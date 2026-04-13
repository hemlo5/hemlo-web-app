// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { AssetNews } from "@/lib/types"

export const dynamic = "force-dynamic"

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "ALL"
  const supa = getSupa()

  if (!supa) {
    return NextResponse.json({ symbol, news: [], error: "No Database" }, { status: 500 })
  }

  let query = supa
    .from("asset_news")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("fetched_at", { ascending: false })

  if (symbol !== "ALL") {
    query = query.eq("symbol", symbol).limit(8)
  } else {
    query = query.limit(30)
  }

  const { data } = await query
  
  if (data && data.length > 0) {
    const news: AssetNews[] = data.map((r: any) => ({
      id: r.id, symbol: r.symbol, headline: r.headline, summary: r.summary,
      sentiment: r.sentiment, sentimentScore: r.sentiment_score,
      urgency: r.urgency, priceImpact: r.price_impact,
      priceDirection: r.price_direction, fetchedAt: r.fetched_at,
    }))
    return NextResponse.json({ symbol, news, cached: true })
  }

  return NextResponse.json({ symbol, news: [], cached: false })
}
