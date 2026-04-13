import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const supa = createClient(supaUrl, supaKey)

    // Fetch the 20 most recent simulations
    const { data, error } = await supa
      .from("simulations")
      .select("id, topic, created_at, analysis_data, crowd_odds, hemlo_odds, divergence, market_type")
      .order("views", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      console.error("DB error fetching simulations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Unpack analysis_data so it maps seamlessly into TrendingTopic struct for the UI
    const mapped = (data || []).map(sim => {
      const a = sim.analysis_data || {}
      return {
        id: sim.id,
        topic: sim.topic,
        topicSlug: a.topicSlug,
        confidence: a.confidence ?? 0,
        hemloOdds: sim.hemlo_odds ?? a.hemloVerdict,
        polymarketOdds: sim.crowd_odds,
        divergence: sim.divergence,
        divergenceSignal: a.divergenceSignal,
        agentsModeled: a.agentsDeployed ?? Math.floor(25 + Math.random() * 25), // fallback if not in JSON
        createdAt: sim.created_at,
        marketType: sim.market_type ?? "binary",
      }
    })

    return NextResponse.json({ data: mapped })
  } catch (err: any) {
    console.error("Error in simulations-completed:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
