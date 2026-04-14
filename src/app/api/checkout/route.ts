import { NextRequest, NextResponse } from "next/server"
import DodoPayments from "dodopayments"

const dodo = new DodoPayments({
  bearerToken: process.env.DODO_API_KEY!,
  // Switch to "live_mode" when you go live
  environment: (process.env.DODO_ENVIRONMENT as "test_mode" | "live_mode") ?? "test_mode",
})

export async function POST(req: NextRequest) {
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
        // Creates or retrieves a Dodo customer record automatically.
        // Pass 'create' so it links this email to a customer.
        create_new_customer: true,
      },
      // CRITICAL: We store the Supabase user_id here so the webhook can find the user.
      metadata: {
        user_id,
      },
      // Redirect back to your app after payment
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment-success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
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
