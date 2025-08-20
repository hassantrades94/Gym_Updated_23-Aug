import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase/client"

export async function POST(request: NextRequest) {
  try {
    const { phone, password, userType } = await request.json()

    const { data: user, error } = await supabase
      .from("users")
      .select(`
        id,
        phone_number,
        password_hash,
        full_name,
        user_type,
        memberships (
          gym_id,
          gyms (
            id,
            gym_name
          )
        ),
        gyms (
          id,
          gym_name
        )
      `)
      .eq("phone_number", phone)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    if (user.user_type !== userType) {
      const correctDashboard = user.user_type === "member" ? "Member" : "Gym Owner"
      return NextResponse.json(
        {
          error: "Access Denied",
          message: `You are registered as a ${correctDashboard}. Please select the correct login type.`,
        },
        { status: 403 },
      )
    }

    let gymInfo = null
    if (user.user_type === "member" && user.memberships?.[0]?.gyms) {
      const membership = user.memberships?.[0]
      const gymsRelation = membership?.gyms as any
      const gymObj = Array.isArray(gymsRelation) ? gymsRelation[0] : gymsRelation
      gymInfo = {
        gym_id: gymObj?.id,
        gym_name: gymObj?.gym_name,
      }
    } else if (user.user_type === "gym_owner" && user.gyms?.[0]) {
      gymInfo = {
        gym_id: user.gyms[0].id,
        gym_name: user.gyms[0].gym_name,
      }
    }

    const userData = {
      id: user.id,
      phone_number: user.phone_number,
      full_name: user.full_name,
      user_type: user.user_type,
      ...gymInfo,
    }

    const isDefaultPassword = password === "123456"

    return NextResponse.json({
      success: true,
      user: userData,
      isDefaultPassword,
    })
  } catch (error) {
    console.error("Sign in error:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
