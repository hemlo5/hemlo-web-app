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
import { MarketSideRow, useSection } from "@/components/market-sidebar"
import { WorldMap } from "@/components/world-map"
import { useTrendingTopics } from "@/lib/useTrendingTopics"
import type { TrendingTopic, MarketStats } from "@/lib/types"
import { createChart, ColorType, AreaSeries } from "lightweight-charts"
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

function buildMirofishHref(t: any, domain = "kalshi") {
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

function RealKalshiChart({ t, isActive }: { t: any; isActive: boolean }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [historyData, setHistoryData] = useState<{ time: number; value: number }[] | null>(null)
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!isActive) return
    if (historyData) return
    const tokenId = `kalshi-${t.id}`
    setLoading(true)
    fetch(`/api/polymarket-history?tokenId=${tokenId}&interval=1w`)
      .then(r => r.json())
      .then(d => {
        if (d.history && d.history.length > 0) {
          const pts = d.history.map((pt: any) => ({ time: pt.t, value: Math.round(pt.p * 100) }))
          setHistoryData(pts)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isActive, t, historyData])

  const baseProb = parseInt(t.polymarketOdds || "50")
  const fallback = Array.from({ length: 60 }, (_, i) => ({
    time: Math.floor(Date.now() / 1000) - (60 - i) * 3600,
    value: Math.max(0, Math.min(100, baseProb + Math.sin(i * 0.4) * 4 + Math.cos(i * 0.7) * 2))
  }))
  const pts = historyData || fallback

  useEffect(() => {
    if (!chartContainerRef.current || pts.length === 0) return
    if (chartRef.current) { try { chartRef.current.remove() } catch {} }
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#6b7280", fontFamily: "Inter, sans-serif", fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.15 }, minimumWidth: 50 },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, fixLeftEdge: true, fixRightEdge: true },
      crosshair: { vertLine: { labelBackgroundColor: "#22c55e" }, horzLine: { labelBackgroundColor: "#22c55e" } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      handleScroll: false,
      handleScale: false,
    })
    chartRef.current = chart
    const isLow = baseProb < 15
    const lineColor = isLow ? "#ef4444" : baseProb > 60 ? "#22c55e" : "#22c55e"
    const topFill = isLow ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.18)"
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: topFill,
      bottomColor: "rgba(0,0,0,0)",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${Math.round(v)}%` },
    })
    // Sort by timestamp ascending and remove duplicate timestamps
    const sortedPts = [...pts]
      .sort((a, b) => a.time - b.time)
      .filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time)
    series.setData(sortedPts.map(p => ({ time: p.time as any, value: p.value })))
    chart.timeScale().fitContent()
    const handleResize = () => {
      if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight })
    }
    window.addEventListener("resize", handleResize)
    return () => { window.removeEventListener("resize", handleResize); try { chart.remove() } catch {} }
  }, [pts, baseProb])

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
      {loading && !historyData && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a6", fontSize: 13 }}>Loading chart...</div>
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

  // Highest Volume Live Kalshi Markets
  const [topKalshiMarkets, setTopKalshiMarkets] = useState<TrendingTopic[]>([])
  const [loadingSims, setLoadingSims] = useState(true)
  const [kalshiCat, setKalshiCat] = useState("trending")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setLoadingSims(true)
    fetch(`/api/kalshi-markets?category=${kalshiCat}`)
      .then(r => r.json())
      .then(d => {
        // Map Kalshi specific fields to the TrendingTopic format the UI expects
        const mapped = (d.markets || []).map((m: any) => ({
          ...m,
          topic: m.title,
          category: m.category || "Kalshi",
          polymarketOdds: m.yesPrice?.toString() || "50",
          outcomes: m.outcomes && m.outcomes.length > 0 
            ? m.outcomes 
            : [{ label: "Yes", prob: m.yesPrice || 50 }, { label: "No", prob: m.noPrice || 50 }],
          icon: m.image,
          moneyAtStake: m.volume,
          marketType: m.marketType === "categorical" || (m.outcomes && m.outcomes.length > 2) ? "categorical" : "binary",
        }))
        setTopKalshiMarkets(mapped.length > 0 ? mapped : [{
          id: "fallback-kalshi",
          topic: "Kalshi data temporarily unavailable",
          category: "Error",
          polymarketOdds: "50",
          outcomes: [{ label: "Retrying...", prob: 50 }, { label: "Please wait", prob: 50 }],
          marketType: "binary",
          icon: "/kalshi.webp",
          moneyAtStake: "$0",
        }])
        setLoadingSims(false)
      })
      .catch(() => { setLoadingSims(false) })
  }, [kalshiCat])

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
  const displayed = topKalshiMarkets

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

      {/* ── KALSHI BRANDING HEADER ── */}
      <div style={{ padding: "14px 32px 12px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 18, background: "#0c0f16" }}>
         {/* Top Row: Logo, Search, Auth */}
         <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(320px, 620px) 1fr", alignItems: "center", columnGap: 18 }}>
            <div className="hide-mobile" style={{ minWidth: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, minWidth: 0 }}>
                 <img src="/kalshi.webp" alt="Kalshi" style={{ width: 28, height: 28, flexShrink: 0 }} />
                 <span style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Kalshi</span>
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
            <button onClick={() => setKalshiCat("trending")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: kalshiCat === "trending" ? "#ffffff" : "#8a94a6", fontWeight: 800, fontSize: 14 }}>
              <TrendingUp size={16} /> Trending
            </button>
            {["Breaking", "New", "Politics", "Sports", "Crypto", "Esports", "Iran", "Finance", "Geopolitics", "Tech", "Culture", "Economy", "Weather"].map(c => (
              <button key={c} onClick={() => setKalshiCat(c.toLowerCase())} style={{ background: "none", border: "none", padding: 0, color: kalshiCat === c.toLowerCase() ? "#ffffff" : "#8a94a6", fontWeight: kalshiCat === c.toLowerCase() ? 700 : 500, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.2s" }}>
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
        <div style={{ display: "flex", width: "100%", maxWidth: 1400, height: "100%", alignItems: "center", gap: 40 }}>
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
            onMouseEnter={e => { e.currentTarget.style.color = "#22c55e"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}
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
                  maxWidth: 920,
                  background: "#11141b",
                  border: "1px solid #1f2330",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                  position: "relative",
                  color: "#ffffff",
                }}
              >
                {(() => {
                  const activeIdx = typeof chartTab === "number" ? chartTab : 0;
                  const t = displayed[activeIdx % displayed.length];
                  if (!t) return null;
                  
                  const isCat = t.marketType === "categorical";
                  const outcomes = isCat ? (t.outcomes || []) : [{ label: "Yes", prob: parseInt(t.polymarketOdds || "50") }, { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") }];
                  
                  const o1 = outcomes[0] || { label: "UP", prob: 50 };
                  const o2 = outcomes[1] || { label: "DOWN", prob: 50 };
                  const o1Mult = (100 / Math.max(1, o1.prob)).toFixed(1);
                  const o2Mult = (100 / Math.max(1, o2.prob)).toFixed(2);

                  return (
                    <div className="home-carousel-card" style={{ display: "flex", flex: 1, minHeight: 460 }}>
                      
                      {/* ── LEFT SIDE: Info, Buttons, Comments ── */}
                      <div className="home-carousel-left" style={{ flex: "0 0 40%", padding: "24px 32px", display: "flex", flexDirection: "column", borderRight: "1px solid #1f2330" }}>
                        
                        {/* Header: Logo + Title */}
                        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", background: "#1f2330", flexShrink: 0 }}>
                            <img src={t.icon || t.image || "/kalshi.webp"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", lineHeight: 1.2, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.topic}
                            </div>
                            <div style={{ fontSize: 13, color: "#8a94a6", fontWeight: 500 }}>
                              {t.endDate ? `Ends ${new Date(t.endDate).toLocaleDateString()}` : "Active Market"}
                            </div>
                          </div>
                        </div>
                        {/* Outcome Buttons — binary=2 cols, categorical=grid */}
                        <div style={{ display: "grid", gridTemplateColumns: outcomes.length <= 2 ? "1fr 1fr" : "1fr 1fr", gap: 8, marginBottom: 20 }}>
                          {(isMobile && outcomes.length > 2 ? outcomes.slice(0, 2) : outcomes).map((o, oi) => {
                            const colors = [
                              { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.35)",  text: "#22c55e" },
                              { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.28)",  text: "#ef4444" },
                              { bg: "rgba(59,130,246,0.12)",border: "rgba(59,130,246,0.28)", text: "#3b82f6" },
                              { bg: "rgba(245,158,11,0.12)",border: "rgba(245,158,11,0.28)", text: "#f59e0b" },
                            ]
                            const c = colors[oi % colors.length]
                            return (
                              <button key={oi} style={{ padding: "12px 8px", borderRadius: 10, background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 0 }}>
                                <span style={{ fontSize: 10, opacity: 0.75, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{o.label.toUpperCase()}</span>
                                <span style={{ fontSize: 18 }}>{o.prob}%</span>
                              </button>
                            )
                          })}
                          {isMobile && outcomes.length > 2 && (
                            <div style={{ gridColumn: "span 2", textAlign: "center", fontSize: 12, color: "#8a94a6", fontWeight: 700, marginTop: 4 }}>
                              +{outcomes.length - 2} more outcomes
                            </div>
                          )}
                        </div>
                        
                        {/* Simulate Button instead of Comments */}
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
                          <Link href={buildMirofishHref(t, "kalshi")} style={{ textDecoration: "none" }}>
                            <div style={{ padding: "18px 24px", borderRadius: 12, background: "#ffffff", color: "#000000", fontSize: 16, fontWeight: 800, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 12, boxShadow: "0 8px 24px rgba(255,255,255,0.15)", transition: "transform 0.2s" }}>
                              <img src="/hemlo-icon.svg" alt="Hemlo" style={{ width: 26, height: 26, objectFit: "contain" }} />
                              Simulate This Market
                            </div>
                          </Link>
                        </div>

                        {/* Footer / Vol */}
                        <div style={{ marginTop: 24, fontSize: 13, color: "#3b82f6", fontWeight: 700 }}>
                          {t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Trending"}
                        </div>
                      </div>
                      
                      {/* ── RIGHT SIDE: Chart & Stats ── */}
                      <div className="home-carousel-right" style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px", position: "relative" }}>
                        
                        {/* Top Stats Row */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                          <div style={{ display: "flex", gap: 40 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#8a94a6", fontWeight: 600 }}>Volume</span>
                              <span style={{ fontSize: 24, fontWeight: 800, color: "#94a3b8" }}>{t.moneyAtStake || "$0"}</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Current Odds ▲</span>
                              <span style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{o1.prob}%</span>
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
                        <div style={{ flex: 1, position: "relative", width: "100%", opacity: 1 }}>
                           <RealKalshiChart t={t} isActive={true} />
                           {/* Fake Target Line */}
                           <div style={{ position: "absolute", top: "50%", left: 0, right: 0, borderTop: "1px dashed #334155", zIndex: 0, pointerEvents: "none" }}>
                              <div style={{ position: "absolute", right: -10, top: -12, background: "#475569", padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>Target</div>
                           </div>
                        </div>

                        {/* Pagination Dots at very bottom */}
                        <div style={{ position: "absolute", bottom: 24, right: 32, display: "flex", gap: 8 }}>
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
        <ExploreMarkets defaultTab="kalshi" hideTabs={true} />
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
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(34,197,94,0.1)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Find a Market</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>Browse the trending Kalshi cards below or search for a specific event. Click on any market card to open the quick-view side panel.</div>
                  </div>
               </div>

               <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(34,197,94,0.1)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Click 'Simulate This'</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>In the side panel, review the current market pricing and outcomes. Click the prominent <strong>Simulate This</strong> button to run our proprietary intelligence engine against the event.</div>
                  </div>
               </div>

               <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(34,197,94,0.1)", color: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>3</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Review the Alpha</div>
                    <div style={{ color: "#8a94a6", fontSize: 13, lineHeight: 1.5 }}>Hemlo will instantly aggregate live news, sentiment, and historical data to run thousands of Monte Carlo simulations. You'll receive a detailed report showing our AI's predicted odds versus the market's current odds. If our prediction is higher, you've found alpha.</div>
                  </div>
               </div>
            </div>

            <button onClick={() => setHowItWorksOpen(false)} style={{ marginTop: 12, padding: "14px", borderRadius: 12, background: "#22c55e", color: "white", border: "none", fontWeight: 800, fontSize: 15, cursor: "pointer", width: "100%" }}>
              Got it, let's go!
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
