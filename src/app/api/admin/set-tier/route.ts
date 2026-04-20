import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// POST /api/admin/set-tier
// Headers: x-admin-secret: <ADMIN_SECRET from .env>
// Body: { user_id: string, tier: "pro" | "founder" | "normal" | "starter", has_starter_pack?: boolean }
//
// Usage: curl -X POST https://app.hemloai.com/api/admin/set-tier \
//   -H "Content-Type: application/json" \
//   -H "x-admin-secret: YOUR_ADMIN_SECRET" \
//   -d '{"user_id":"<UID>","tier":"pro"}'

export const dynamic = "force-dynamic"

const VALID_TIERS = ["free", "normal", "starter", "pro", "premium", "founder"]

export async function POST(req: NextRequest) {
  // ── Auth guard ──
  const secret = req.headers.get("x-admin-secret")
  const envSecret = process.env.ADMIN_SECRET
  if (!envSecret || secret !== envSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { user_id, tier, has_starter_pack } = body

  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 })
  }
  if (tier !== undefined && !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}` }, { status: 400 })
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const supa = createClient(supaUrl, supaKey, { auth: { persistSession: false } })

  // Check user exists first
  const { data: existing } = await supa.from("profiles").select("id, tier, has_starter_pack").eq("id", user_id).single()
  if (!existing) {
    return NextResponse.json({ error: `No profile found for user_id: ${user_id}` }, { status: 404 })
  }

  // Build update payload
  const payload: any = { updated_at: new Date().toISOString() }
  if (tier !== undefined) payload.tier = tier
  if (has_starter_pack !== undefined) payload.has_starter_pack = has_starter_pack

  const { error } = await supa.from("profiles").update(payload).eq("id", user_id)

  if (error) {
    console.error("[admin/set-tier] DB error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[admin/set-tier] ✅ Updated user ${user_id}: tier=${tier ?? "(unchanged)"}, has_starter_pack=${has_starter_pack ?? "(unchanged)"}`)

  return NextResponse.json({
    success: true,
    user_id,
    before: { tier: existing.tier, has_starter_pack: existing.has_starter_pack },
    after: { tier: tier ?? existing.tier, has_starter_pack: has_starter_pack ?? existing.has_starter_pack },
  })
}
