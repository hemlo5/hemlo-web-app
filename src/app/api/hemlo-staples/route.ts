import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enrichWithIcons } from "@/lib/enrich-icons"

export const dynamic = "force-dynamic"

export async function GET() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ data: [] })

  try {
    const supa = createClient(supaUrl, supaKey)
    const { data, error } = await supa
      .from("trending_topics")
      .select("*")
      .eq("type", "prediction")
      .eq("section", "hemlo_staples")
      .order("fetched_at", { ascending: false })
      .limit(20)

    if (error || !data) return NextResponse.json({ data: [] })

    // Enrich with icons from Polymarket API
    const enriched = await enrichWithIcons(data)
    
    return NextResponse.json({ data: enriched }, { status: 200 })
  } catch {
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}
