import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id    = searchParams.get("id")
  const topic = searchParams.get("topic")

  if (!id && !topic) {
    return NextResponse.json({ error: "Missing id or topic" }, { status: 400 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ error: "No DB" }, { status: 500 })

  try {
    const supa = createClient(supaUrl, supaKey)

    let query = supa
      .from("simulations")
      .select("id, topic, crowd_odds, hemlo_odds, divergence, analysis_data, market_type, outcomes, section, created_at")
      .order("created_at", { ascending: false })
      .limit(1)

    if (id) {
      query = query.eq("id", id)
    } else {
      query = query.eq("topic", topic!)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      return NextResponse.json({ simulation: null }, { status: 200 })
    }

    return NextResponse.json({ simulation: data[0] }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
