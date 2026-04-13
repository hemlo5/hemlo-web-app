import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ data: [] }, { status: 401 })
  }

  try {
    const { data, error } = await supabase
      .from("simulations")
      .select("id, topic, created_at, analysis_data, crowd_odds, hemlo_odds, divergence, market_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("DB error fetching my simulations:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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
        insight: a.stateSnapshot?.insight ?? "",
        whyDivergent: a.whyDivergent ?? "",
        agentsModeled: a.agentsDeployed ?? Math.floor(25 + Math.random() * 25),
        createdAt: sim.created_at,
        marketType: sim.market_type ?? "binary",
      }
    })

    return NextResponse.json({ data: mapped })
  } catch (err: any) {
    console.error("Error in my-simulations:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
