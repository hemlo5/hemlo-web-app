import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 120

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
}

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

async function fetchAny(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      next: { revalidate: 120 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$]+/g, " ").replace(/\s+/g, " ").trim()
}

function eventSearchText(ev: any) {
  const tags = Array.isArray(ev.tags)
    ? ev.tags.map((tag: any) => `${tag?.label || ""} ${tag?.slug || ""}`).join(" ")
    : ""
  const markets = Array.isArray(ev.markets)
    ? ev.markets.map((market: any) => `${market?.question || ""} ${market?.groupItemTitle || ""}`).join(" ")
    : ""
  return normalizeSearchText(`${ev.title || ""} ${ev.description || ""} ${tags} ${markets}`)
}

function scoreSearchMatch(ev: any, query: string) {
  const q = normalizeSearchText(query)
  if (!q) return 0

  const title = normalizeSearchText(ev.title || ev.description || "")
  const text = eventSearchText(ev)
  const words = q.split(" ").filter(Boolean)
  let score = 0

  if (title === q) score += 160
  if (title.startsWith(q)) score += 110
  if (title.includes(q)) score += 80
  if (text.includes(q)) score += 45

  for (const word of words) {
    if (title.includes(word)) score += 18
    else if (text.includes(word)) score += 8
  }

  if (score <= 0) return 0

  score += Math.min(25, Math.log10(Math.max(Number(ev.volume || ev.volumeNum || 1), 1)) * 4)
  score += Math.min(18, Math.log10(Math.max(Number(ev.volume24hr || 1), 1)) * 3)
  return score
}

function dedupeEvents(events: any[]) {
  const seen = new Set<string>()
  return events.filter((ev: any) => {
    const key = String(ev?.id || ev?.slug || ev?.title || "")
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
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
  let outcomes: Array<{ label: string; prob: number; tokenId?: string; clobTokenId?: string; image?: string; icon?: string }> = []
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
          const optionImage = m.image || m.icon || ev.image || ev.icon || ""
          const optionIcon = m.icon || m.image || ev.icon || ev.image || ""
          return {
            label: m.groupItemTitle || m.question || "Option",
            prob: Math.min(99, Math.max(1, prob)),
            tokenId: tokenIds[0],
            clobTokenId: tokenIds[0],
            image: optionImage,
            icon: optionIcon,
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
  const requestedLimit = parseInt(searchParams.get("limit") || "12", 10)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 12

  try {
    let events: any[] = []

    if (query) {
      // ── SEARCH ──────────────────────────────────────────────────────────────
      const eventSearchLimit = 100
      const eventSearchUrls = [0, 100, 200].map(offset =>
        `https://gamma-api.polymarket.com/events?limit=${eventSearchLimit}&offset=${offset}&active=true&closed=false&search=${encodeURIComponent(query)}`
      )
      const [publicSearch, ...eventPages] = await Promise.all([
        fetchAny(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(query)}`),
        ...eventSearchUrls.map(fetchJson),
      ])
      const rankedEvents = Array.isArray(publicSearch?.events) ? publicSearch.events : []
      events = dedupeEvents([...rankedEvents, ...eventPages.flat()])
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
      .map((ev: any) => ({ ...parseEvent(ev), _searchScore: query ? scoreSearchMatch(ev, query) : 0 }))
      .filter((market: any) => !query || market._searchScore > 0)

    console.log(`[polymarket-browse] category=${category} events=${events.length} parsedMarkets=${markets.length}`)

    // Deduplicate by id
    const seen = new Set<string>()
    markets = markets.filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })

    // Sort by relevance when searching, otherwise by volume.
    markets.sort((a, b) => query ? (b._searchScore - a._searchScore || b.volumeRaw - a.volumeRaw) : b.volumeRaw - a.volumeRaw)
    const publicMarkets = markets.slice(0, limit).map(({ _searchScore, ...market }) => market)

    return NextResponse.json({ markets: publicMarkets, count: publicMarkets.length }, { status: 200, headers: CACHE_HEADERS })
  } catch (err: any) {
    console.error("[polymarket-browse]", err.message)
    return NextResponse.json({ markets: [], count: 0, error: err.message }, { status: 200, headers: CACHE_HEADERS })
  }
}
