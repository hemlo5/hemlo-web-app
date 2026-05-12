import { NextRequest, NextResponse } from "next/server"

/* eslint-disable @typescript-eslint/no-explicit-any */

export const dynamic = "force-dynamic"

function parseClobTokenIds(market: any): string[] {
  try {
    const raw = market?.clobTokenIds || "[]"
    return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
  } catch {
    return []
  }
}

function priceFromMarket(market: any, fallback = 50) {
  if (market?.lastTradePrice && market.lastTradePrice > 0) {
    return Math.round(Number(market.lastTradePrice) * 100)
  }
  try {
    const raw = market?.outcomePrices || "[0.5,0.5]"
    const prices = typeof raw === "string" ? JSON.parse(raw) : raw
    return Math.round(parseFloat(prices?.[0] || "0.5") * 100)
  } catch {
    return fallback
  }
}

function parseMarketData(m: any) {
  const tokenIds = parseClobTokenIds(m)
  let outcomes: { label: string; prob: number; tokenId?: string; clobTokenId?: string; image?: string; icon?: string }[] = []
  try {
    const outList = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : (m.outcomes || ["Yes", "No"])
    const oprList = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : (m.outcomePrices || [0.5, 0.5])
    outcomes = outList.map((lbl: string, i: number) => ({
      label: lbl,
      prob: Math.round(parseFloat(oprList[i] ?? "0.5") * 100),
      tokenId: tokenIds[i],
      clobTokenId: tokenIds[i],
      image: m.image || "",
      icon: m.icon || m.image || "",
    }))
  } catch {
    outcomes = [{ label: "Yes", prob: 50 }, { label: "No", prob: 50 }]
  }

  const volume = parseFloat(m.volume || "0")
  const volStr = volume >= 1e6 ? `$${(volume / 1e6).toFixed(1)}M`
    : volume >= 1e3 ? `$${(volume / 1e3).toFixed(0)}K`
    : `$${Math.round(volume)}`

  return {
    id: m.id,
    conditionId: m.conditionId || "",
    slug: m.slug,
    question: m.question,
    outcomes,
    volume: volStr,
    volumeRaw: volume,
    volume24h: parseFloat(m.volume24hr || m.volume24h || "0"),
    liquidity: parseFloat(m.liquidityClob || m.liquidity || "0"),
    lastTradePrice: parseFloat(m.lastTradePrice || "0"),
    bestAsk: parseFloat(m.bestAsk || "0"),
    bestBid: parseFloat(m.bestBid || "0"),
    spread: parseFloat(m.spread || "0"),
    oneDayPriceChange: parseFloat(m.oneDayPriceChange || "0"),
    oneWeekPriceChange: parseFloat(m.oneWeekPriceChange || "0"),
    marketMakerAddress: m.marketMakerAddress || "",
    endDate: m.endDate || "",
    active: m.active ?? true,
    closed: m.closed ?? false,
    groupItemTitle: m.groupItemTitle || "",
    image: m.image || "",
    icon: m.icon || m.image || "",
    clobTokenIds: tokenIds,
  }
}

function parseEventOutcomes(event: any) {
  const markets: any[] = Array.isArray(event?.markets) ? event.markets : []
  const activeMarkets = markets.filter((market) => !market.closed && market.active !== false)
  const grouped = activeMarkets.filter((market) => market.groupItemTitle && String(market.groupItemTitle).trim())
  const tradedGrouped = grouped.filter((market) => {
    const volume = Number(market.volumeNum ?? market.volume ?? 0)
    const volume24h = Number(market.volume24hr ?? market.volume24h ?? 0)
    const lastTrade = Number(market.lastTradePrice ?? 0)
    return volume > 0 || volume24h > 0 || (lastTrade > 0 && lastTrade < 1)
  })

  if (tradedGrouped.length >= 2) {
    return tradedGrouped
      .map((market) => {
        const tokenIds = parseClobTokenIds(market)
        const prob = Math.min(99, Math.max(1, priceFromMarket(market)))
        return {
          label: market.groupItemTitle || market.question || "Option",
          prob,
          tokenId: tokenIds[0],
          clobTokenId: tokenIds[0],
          image: market.image || market.icon || event.image || event.icon || "",
          icon: market.icon || market.image || event.icon || event.image || "",
        }
      })
      .filter((outcome) => outcome.prob > 0 && outcome.prob < 100)
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 12)
  }

  const firstMarket = activeMarkets[0] || markets[0]
  if (!firstMarket) return [{ label: "Yes", prob: 50 }, { label: "No", prob: 50 }]
  return parseMarketData(firstMarket).outcomes
}

const HEADERS = { "User-Agent": "hemlo/1.0" }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = (searchParams.get("slug") || "").trim()

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }

  const isNumericId = /^\d+$/.test(slug)

  try {
    // ── Strategy 1: if it looks like a numeric ID, try /markets?id= directly ──
    if (isNumericId) {
      const mktRes = await fetch(
        `https://gamma-api.polymarket.com/markets?id=${slug}`,
        { headers: HEADERS, next: { revalidate: 60 } }
      )
      if (mktRes.ok) {
        const mktData = await mktRes.json()
        const mkt = Array.isArray(mktData) ? mktData[0] : mktData
        if (mkt) {
          // Try to get the parent event for title/image
          let title = mkt.question || mkt.slug || slug
          let image = mkt.image || ""
          const endDate = mkt.endDate || ""
          let eventSlug = mkt.slug || slug

          if (mkt.conditionId || mkt.slug) {
            try {
              const evRes = await fetch(
                `https://gamma-api.polymarket.com/events?id=${mkt.conditionId || ""}`,
                { headers: HEADERS, next: { revalidate: 60 } }
              )
              if (evRes.ok) {
                const evData = await evRes.json()
                const ev = Array.isArray(evData) ? evData[0] : evData
                if (ev) {
                  title = ev.title || title
                  image = ev.image || image
                  eventSlug = ev.slug || eventSlug
                }
              }
            } catch { /* use market-level fields */ }
          }

          const parsedMarket = parseMarketData(mkt)
          return NextResponse.json({
            title,
            slug: eventSlug,
            image,
            endDate,
            description: mkt.description || "",
            outcomes: parsedMarket.outcomes,
            markets: [parsedMarket],
          })
        }
      }
    }

    // ── Strategy 2: try event slug lookup ──
    const eventRes = await fetch(
      `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`,
      { headers: HEADERS, next: { revalidate: 60 } }
    )
    if (eventRes.ok) {
      const events = await eventRes.json()
      const event = Array.isArray(events) ? events[0] : events
      if (event) {
        return NextResponse.json({
          title: event.title || event.slug,
          slug: event.slug,
          description: event.description || "",
          image: event.image || "",
          startDate: event.startDate || "",
          endDate: event.endDate || "",
          volume: parseFloat(event.volume || "0"),
          volume24h: parseFloat(event.volume24hr || event.volume24h || "0"),
          liquidity: parseFloat(event.liquidity || event.liquidityClob || "0"),
          active: event.active ?? true,
          closed: event.closed ?? false,
          category: event.category || event.tags?.[0]?.label || "",
          outcomes: parseEventOutcomes(event),
          markets: (event.markets || []).map(parseMarketData),
        })
      }
    }

    // ── Strategy 3: text search fallback ──
    const searchRes = await fetch(
      `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(slug)}`,
      { headers: HEADERS, next: { revalidate: 60 } }
    )
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const firstEvent = searchData?.events?.[0]
      if (firstEvent) {
        return NextResponse.json({
          title: firstEvent.title || slug,
          slug: firstEvent.slug || slug,
          description: firstEvent.description || "",
          image: firstEvent.image || "",
          endDate: firstEvent.endDate || "",
          volume: parseFloat(firstEvent.volume || "0"),
          volume24h: parseFloat(firstEvent.volume24hr || firstEvent.volume24h || "0"),
          liquidity: parseFloat(firstEvent.liquidity || firstEvent.liquidityClob || "0"),
          active: firstEvent.active ?? true,
          closed: firstEvent.closed ?? false,
          category: firstEvent.category || firstEvent.tags?.[0]?.label || "",
          outcomes: parseEventOutcomes(firstEvent),
          markets: (firstEvent.markets || []).map(parseMarketData),
        })
      }
    }

    return NextResponse.json({ error: "Market not found" }, { status: 404 })

  } catch (err: any) {
    console.error("[polymarket-market]", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
