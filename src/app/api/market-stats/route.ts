// @ts-nocheck
import { NextResponse } from "next/server"
import type { MarketStats } from "@/lib/types"

export const dynamic = "force-dynamic"

function isNYSEOpen(): boolean {
  const now = new Date()
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
  const day = est.getDay()
  const hours = est.getHours()
  const mins = est.getMinutes()
  const time = hours * 60 + mins
  // Mon-Fri, 9:30 AM - 4:00 PM EST
  return day >= 1 && day <= 5 && time >= 570 && time < 960
}

export async function GET() {
  let fearGreedValue = 50
  let fearGreedLabel = "Neutral"
  let cryptoMarketCap = 0
  let btcDominance = 0

  // Fear & Greed Index
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 600 } })
    if (res.ok) {
      const data = await res.json()
      const fg = data?.data?.[0]
      fearGreedValue = parseInt(fg?.value ?? "50")
      fearGreedLabel = fg?.value_classification ?? "Neutral"
    }
  } catch {}

  // CoinGecko global data
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global", { next: { revalidate: 600 } })
    if (res.ok) {
      const data = await res.json()
      cryptoMarketCap = data?.data?.total_market_cap?.usd ?? 0
      btcDominance = data?.data?.market_cap_percentage?.btc ?? 0
    }
  } catch {}

  const stats: MarketStats = {
    nyseOpen: isNYSEOpen(),
    fearGreedValue,
    fearGreedLabel,
    cryptoMarketCap,
    btcDominance,
  }

  return NextResponse.json(stats)
}
