import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const isDev = process.env.NODE_ENV !== "production"
const debugErr = (e: any) => ({
  message: e?.message,
  details: e?.details,
  hint: e?.hint,
  code: e?.code,
})

if (!serviceRoleKey || !supabaseUrl) {
  console.error("Supabase env missing. NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Server-side writes will fail.")
}

export async function POST(request: NextRequest) {
  try {
    const {
      phone,
      password,
      fullName,
      userType,
      dateOfBirth,
      gender,
      gymCode,
      referralCode,
      height,
      weight,
      gymName,
    } = await request.json()

    const dob = dateOfBirth ? new Date(dateOfBirth).toISOString().split("T")[0] : null
    // Normalize gender to match DB CHECK constraint: 'Male' | 'Female' | 'Others'
    const normalizedGender = gender
      ? gender.toLowerCase() === "male"
        ? "Male"
        : gender.toLowerCase() === "female"
        ? "Female"
        : gender.toLowerCase() === "others"
        ? "Others"
        : null
      : null
    // Normalize gym code to avoid mismatches
    const normalizedGymCode = typeof gymCode === "string" ? gymCode.toUpperCase().trim() : gymCode

    if (!serviceRoleKey || !supabaseUrl) {
      console.error("Signup blocked: missing Supabase envs")
      return NextResponse.json(
        { error: "Server configuration error: missing Supabase environment variables", ...(isDev ? { debug: { env: { NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey } } } : {}) },
        { status: 500 },
      )
    }

    // Create Supabase client only after env validation to avoid module-scope crashes
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Check if user already exists
    const { data: existingUser, error: existingUserError } = await supabase
      .from("users")
      .select("id")
      .eq("phone_number", phone)
      .single()

    if (existingUserError && existingUserError.code !== "PGRST116") {
      console.error("Error checking existing user:", existingUserError)
    }

    if (existingUser) {
      return NextResponse.json({ error: "User with this phone number already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // For gym owners, check if gym code already exists
    if (userType === "gym_owner") {
      const { data: existingGym, error: existingGymError } = await supabase
        .from("gyms")
        .select("id")
        .eq("gym_code", normalizedGymCode)
        .single()

      if (existingGymError && existingGymError.code !== "PGRST116") {
        console.error("Error checking existing gym:", existingGymError)
      }

      if (existingGym) {
        return NextResponse.json({ error: "Gym code already exists. Please generate a new one." }, { status: 400 })
      }
    }

    // For members, validate gym code exists
    let gymData = null as any
    if (userType === "member") {
      const { data: gym, error: gymError } = await supabase
        .from("gyms")
        .select("id, gym_name, coin_value")
        .eq("gym_code", normalizedGymCode)
        .single()

      if (gymError || !gym) {
        if (gymError) console.error("Gym lookup error:", gymError)
        return NextResponse.json(
          { error: "Invalid gym code. Please check with your gym.", ...(isDev && gymError ? { debug: debugErr(gymError) } : {}) },
          { status: 400 },
        )
      }
      gymData = gym
    }

    // Create user
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        phone_number: phone,
        password_hash: hashedPassword,
        full_name: fullName,
        user_type: userType,
        date_of_birth: dob,
        gender: normalizedGender,
        height: height,
        weight: weight,
      })
      .select()
      .single()

    if (userError) {
      console.error("User insert error:", userError)
      return NextResponse.json(
        { error: "Failed to create user account", ...(isDev ? { debug: debugErr(userError) } : {}) },
        { status: 500 },
      )
    }

    let gymInfo = null as any

    if (userType === "gym_owner") {
      // Create gym for gym owner
      const { data: newGym, error: gymError } = await supabase
        .from("gyms")
        .insert({
          owner_id: newUser.id,
          gym_name: gymName || `${fullName}'s Gym`,
          gym_code: normalizedGymCode,
          coin_value: 4.0,
        })
        .select()
        .single()

      if (gymError) {
        console.error("Gym insert error:", gymError)
        return NextResponse.json(
          { error: "Failed to create gym", ...(isDev ? { debug: debugErr(gymError) } : {}) },
          { status: 500 },
        )
      }

      // Create gym wallet
      const { error: walletError } = await supabase.from("gym_wallets").insert({
        gym_id: newGym.id,
        balance_inr: 0,
      })

      if (walletError) {
        console.error("Gym wallet insert error:", walletError)
      }

      gymInfo = {
        gym_id: newGym.id,
        gym_name: newGym.gym_name,
      }
    } else {
      // Try to find a default active plan for the gym
      const { data: plans, error: plansError } = await supabase
        .from("gym_plans")
        .select("id")
        .eq("gym_id", gymData.id)
        .eq("is_active", true)
        .order("price_inr", { ascending: true })

      if (plansError) {
        console.error("Plan lookup error:", plansError)
      }

      const defaultPlanId = Array.isArray(plans) && plans.length > 0 ? plans[0].id : null

      if (defaultPlanId) {
        // Create membership for member with a valid plan
        const { error: membershipError } = await supabase.from("memberships").insert({
          user_id: newUser.id,
          gym_id: gymData.id,
          plan_id: defaultPlanId,
          start_date: new Date().toISOString().split("T")[0],
          expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          payment_status: "pending",
          is_active: true,
        })

        if (membershipError) {
          console.error("Membership insert error:", membershipError)
          return NextResponse.json(
            { error: "Failed to create membership", ...(isDev ? { debug: debugErr(membershipError) } : {}) },
            { status: 500 },
          )
        }
      } else {
        console.warn(`No active plans found for gym ${gymData.id}. Skipping membership creation for user ${newUser.id}.`)
      }

      gymInfo = {
        gym_id: gymData.id,
        gym_name: gymData.gym_name,
      }

      // Handle referral if provided
      if (referralCode) {
        const { data: referrer, error: referrerError } = await supabase
          .from("users")
          .select("id")
          .eq("phone_number", referralCode)
          .eq("user_type", "member")
          .single()

        if (referrerError && referrerError.code !== "PGRST116") {
          console.error("Referrer lookup error:", referrerError)
        }

        if (referrer) {
          const { error: referralInsertError } = await supabase.from("referrals").insert({
            referrer_id: referrer.id,
            referred_id: newUser.id,
            gym_id: gymData.id,
            referral_code: referralCode,
            coins_awarded: 50,
          })
          if (referralInsertError) console.error("Referral insert error:", referralInsertError)

          const { error: coinTxError } = await supabase.from("coin_transactions").insert({
            user_id: referrer.id,
            gym_id: gymData.id,
            transaction_type: "earned",
            amount: 50,
            description: "Referral bonus",
          })
          if (coinTxError) console.error("Coin transaction insert error:", coinTxError)
        }
      }
    }

    const userData = {
      id: newUser.id,
      phone_number: newUser.phone_number,
      full_name: newUser.full_name,
      user_type: newUser.user_type,
      ...gymInfo,
    }

    return NextResponse.json({
      success: true,
      user: userData,
    })
  } catch (error: any) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred", ...(isDev ? { debug: { message: error?.message } } : {}) },
      { status: 500 },
    )
  }
}
