import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { enrichWithIcons } from "@/lib/enrich-icons"
import type { TrendingTopic } from "@/lib/types"

const MOCK_TOPICS: TrendingTopic[] = [
  {
    id: "mock-news-1",
    type: "news",
    topic: "A.I. Breakthrough Accelerated by New Silicon Designs",
    category: "tech",
    impact: "Silicon manufacturers jump 8-12%. Massive infrastructure spending on power and cooling solutions incoming.",
    sentiment: "bullish",
    sentimentScore: 82,
    agentCount: 14200,
    confidence: 88,
    affectedGroups: ["Semiconductors", "Data Centers", "Tech Investors"],
    urgency: "hot",
    sourceTitle: "News API",
    sourceUrl: "https://news.google.com",
    fetchedAt: new Date().toISOString(),
  },
  {
    id: "mock-news-2",
    type: "news",
    topic: "European Union Drafts Emergency Energy Protocol",
    category: "geo",
    impact: "Energy markets stabilize while green-tech subsidies balloon. Euro shows minor recovery signs.",
    sentiment: "controversial",
    sentimentScore: -12,
    agentCount: 9800,
    confidence: 76,
    affectedGroups: ["Energy traders", "EU Taxpayers", "Manufacturers"],
    urgency: "breaking",
    sourceTitle: "Reuters",
    sourceUrl: "https://reuters.com",
    fetchedAt: new Date().toISOString(),
  },
  {
    id: "mock-news-3",
    type: "news",
    topic: "Global supply chains shift dynamically away from traditional hubs",
    category: "finance",
    impact: "Shipping costs exhibit volatility. Emerging markets see heavy FDI influx.",
    sentiment: "bullish",
    sentimentScore: 30,
    agentCount: 11100,
    confidence: 81,
    affectedGroups: ["Logistics", "Emerging Markets", "Retail"],
    urgency: "trending",
    sourceTitle: "Bloomberg",
    sourceUrl: "https://bloomberg.com",
    fetchedAt: new Date().toISOString(),
  },
]

function triggerCronSeed() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  fetch(`${baseUrl}/api/cron/refresh-trending`, {
    method: "GET",
    headers: { "x-cron-secret": process.env.CRON_SECRET ?? "dev" },
  }).catch(() => {})
}

export async function GET() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supaUrl || !supaKey) {
    return NextResponse.json(
      { topics: MOCK_TOPICS, source: "mock_no_supabase", timestamp: new Date().toISOString() },
      { status: 200 }
    )
  }

  try {
    const supa = createClient(supaUrl, supaKey)

    const { data, error } = await supa
      .from("trending_topics")
      .select("*")
      .eq("type", "news")
      .order("fetched_at", { ascending: false })
      .limit(80)

    if (error || !data || data.length === 0) {
      triggerCronSeed()
      return NextResponse.json(
        { topics: MOCK_TOPICS, source: "mock_seeding", timestamp: new Date().toISOString() },
        { status: 200 }
      )
    }

    const topics: TrendingTopic[] = data.map((row: any) => ({
      id:               row.id,
      topic:            row.topic,
      category:         row.category,
      impact:           row.impact,
      sentiment:        row.sentiment,
      sentimentScore:   row.sentiment_score,
      agentCount:       row.agent_count,
      confidence:       row.confidence,
      affectedGroups:   row.affected_groups ?? [],
      urgency:          row.urgency,
      sourceTitle:      row.source_title,
      sourceUrl:        row.source_url,
      fetchedAt:        row.fetched_at,
      // Prediction market fields
      type:             row.type ?? "news",
      polymarketOdds:   row.polymarket_odds,
      moneyAtStake:     row.money_at_stake,
      hemloOdds:        row.hemlo_odds,
      divergence:       row.divergence,
      divergenceSignal: row.divergence_signal,
      marketEndDate:    row.market_end_date,
      marketType:       row.market_type,
      outcomes:         row.outcomes,
      icon:             row.icon || null,
    }))

    // Enrich with icons from Polymarket API
    const enriched = await enrichWithIcons(topics)

    return NextResponse.json({ topics: enriched, source: "supabase", timestamp: new Date().toISOString() }, { status: 200 })
  } catch (err) {
    console.error("[/api/trending]", err)
    return NextResponse.json(
      { topics: MOCK_TOPICS, source: "mock_error", timestamp: new Date().toISOString() },
      { status: 200 }
    )
  }
}
