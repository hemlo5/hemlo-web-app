import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Define tags for each category to query Polymarket via the /events endpoint
const CATEGORY_TAGS: Record<string, string[]> = {
  politics: ["politics", "election", "president", "trump", "biden"],
  sports: ["sports", "nfl", "nba", "soccer", "f1", "tennis", "world-cup", "premier-league"],
  crypto: ["crypto", "bitcoin", "ethereum", "btc", "eth", "solana"],
  finance: ["economics", "finance", "stock", "interest-rate", "nasdaq", "inflation"],
  tech: ["science", "tech", "ai", "openai", "tesla"],
  entertainment: ["pop-culture", "entertainment", "movie", "award"],
  world: ["world", "geopolitics", "war", "middle-east"],
}

function parseMarket(m: any) {
  let outcomes: Array<{ label: string; prob: number }> = []
  let marketType: "binary" | "categorical" = "binary"
  try {
    const outRaw = m.outcomes || '["Yes","No"]'
    const outList = typeof outRaw === "string" ? JSON.parse(outRaw) : outRaw
    const oprRaw = m.outcomePrices || "[0.5,0.5]"
    const oprList = typeof oprRaw === "string" ? JSON.parse(oprRaw) : oprRaw
    outcomes = outList.map((lbl: string, i: number) => ({
      label: lbl,
      prob: Math.round(parseFloat(oprList[i] || "0.5") * 100),
    }))
    const labels = new Set(outList.map((l: string) => l.toLowerCase()))
    marketType = (outList.length === 2 && labels.has("yes") && labels.has("no")) ? "binary" : "categorical"
  } catch {
    outcomes = [{ label: "Yes", prob: 50 }, { label: "No", prob: 50 }]
  }

  const volume = parseFloat(m.volume || "0")
  const volume24h = parseFloat(m.volume24hr || "0")
  const volStr = volume >= 1e6 ? `$${(volume / 1e6).toFixed(1)}M`
    : volume >= 1e3 ? `$${(volume / 1e3).toFixed(0)}K`
    : `$${Math.round(volume)}`

  return {
    id: m.id || m.slug,
    slug: m.slug || "",
    question: m.question || "",
    outcomes,
    marketType,
    volume: volStr,
    volumeRaw: volume,
    volume24h,
    endDate: m.endDate || "",
    image: m.image || "",
    icon: m.icon || "",
    category: m.category || "",
    active: m.active ?? true,
    closed: m.closed ?? false,
    tags: m.tags || [],
    clobTokenIds: (() => {
      try {
        const raw = m.clobTokenIds || "[]"
        return typeof raw === "string" ? JSON.parse(raw) : raw
      } catch { return [] }
    })(),
    // Extra fields for detail modal
    description: m.description || "",
    resolutionSource: m.resolutionSource || "",
    conditionId: m.conditionId || "",
    liquidityClob: parseFloat(m.liquidityClob || "0"),
    lastTradePrice: parseFloat(m.lastTradePrice || "0"),
    spreadPercent: parseFloat(m.spread || "0") * 100,
    bestAsk: parseFloat(m.bestAsk || "0"),
    bestBid: parseFloat(m.bestBid || "0"),
  }
}

async function fetchPage(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "hemlo/1.0" }, next: { revalidate: 120 } })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category") || "trending"
  const query = searchParams.get("q") || ""
  const limit = parseInt(searchParams.get("limit") || "40")

  try {
    let raw: any[] = []

    if (query) {
      // ── SEARCH MODE ────────────────────────────────────────────────────────
      const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}`
      const res = await fetch(url, { headers: { "User-Agent": "hemlo/1.0" }, next: { revalidate: 120 } })
      
      if (res.ok) {
        const data = await res.json()
        if (data && data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (ev.markets && Array.isArray(ev.markets)) {
              raw.push(...ev.markets)
            }
          }
        }
      }
    } else if (category === "trending") {
      // ── TRENDING (Top global by 24h volume) ────────────────────────────────
      const url = `https://gamma-api.polymarket.com/markets?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`
      raw = await fetchPage(url)
    } else {
      // ── CATEGORY MODE ──────────────────────────────────────────────────────
      // Polymarket's Gamma API does not natively link tags to the `/markets` 
      // endpoint directly anymore. They link tags directly to `/events`.
      // By fetching from /events we guarantee the tag exists and then we flatten.
      const tags = CATEGORY_TAGS[category] || [category]
      
      const requests = tags.map(tag => {
        const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&tag_slug=${encodeURIComponent(tag)}&order=volume24hr&ascending=false`
        return fetchPage(url)
      })

      const eventPages = await Promise.all(requests)
      
      // Flatten out the markets from inside each event object
      const allMarkets: any[] = []
      for (const page of eventPages) {
        for (const ev of page) {
          if (ev.markets && Array.isArray(ev.markets)) {
            allMarkets.push(...ev.markets)
          }
        }
      }
      
      raw = allMarkets

      // Sort combined results by lifetime volume
      raw.sort((a, b) => parseFloat(b.volume || "0") - parseFloat(a.volume || "0"))
    }

    let markets = raw.map(parseMarket)

    // Deduplicate by ID
    const seen = new Set()
    markets = markets.filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      // Hide very low volume dead markets
      if (m.volumeRaw < 100) return false
      return true
    })

    // Trim to limit
    markets = markets.slice(0, limit)

    return NextResponse.json({ markets, count: markets.length }, { status: 200 })

  } catch (err: any) {
    console.error("[polymarket-browse]", err.message)
    return NextResponse.json({ markets: [], count: 0, error: err.message }, { status: 200 })
  }
}
