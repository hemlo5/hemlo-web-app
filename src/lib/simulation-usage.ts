import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"

export type UsageWindow = "month" | "total"

export type SimulationPlan = {
  tier: string
  label: string
  limit: number
  usage: number
  window: UsageWindow
  maxAgents: number
  maxRounds: number
  advancedParams: boolean
}

type PlanRule = Omit<SimulationPlan, "tier" | "usage">

const STANDARD_AGENTS = 15
const STANDARD_ROUNDS = 5

// Source of truth for billing gates. Free/Pro/Founder reset monthly.
// Starter is a one-time total pack.
const PLAN_RULES: Record<string, PlanRule> = {
  free: {
    label: "Free",
    limit: 2,
    window: "month",
    maxAgents: STANDARD_AGENTS,
    maxRounds: STANDARD_ROUNDS,
    advancedParams: false,
  },
  normal: {
    label: "Free",
    limit: 2,
    window: "month",
    maxAgents: STANDARD_AGENTS,
    maxRounds: STANDARD_ROUNDS,
    advancedParams: false,
  },
  starter: {
    label: "Starter",
    limit: 5,
    window: "total",
    maxAgents: STANDARD_AGENTS,
    maxRounds: STANDARD_ROUNDS,
    advancedParams: false,
  },
  pro: {
    label: "Pro",
    limit: 55,
    window: "month",
    maxAgents: 250,
    maxRounds: 15,
    advancedParams: true,
  },
  premium: {
    label: "Pro",
    limit: 55,
    window: "month",
    maxAgents: 250,
    maxRounds: 15,
    advancedParams: true,
  },
  founder: {
    label: "Founder",
    limit: 200,
    window: "month",
    maxAgents: 500,
    maxRounds: 24,
    advancedParams: true,
  },
}

function getSupaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

function normalizeTier(profile: { tier?: string | null; has_starter_pack?: boolean | null } | null | undefined) {
  const rawTier = String(profile?.tier || "normal").toLowerCase()
  const tier = PLAN_RULES[rawTier] ? rawTier : "normal"
  const hasStarterPack = profile?.has_starter_pack === true

  if (hasStarterPack && (tier === "normal" || tier === "free")) {
    return "starter"
  }

  return tier
}

function currentWindowStartIso(window: UsageWindow) {
  if (window === "total") return null

  const start = new Date()
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  return start.toISOString()
}

async function countUsage(
  supa: NonNullable<ReturnType<typeof getSupaAdmin>>,
  userId: string,
  window: UsageWindow,
) {
  const windowStart = currentWindowStartIso(window)

  let marketQuery = supa
    .from("simulations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
  let customQuery = supa
    .from("custom_simulations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  if (windowStart) {
    marketQuery = marketQuery.gte("created_at", windowStart)
    customQuery = customQuery.gte("created_at", windowStart)
  }

  const [{ count: marketCount }, { count: customCount }] = await Promise.all([
    marketQuery,
    customQuery,
  ])

  return (marketCount ?? 0) + (customCount ?? 0)
}

export function sanitizeSimulationParameters(
  plan: Pick<SimulationPlan, "maxAgents" | "maxRounds" | "advancedParams">,
  agentCount: unknown,
  rounds: unknown,
) {
  const requestedAgents = Number(agentCount)
  const requestedRounds = Number(rounds)
  const fallbackAgents = Math.min(STANDARD_AGENTS, plan.maxAgents)
  const fallbackRounds = Math.min(STANDARD_ROUNDS, plan.maxRounds)

  return {
    agentCount: Math.max(
      1,
      Math.min(plan.maxAgents, Number.isFinite(requestedAgents) ? Math.round(requestedAgents) : fallbackAgents),
    ),
    rounds: Math.max(
      1,
      Math.min(plan.maxRounds, Number.isFinite(requestedRounds) ? Math.round(requestedRounds) : fallbackRounds),
    ),
  }
}

export async function getSimulationPlan(userId: string): Promise<SimulationPlan> {
  const supa = getSupaAdmin()
  if (!supa) {
    return { tier: "normal", usage: 0, ...PLAN_RULES.normal }
  }

  const { data: profile, error } = await supa
    .from("profiles")
    .select("tier, has_starter_pack")
    .eq("id", userId)
    .single()

  if (error) {
    console.error("[getSimulationPlan] Failed to fetch profile:", error.message)
  }

  const tier = normalizeTier(profile)
  const rule = PLAN_RULES[tier] ?? PLAN_RULES.normal
  const usage = await countUsage(supa, userId, rule.window)

  return { tier, usage, ...rule }
}

export async function checkSimulationLimit(userId: string): Promise<{
  allowed: boolean
  reason?: string
  usageToday?: number
  usage?: number
  limit?: number
  tier?: string
  label?: string
  window?: UsageWindow
  maxAgents?: number
  maxRounds?: number
  advancedParams?: boolean
}> {
  const plan = await getSimulationPlan(userId)
  const periodLabel = plan.window === "month" ? "this month" : "total"

  if (plan.usage >= plan.limit) {
    return {
      allowed: false,
      reason: plan.tier === "normal" || plan.tier === "free"
        ? `__FREE_LIMIT_REACHED__:You've used ${plan.usage}/${plan.limit} free simulations ${periodLabel}. Upgrade to Pro for 55/month.`
        : `__PAID_LIMIT_REACHED__:${plan.usage}/${plan.limit} simulations used ${periodLabel} on your ${plan.label} plan.`,
      usageToday: plan.usage,
      usage: plan.usage,
      limit: plan.limit,
      tier: plan.tier,
      label: plan.label,
      window: plan.window,
      maxAgents: plan.maxAgents,
      maxRounds: plan.maxRounds,
      advancedParams: plan.advancedParams,
    }
  }

  return {
    allowed: true,
    usageToday: plan.usage,
    usage: plan.usage,
    limit: plan.limit,
    tier: plan.tier,
    label: plan.label,
    window: plan.window,
    maxAgents: plan.maxAgents,
    maxRounds: plan.maxRounds,
    advancedParams: plan.advancedParams,
  }
}

export async function incrementSimulationCount(userId: string): Promise<void> {
  const supa = getSupaAdmin()
  if (!supa) return

  const today = new Date().toISOString().split("T")[0]

  const { error } = await supa.rpc("increment_sim_count", { p_user_id: userId })

  if (error) {
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
