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

function getOutcomeImage(outcome: any) {
  return outcome?.icon || outcome?.image || ""
}

function buildLaunchMarket(t: any, domain = "kalshi"): MirofishLaunchMarket {
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
    cachedJson<any>(`/api/polymarket-history?tokenId=${tokenId}&interval=1w`, { ttlMs: 5 * 60_000 })
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
type KalshiClientProps = {
  initialMarkets?: TrendingTopic[]
  initialStats?: MarketStats | null
}

export default function KalshiClient({ initialMarkets = [], initialStats = null }: KalshiClientProps) {
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

  // Highest Volume Live Kalshi Markets
  const [topKalshiMarkets, setTopKalshiMarkets] = useState<TrendingTopic[]>(initialMarkets)
  const [loadingSims, setLoadingSims] = useState(initialMarkets.length === 0)
  const [kalshiCat, setKalshiCat] = useState("trending")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    setLoadingSims(true)
    const endpoint = `/api/kalshi-markets?category=${kalshiCat}`
    const cached = readClientCache<any>(endpoint)
    if (cached) {
      const cachedMapped = (cached.markets || []).map((m: any) => ({
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
      if (cachedMapped.length > 0) {
        setTopKalshiMarkets(cachedMapped)
        setLoadingSims(false)
      }
    }
    cachedJson<any>(endpoint, { ttlMs: 90_000 })
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
        <div style={{ display: "flex", width: "100%", maxWidth: isMobile ? 930 : 1400, height: "100%", alignItems: "stretch", gap: isMobile ? 14 : 40 }}>
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
              position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", 
              background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", 
              width: 44, height: 44, 
              display: isMobile ? "none" : "flex", alignItems: "center", justifyContent: "center", 
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
                  height: isMobile ? 420 : undefined,
                  maxWidth: 930,
                  background: "#181d21",
                  border: "1px solid #1f2330",
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
                  const outcomes = isCat ? (t.outcomes || []) : [{ label: "Yes", prob: parseInt(t.polymarketOdds || "50") }, { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") }];
                  
                  const o1 = outcomes[0] || { label: "UP", prob: 50 };

                  return (
                    <div className="home-carousel-card" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 40%) minmax(0, 1fr)", gridTemplateRows: isMobile ? "auto minmax(0, 1fr)" : undefined, width: "100%", height: isMobile ? "100%" : 431, minHeight: 0 }}>
                      
                      {/* ── LEFT SIDE: Info + Chart + CTA ── */}
                      <div className="home-carousel-left" style={{ padding: isMobile ? "20px" : "20px 20px 16px", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden", borderRight: isMobile ? "none" : "1px solid #1f2330", borderBottom: isMobile ? "1px solid #25303a" : "none" }}>
                        
                        {/* Header: Logo + Title */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
                          <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: 8, overflow: "hidden", background: "#1f2330", flexShrink: 0 }}>
                            <img src={t.icon || t.image || "/kalshi.webp"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#768493", lineHeight: 1.2, marginBottom: 4 }}>
                              {t.category || "Kalshi"}
                            </div>
                            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 600, color: "#f6f8fb", lineHeight: 1.12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.topic}
                            </div>
                          </div>
                        </div>
                        
                        {/* Kalshi price chart */}
                        <div style={{ display: isMobile ? "none" : "block", flex: 1, minHeight: 0, borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginTop: 4 }}>
                          <RealKalshiChart t={t} isActive={true} />
                        </div>

                        {/* Volume badge */}
                        <div style={{ paddingTop: 6, fontSize: 13, color: "#50677f", fontWeight: 600 }}>
                          {t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Trending"}
                        </div>

                        {/* CTA */}
                        <div style={{ marginTop: 8 }}>
                            <motion.button
                              type="button"
                              onClick={() => setLaunchMarket(buildLaunchMarket(t, "kalshi"))}
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
                      <div className="home-carousel-right" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", alignSelf: "stretch", boxSizing: "border-box", background: "transparent", padding: isMobile ? "16px 20px 16px" : "24px 28px 18px", borderLeft: isMobile ? "none" : "1px solid #25303a", borderTop: isMobile ? "1px solid #25303a" : "none", position: "relative", minWidth: 0, overflow: "hidden", minHeight: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
                          <div>
                            <div style={{ color: "#768493", fontSize: 11, fontWeight: 900, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 5 }}>Market outcomes</div>
                            <div style={{ color: "#f3f6f9", fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{o1.label}</div>
                          </div>
                          <div style={{ color: "#f3f6f9", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{Math.round(o1.prob)}%</div>
                        </div>

                        <div className="market-carousel-outcomes-scroll" style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2, scrollbarWidth: "none" }}>
                          {outcomes.map((o, oi) => {
                            const prob = Math.max(0, Math.min(100, Math.round(o.prob || 0)));
                            const color = ["#22c55e", "#16a34a", "#7dd3fc", "#facc15"][oi % 4];
                            const optionImage = o.icon || o.image;
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

      <MirofishLaunchPanel
        market={launchMarket}
        onClose={() => setLaunchMarket(null)}
      />

    </div>
  )
}
