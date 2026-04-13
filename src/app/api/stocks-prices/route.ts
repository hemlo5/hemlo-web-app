// @ts-nocheck
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Asset } from "@/lib/types"
import { TRACKED_ASSETS } from "@/lib/types"

export const dynamic = "force-dynamic"

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// Fetch crypto prices from CoinGecko
async function fetchCryptoPrices(): Promise<Asset[]> {
  const cryptos = TRACKED_ASSETS.filter(a => a.type === "crypto")
  const ids = cryptos.map(c => c.coingeckoId).join(",")
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return []
  const data = await res.json()
  return data.map((c: any) => {
    const tracked = cryptos.find(t => t.coingeckoId === c.id)
    return {
      symbol: tracked?.symbol ?? c.symbol.toUpperCase(),
      name: tracked?.name ?? c.name,
      type: "crypto" as const,
      coingeckoId: c.id,
      price: c.current_price ?? 0,
      change24h: c.price_change_24h ?? 0,
      changePct24h: c.price_change_percentage_24h ?? 0,
      marketCap: c.market_cap ?? 0,
      volume24h: c.total_volume ?? 0,
      high24h: c.high_24h ?? 0,
      low24h: c.low_24h ?? 0,
      circulatingSupply: c.circulating_supply ?? 0,
    }
  })
}

// Fetch stock prices from Yahoo Finance
async function fetchStockPrices(): Promise<Asset[]> {
  const stocks = TRACKED_ASSETS.filter(a => a.type === "stock")
  try {
    const promises = stocks.map(async (s) => {
      try {
        const url = `https://query2.finance.yahoo.com/v8/finance/chart/${s.symbol}?interval=1d&range=1d`
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } })
        if (!res.ok) throw new Error("bad")
        const data = await res.json()
        const meta = data.chart?.result?.[0]?.meta
        if (!meta) throw new Error("no meta")
        
        const price = meta.regularMarketPrice ?? 0
        const prev = meta.chartPreviousClose ?? meta.previousClose ?? price
        const change = price - prev
        const pct = prev > 0 ? (change / prev) * 100 : 0
        
        return {
          symbol: s.symbol, name: s.name, type: "stock" as const,
          price: price, change24h: change, changePct24h: pct,
          marketCap: meta.marketCap ?? 0, volume24h: meta.regularMarketVolume ?? 0,
          high24h: price * 1.01, low24h: price * 0.99, // rough estimate if absent
        }
      } catch {
        return { ...s, price: 0, change24h: 0, changePct24h: 0, marketCap: 0, volume24h: 0, high24h: 0, low24h: 0 }
      }
    })
    return await Promise.all(promises)
  } catch {
    return stocks.map(s => ({ ...s, price: 0, change24h: 0, changePct24h: 0, marketCap: 0, volume24h: 0, high24h: 0, low24h: 0 }))
  }
}

export async function GET() {
  const supa = getSupa()

  // Try Supabase cache first
  if (supa) {
    const { data } = await supa.from("asset_prices").select("*").order("symbol")
    if (data && data.length > 0) {
      // Check freshness (5 min)
      const oldest = data.reduce((min: string, r: any) => r.updated_at < min ? r.updated_at : min, data[0].updated_at)
      const age = Date.now() - new Date(oldest).getTime()
      if (age < 5 * 60 * 1000) {
        const assets: Asset[] = data.map((r: any) => ({
          symbol: r.symbol, name: r.name, type: r.type, coingeckoId: r.coingecko_id,
          price: r.price, change24h: r.change_24h, changePct24h: r.change_pct_24h,
          marketCap: r.market_cap, volume24h: r.volume_24h, high24h: r.high_24h,
          low24h: r.low_24h, circulatingSupply: r.circulating_supply, updatedAt: r.updated_at,
        }))
        return NextResponse.json({ assets, cached: true })
      }
    }
  }

  // Fetch fresh data
  const [crypto, stocks] = await Promise.all([fetchCryptoPrices(), fetchStockPrices()])
  const assets = [...crypto, ...stocks]

  // Upsert to cache
  if (supa && assets.length > 0) {
    const rows = assets.map(a => ({
      symbol: a.symbol, name: a.name, type: a.type, coingecko_id: a.coingeckoId ?? null,
      price: a.price, change_24h: a.change24h, change_pct_24h: a.changePct24h,
      market_cap: a.marketCap, volume_24h: a.volume24h, high_24h: a.high24h,
      low_24h: a.low24h, circulating_supply: a.circulatingSupply ?? null,
      updated_at: new Date().toISOString(),
    }))
    try {
      await supa.from("asset_prices").upsert(rows, { onConflict: "symbol" })
    } catch {}
  }

  return NextResponse.json({ assets, cached: false })
}
