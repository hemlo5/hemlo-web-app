import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Tag slugs used by Polymarket's /events endpoint
const CATEGORY_TAGS: Record<string, string[]> = {
  politics:    ["politics", "election", "trump", "biden"],
  sports:      ["sports", "nfl", "nba", "soccer", "f1", "tennis", "world-cup"],
  crypto:      ["crypto", "bitcoin", "ethereum", "btc", "solana"],
  finance:     ["economics", "finance", "fed-rates", "inflation", "nasdaq"],
  tech:        ["tech", "ai", "openai", "science"],
  culture:     ["pop-culture", "culture", "entertainment", "celebrity"],
  esports:     ["esports", "gaming"],
  iran:        ["iran", "trump-iran", "diplomacy-ceasefire"],
  geopolitics: ["geopolitics", "ukraine", "russia", "middle-east"],
  economy:     ["economy", "economic-policy", "fed", "fomc"],
  weather:     ["weather", "climate"],
  entertainment: ["pop-culture", "entertainment", "movie"],
}

async function fetchJson(url: string): Promise<any[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      next: { revalidate: 120 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Parse a Polymarket EVENT into a market card.
 *
 * Multi-choice events (negRisk or multiple markets with groupItemTitle):
 *   Each child market = one outcome, label = groupItemTitle, prob = outcomePrices[0]*100
 *
 * Binary events (single Yes/No market):
 *   Two outcomes: Yes and No
 */
function parseClobTokenIds(market: any): string[] {
  try {
    const raw = market?.clobTokenIds || "[]"
    const ids = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(ids) ? ids.filter(Boolean).map(String) : []
  } catch {
    return []
  }
}

function parseEvent(ev: any) {
  const markets: any[] = ev.markets || []

  // Compute total volume from all child markets (or from event-level volume)
  const totalVolume = parseFloat(ev.volume || "0")
  const volStr = totalVolume >= 1e6 ? `$${(totalVolume / 1e6).toFixed(1)}M`
    : totalVolume >= 1e3 ? `$${(totalVolume / 1e3).toFixed(0)}K`
    : `$${Math.round(totalVolume)}`

  // --- Determine outcomes ---
  let outcomes: Array<{ label: string; prob: number; tokenId?: string }> = []
  let marketType: "binary" | "categorical" = "binary"
  let outcomeTokenIds: string[] = []

  // Check if this is a multi-choice (negRisk) event
  const activeMarkets = markets.filter((m: any) => !m.closed)
  const hasGroupTitles = activeMarkets.length > 1 && activeMarkets.some((m: any) => m.groupItemTitle)

  if (hasGroupTitles) {
    // Categorical: each child market is one option.
    // KEY FIX: Only include child markets with real trading activity.
    // Placeholder/future markets have lastTradePrice=0 and outcomePrices=[0.5,0.5]
    // which produces fake "Person A/B/C" labels all at 50%.
    const tradedMarkets = activeMarkets.filter((m: any) => {
      const hasVolume = (m.volumeNum ?? 0) > 0 || (m.volume24hr ?? 0) > 0
      const hasRealPrice = m.lastTradePrice && m.lastTradePrice > 0 && m.lastTradePrice < 1
      const hasLabel = m.groupItemTitle && m.groupItemTitle.trim().length > 0
      return hasLabel && (hasVolume || hasRealPrice)
    })

    if (tradedMarkets.length >= 2) {
      marketType = "categorical"
      outcomes = tradedMarkets
        .map((m: any) => {
          // Prefer lastTradePrice (reflects real trades). Fall back to outcomePrices[0].
          let prob = 50
          if (m.lastTradePrice && m.lastTradePrice > 0) {
            prob = Math.round(m.lastTradePrice * 100)
          } else {
            try {
              const raw = m.outcomePrices || "[0.5,0.5]"
              const prices = typeof raw === "string" ? JSON.parse(raw) : raw
              prob = Math.round(parseFloat(prices[0] || "0.5") * 100)
            } catch { prob = 50 }
          }
          const tokenIds = parseClobTokenIds(m)
          return {
            label: m.groupItemTitle || m.question || "Option",
            prob: Math.min(99, Math.max(1, prob)),
            tokenId: tokenIds[0],
          }
        })
        .filter((o) => o.prob > 0 && o.prob < 100) // drop fully-resolved outcomes
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 8) // cap at 8 outcomes
      outcomeTokenIds = outcomes.map((o) => o.tokenId).filter(Boolean) as string[]
    }
    // If fewer than 2 valid traded outcomes → fall through to binary
  }

  if (marketType === "binary" || outcomes.length < 2) {
    // Binary: use the single/first market's Yes outcome
    marketType = "binary"
    const m = activeMarkets[0] || markets[0]
    if (m) {
      const tokenIds = parseClobTokenIds(m)
      let yesProb = 50
      if (m.lastTradePrice && m.lastTradePrice > 0) {
        yesProb = Math.round(m.lastTradePrice * 100)
      } else {
        try {
          const raw = m.outcomePrices || "[0.5,0.5]"
          const prices = typeof raw === "string" ? JSON.parse(raw) : raw
          yesProb = Math.round(parseFloat(prices[0] || "0.5") * 100)
        } catch { yesProb = 50 }
      }
      outcomes = [
        { label: "Yes", prob: yesProb, tokenId: tokenIds[0] },
        { label: "No", prob: 100 - yesProb, tokenId: tokenIds[1] },
      ]
      outcomeTokenIds = tokenIds.slice(0, 2)
    } else {
      outcomes = [{ label: "Yes", prob: 50 }, { label: "No", prob: 50 }]
    }
  }

  // Token ids used for chart fetching. For categorical events each outcome is a
  // separate child market, so these must line up with the sorted outcomes above.
  const firstMarket = activeMarkets[0] || markets[0]
  const clobTokenIds = outcomeTokenIds.length ? outcomeTokenIds : parseClobTokenIds(firstMarket)

  return {
    id: ev.id || ev.slug,
    slug: ev.slug || "",
    question: ev.title || ev.description || "",
    outcomes,
    marketType,
    volume: volStr,
    volumeRaw: totalVolume,
    volume24h: parseFloat(ev.volume24hr || "0"),
    endDate: ev.endDate || firstMarket?.endDate || "",
    image: ev.image || firstMarket?.image || "",
    icon: ev.icon || firstMarket?.icon || "",
    category: (ev.tags?.[0]?.label) || "",
    active: ev.active ?? true,
    closed: ev.closed ?? false,
    clobTokenIds,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category") || "trending"
  const query = searchParams.get("q") || ""
  const limit = parseInt(searchParams.get("limit") || "12")

  try {
    let events: any[] = []

    if (query) {
      // ── SEARCH ──────────────────────────────────────────────────────────────
      const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&_placeholderSearch=${encodeURIComponent(query)}`
      events = await fetchJson(url)
      // Fallback: try the public search endpoint
      if (!events.length) {
        const res = await fetch(
          `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}`,
          { 
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, 
            next: { revalidate: 120 } 
          }
        )
        if (res.ok) {
          const data = await res.json()
          events = data?.events || []
        }
      }
    } else if (category === "trending") {
      // ── TRENDING (by 24h volume) ─────────────────────────────────────────
      events = await fetchJson(
        `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`
      )
    } else if (category === "new") {
      // ── NEW (recently created) ──────────────────────────────────────────
      events = await fetchJson(
        `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&order=createdAt&ascending=false`
      )
    } else if (category === "breaking") {
      // ── BREAKING (highest single-day volume spike) ───────────────────────
      events = await fetchJson(
        `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&order=volume24hr&ascending=false`
      )
    } else {
      // ── CATEGORY (by tag) ─────────────────────────────────────────────────
      const tags = CATEGORY_TAGS[category] || [category]
      const requests = tags.map(tag =>
        fetchJson(
          `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&tag_slug=${encodeURIComponent(tag)}&order=volume24hr&ascending=false`
        )
      )
      const pages = await Promise.all(requests)
      events = pages.flat()
    }

    // Parse events into market cards
    let markets = events
      .filter((ev: any) => ev && !ev.closed)
      .map(parseEvent)

    console.log(`[polymarket-browse] category=${category} events=${events.length} parsedMarkets=${markets.length}`)

    // Deduplicate by id
    const seen = new Set<string>()
    markets = markets.filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    // Sort by volume and trim
    markets.sort((a, b) => b.volumeRaw - a.volumeRaw)
    markets = markets.slice(0, limit)

    return NextResponse.json({ markets, count: markets.length }, { status: 200 })
  } catch (err: any) {
    console.error("[polymarket-browse]", err.message)
    return NextResponse.json({ markets: [], count: 0, error: err.message }, { status: 200 })
  }
}
