// @ts-nocheck
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { TRACKED_ASSETS } from "@/lib/types"
import type { AssetChartPoint } from "@/lib/types"

export const dynamic = "force-dynamic"

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function fetchCryptoChart(coingeckoId: string, range: string): Promise<AssetChartPoint[]> {
  const daysMap: Record<string, string> = { "1H": "1", "1D": "1", "1W": "7", "1M": "30" }
  const days = daysMap[range] ?? "1"
  const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`
  try {
    const res = await fetch(url, { next: { revalidate: 900 } })
    if (!res.ok) return []
    const data = await res.json()
    const prices: [number, number][] = data.prices ?? []
    const volumes: [number, number][] = data.total_volumes ?? []
    const volMap = new Map(volumes.map(([t, v]) => [Math.round(t / 60000), v]))
    let points = prices.map(([t, p]) => ({
      t, p, v: volMap.get(Math.round(t / 60000)) ?? 0,
    }))
    // For 1H, only keep last 60 points
    if (range === "1H") points = points.slice(-60)
    return points
  } catch { return [] }
}

async function fetchStockChart(symbol: string, range: string): Promise<AssetChartPoint[]> {
  const configMap: Record<string, { interval: string; range: string }> = {
    "1H": { interval: "5m", range: "1d" },
    "1D": { interval: "5m", range: "1d" },
    "1W": { interval: "1h", range: "5d" },
    "1M": { interval: "1d", range: "1mo" },
  }
  const cfg = configMap[range] ?? configMap["1D"]
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${cfg.interval}&range=${cfg.range}`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 900 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return []
    const timestamps: number[] = result.timestamp ?? []
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? []
    const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? []
    return timestamps.map((t, i) => ({
      t: t * 1000,
      p: closes[i] ?? 0,
      v: volumes[i] ?? 0,
    })).filter(pt => pt.p > 0)
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  let symbol = req.nextUrl.searchParams.get("symbol") ?? "BTC"
  const range = req.nextUrl.searchParams.get("range") ?? "1D"
  const supa = getSupa()

  // Try cache
  if (supa) {
    const { data } = await supa
      .from("asset_charts")
      .select("data, expires_at")
      .eq("symbol", symbol)
      .eq("timerange", range)
      .single()
    if (data && new Date(data.expires_at) > new Date()) {
      return NextResponse.json({ symbol, range, chart: data.data, cached: true })
    }
  }

  // Fetch fresh
  const tracked = TRACKED_ASSETS.find(a => a.symbol === symbol)
  let chart: AssetChartPoint[] = []

  if (tracked?.type === "crypto" && tracked.coingeckoId) {
    chart = await fetchCryptoChart(tracked.coingeckoId, range)
  } else {
    // Dynamic Fallback via Yahoo Finance
    const lookupSymbol = (!tracked && (symbol === "BTC" || symbol === "ETH" || symbol.length >= 4 && symbol.endsWith("USD"))) ? symbol : symbol
    chart = await fetchStockChart(lookupSymbol, range)
    if (chart.length === 0 && !tracked) {
       chart = await fetchStockChart(`${symbol}-USD`, range) // Crypto fallback
    }
  }

  // Cache it (15 min TTL)
  if (supa && chart.length > 0) {
    try {
      await supa.from("asset_charts").upsert({
        symbol,
        timerange: range,
        data: chart,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }, { onConflict: "symbol,timerange" })
    } catch {}
  }

  return NextResponse.json({ symbol, range, chart, cached: false })
}
