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
    const { userId, gymId, latitude, longitude } = await request.json()

    if (!userId || !gymId || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Get gym location
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

    // Calculate distance from gym
    const distanceFromGym = calculateDistance(
      latitude,
      longitude,
      gymData.location_latitude,
      gymData.location_longitude
    )

    const isWithinGeofence = distanceFromGym <= 15 // 15 meter radius
    const now = new Date().toISOString()

    // Store location history
    const { error: insertError } = await supabase
      .from("location_history")
      .insert({
        user_id: userId,
        gym_id: gymId,
        latitude,
        longitude,
        distance_from_gym: distanceFromGym,
        is_within_geofence: isWithinGeofence,
        recorded_at: now
      })

    if (insertError) {
      console.error("Location history insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to record location" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      distanceFromGym,
      isWithinGeofence,
      recordedAt: now
    })

  } catch (error: any) {
    console.error("Location tracking API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// GET endpoint to check presence duration
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const gymId = searchParams.get('gymId')

    if (!userId || !gymId) {
      return NextResponse.json(
        { error: "Missing userId or gymId" },
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

    // Get location history for the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    const { data: locationHistory, error } = await supabase
      .from("location_history")
      .select("*")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .gte("recorded_at", thirtyMinutesAgo)
      .order("recorded_at", { ascending: true })

    if (error) {
      console.error("Location history fetch error:", error)
      return NextResponse.json(
        { error: "Failed to fetch location history" },
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
    const hasMinimumPresence = continuousMinutes >= 20
    const isCurrentlyWithinGeofence = locationHistory && locationHistory.length > 0 ? 
      locationHistory[locationHistory.length - 1].is_within_geofence : false

    return NextResponse.json({
      success: true,
      continuousPresenceMinutes: continuousMinutes,
      hasMinimumPresence,
      isCurrentlyWithinGeofence,
      totalRecords: locationHistory?.length || 0
    })

  } catch (error: any) {
    console.error("Location presence check API error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}