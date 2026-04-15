import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json()

    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[confirm-payment] Missing Supabase env vars")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Verify user actually exists before writing
    const { data: user, error: userErr } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (userErr || !user) {
      console.error("[confirm-payment] User not found:", userErr)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Upgrade the profile tier
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ tier: "premium" })
      .eq("id", user_id)

    if (updateErr) {
      console.error("[confirm-payment] Update failed:", updateErr)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    console.log(`[confirm-payment] ✅ User ${user_id} upgraded to premium`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[confirm-payment] Unhandled error:", err?.message ?? err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
