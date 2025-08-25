import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey || !supabaseUrl) {
  console.error("Supabase env missing. Server-side operations will fail.")
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c * 1000 // Convert to meters
}

export async function POST(request: NextRequest) {
  try {
    const { userId, gymId, latitude, longitude, checkInType } = await request.json()

    // Validate required fields
    if (!userId || !gymId) {
      return NextResponse.json(
        { error: "User ID and Gym ID are required" },
        { status: 400 }
      )
    }

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Get gym location for geofencing validation
    const { data: gymData, error: gymError } = await supabase
      .from("gyms")
      .select("location_latitude, location_longitude")
      .eq("id", gymId)
      .single()

    if (gymError || !gymData) {
      return NextResponse.json(
        { error: "Gym not found" },
        { status: 404 }
      )
    }

    // Validate geofencing if coordinates provided
    if (latitude && longitude) {
      const distanceFromGym = calculateDistance(
        latitude,
        longitude,
        gymData.location_latitude,
        gymData.location_longitude
      )

      if (distanceFromGym > 15) {
        return NextResponse.json(
          { 
            error: "Location validation failed",
            message: "You must be within 15 meters of the gym to check in",
            distanceFromGym: Math.round(distanceFromGym)
          },
          { status: 400 }
        )
      }
    }

    // Check 20-minute presence requirement
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: locationHistory, error: historyError } = await supabase
      .from("location_history")
      .select("*")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .gte("recorded_at", thirtyMinutesAgo)
      .order("recorded_at", { ascending: true })

    if (historyError) {
      console.error("Location history fetch error:", historyError)
      return NextResponse.json(
        { error: "Failed to validate presence duration" },
        { status: 500 }
      )
    }

    // Calculate continuous presence within geofence
    let continuousPresenceDuration = 0
    let currentStreak = 0
    let lastRecordTime: Date | null = null

    for (const record of locationHistory || []) {
      const recordTime = new Date(record.recorded_at)
      
      if (record.is_within_geofence) {
        if (lastRecordTime) {
          const timeDiff = recordTime.getTime() - lastRecordTime.getTime()
          // If gap is less than 2 minutes, consider it continuous
          if (timeDiff <= 2 * 60 * 1000) {
            currentStreak += timeDiff
          } else {
            // Reset streak if gap is too large
            currentStreak = 0
          }
        }
        lastRecordTime = recordTime
      } else {
        // Outside geofence, reset streak
        continuousPresenceDuration = Math.max(continuousPresenceDuration, currentStreak)
        currentStreak = 0
        lastRecordTime = null
      }
    }

    // Final check
    continuousPresenceDuration = Math.max(continuousPresenceDuration, currentStreak)
    const continuousMinutes = Math.floor(continuousPresenceDuration / (60 * 1000))

    if (continuousMinutes < 20) {
      return NextResponse.json(
        { 
          error: "Minimum presence requirement not met",
          message: `You need to stay within the gym area for at least 20 minutes. Current: ${continuousMinutes} minutes`,
          continuousMinutes
        },
        { status: 400 }
      )
    }

    // Start transaction by checking for existing check-in today
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

    const { data: existingCheckIn, error: checkError } = await supabase
      .from("check_ins")
      .select("id, check_in_time")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .gte("check_in_time", startOfDay.toISOString())
      .lt("check_in_time", endOfDay.toISOString())
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing check-in:", checkError)
      return NextResponse.json(
        { error: "Database error occurred" },
        { status: 500 }
      )
    }

    if (existingCheckIn) {
      return NextResponse.json(
        {
          success: false,
          message: "Already checked in today! 🎉",
          description: "Come back tomorrow for your next check-in.",
          checkInTime: existingCheckIn.check_in_time
        },
        { status: 409 }
      )
    }

    // Validate user membership
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .eq("status", "active")
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Active membership not found" },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()
    const coinsEarned = 100

    // Atomic transaction: Insert check-in and coin transaction
    const { data: checkInData, error: insertError } = await supabase
      .from("check_ins")
      .insert({
        user_id: userId,
        gym_id: gymId,
        check_in_time: now,
        latitude: latitude || null,
        longitude: longitude || null,
        coins_earned: coinsEarned,
        check_in_type: checkInType || 'gps',
        presence_duration_minutes: continuousMinutes
      })
      .select()
      .single()

    if (insertError) {
      console.error("Check-in insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to record check-in" },
        { status: 500 }
      )
    }

    // Award coins
    const { error: coinError } = await supabase
      .from("coin_transactions")
      .insert({
        user_id: userId,
        gym_id: gymId,
        transaction_type: "earned",
        amount: coinsEarned,
        description: `${checkInType === 'manual' ? 'Manual' : checkInType === 'automatic' ? 'Automatic' : 'GPS'} check-in reward (${continuousMinutes}min presence)`,
        reference_id: checkInData.id
      })

    if (coinError) {
      console.error("Coin transaction error:", coinError)
      // Rollback check-in if coin transaction fails
      await supabase
        .from("check_ins")
        .delete()
        .eq("id", checkInData.id)
      
      return NextResponse.json(
        { error: "Failed to award coins" },
        { status: 500 }
      )
    }

    // Get updated user stats
    const { data: userStats } = await supabase
      .from("coin_transactions")
      .select("amount")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .eq("transaction_type", "earned")

    const totalCoins = userStats?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0

    // Calculate streak and monthly visits
    const { data: recentCheckIns } = await supabase
      .from("check_ins")
      .select("check_in_time")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .order("check_in_time", { ascending: false })
      .limit(30)

    let streak = 1
    if (recentCheckIns && recentCheckIns.length > 1) {
      const checkInDates = recentCheckIns.map(ci => new Date(ci.check_in_time).toDateString())
      const uniqueDates = [...new Set(checkInDates)]
      
      for (let i = 1; i < uniqueDates.length; i++) {
        const currentDate = new Date(uniqueDates[i])
        const previousDate = new Date(uniqueDates[i-1])
        const dayDiff = Math.floor((previousDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (dayDiff === 1) {
          streak++
        } else {
          break
        }
      }
    }

    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    const monthlyVisits = recentCheckIns?.filter(ci => {
      const checkInDate = new Date(ci.check_in_time)
      return checkInDate.getMonth() === currentMonth && checkInDate.getFullYear() === currentYear
    }).length || 1

    return NextResponse.json({
      success: true,
      message: "Check-in successful! 🎉",
      description: `You earned ${coinsEarned} coins for today's workout! (${continuousMinutes} minutes presence)`,
      data: {
        checkInId: checkInData.id,
        checkInTime: now,
        coinsEarned,
        totalCoins,
        streak,
        monthlyVisits,
        presenceDuration: continuousMinutes
      }
    })

  } catch (error: any) {
    console.error("Check-in API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}