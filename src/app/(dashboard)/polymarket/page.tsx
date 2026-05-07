// @ts-nocheck
"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart2, Globe, DollarSign, TrendingUp, TrendingDown,
  Zap, Activity, Radio, ArrowRight, ChevronDown, ChevronUp, Filter,
  AlertTriangle, Flame, Clock, Search, X, ChevronLeft, ChevronRight, Link2, Bookmark
} from "lucide-react"
import Link from "next/link"
import { HemloIndexChart, genIndexData } from "@/components/hemlo-index-chart"
import { ExploreMarkets } from "@/components/explore-markets"
import { HotSimulationsRail } from "@/components/hot-simulations-rail"
import { MarketSideRow, useSection } from "@/components/market-sidebar"
import { WorldMap } from "@/components/world-map"
import { useTrendingTopics } from "@/lib/useTrendingTopics"
import type { TrendingTopic, MarketStats } from "@/lib/types"
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

function buildMirofishHref(t: any, domain = "polymarket") {
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
      prob: Number.isFinite(Number(o.prob)) ? Math.round(Number(o.prob)) : undefined,
      tokenId: o.tokenId || o.clobTokenId || t?.clobTokenIds?.[index],
    }))

  const params = new URLSearchParams({
    scenario: t?.topic || "",
    domain,
    marketType: t?.marketType || (outcomes.length > 2 ? "categorical" : "binary"),
  })
  if (outcomes.length >= 2) params.set("outcomes", JSON.stringify(outcomes))
  if (t?.id) params.set("marketId", String(t.id))
  if (t?.icon || t?.image) params.set("img", String(t.icon || t.image))
  return `/simulate/mirofish?${params.toString()}`
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
        fetch(`/api/polymarket-history?tokenId=${encodeURIComponent(outcome.tokenId)}&interval=1w&fidelity=60`)
          .then((r) => r.json())
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
          background: "#0c0e12", // Dark, clean background like the image
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
                 <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingRight: 20 }}>
                   <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                     {o.label}
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
export default function HomePage() {
  const [chartTab, setChartTab] = useState<"index" | "geo">("index")
  const [sideTab, setSideTab] = useState<"staples" | "trending" | "breaking">("staples")
  const [simFilter, setSimFilter] = useState("all")
  const [simSort, setSimSort] = useState("divergence")
  const [showMore, setShowMore] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(true)
  const [mobileSlideOpen, setMobileSlideOpen] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userTier, setUserTier] = useState<string>("free")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user)
    })
    // Fetch user tier
    fetch("/api/usage").then(r => r.json()).then(d => {
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
  const [stats, setStats] = useState<MarketStats | null>(null)
  useEffect(() => { fetch("/api/market-stats").then(r => r.json()).then(setStats).catch(() => {}) }, [])

  // Highest Volume Live Polymarket Markets
  const [topPolyMarkets, setTopPolyMarkets] = useState<TrendingTopic[]>([])
  const [loadingSims, setLoadingSims] = useState(true)
  const [polyCat, setPolyCat] = useState("trending")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setLoadingSims(true)
    fetch(`/api/polymarket-browse?category=${polyCat}&limit=12`)
      .then(r => r.json())
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

      {/* ── POLYMARKET BRANDING HEADER ── */}
      <div style={{ padding: "14px 32px 12px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 18, background: "#0c0f16" }}>
         {/* Top Row: Logo, Search, Auth */}
         <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(320px, 620px) 1fr", alignItems: "center", columnGap: 18 }}>
            <div className="hide-mobile" style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0 }}>
                 <img src="/polymarket.webp" alt="Polymarket" style={{ width: 28, height: 28, flexShrink: 0 }} />
                 <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Polymarket</span>
              </div>
            </div>

            {/* Search Bar - Desktop Only */}
            <div className="hide-mobile" style={{ width: "100%", position: "relative" }}>
                <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#8a94a6" }} />
                <input 
                  type="text" 
                  placeholder="Search markets..." 
                  style={{ width: "100%", background: "#1a1e26", border: "1px solid #2d333d", borderRadius: 10, padding: "10px 16px 10px 42px", color: "white", fontSize: 14, outline: "none", transition: "border-color 0.2s" }}
                  onFocus={e => e.currentTarget.style.borderColor = "#3b82f6"}
                  onBlur={e => e.currentTarget.style.borderColor = "#2d333d"}
                />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 20 }}>
               <button onClick={() => setHowItWorksOpen(true)} className="hide-mobile" style={{ background: "none", border: "none", fontSize: 13, color: "#3b82f6", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
                 <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#3b82f6", color: "#0c0f16", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>i</div>
                 How it works
               </button>
               {!user ? (
                 <button onClick={doGoogleSignIn} style={{ padding: "8px 24px", borderRadius: 8, background: "#3b82f6", color: "white", border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Log In</button>
               ) : (
                 <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1a1e26", border: "1px solid #2d333d" }} />
               )}
            </div>
         </div>
         {/* Categories - Now visible on mobile too */}
         <div style={{ display: "flex", gap: 24, overflowX: "auto", scrollbarWidth: "none", alignItems: "center", paddingTop: 6, paddingBottom: 4 }}>
            <button onClick={() => setPolyCat("trending")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: polyCat === "trending" ? "#ffffff" : "#8a94a6", fontWeight: 800, fontSize: 14 }}>
              <TrendingUp size={16} /> Trending
            </button>
            {["Breaking", "New", "Politics", "Sports", "Crypto", "Esports", "Iran", "Finance", "Geopolitics", "Tech", "Culture", "Economy", "Weather"].map(c => (
              <button key={c} onClick={() => setPolyCat(c.toLowerCase())} style={{ background: "none", border: "none", padding: 0, color: polyCat === c.toLowerCase() ? "#ffffff" : "#8a94a6", fontWeight: polyCat === c.toLowerCase() ? 700 : 500, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.2s" }}>
                {c}
              </button>
            ))}
         </div>
      </div>

      {/* ── BODY: Carousel + Sidebar ── */}
      <div 
        id="main-chart-area" 
        className="home-hero-layout" 
        style={{ 
          display: "flex", 
          justifyContent: "center",
          height: "calc(100vh - 120px)",
          minHeight: 600,
          background: "#000000", 
          overflow: "hidden",
          padding: "0 40px"
        }}
      >
        <div style={{ display: "flex", width: "100%", maxWidth: 1700, height: "100%", alignItems: "center", gap: 30 }}>
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
              display: "flex", alignItems: "center", justifyContent: "center", 
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
                  maxWidth: 1240,
                  background: "#13191f",
                  border: "1px solid #25303a",
                  borderRadius: 22,
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
                    ? (t.outcomes || []).slice(0, 4)
                    : [
                        { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
                        { label: "No",  prob: 100 - parseInt(t.polymarketOdds || "50") },
                      ];

                  const topOutcome = outcomes[0] || { label: "Yes", prob: 50 };
                  const chartColors = ["#7db7ff", "#2d9cff", "#facc15", "#fb8c23"];

                  return (
                    <div className="home-carousel-card" style={{ display: "grid", gridTemplateColumns: "minmax(340px, 35%) minmax(0, 1fr)", width: "100%", height: 444, minHeight: 430 }}>
                      
                      {/* ── LEFT SIDE: Info, Buttons, Comments ── */}
                      <div className="home-carousel-left" style={{ padding: "22px 24px 16px", display: "flex", flexDirection: "column", minWidth: 0 }}>
                        
                        {/* Header: Logo + Title */}
                        <div style={{ display: "flex", gap: 15, alignItems: "flex-start", marginBottom: 15 }}>
                          <div style={{ width: 58, height: 58, borderRadius: 14, overflow: "hidden", background: "#202a33", flexShrink: 0 }}>
                            <img src={t.icon || t.image || "/polymarket.webp"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#768493", lineHeight: 1.2, marginBottom: 6 }}>
                              {t.category || "Polymarket"} <span style={{ color: "#55616d" }}>-</span> {polyCat.charAt(0).toUpperCase() + polyCat.slice(1)}
                            </div>
                            <div style={{ fontSize: 25, fontWeight: 900, color: "#f6f8fb", lineHeight: 1.08, letterSpacing: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.topic}
                            </div>
                          </div>
                        </div>
                        
                        {/* Outcome Buttons — binary=2 cols, categorical=grid */}
                        <div style={{ display: "flex", flexDirection: "column", marginTop: 2 }}>
                          {outcomes.slice(0, 4).map((o, oi) => (
                            <div key={oi} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "9px 0", borderBottom: oi < Math.min(outcomes.length, 4) - 1 ? "1px solid rgba(255,255,255,0.035)" : "none" }}>
                              <span style={{ color: "#d8dde3", fontSize: 17, fontWeight: 800, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {o.label}
                              </span>
                              <span style={{ color: "#e8edf2", fontSize: 23, fontWeight: 900, letterSpacing: 0, flexShrink: 0 }}>
                                {Math.round(o.prob)}%
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
                          <Link href={buildMirofishHref(t, "polymarket")} style={{ textDecoration: "none" }}>
                            <motion.div
                              whileHover={{ y: -1, boxShadow: "0 10px 28px rgba(255,255,255,0.18)" }}
                              whileTap={{ scale: 0.98 }}
                              style={{
                                padding: "16px 22px",
                                borderRadius: 12,
                                background: "#ffffff",
                                color: "#000000",
                                fontSize: 16,
                                fontWeight: 900,
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: 12,
                                boxShadow: "0 8px 24px rgba(255,255,255,0.13)",
                                transition: "box-shadow 0.2s, transform 0.2s",
                              }}
                            >
                              <img src="/hemlo-icon.svg" alt="Hemlo" style={{ width: 26, height: 26, objectFit: "contain" }} />
                              Simulate This Market
                            </motion.div>
                          </Link>
                        </div>

                        {/* Footer / Vol */}
                        <div style={{ marginTop: "auto", paddingTop: 8, fontSize: 14, color: "#50677f", fontWeight: 900 }}>
                          {t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Trending"}
                        </div>
                      </div>
                      
                      {/* ── RIGHT SIDE: Chart & Stats ── */}
                      <div className="home-carousel-right" style={{ display: "flex", flexDirection: "column", width: "100%", alignSelf: "stretch", boxSizing: "border-box", background: "transparent", padding: "22px 24px 16px 28px", borderLeft: "1px solid #25303a", position: "relative", minWidth: 0, overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 23, right: 26, display: "flex", alignItems: "center", gap: 17, color: "#dce3ea", zIndex: 4 }}>
                          <Link href={buildMirofishHref(t, "polymarket")} style={{ color: "inherit", lineHeight: 0 }} title="Run MiroFish simulation">
                            <Link2 size={19} strokeWidth={2.2} />
                          </Link>
                          <Bookmark size={20} strokeWidth={2.2} />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 16, minHeight: 30, marginBottom: 10, paddingRight: 86 }}>
                          <span style={{ color: "#f3f6f9", fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>{Math.round(topOutcome.prob)}%</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
                            {outcomes.slice(0, 4).map((o, oi) => (
                              <span key={o.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#7d8996", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: chartColors[oi % chartColors.length], display: "inline-block" }} />
                                {o.label} {Math.round(o.prob)}%
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        {/* Top Stats Row */}
                        <div style={{ display: "none", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                          <div style={{ display: "flex", gap: 40 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#8a94a6", fontWeight: 600 }}>Volume</span>
                              <span style={{ fontSize: 24, fontWeight: 800, color: "#94a3b8" }}>{t.moneyAtStake || "$0"}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>Top Outcome ▲</span>
                              <span style={{ fontSize: 24, fontWeight: 800, color: "#f59e0b" }}>{topOutcome.prob}%</span>
                            </div>
                          </div>
                          
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <span style={{ fontSize: 12, color: "#8a94a6", fontWeight: 600 }}>Ends in</span>
                            <span style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>
                              {formatEndsIn(t.endDate)}
                            </span>
                          </div>
                        </div>

                        {/* Main Chart Area */}
                        <div style={{ flex: 1, position: "relative", width: "100%", minWidth: 0, minHeight: 250, opacity: 1, overflow: "hidden" }}>
                           <RealPolymarketChart t={t} isActive={true} />
                           {/* Fake Target Line */}
                           <div style={{ display: "none", position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #334155", zIndex: 0, pointerEvents: "none" }}>
                              <div style={{ position: "absolute", right: -10, top: -12, background: "#475569", padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>Target</div>
                           </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, color: "#566b80", fontSize: 14, fontWeight: 800, padding: "6px 0 0" }}>
                          <span>{t.endDate ? `Ends ${new Date(t.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "Active market"}</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <img src="/polymarket.webp" alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.75 }} />
                            Polymarket
                          </span>
                        </div>

                        {/* Pagination Dots at very bottom */}
                        <div style={{ position: "absolute", bottom: 24, right: 32, display: "none", gap: 8 }}>
                           <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {displayed.map((_, i) => (
                              <div key={i} onClick={() => setChartTab(i as any)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeIdx ? "#ffffff" : "#475569", cursor: "pointer" }} />
                            ))}
                          </div>
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

    </div>
  )
}
