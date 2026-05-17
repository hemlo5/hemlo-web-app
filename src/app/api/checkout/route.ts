import { NextRequest, NextResponse } from "next/server"
import DodoPayments from "dodopayments"
import { createClient } from "@/utils/supabase/server"

function cleanEnv(value: string | undefined) {
  const trimmed = (value ?? "").trim()
  return trimmed.replace(/^["']|["']$/g, "")
}

type DodoErrorLike = {
  status?: number
  response?: { status?: number; data?: { message?: string } }
  error?: { message?: string }
  message?: string
  code?: string
  request_id?: string
  requestID?: string
}

function toDodoError(err: unknown): DodoErrorLike {
  if (typeof err === "object" && err !== null) return err as DodoErrorLike
  return { message: String(err) }
}

function getDodoErrorMessage(err: unknown, plan: string) {
  const detail = toDodoError(err)
  const status = Number(detail.status ?? detail.response?.status ?? 0)
  const rawMessage = String(
    detail.error?.message ??
      detail.message ??
      detail.response?.data?.message ??
      "Dodo checkout request failed"
  )

  if (status === 401 || status === 403) {
    return "Dodo rejected the API key or environment. Check DODO_API_KEY and DODO_ENVIRONMENT."
  }
  if (status === 404 || (status === 422 && rawMessage.toLowerCase().includes("product"))) {
    return `Dodo product for '${plan}' was not found. Check the matching DODO_PRODUCT_ID_${plan.toUpperCase()} value.`
  }
  if (status === 400) {
    return `Dodo rejected the checkout request: ${rawMessage}`
  }
  return "Failed to create checkout session"
}

export async function OPTIONS() {
  return NextResponse.json({})
}

export async function POST(req: NextRequest) {
  const dodoApiKey = cleanEnv(process.env.DODO_API_KEY)
  const rawDodoEnvironment = cleanEnv(process.env.DODO_ENVIRONMENT)
  const dodoEnvironment = rawDodoEnvironment === "live_mode" ? "live_mode" : "test_mode"
  let requestedPlan = "pro"

  try {
    if (!dodoApiKey) {
      return NextResponse.json({ error: "DODO_API_KEY is not configured." }, { status: 500 })
    }
    if (!rawDodoEnvironment) {
      return NextResponse.json({ error: "DODO_ENVIRONMENT is not configured. Use live_mode or test_mode." }, { status: 500 })
    }
    if (rawDodoEnvironment !== "live_mode" && rawDodoEnvironment !== "test_mode") {
      return NextResponse.json({ error: "DODO_ENVIRONMENT must be live_mode or test_mode." }, { status: 500 })
    }

    const dodo = new DodoPayments({
      bearerToken: dodoApiKey,
      environment: dodoEnvironment,
    })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Sign in before starting checkout" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    requestedPlan = typeof body?.plan === "string" ? body.plan : "pro"
    const productByPlan: Record<string, string | undefined> = {
      starter: cleanEnv(process.env.DODO_PRODUCT_ID_STARTER),
      pro: cleanEnv(process.env.DODO_PRODUCT_ID_PRO) || cleanEnv(process.env.DODO_PRODUCT_ID),
      founder: cleanEnv(process.env.DODO_PRODUCT_ID_FOUNDER),
    }
    const productId = productByPlan[requestedPlan]

    if (!Object.prototype.hasOwnProperty.call(productByPlan, requestedPlan)) {
      return NextResponse.json({ error: "Unknown checkout plan" }, { status: 400 })
    }

    if (!productId) {
      return NextResponse.json(
        { error: `Dodo Product ID for plan '${requestedPlan}' is not configured in environment variables.` },
        { status: 500 }
      )
    }

    // Derive origin dynamically from request headers so it works on any domain
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const host = forwardedHost || req.headers.get("host")
    const protocol = forwardedProto || (host?.includes("localhost") ? "http" : "https")
    const origin = `${protocol}://${host}`

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email: user.email,
      },
      // CRITICAL: We store the Supabase user_id here so the webhook can find the user.
      metadata: {
        user_id: user.id,
        plan: requestedPlan,
      },
      // return_url = where Dodo sends user after they view the order summary and click continue
      // cancel_url = where Dodo sends user if they click back/cancel
      return_url: `${origin}/payment-success`,
      cancel_url: `${origin}/profile`,
    })

    return NextResponse.json({ checkoutUrl: session.checkout_url })
  } catch (err: unknown) {
    const detail = toDodoError(err)
    console.error("[/api/checkout] Error:", {
      message: detail.message ?? String(err),
      status: detail.status ?? detail.response?.status,
      code: detail.code,
      requestID: detail.request_id ?? detail.requestID,
      plan: requestedPlan,
      dodoEnvironment,
    })
    return NextResponse.json(
      { error: getDodoErrorMessage(err, requestedPlan) },
      { status: Number(detail.status ?? detail.response?.status ?? 500) || 500 }
    )
  }
}
