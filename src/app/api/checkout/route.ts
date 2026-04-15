import { NextRequest, NextResponse } from "next/server"
import DodoPayments from "dodopayments"

export async function POST(req: NextRequest) {
  // Initialize inside the handler so missing env vars surface as a 500, not a module crash
  const dodo = new DodoPayments({
    bearerToken: process.env.DODO_API_KEY ?? (() => { throw new Error("DODO_API_KEY is not set") })(),
    environment: (process.env.DODO_ENVIRONMENT as "test_mode" | "live_mode") ?? "test_mode",
  })

  try {
    const { user_id, email } = await req.json()

    if (!user_id || !email) {
      return NextResponse.json(
        { error: "user_id and email are required" },
        { status: 400 }
      )
    }

    const productId = process.env.DODO_PRODUCT_ID
    if (!productId) {
      return NextResponse.json(
        { error: "DODO_PRODUCT_ID env variable is not set" },
        { status: 500 }
      )
    }

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: {
        email,
      },
      // CRITICAL: We store the Supabase user_id here so the webhook can find the user.
      metadata: {
        user_id,
      },
      // return_url = where Dodo sends user after they view the order summary and click continue
      // cancel_url = where Dodo sends user if they click back/cancel
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile`,
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
