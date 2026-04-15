import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "standardwebhooks"
import { createClient } from "@supabase/supabase-js"

// Must receive the raw body for signature verification — do NOT parse as JSON first!
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // ── 1. Verify the signature ────────────────────────────────────────────────
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("[dodo-webhook] DODO_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const wh = new Webhook(webhookSecret)
  let event: any

  try {
    event = wh.verify(rawBody, {
      "webhook-id": req.headers.get("webhook-id") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
    })
  } catch (err) {
    console.error("[dodo-webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
  }

  // ── 2. Acknowledge immediately (Dodo needs 2xx fast) ─────────────────────
  // Process asynchronously so the response is not delayed.
  processEvent(event).catch((err) =>
    console.error("[dodo-webhook] Async processing error:", err)
  )

  return NextResponse.json({ received: true }, { status: 200 })
}

async function processEvent(event: any) {
  console.log(`[dodo-webhook] Event received: ${event.type}`)

  // ── 3. Only act on successful payments ────────────────────────────────────
  if (event.type !== "payment.succeeded") {
    console.log(`[dodo-webhook] Ignoring event type: ${event.type}`)
    return
  }

  // ── 4. Extract user_id from the payment metadata ──────────────────────────
  const metadata = event.data?.metadata as Record<string, string> | undefined
  const userId = metadata?.user_id
  const plan = metadata?.plan || "pro" // default fallback

  if (!userId) {
    console.error("[dodo-webhook] payment.succeeded but no user_id in metadata. Payload:", JSON.stringify(event.data))
    return
  }

  console.log(`[dodo-webhook] Processing ${plan} purchase for user: ${userId}...`)

  // ── 5. Update Supabase using the service-role key (bypasses RLS) ──────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[dodo-webhook] Supabase URL or service role key is missing.")
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  let updatePayload: any = {}
  if (plan === "starter") {
    updatePayload = { has_starter_pack: true }
  } else if (plan === "pro") {
    updatePayload = { tier: "pro" }
  } else if (plan === "founder") {
    updatePayload = { tier: "founder" }
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)

  if (error) {
    console.error(`[dodo-webhook] Failed to update profile for user ${userId}:`, error)
  } else {
    console.log(`[dodo-webhook] ✅ User ${userId} successfully updated with plan: ${plan}.`)
  }
}
