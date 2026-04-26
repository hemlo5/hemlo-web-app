import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function parseMarketData(m: any) {
  let outcomes: { label: string; prob: number }[] = []
  try {
    const outList = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : (m.outcomes || ["Yes", "No"])
    const oprList = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : (m.outcomePrices || [0.5, 0.5])
    outcomes = outList.map((lbl: string, i: number) => ({
      label: lbl,
      prob: Math.round(parseFloat(oprList[i] ?? "0.5") * 100),
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
    slug: m.slug,
    question: m.question,
    outcomes,
    volume: volStr,
    volumeRaw: volume,
    liquidity: parseFloat(m.liquidityClob || m.liquidity || "0"),
    lastTradePrice: parseFloat(m.lastTradePrice || "0"),
    bestAsk: parseFloat(m.bestAsk || "0"),
    bestBid: parseFloat(m.bestBid || "0"),
    endDate: m.endDate || "",
    active: m.active ?? true,
    closed: m.closed ?? false,
    clobTokenIds: (() => {
      try {
        const raw = m.clobTokenIds || "[]"
        return typeof raw === "string" ? JSON.parse(raw) : (Array.isArray(raw) ? raw : [])
      } catch { return [] }
    })(),
  }
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
          let endDate = mkt.endDate || ""
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

          return NextResponse.json({
            title,
            slug: eventSlug,
            image,
            endDate,
            markets: [parseMarketData(mkt)],
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
          image: firstEvent.image || "",
          endDate: firstEvent.endDate || "",
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
