import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/utils/supabase/server"

export async function POST(req: NextRequest) {
  try {
    // Get the authenticated user from their session cookie
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use service role to bypass RLS and update the profile
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tier: "premium" })
      .eq("id", user.id)

    if (error) {
      console.error("[confirm-payment] Supabase update failed:", error)
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
    }

    console.log(`[confirm-payment] ✅ User ${user.id} upgraded to premium via success page`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[confirm-payment] Error:", err?.message ?? err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
