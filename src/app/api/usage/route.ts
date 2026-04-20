import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { checkSimulationLimit } from "@/lib/simulation-usage"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get current usage from the centralized tracker
  const { usageToday = 0, limit = 2 } = await checkSimulationLimit(user.id)

  const [
    { count: mktTotal },
    { count: customTotal },
    { data: profileData },
  ] = await Promise.all([
    supabase.from("simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("custom_simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("profiles").select("tier").eq("id", user.id).single(),
  ])

  const tier = profileData?.tier || "normal"
  const totalSims = (mktTotal ?? 0) + (customTotal ?? 0)

  return NextResponse.json({ usageToday, totalSims, limit, tier })
}
