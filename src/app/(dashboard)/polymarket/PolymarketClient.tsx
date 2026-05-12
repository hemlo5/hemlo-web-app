// @ts-nocheck
"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart2, Globe, DollarSign, TrendingUp, TrendingDown,
  Zap, Activity, Radio, ArrowRight, ChevronDown, ChevronUp, Filter,
  AlertTriangle, Flame, Clock, Search, X, ChevronLeft, ChevronRight
} from "lucide-react"
import Link from "next/link"
import { HemloIndexChart, genIndexData } from "@/components/hemlo-index-chart"
import { ExploreMarkets } from "@/components/explore-markets"
import { HotSimulationsRail } from "@/components/hot-simulations-rail"
import { NewsTicker } from "@/components/news-ticker"
import { MarketSideRow, useSection } from "@/components/market-sidebar"
import { MirofishLaunchPanel, toMirofishLaunchMarket, type MirofishLaunchMarket } from "@/components/mirofish-launch-panel"
import { WorldMap } from "@/components/world-map"
import { useTrendingTopics } from "@/lib/useTrendingTopics"
import type { TrendingTopic, MarketStats } from "@/lib/types"
import { cachedJson, readClientCache } from "@/lib/client-cache"
import { createChart, ColorType, LineSeries } from "lightweight-charts"
import { useRef } from "react"
import { createClient } from "@/utils/supabase/client"

// ── HELPERS ──────────────────────────────────────────────────────────────────
function formatEndsIn(endDateStr: string | undefined): string {
  if (!endDateStr) return "N/A"
  const end = new Date(endDateStr).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return "Ended"
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function getOutcomeImage(outcome: any) {
  return outcome?.icon || outcome?.image || ""
}

function buildLaunchMarket(t: any, domain = "polymarket"): MirofishLaunchMarket {
  const yesProb = parseInt(t?.polymarketOdds || "50")
  const rawOutcomes = Array.isArray(t?.outcomes) && t.outcomes.length > 0
    ? t.outcomes
    : [
        { label: "Yes", prob: yesProb },
        { label: "No", prob: 100 - yesProb },
      ]
  const outcomes = rawOutcomes
    .filter((o: any) => o?.label)
    .slice(0, 12)
    .map((o: any, index: number) => ({
      label: String(o.label).trim(),
      prob: Number.isFinite(Number(o.prob)) ? Number(o.prob) : undefined,
      tokenId: o.tokenId || o.clobTokenId || t?.clobTokenIds?.[index],
      clobTokenId: o.clobTokenId || o.tokenId || t?.clobTokenIds?.[index],
      image: o.image || o.icon,
      icon: o.icon || o.image,
    }))

  return toMirofishLaunchMarket({
    ...t,
    question: t?.topic || t?.question || t?.title || "",
    source: domain,
    marketType: t?.marketType || (outcomes.length > 2 ? "categorical" : "binary"),
    outcomes,
    volume: t?.volume || t?.moneyAtStake || "",
    image: t?.icon || t?.image || "",
    icon: t?.icon || t?.image || "",
  }, domain)
}

function RealPolymarketChart({ t, isActive }: { t: any; isActive: boolean }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [seriesData, setSeriesData] = useState<Array<{ label: string; color: string; data: { time: number; value: number }[] }>>([])
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<any>(null)
  const lineColors = ["#7db7ff", "#2d9cff", "#facc15", "#fb8c23"]
  const chartOutcomes = useMemo(() => {
    const rawOutcomes = (
      t.marketType === "categorical" && Array.isArray(t.outcomes) && t.outcomes.length > 0
        ? t.outcomes
        : [
            { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
            { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") },
          ]
    ).slice(0, 4)

    return rawOutcomes.map((outcome: any, index: number) => ({
      label: String(outcome.label || `Outcome ${index + 1}`),
      prob: Number(outcome.prob),
      tokenId: String(outcome.tokenId || outcome.clobTokenId || t.clobTokenIds?.[index] || ""),
    }))
  }, [t])
  const tokenKey = chartOutcomes.map((o) => `${o.tokenId}:${o.label}:${o.prob}`).join("|")

  useEffect(() => {
    if (!isActive) return
    const outcomesWithTokens = chartOutcomes.filter((o) => o.tokenId)
    if (outcomesWithTokens.length === 0) {
      setSeriesData([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all(
      outcomesWithTokens.map((outcome, index) =>
        cachedJson<any>(`/api/polymarket-history?tokenId=${encodeURIComponent(outcome.tokenId)}&interval=1w&fidelity=60`, { ttlMs: 5 * 60_000 })
          .then((d) => ({ outcome, index, history: d.history || [] }))
          .catch(() => ({ outcome, index, history: [] }))
      )
    )
      .then((results) => {
        if (cancelled) return
        const nextSeries = results
          .map(({ outcome, index, history }) => {
            const seen = new Set<number>()
            const points = history
              .map((pt: any) => ({
                time: Number(pt.t),
                value: Math.max(0, Math.min(100, Number(pt.p) * 100)),
              }))
              .filter((pt: any) => Number.isFinite(pt.time) && Number.isFinite(pt.value))
              .sort((a: any, b: any) => a.time - b.time)
              .filter((pt: any) => {
                if (seen.has(pt.time)) return false
                seen.add(pt.time)
                return true
              })

            const currentProb = Number(outcome.prob)
            const now = Math.floor(Date.now() / 1000)
            const last = points[points.length - 1]
            if (last && Number.isFinite(currentProb) && now > last.time && Math.abs(last.value - currentProb) >= 0.2) {
              points.push({ time: now, value: Math.max(0, Math.min(100, currentProb)) })
            }

            return {
              label: outcome.label,
              color: lineColors[index % lineColors.length],
              data: points,
            }
          })
          .filter((series) => series.data.length >= 2)

        setSeriesData(nextSeries)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isActive, tokenKey])

  useEffect(() => {
    if (!chartContainerRef.current || loading || seriesData.length === 0) {
      if (chartRef.current) { try { chartRef.current.remove() } catch {}; chartRef.current = null }
      return
    }

    if (chartRef.current) { try { chartRef.current.remove() } catch {} }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#7b8794", fontFamily: "Inter, sans-serif", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.065)" } },
      rightPriceScale: { borderVisible: false, alignLabels: true, scaleMargins: { top: 0.12, bottom: 0.12 }, minimumWidth: 52 },
      timeScale: { borderVisible: false, timeVisible: false, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      localization: { priceFormatter: (v: number) => `${Math.round(v)}%` },
      crosshair: {
        vertLine: { color: "rgba(125,183,255,0.28)", labelBackgroundColor: "#1d4ed8" },
        horzLine: { color: "rgba(125,183,255,0.2)", labelBackgroundColor: "#1d4ed8" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      handleScroll: false,
      handleScale: false,
    })
    chartRef.current = chart

    seriesData.forEach((seriesItem, index) => {
      const series = chart.addSeries(LineSeries, {
        color: seriesItem.color,
        lineWidth: index === 0 ? 3 : 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: "#111820",
        crosshairMarkerBackgroundColor: seriesItem.color,
        priceFormat: { type: "custom", formatter: (v: number) => `${Math.round(v)}%` },
      })
      series.setData(seriesItem.data.map((pt) => ({ time: pt.time as any, value: pt.value })))
    })
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight })
    }
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(handleResize) : null
    if (resizeObserver && chartContainerRef.current) resizeObserver.observe(chartContainerRef.current)
    requestAnimationFrame(handleResize)
    window.addEventListener("resize", handleResize)
    return () => { resizeObserver?.disconnect(); window.removeEventListener("resize", handleResize); try { chart.remove() } catch {} }
  }, [seriesData, loading])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%", overflow: "hidden" }} />
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a6", fontSize: 13 }}>Loading chart...</div>
      )}
      {!loading && seriesData.length === 0 && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#6f7c8a", fontSize: 13, fontWeight: 700 }}>
          No live price history yet
        </div>
      )}
    </div>
  )
}

// MINI PRICE CHART - REMOVED

// ── STAT PILL ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 10, padding: "clamp(4px, 1.5vw, 6px) clamp(8px, 3vw, 14px)", display: "flex", alignItems: "center", gap: "clamp(4px, 2vw, 8px)", whiteSpace: "nowrap", flexShrink: 0 }}>
      <div style={{ fontSize: "clamp(9px, 2.5vw, 10px)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(11px, 3vw, 13px)", fontWeight: 800, color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  )
}

// ── SIMULATION CARD ──────────────────────────────────────────────────────────
function SimCard({ t, index }: { t: TrendingTopic; index: number }) {
  const isCat = t.marketType === "categorical";
  const outcomes = isCat && t.outcomes && t.outcomes.length > 0 ? t.outcomes : [
    { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
    { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") }
  ];

  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7"]; // Polymarket-style colors

  return (
    <Link href={`/simulate/staple/report?topic=${encodeURIComponent(t.topic)}`} style={{ textDecoration: "none" }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -2, backgroundColor: "rgba(255,255,255,0.03)" }}
        style={{
          background: "#15191d", // Dark, clean background like the image
          border: "1px solid #1e222b",
          borderRadius: 12,
          padding: "24px",
          cursor: "pointer",
          transition: "all 0.2s",
          display: "flex", flexDirection: "column", gap: 18,
          height: "100%",
        }}
      >
        {/* Header: Icon + Category */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4, overflow: "hidden", background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {t.icon ? (
              <img src={t.icon} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none" }} />
            ) : (
              <div style={{ width: 14, height: 14, background: "white", borderRadius: 2 }} />
            )}
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#8a94a6", textTransform: "uppercase", letterSpacing: 0.8 }}>
            {t.category || t.section || "PREDICTION"}
          </span>
        </div>

        {/* Title / Question */}
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f8f9fa", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {t.topic}
        </div>

        {/* Outcomes List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4, flex: 1 }}>
          {outcomes.slice(0, Math.max(2, outcomes.length)).slice(0, 3).map((o, i) => {
             const prob = o.prob || 0;
             const impliedMultiplier = (100 / Math.max(1, prob)).toFixed(2) + "x";
             const color = colors[i % colors.length];

             return (
               <div key={i} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                 <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingRight: 20, minWidth: 0 }}>
                   <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                     {getOutcomeImage(o) && (
                       <img src={getOutcomeImage(o)} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover", background: "#202a33", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none" }} />
                     )}
                     <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                   </div>
                   <div style={{ height: 2, background: "#1e293b", position: "relative", width: "100%", maxWidth: 120 }}>
                     <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${prob}%`, background: color }} />
                   </div>
                 </div>

                 <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                   <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                     {impliedMultiplier}
                   </span>
                   <div style={{
                     border: `1px solid ${color}60`, 
                     borderRadius: 20,
                     minWidth: 54,
                     height: 30,
                     display: "flex", alignItems: "center", justifyContent: "center",
                     fontSize: 14, fontWeight: 800, color: "#f8f9fa"
                   }}>
                     {Math.round(prob)}%
                   </div>
                 </div>
               </div>
             )
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: "auto", paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#8a94a6" }}>
            {t.divergence && Math.abs(t.divergence) > 5 ? (
              <span style={{ color: t.divergence > 0 ? colors[0] : colors[1], fontWeight: 700 }}>
                {Math.abs(t.divergence)}% AI Div
              </span>
            ) : "1 market"}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
type PolymarketClientProps = {
  initialMarkets?: TrendingTopic[]
  initialStats?: MarketStats | null
}

export default function PolymarketClient({ initialMarkets = [], initialStats = null }: PolymarketClientProps) {
  const [chartTab, setChartTab] = useState<"index" | "geo">("index")
  const [sideTab, setSideTab] = useState<"staples" | "trending" | "breaking">("staples")
  const [simFilter, setSimFilter] = useState("all")
  const [simSort, setSimSort] = useState("divergence")
  const [showMore, setShowMore] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(true)
  const [mobileSlideOpen, setMobileSlideOpen] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [launchMarket, setLaunchMarket] = useState<MirofishLaunchMarket | null>(null)
  const [user, setUser] = useState<any>(null)
  const [userTier, setUserTier] = useState<string>("free")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user)
    })
    // Fetch user tier
    const cachedUsage = readClientCache<any>("/api/usage")
    if (cachedUsage?.tier) setUserTier(cachedUsage.tier)
    cachedJson<any>("/api/usage", { ttlMs: 30_000 }).then(d => {
      if (d.tier) setUserTier(d.tier)
    }).catch(() => {})
  }, [])

  const doGoogleSignIn = async () => {
    const supabase = createClient()
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const redirectTo = `${origin}/auth/callback`

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account", access_type: "offline" },
      },
    })
  }

  useEffect(() => {
    // Wait a brief moment to ensure DOM is ready
    const timeout = setTimeout(() => {
      const target = document.getElementById("main-chart-area")
      if (!target) return
      
      const observer = new IntersectionObserver((entries) => {
        setShowScrollBtn(entries[0].isIntersecting)
      }, { threshold: 0.5 }) // 50% of chart on screen
      
      observer.observe(target)
      // Cleanup observer on unmount
      return () => observer.disconnect()
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

  // Data hooks
  const staples = useSection("/api/hemlo-staples")
  const trending = useSection("/api/daily-trending")
  const newPoly = useSection("/api/polymarket-browse?category=new&limit=6")
  const { topics: newsTopics, loading: newsLoading } = useTrendingTopics()
  const [selectedSide, setSelectedSide] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState<MarketStats | null>(initialStats)
  useEffect(() => {
    const cached = readClientCache<MarketStats>("/api/market-stats")
    if (cached) setStats(cached)
    cachedJson<MarketStats>("/api/market-stats", { ttlMs: 10 * 60_000 })
      .then(setStats)
      .catch(() => {})
  }, [])

  // Highest Volume Live Polymarket Markets
  const [topPolyMarkets, setTopPolyMarkets] = useState<TrendingTopic[]>(initialMarkets)
  const [loadingSims, setLoadingSims] = useState(initialMarkets.length === 0)
  const [polyCat, setPolyCat] = useState("trending")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setLoadingSims(true)
    const endpoint = `/api/polymarket-browse?category=${polyCat}&limit=12`
    const cached = readClientCache<any>(endpoint)
    if (cached) {
      const cachedMapped = (cached.markets || []).map((m: any) => ({
        ...m,
        topic: m.question || m.title || "",
        category: m.category || "Polymarket",
        polymarketOdds: m.outcomes?.[0]?.prob?.toString() || "50",
        icon: m.image || m.icon || "",
        moneyAtStake: m.volume || "",
      }))
      if (cachedMapped.length > 0) {
        setTopPolyMarkets(cachedMapped)
        setLoadingSims(false)
      }
    }
    cachedJson<any>(endpoint, { ttlMs: 90_000 })
      .then(d => {
        const mapped = (d.markets || []).map((m: any) => ({
          ...m,
          topic: m.question || m.title || "",
          category: m.category || "Polymarket",
          polymarketOdds: m.outcomes?.[0]?.prob?.toString() || "50",
          // outcomes & marketType come directly from the API — no override
          icon: m.image || m.icon || "",
          moneyAtStake: m.volume || "",
        }))
        console.log(`[PolymarketPage] Fetched ${d.markets?.length} raw, mapped to ${mapped.length}`)
        if (mapped.length === 0) {
          mapped.push({
            id: "fallback-market",
            topic: "Market data temporarily unavailable",
            category: "Error",
            polymarketOdds: "50",
            outcomes: [{ label: "Retrying...", prob: 50 }, { label: "Please wait", prob: 50 }],
            marketType: "binary",
            icon: "/polymarket.webp",
            volume: "$0",
          })
        }
        setTopPolyMarkets(mapped)
        setLoadingSims(false)
      })
      .catch(() => { setLoadingSims(false) })
  }, [polyCat])

  // BTC price from assets - REMOVED

  // HEMLO Index data
  const combined = [...staples.data, ...trending.data]
  const hemloAvg = combined.length ? combined.reduce((s, p) => s + (p.hemloOdds ?? 50), 0) / combined.length : 55
  const crowdAvg = combined.length ? combined.reduce((s, p) => s + parseInt(p.polymarketOdds ?? "50"), 0) / combined.length : 50
  const indexData = genIndexData(96, hemloAvg, crowdAvg)
  const lastH = indexData[indexData.length - 1]?.hemlo ?? 55
  const lastC = indexData[indexData.length - 1]?.crowd ?? 50
  const idxDiff = lastH - lastC
  const idxColor = idxDiff >= 0 ? "#22c55e" : "#ef4444"

  // Top divergence for stat pills
  const topDiv = combined.reduce((max, t) => Math.abs(t.divergence ?? 0) > Math.abs(max.divergence ?? 0) ? t : max, combined[0] ?? { topic: "—", divergence: 0 })
  const breakingCount = newsTopics.filter(t => t.urgency === "breaking").length

  // BTC price logic - REMOVED

  // Simulation cards — filter & sort
  const displayed = topPolyMarkets

  // Auto-scroll for the carousel
  useEffect(() => {
    if (displayed.length === 0) return
    const interval = setInterval(() => {
      setChartTab(prev => {
        const activeIdx = typeof prev === "number" ? prev : 0;
        return ((activeIdx + 1) % displayed.length) as any
      })
    }, 6000)
    return () => clearInterval(interval)
  }, [displayed.length])

  // Side panel data
  const sideData = sideTab === "staples" ? staples.data.slice(0, 20)
    : sideTab === "trending" ? trending.data.slice(0, 50)
    : newsTopics.filter(t => t.urgency === "breaking")
  const sideLoading = sideTab === "staples" ? staples.loading : sideTab === "trending" ? trending.loading : newsLoading

  // Selected asset for stocks tab - REMOVED

  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {isMobile && <NewsTicker />}

      {/* ── BODY: Carousel + Sidebar ── */}
      <div 
        id="main-chart-area" 
        className="home-hero-layout market-hero-padding" 
        style={{ 
          display: "flex", 
          justifyContent: "center",
          height: isMobile ? 500 : 495,
          minHeight: isMobile ? 500 : 495,
          maxHeight: isMobile ? 500 : 495,
          background: "#15191d", 
          overflow: "hidden",
          padding: isMobile ? "28px 14px" : "32px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", width: "100%", maxWidth: isMobile ? 930 : 1700, height: "100%", alignItems: "stretch", gap: isMobile ? 14 : 30 }}>
          {/* ── LEFT: Featured Carousel ── */}
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            flex: 1, 
            minWidth: 0, 
            position: "relative",
            alignItems: "center", 
            justifyContent: "center",
            overflow: "hidden",
            height: "100%",
          }}>
          
          {/* Navigation Arrow */}
          <button 
            onClick={() => {
              setChartTab(prev => {
                const activeIdx = typeof prev === "number" ? prev : 0;
                return ((activeIdx + 1) % displayed.length) as any
              })
            }}
            style={{ 
              position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", 
              background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", 
              width: 44, height: 44, 
              display: isMobile ? "none" : "flex", alignItems: "center", justifyContent: "center", 
              cursor: "pointer", zIndex: 20, transition: "all 0.2s" 
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#3b82f6"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}
          >
            <ChevronRight size={24} />
          </button>

          <AnimatePresence mode="wait">
            {displayed.length > 0 ? (
              <motion.div
                key={chartTab /* using chartTab state as activeIndex for carousel */}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{
                  width: "100%",
                  height: isMobile ? 420 : undefined,
                  maxWidth: 930,
                  background: "#181d21",
                  border: "1px solid #25303a",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
                  position: "relative",
                  color: "#ffffff",
                }}
              >
                {(() => {
                  const activeIdx = typeof chartTab === "number" ? chartTab : 0;
                  const t = displayed[activeIdx % displayed.length];
                  if (!t) return null;
                  
                  const isCat = t.marketType === "categorical";
                  const outcomes: {label:string;prob:number}[] = isCat
                    ? (t.outcomes || [])
                    : [
                        { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
                        { label: "No",  prob: 100 - parseInt(t.polymarketOdds || "50") },
                      ];

                  const topOutcome = outcomes[0] || { label: "Yes", prob: 50 };
                  const chartColors = ["#7db7ff", "#2d9cff", "#facc15", "#fb8c23"];

                  return (
                    <div className="home-carousel-card" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 40%) minmax(0, 1fr)", gridTemplateRows: isMobile ? "auto minmax(0, 1fr)" : undefined, width: "100%", height: isMobile ? "100%" : 431, minHeight: 0 }}>
                      
                      {/* ── LEFT SIDE: Info + Chart + CTA ── */}
                      <div className="home-carousel-left" style={{ padding: isMobile ? "20px" : "20px 20px 16px", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden", borderBottom: isMobile ? "1px solid #25303a" : "none" }}>
                        
                        {/* Header: Logo + Title */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
                          <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: 8, overflow: "hidden", background: "#202a33", flexShrink: 0 }}>
                            <img src={t.icon || t.image || "/polymarket.webp"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#768493", lineHeight: 1.2, marginBottom: 4 }}>
                              {t.category || "Polymarket"}
                            </div>
                            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 600, color: "#f6f8fb", lineHeight: 1.12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.topic}
                            </div>
                          </div>
                        </div>
                        
                        {/* Polymarket price chart */}
                        <div style={{ display: isMobile ? "none" : "block", flex: 1, minHeight: 0, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}>
                          <RealPolymarketChart t={t} isActive={true} />
                        </div>

                        {/* Volume badge */}
                        <div style={{ paddingTop: 6, fontSize: 13, color: "#50677f", fontWeight: 600 }}>
                          {t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Trending"}
                        </div>

                        {/* CTA */}
                        <div style={{ marginTop: 8 }}>
                            <motion.button
                              type="button"
                              onClick={() => setLaunchMarket(buildLaunchMarket(t, "polymarket"))}
                              whileHover={{ y: -1, boxShadow: "0 10px 28px rgba(255,255,255,0.18)" }}
                              whileTap={{ scale: 0.97 }}
                              style={{
                                width: "100%",
                                height: 48,
                                borderRadius: 8,
                                background: "#ffffff",
                                color: "#000000",
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 10,
                                boxShadow: "0 4px 16px rgba(255,255,255,0.1)",
                                border: "none",
                              }}
                            >
                              <img src="/hemlo-icon.svg" alt="Hemlo" style={{ width: 20, height: 20, objectFit: "contain" }} />
                              Simulate This Market
                            </motion.button>
                        </div>
                      </div>
                      
                      {/* ── RIGHT SIDE: Outcomes only ── */}
                      <div className="home-carousel-right" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", alignSelf: "stretch", boxSizing: "border-box", background: "transparent", padding: isMobile ? "16px 20px 16px" : "24px 28px 18px", borderLeft: isMobile ? "none" : "1px solid #25303a", borderTop: isMobile ? "1px solid #25303a" : "none", minWidth: 0, overflow: "hidden", minHeight: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
                          <div>
                            <div style={{ color: "#768493", fontSize: 11, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 5 }}>Market outcomes</div>
                            <div style={{ color: "#f3f6f9", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{topOutcome.label}</div>
                          </div>
                          <div style={{ color: "#f3f6f9", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{Math.round(topOutcome.prob)}%</div>
                        </div>

                        <div className="market-carousel-outcomes-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2, scrollbarWidth: "none" }}>
                          {outcomes.map((o, oi) => {
                            const prob = Math.max(0, Math.min(100, Math.round(o.prob || 0)));
                            const optionImage = getOutcomeImage(o);
                            const color = chartColors[oi % chartColors.length];
                            return (
                              <div key={`${o.label}-${oi}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 74px", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", minHeight: 72, flexShrink: 0 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9, minWidth: 0 }}>
                                    {optionImage ? (
                                      <img src={optionImage} alt="" style={{ width: 28, height: 28, borderRadius: 7, objectFit: "cover", background: "#202a33", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none" }} />
                                    ) : (
                                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
                                    )}
                                    <span style={{ color: "#e9eef5", fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                                  </div>
                                  <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${Math.max(prob, 1)}%`, borderRadius: 999, background: color }} />
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", color: "#f6f8fb", fontSize: 24, fontWeight: 900 }}>{prob}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {loadingSims ? "Loading Top Markets..." : "No markets available"}
              </div>
            )}
          </AnimatePresence>
        </div>

          <HotSimulationsRail />
        </div>
      </div>

      {/* ── EXPLORE ALL MARKETS ── */}
      <div id="top-simulations" style={{ borderTop: "1px solid var(--border)" }}>
        <ExploreMarkets defaultTab="polymarket" hideTabs={true} />
      </div>

      {/* ── HOW IT WORKS TEXT MODAL ── */}
      {howItWorksOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setHowItWorksOpen(false)}>
          <div style={{ background: "#11141b", borderRadius: 16, overflow: "hidden", border: "1px solid #1f2330", position: "relative", width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", padding: 40, color: "#ffffff", display: "flex", flexDirection: "column", gap: 24 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setHowItWorksOpen(false)} style={{ position: "absolute", top: 16, right: 16, zIndex: 10, background: "rgba(255,255,255,0.1)", border: "none", color: "white", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              <X size={18} />
            </button>
            
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>How Hemlo Works</div>
              <div style={{ color: "#8a94a6", fontSize: 14, lineHeight: 1.5 }}>Hemlo AI helps you discover predictive alpha by comparing crowd consensus with our advanced simulation engine.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
               <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Find a Market</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>Browse the trending Polymarket cards below or search for a specific event. Click on any market card to open the quick-view side panel.</div>
                  </div>
               </div>

               <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Click 'Simulate This'</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>In the side panel, review the current market pricing and outcomes. Click the prominent <strong>Simulate This</strong> button to run our proprietary intelligence engine against the event.</div>
                  </div>
               </div>

               <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(59,130,246,0.1)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>3</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Review the Alpha</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>Hemlo will instantly aggregate live news, sentiment, and historical data to run thousands of Monte Carlo simulations. You'll receive a detailed report showing our AI's predicted odds versus the market's current odds. If our prediction is higher, you've found alpha.</div>
                  </div>
               </div>
            </div>

            <button onClick={() => setHowItWorksOpen(false)} style={{ marginTop: 12, padding: "14px", borderRadius: 12, background: "#3b82f6", color: "white", border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", width: "100%" }}>
              Got it, let's go!
            </button>
          </div>
        </div>
      )}

      <MirofishLaunchPanel
        market={launchMarket}
        onClose={() => setLaunchMarket(null)}
      />

    </div>
  )
}
