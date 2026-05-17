import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { getSimulationPlan } from "@/lib/simulation-usage"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const plan = await getSimulationPlan(user.id)

  const [
    { count: mktTotal },
    { count: customTotal },
  ] = await Promise.all([
    supabase.from("simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("custom_simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ])

  const totalSims = (mktTotal ?? 0) + (customTotal ?? 0)

  return NextResponse.json({
    usageToday: plan.usage,
    usage: plan.usage,
    totalSims,
    limit: plan.limit,
    tier: plan.tier,
    label: plan.label,
    window: plan.window,
    maxAgents: plan.maxAgents,
    maxRounds: plan.maxRounds,
    advancedParams: plan.advancedParams,
  })
}
