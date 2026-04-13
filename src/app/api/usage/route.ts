import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const isoToday = startOfDay.toISOString()

  const [
    { count: mktToday },
    { count: customToday },
    { count: mktTotal },
    { count: customTotal },
    { data: profileData },
  ] = await Promise.all([
    supabase.from("simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", isoToday),
    supabase.from("custom_simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", isoToday),
    supabase.from("simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("custom_simulations").select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase.from("profiles").select("tier").eq("id", user.id).single(),
  ])

  const tier = profileData?.tier || "normal"
  const limit = tier === "premium" ? 10 : 2
  const usageToday = (mktToday ?? 0) + (customToday ?? 0)
  const totalSims = (mktTotal ?? 0) + (customTotal ?? 0)

  return NextResponse.json({ usageToday, totalSims, limit, tier })
}
