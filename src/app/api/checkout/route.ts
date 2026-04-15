import { NextRequest, NextResponse } from "next/server"
import DodoPayments from "dodopayments"

export async function POST(req: NextRequest) {
  // Initialize inside the handler so missing env vars surface as a 500, not a module crash
  const dodo = new DodoPayments({
    bearerToken: process.env.DODO_API_KEY ?? (() => { throw new Error("DODO_API_KEY is not set") })(),
    environment: (process.env.DODO_ENVIRONMENT as "test_mode" | "live_mode") ?? "test_mode",
  })

  try {
    const { user_id, email, plan = "pro" } = await req.json()

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "user_id and email are required" },
        { status: 400 }
      )
    }

    // Map the plan request to specific Dodo Product IDs
    let productId = process.env.DODO_PRODUCT_ID // fallback default
    if (plan === "starter") productId = process.env.DODO_PRODUCT_ID_STARTER
    if (plan === "pro") productId = process.env.DODO_PRODUCT_ID_PRO || process.env.DODO_PRODUCT_ID
    if (plan === "founder") productId = process.env.DODO_PRODUCT_ID_FOUNDER

    if (!productId) {
      return NextResponse.json(
        { error: `Dodo Product ID for plan '${plan}' is not configured in environment variables.` },
        { status: 500 }
      )
    }

    // Derive origin dynamically from request headers so it works on any domain
    const host = req.headers.get("host")
    const protocol = host?.includes("localhost") ? "http" : "https"
    const origin = `${protocol}://${host}`

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email,
      },
      // CRITICAL: We store the Supabase user_id here so the webhook can find the user.
      metadata: {
        user_id,
        plan,
      },
      // return_url = where Dodo sends user after they view the order summary and click continue
      // cancel_url = where Dodo sends user if they click back/cancel
      return_url: `${origin}/payment-success`,
      cancel_url: `${origin}/profile`,
    })

    return NextResponse.json({ checkoutUrl: session.checkout_url })
  } catch (err: any) {
    console.error("[/api/checkout] Error:", err?.message ?? err)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
