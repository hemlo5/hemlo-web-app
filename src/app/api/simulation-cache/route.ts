import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topic = searchParams.get("topic")

  if (!topic) {
    return NextResponse.json({ error: "Missing topic" }, { status: 400 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const supa = createClient(supaUrl, supaKey)

    // Find the latest simulation for this exact topic
    const { data, error } = await supa
      .from("simulations")
      .select("id, analysis_data, created_at")
      .eq("topic", topic)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      return NextResponse.json({ cached: null }, { status: 200 })
    }

    return NextResponse.json({
      cached: data[0].analysis_data,
      simId: data[0].id,
      createdAt: data[0].created_at,
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
