import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { createClient as createServerSupabase } from "@/utils/supabase/server"
import { getSimulationPlan, sanitizeSimulationParameters } from "@/lib/simulation-usage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const SIGNED_MODAL_KEYS = [
  "question",
  "sim_id",
  "reality_seed",
  "agent_count",
  "rounds",
  "domain",
  "market_options",
  "market_type",
  "test_mode",
  "fast_mode",
] as const

function signaturePayload(params: URLSearchParams, expires: string) {
  return [
    ...SIGNED_MODAL_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`),
    `expires=${expires}`,
  ].join("\n")
}

function signParams(params: URLSearchParams) {
  const secret = process.env.MODAL_RUN_SECRET
  if (!secret) throw new Error("MODAL_RUN_SECRET is not configured")

  const expires = String(Math.floor(Date.now() / 1000) + 15 * 60)
  const signature = createHmac("sha256", secret)
    .update(signaturePayload(params, expires))
    .digest("hex")

  params.set("expires", expires)
  params.set("sig", signature)
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const authClient = await createServerSupabase()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sign in before running a simulation" }, { status: 401 })
  }

  const incoming = new URL(req.url).searchParams
  const simId = incoming.get("sim_id")
  const wantsSignedUrl = incoming.get("transport") === "url"
  if (!simId) {
    return NextResponse.json({ error: "sim_id is required" }, { status: 400 })
  }

  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "Supabase service role is not configured" }, { status: 500 })
  }

  const { data: simulation, error } = await admin
    .from("custom_simulations")
    .select("id, user_id, status")
    .eq("id", simId)
    .maybeSingle()

  if (error) {
    console.error("[mirofish-run] DB check failed:", error)
    return NextResponse.json({ error: "Could not verify simulation ownership" }, { status: 500 })
  }

  if (!simulation || simulation.user_id !== user.id) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 })
  }

  if (simulation.status && String(simulation.status) !== "pending") {
    return NextResponse.json({ error: "This simulation record is already running or finished and cannot be relaunched." }, { status: 409 })
  }

  const plan = await getSimulationPlan(user.id)
  if (plan.usage > plan.limit) {
    const periodLabel = plan.window === "month" ? "this month" : "total"
    return NextResponse.json(
      { error: `${plan.usage}/${plan.limit} simulations used ${periodLabel} on your ${plan.label} plan.` },
      { status: 429 }
    )
  }

  const safeParams = sanitizeSimulationParameters(
    plan,
    incoming.get("agent_count"),
    incoming.get("rounds"),
  )

  const modalUrl = process.env.MIROFISH_MODAL_URL || process.env.NEXT_PUBLIC_MODAL_URL
  if (!modalUrl) {
    return NextResponse.json({ error: "MIROFISH_MODAL_URL is not configured" }, { status: 500 })
  }

  const upstreamParams = new URLSearchParams()
  upstreamParams.set("question", incoming.get("question") || "")
  upstreamParams.set("sim_id", simId)
  // Keep the signed Modal URL small. The full seed is already stored on
  // custom_simulations and Modal fetches it by sim_id.
  upstreamParams.set("reality_seed", "")
  upstreamParams.set("agent_count", String(safeParams.agentCount))
  upstreamParams.set("rounds", String(safeParams.rounds))
  upstreamParams.set("domain", incoming.get("domain") || "custom")
  upstreamParams.set("market_options", incoming.get("market_options") || "")
  upstreamParams.set("market_type", incoming.get("market_type") || "")
  upstreamParams.set("test_mode", "")
  upstreamParams.set("fast_mode", plan.advancedParams ? incoming.get("fast_mode") || "" : "")

  try {
    signParams(upstreamParams)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[mirofish-run] signing failed:", message)
    return NextResponse.json({ error: "Modal request signing is not configured" }, { status: 500 })
  }

  const upstreamUrl = new URL(modalUrl)
  upstreamParams.forEach((value, key) => upstreamUrl.searchParams.set(key, value))
  upstreamUrl.searchParams.set("via", "hemlo-next-proxy")

  console.info("[mirofish-run] forwarding signed Modal stream", {
    simId,
    modalHost: upstreamUrl.host,
    modalPath: upstreamUrl.pathname,
    hasExpires: upstreamUrl.searchParams.has("expires"),
    expires: upstreamUrl.searchParams.get("expires"),
    hasSig: upstreamUrl.searchParams.has("sig"),
    questionChars: upstreamParams.get("question")?.length ?? 0,
    seedParamChars: upstreamParams.get("reality_seed")?.length ?? 0,
    marketOptionsChars: upstreamParams.get("market_options")?.length ?? 0,
    urlChars: upstreamUrl.toString().length,
  })

  await admin
    .from("custom_simulations")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", simId)
    .eq("user_id", user.id)

  if (wantsSignedUrl) {
    return NextResponse.json(
      {
        url: upstreamUrl.toString(),
        expires: upstreamUrl.searchParams.get("expires"),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  }

  // Do not proxy the SSE body through Railway/Next. Long-running server-side
  // proxy streams can be closed by platform/network timeouts even while Modal
  // keeps running. A short-lived signed redirect keeps auth and plan checks here
  // but lets the browser stream directly from Modal.
  const redirect = NextResponse.redirect(upstreamUrl, 307)
  redirect.headers.set("Cache-Control", "no-store")
  return redirect
}
