import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase/client"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")?.toUpperCase().trim()

    if (!code) {
      return NextResponse.json({ data: null, error: "Missing 'code' query parameter" }, { status: 400 })
    }

    const { data, error } = await supabase.from("gyms").select("id").eq("gym_code", code)

    if (error) {
      return NextResponse.json({ data: null, error: "Failed to check gym code" }, { status: 500 })
    }

    const existingGym = Array.isArray(data) && data.length > 0 ? data[0] : null
    return NextResponse.json({ data: existingGym })
  } catch (err) {
    return NextResponse.json({ data: null, error: "Unexpected error" }, { status: 500 })
  }
}