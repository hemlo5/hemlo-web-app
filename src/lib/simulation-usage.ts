import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

const DAILY_LIMITS: Record<string, number> = {
  normal: 2,
  premium: 10,
}

function getSupaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseAdmin(url, key)
}

/**
 * Check if user has hit their daily limit.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export async function checkSimulationLimit(userId: string): Promise<{ allowed: boolean; reason?: string; usageToday?: number; limit?: number }> {
  const supa = getSupaAdmin()
  if (!supa) return { allowed: false, reason: "Database not configured" }

  // Get tier
  const { data: profile } = await supa
    .from("profiles")
    .select("tier, simulations_today, last_sim_date")
    .eq("id", userId)
    .single()

  const tier = profile?.tier || "normal"
  const limit = DAILY_LIMITS[tier] ?? 2

  // Compute today's usage from the simulations tables (source of truth)
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const isoToday = startOfDay.toISOString()

  const [{ count: mktCount }, { count: customCount }] = await Promise.all([
    supa.from("simulations").select("*", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", isoToday),
    supa.from("custom_simulations").select("*", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", isoToday),
  ])

  const usageToday = (mktCount ?? 0) + (customCount ?? 0)

  if (usageToday >= limit) {
    return {
      allowed: false,
      reason: tier === "normal"
        ? `Daily limit reached (${limit}/day on Free plan). Upgrade to Premium for 10 simulations per day.`
        : `Daily limit reached (${limit}/day). Your premium limit resets at midnight UTC.`,
      usageToday,
      limit,
    }
  }

  return { allowed: true, usageToday, limit }
}

/**
 * Increment lifetime simulation counter in profiles table.
 * Call this AFTER a successful simulation completes.
 */
export async function incrementSimulationCount(userId: string): Promise<void> {
  const supa = getSupaAdmin()
  if (!supa) return

  const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD

  // Upsert: increment lifetime counter
  // Also update last_sim_date for audit
  const { error } = await supa.rpc("increment_sim_count", { p_user_id: userId })

  if (error) {
    // Fallback: manual read-increment-write if RPC doesn't exist
    const { data: profile } = await supa
      .from("profiles")
      .select("simulations_run")
      .eq("id", userId)
      .single()

    const current = profile?.simulations_run ?? 0
    await supa
      .from("profiles")
      .update({
        simulations_run: current + 1,
        last_sim_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)
  }
}
