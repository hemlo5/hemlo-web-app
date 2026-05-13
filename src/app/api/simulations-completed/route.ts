import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 60

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
}

type MarketOutcome = {
  label: string
  prob?: number
  hemloProb?: number
  tokenId?: string
  clobTokenId?: string
  image?: string
  icon?: string
}

const POLY_HEADERS = { "User-Agent": "hemlo/1.0" }

function toNumber(value: any, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function confidenceScore(value: any) {
  if (typeof value === "number") return value
  const text = String(value || "").toUpperCase()
  if (text === "HIGH") return 90
  if (text === "MEDIUM") return 65
  if (text === "LOW") return 40
  return 0
}

function parseDomainMeta(domain: any) {
  const parts = String(domain || "").split("|")
  const [source = "", marketId = "", volume = "", liquidity = "", last = "", ...imageParts] = parts
  return {
    source: source || "",
    marketId: marketId || "",
    volume: volume || "",
    liquidity: liquidity || "",
    last: last || "",
    image: imageParts.join("|") || "",
  }
}

function parseClobTokenIds(market: any): string[] {
  try {
    const raw = market?.clobTokenIds || "[]"
    const ids = typeof raw === "string" ? JSON.parse(raw) : raw
    return Array.isArray(ids) ? ids.filter(Boolean).map(String) : []
  } catch {
    return []
  }
}

function parseFirstOutcomeProb(market: any, fallback = 50) {
  if (market?.lastTradePrice && Number(market.lastTradePrice) > 0) {
    return Math.round(Number(market.lastTradePrice) * 100)
  }
  try {
    const raw = market?.outcomePrices || "[0.5,0.5]"
    const prices = typeof raw === "string" ? JSON.parse(raw) : raw
    return Math.round(Number(prices?.[0] ?? 0.5) * 100)
  } catch {
    return fallback
  }
}

function formatVolume(value: any) {
  const volume = toNumber(value, 0)
  if (!volume) return ""
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(0)}K`
  return `$${Math.round(volume)}`
}

function normalizeKey(label: string) {
  return label.trim().toLowerCase()
}

function marketDedupeKey(sim: { source?: string; marketId?: string; topic?: string }) {
  const source = normalizeKey(sim.source || "simulation")
  const topicKey = normalizeKey(sim.topic || "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const marketId = String(sim.marketId || "").trim()
  return topicKey ? `${source}:${topicKey}` : `${source}:${marketId}`
}

function dedupeMarkets<T extends { source?: string; marketId?: string; topic?: string; divergence?: number; createdAt?: string }>(rows: T[]) {
  const bestByMarket = new Map<string, T>()

  for (const row of rows) {
    const key = marketDedupeKey(row)
    const existing = bestByMarket.get(key)
    if (!existing) {
      bestByMarket.set(key, row)
      continue
    }

    const rowScore = Math.abs(Number(row.divergence || 0))
    const existingScore = Math.abs(Number(existing.divergence || 0))
    const rowTime = new Date(row.createdAt || 0).getTime()
    const existingTime = new Date(existing.createdAt || 0).getTime()

    if (rowScore > existingScore || (rowScore === existingScore && rowTime > existingTime)) {
      bestByMarket.set(key, row)
    }
  }

  return Array.from(bestByMarket.values())
}

function resultTotalActions(result: any) {
  const explicit = toNumber(result?.total_actions, 0)
  const fromRounds = Array.isArray(result?.round_logs)
    ? result.round_logs.reduce((sum: number, row: any) => sum + toNumber(row?.total_actions, 0), 0)
    : 0
  return Math.max(explicit, fromRounds)
}

function isUsableCustomResult(sim: any) {
  const result = sim?.result || {}
  const verdict = String(result?.verdict || "").trim()
  const agents = Array.isArray(result?.agents) ? result.agents : []
  const genericAgents = agents.filter((agent: any) => {
    const name = String(agent?.name || "").toLowerCase()
    const bio = String(agent?.bio || "").toLowerCase()
    return (
      name.startsWith("participant ") ||
      name.startsWith("agent ") ||
      bio.includes("interested observer") ||
      bio.includes("social media user following and discussing")
    )
  }).length

  if (resultTotalActions(result) <= 0) return false
  if (!Array.isArray(result?.round_logs) || result.round_logs.length === 0) return false
  if (!verdict || verdict.startsWith("Simulation complete. Top outcome:")) return false
  if (agents.length >= 5 && genericAgents / agents.length >= 0.8) return false
  return true
}

function normalizeOutcomes(result: any, marketInfo: any): MarketOutcome[] {
  const marketOutcomes = Array.isArray(result?.market_outcomes) ? result.market_outcomes : []
  const infoOutcomes = Array.isArray(marketInfo?.outcomes) ? marketInfo.outcomes : []
  const options = Array.isArray(result?.options) ? result.options : []
  const probs = result?.probabilityModel?.predictionMarket || {}
  const hemloProbs =
    result?.probabilityModel?.hemloModel ||
    result?.outcome_probabilities ||
    result?.outcomeProbabilities ||
    {}

  const raw = marketOutcomes.length
    ? marketOutcomes
    : infoOutcomes.length
      ? infoOutcomes
      : options.map((label: string) => ({ label, prob: probs?.[label] }))
  const infoByLabel = new Map<string, any>()
  infoOutcomes.forEach((o: any) => {
    const key = normalizeKey(String(o?.label || o?.name || o || ""))
    if (key) infoByLabel.set(key, o)
  })

  return raw
    .map((o: any, index: number) => {
      const label = String(o?.label || o?.name || o || "").trim()
      const info = infoByLabel.get(normalizeKey(label)) || infoOutcomes[index] || {}
      return {
        label,
        prob: o?.prob !== undefined ? Math.round(toNumber(o.prob, 0)) : info?.prob !== undefined ? Math.round(toNumber(info.prob, 0)) : undefined,
        hemloProb: o?.hemloProb !== undefined
          ? Math.round(toNumber(o.hemloProb, 0))
          : hemloProbs?.[label] !== undefined
            ? Math.round(toNumber(hemloProbs[label], 0))
            : undefined,
        tokenId: o?.tokenId || o?.clobTokenId || info?.tokenId || info?.clobTokenId,
        clobTokenId: o?.clobTokenId || o?.tokenId || info?.clobTokenId || info?.tokenId,
        image: o?.image || o?.icon || info?.image || info?.icon,
        icon: o?.icon || o?.image || info?.icon || info?.image,
      }
    })
    .filter((o: MarketOutcome) => o.label)
    .slice(0, 8)
}

function parsePolymarketEvent(ev: any) {
  const markets: any[] = Array.isArray(ev?.markets) ? ev.markets : []
  const activeMarkets = markets.filter((m: any) => !m.closed)
  const firstMarket = activeMarkets[0] || markets[0] || {}
  const grouped = activeMarkets.filter((m: any) => String(m.groupItemTitle || "").trim())

  let outcomes: MarketOutcome[] = []
  if (grouped.length >= 2) {
    outcomes = grouped
      .map((m: any) => {
        const tokenIds = parseClobTokenIds(m)
        return {
          label: String(m.groupItemTitle || m.question || "Option").trim(),
          prob: Math.max(1, Math.min(99, parseFirstOutcomeProb(m))),
          tokenId: tokenIds[0],
          clobTokenId: tokenIds[0],
          image: m?.image || m?.icon || ev?.image || ev?.icon || "",
          icon: m?.icon || m?.image || ev?.icon || ev?.image || "",
        }
      })
      .filter((o) => o.label)
      .sort((a, b) => toNumber(b.prob, 0) - toNumber(a.prob, 0))
      .slice(0, 8)
  }

  if (outcomes.length < 2 && firstMarket) {
    const tokenIds = parseClobTokenIds(firstMarket)
    const yesProb = Math.max(0, Math.min(100, parseFirstOutcomeProb(firstMarket)))
    outcomes = [
      { label: "Yes", prob: yesProb, tokenId: tokenIds[0], clobTokenId: tokenIds[0] },
      { label: "No", prob: 100 - yesProb, tokenId: tokenIds[1], clobTokenId: tokenIds[1] },
    ]
  }

  return {
    id: ev?.id || ev?.slug || firstMarket?.id || "",
    icon: ev?.icon || ev?.image || firstMarket?.icon || firstMarket?.image || "",
    image: ev?.image || ev?.icon || firstMarket?.image || firstMarket?.icon || "",
    category: ev?.tags?.[0]?.label || "",
    volume: formatVolume(ev?.volume || firstMarket?.volume),
    endDate: ev?.endDate || firstMarket?.endDate || "",
    marketType: outcomes.length > 2 ? "categorical" : "binary",
    outcomes,
  }
}

async function fetchPolymarketEnrichment(marketId: string, topic: string) {
  const candidates: string[] = []
  if (marketId) {
    candidates.push(`https://gamma-api.polymarket.com/events?id=${encodeURIComponent(marketId)}`)
    candidates.push(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(marketId)}`)
  }
  if (topic) {
    candidates.push(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(topic)}`)
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: POLY_HEADERS, next: { revalidate: 120 } })
      if (!res.ok) continue
      const data = await res.json()
      const event = Array.isArray(data)
        ? data[0]
        : data?.events?.[0] || data
      if (event) return parsePolymarketEvent(event)
    } catch {
      // Try the next source.
    }
  }

  return null
}

function mapCustomSimulation(sim: any) {
  const result = sim.result || {}
  const marketInfo = result.marketInfo || result.market_info || {}
  const domainMeta = parseDomainMeta(sim.domain)
  const outcomes = normalizeOutcomes(result, marketInfo)
  const predictionMarket = result?.probabilityModel?.predictionMarket || {}
  const hemloModel = result?.probabilityModel?.hemloModel || result?.outcome_probabilities || {}
  const firstLabel = outcomes[0]?.label
  const source = marketInfo.source || domainMeta.source || "simulation"
  const crowdOdds = toNumber(
    marketInfo.crowdOdds ??
      (firstLabel ? predictionMarket[firstLabel] : undefined) ??
      outcomes[0]?.prob,
    50,
  )
  const hemloOdds = toNumber(
    sim.primary_probability ??
      result.primary_probability ??
      result.top_probability ??
      (firstLabel ? hemloModel[firstLabel] : undefined),
    50,
  )
  const icon = marketInfo.icon || marketInfo.image || domainMeta.image || null

  return {
    id: sim.id,
    topic: sim.scenario,
    category: marketInfo.category || source || "Simulation",
    source,
    marketId: marketInfo.id || domainMeta.marketId || "",
    confidence: confidenceScore(result.confidence),
    confidenceLabel: result.confidence,
    hemloOdds,
    polymarketOdds: Math.round(crowdOdds).toString(),
    divergence: Math.round(hemloOdds - crowdOdds),
    divergenceSignal: Math.abs(hemloOdds - crowdOdds) >= 10 ? "high" : "normal",
    agentsModeled: result.agent_count || sim.agent_count,
    createdAt: sim.completed_at || sim.created_at,
    marketType: result.market_type || marketInfo.marketType || (outcomes.length > 2 ? "categorical" : "binary"),
    outcomes,
    icon,
    image: marketInfo.image || marketInfo.icon || domainMeta.image || icon,
    moneyAtStake: marketInfo.volume || domainMeta.volume || "",
    endDate: marketInfo.endDate || "",
    chartSeries: Array.isArray(marketInfo.chartSeries) ? marketInfo.chartSeries : [],
    resultHref: `/simulate/mirofish/${sim.id}`,
  }
}

async function enrichMarketSimulation(mapped: ReturnType<typeof mapCustomSimulation>) {
  if (mapped.source !== "polymarket") return mapped

  const hasImage = Boolean(mapped.icon || mapped.image)
  const hasTokens = mapped.outcomes.some((o) => o.tokenId || o.clobTokenId)
  const hasOutcomeImages = mapped.marketType !== "categorical" || mapped.outcomes.every((o) => o.image || o.icon)
  if (hasImage && hasTokens && hasOutcomeImages) return mapped

  const enrichment = await fetchPolymarketEnrichment(mapped.marketId, mapped.topic)
  if (!enrichment) return mapped

  const enrichedByLabel = new Map(enrichment.outcomes.map((o) => [normalizeKey(o.label), o]))
  const outcomes = mapped.outcomes.length
    ? mapped.outcomes.map((o, index) => {
        const enriched = enrichedByLabel.get(normalizeKey(o.label)) || enrichment.outcomes[index]
        return {
          ...o,
          prob: o.prob ?? enriched?.prob,
          tokenId: o.tokenId || enriched?.tokenId,
          clobTokenId: o.clobTokenId || enriched?.clobTokenId || enriched?.tokenId,
          image: o.image || o.icon || enriched?.image || enriched?.icon,
          icon: o.icon || o.image || enriched?.icon || enriched?.image,
        }
      })
    : enrichment.outcomes

  return {
    ...mapped,
    category: mapped.category === "polymarket" ? enrichment.category || mapped.category : mapped.category,
    marketType: mapped.marketType || enrichment.marketType,
    icon: mapped.icon || enrichment.icon || enrichment.image,
    image: mapped.image || enrichment.image || enrichment.icon,
    moneyAtStake: mapped.moneyAtStake || enrichment.volume,
    endDate: mapped.endDate || enrichment.endDate,
    outcomes,
  }
}

function mapLegacySimulation(sim: any) {
  const a = sim.analysis_data || {}
  return {
    id: sim.id,
    topic: sim.topic,
    topicSlug: a.topicSlug,
    source: "hemlo",
    category: "Hemlo",
    confidence: confidenceScore(a.confidence),
    confidenceLabel: a.confidence,
    hemloOdds: sim.hemlo_odds ?? a.hemloVerdict,
    polymarketOdds: sim.crowd_odds,
    divergence: sim.divergence,
    divergenceSignal: a.divergenceSignal,
    agentsModeled: a.agentsDeployed ?? 25,
    createdAt: sim.created_at,
    marketType: sim.market_type ?? "binary",
    outcomes: sim.outcomes || [],
    icon: a.icon || null,
    image: a.icon || null,
    chartSeries: [],
    resultHref: `/simulate/staple/${sim.id}`,
  }
}

export async function GET(req: NextRequest) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "No DB" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const scope = searchParams.get("scope") || "top"
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || (scope === "all" ? "120" : "30")) || 30))
    const lite = searchParams.get("lite") === "1" || searchParams.get("lite") === "true"
    const includeAllSources = scope === "all"
    const onlyToday = scope === "today"
    const supa = createClient(supaUrl, supaKey)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const customLimit = includeAllSources ? Math.max(limit, 120) : Math.max(limit * 3, 60)

    let customQuery = supa
      .from("custom_simulations")
      .select("id, scenario, domain, status, created_at, completed_at, result, primary_probability, agent_count, rounds")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(customLimit)

    if (onlyToday) {
      customQuery = customQuery.gte("completed_at", since)
    }

    const [{ data: customRows, error: customError }, { data: legacyRows }] = await Promise.all([
      customQuery,
      supa
        .from("simulations")
        .select("id, topic, created_at, analysis_data, crowd_odds, hemlo_odds, divergence, market_type, outcomes")
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    if (customError) {
      console.error("DB error fetching custom simulations:", customError)
    }

    const usableRows = (customRows || [])
      .filter(isUsableCustomResult)
      .map(mapCustomSimulation)

    const marketRows = usableRows.filter((sim) => sim.source === "polymarket" || sim.source === "kalshi")
    const nonMarketRows = includeAllSources || scope === "top"
      ? usableRows.filter((sim) => sim.source !== "polymarket" && sim.source !== "kalshi")
      : []
    const enrichedMarketRows = await Promise.all(marketRows.map(enrichMarketSimulation))
    const fallbackLegacyRows = includeAllSources || enrichedMarketRows.length === 0
      ? (legacyRows || []).map(mapLegacySimulation)
      : []

    const mapped = dedupeMarkets([...enrichedMarketRows, ...nonMarketRows, ...fallbackLegacyRows])
      .sort((a, b) => {
        if (scope === "all") {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        }
        return Math.abs(Number(b.divergence || 0)) - Math.abs(Number(a.divergence || 0))
      })
      .slice(0, limit)

    const responseData = lite
      ? mapped.map((item: any) => {
          const { chartSeries, ...rest } = item
          return rest
        })
      : mapped

    return NextResponse.json({ data: responseData }, { headers: CACHE_HEADERS })
  } catch (err: any) {
    console.error("Error in simulations-completed:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
