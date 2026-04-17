// @ts-nocheck
"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart2, Globe, DollarSign, TrendingUp, TrendingDown,
  Zap, Activity, Radio, ArrowRight, ChevronDown, ChevronUp, Filter,
  AlertTriangle, Flame, Clock
} from "lucide-react"
import Link from "next/link"
import { HemloIndexChart, genIndexData } from "@/components/hemlo-index-chart"
import { ExploreMarkets } from "@/components/explore-markets"
import { MarketSideRow, useSection } from "@/components/market-sidebar"
import { WorldMap } from "@/components/world-map"
import { useTrendingTopics } from "@/lib/useTrendingTopics"
import type { TrendingTopic, MarketStats } from "@/lib/types"
import { createChart, ColorType, AreaSeries } from "lightweight-charts"
import { useRef } from "react"

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
  const { topics: newsTopics, loading: newsLoading } = useTrendingTopics()
  const [selectedSide, setSelectedSide] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState<MarketStats | null>(null)
  useEffect(() => { fetch("/api/market-stats").then(r => r.json()).then(setStats).catch(() => {}) }, [])

  // Completed Simulations (pulled directly from DB)
  const [completedSims, setCompletedSims] = useState<TrendingTopic[]>([])
  const [mySims, setMySims] = useState<TrendingTopic[]>([])
  const [loadingSims, setLoadingSims] = useState(true)
  useEffect(() => {
    fetch("/api/simulations-completed")
      .then(r => r.json())
      .then(d => { setCompletedSims(d.data || []); setLoadingSims(false) })
      .catch(() => { setLoadingSims(false) })

    fetch("/api/my-simulations")
      .then(r => r.json())
      .then(d => { setMySims(d.data || []) })
      .catch(() => {})
  }, [])

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
  const simCandidates = simFilter === "mine" ? mySims : completedSims
  const sorted = [...simCandidates].sort((a, b) => {
    if (simSort === "divergence") return Math.abs(b.divergence ?? 0) - Math.abs(a.divergence ?? 0)
    if (simSort === "confidence") return (b.confidence ?? 0) - (a.confidence ?? 0)
    return 0
  })
  const displayed = showMore ? sorted : sorted.slice(0, 9)

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

      {/* ── TOP BAR ── */}
      <div style={{ padding: "8px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0, overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch" }}>
        <div className="stat-pills-row">
          {topDiv && <StatPill label="Top Div" value={`${topDiv.topic?.slice(0, 20)}… ${topDiv.divergence > 0 ? "+" : ""}${topDiv.divergence}%`} color={Math.abs(topDiv.divergence ?? 0) > 10 ? "var(--accent)" : undefined} />}
          <StatPill label="Breaking" value={`${breakingCount} events`} color={breakingCount > 0 ? "#ef4444" : undefined} />
          {stats && <StatPill label="Fear & Greed" value={`${stats.fearGreedValue} · ${stats.fearGreedLabel}`} color={stats.fearGreedValue > 60 ? "#22c55e" : stats.fearGreedValue < 40 ? "#ef4444" : "var(--accent)"} />}
        </div>
      </div>

      {/* ── BODY: 75/25 split ── */}
      <div id="main-chart-area" className="home-hero-layout" style={{ display: "grid", gridTemplateColumns: "1fr 340px", height: "calc(100vh - 47px)", minHeight: 600, overflow: "hidden", borderBottom: "1px solid var(--border)" }}>

        {/* ── LEFT: Featured Carousel (75%) ── */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", padding: "32px 40px", overflow: "hidden", position: "relative", alignItems: "center", justifyContent: "center" }}>
          
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
                  maxWidth: 980,
                  background: "#141414",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}
              >
                {(() => {
                  // Reusing chartTab state as active index (number) for the carousel
                  const activeIdx = typeof chartTab === "number" ? chartTab : 0;
                  const t = displayed[activeIdx % displayed.length];
                  if (!t) return null;
                  
                  const isCat = t.marketType === "categorical";
                  const outcomes = isCat ? (t.outcomes || []) : [{ label: "Yes", prob: parseInt(t.polymarketOdds || "50"), hemloProb: t.hemloOdds || 50 }, { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50"), hemloProb: 100 - (t.hemloOdds || 50) }];
                  
                  return (
                    <div className="home-carousel-card" style={{ display: "flex", flex: 1, minHeight: 460 }}>
                      
                      {/* Carousel Card Left Side */}
                      <div style={{ flex: 1, padding: "clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#111", flexShrink: 0 }}>
                            <img src="/polymarket.webp" alt="Polymarket" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Polymarket</div>
                            {t.section && <div style={{ fontSize: 9, color: "var(--accent-soft)", fontWeight: 700 }}>{t.section}</div>}
                          </div>
                        </div>
                        
                        <div style={{ fontSize: "clamp(18px, 4vw, 28px)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 40 }}>
                          {t.topic}
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
                          {outcomes.slice(0, 4).map((o, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: "clamp(12px, 3vw, 14px)", fontWeight: 700, color: "var(--text-secondary)" }}>{o.label}</span>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {o.hemloProb !== undefined && (
                                  <span style={{ fontSize: "clamp(11px, 2.5vw, 12px)", fontWeight: 600, color: "var(--accent)" }}>AI {Math.round(o.hemloProb)}%</span>
                                )}
                                <span style={{ fontSize: "clamp(14px, 3.5vw, 16px)", fontWeight: 800, color: "var(--text-primary)", width: 44, textAlign: "right" }}>{Math.round(o.prob)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            {displayed.map((_, i) => (
                              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === activeIdx ? "var(--text-primary)" : "var(--border)" }} />
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={() => setChartTab(((activeIdx - 1 + displayed.length) % displayed.length) as any)} style={{ padding: "8px 16px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>&lt; Prev</button>
                            <button onClick={() => setChartTab(((activeIdx + 1) % displayed.length) as any)} style={{ padding: "8px 16px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Next &gt;</button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Carousel Card Right Side (Divergence Graphic/Index) */}
                      <div className="home-carousel-right" style={{ width: 340, background: "rgba(0,0,0,0.3)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", padding: 24, position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 24 }}>Simulation Intelligence</div>
                          
                          <div style={{ marginBottom: 24 }}>
                             <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Divergence Signal</div>
                             <div style={{ fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 900, color: (t.divergence ?? 0) > 0 ? "#22c55e" : "#ef4444" }}>
                               {(t.divergence ?? 0) > 0 ? "+" : ""}{t.divergence}%
                             </div>
                             <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8, lineHeight: 1.5 }}>
                               {t.divergenceSignal || "Market consensus lacks critical contextual data."}
                             </div>
                          </div>

                          <div style={{ marginTop: "auto" }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Simulated Path</div>
                            <div style={{ height: 120, width: "100%", opacity: 0.8 }}>
                               <HemloIndexChart data={genIndexData(40, t.hemloOdds ?? 50, parseInt(t.polymarketOdds ?? "50"))} idxColor={"var(--accent)"} />
                            </div>
                            <Link href={`/simulate/staple/report?topic=${encodeURIComponent(t.topic)}`} style={{ display: "block", width: "100%", background: "var(--text-primary)", color: "#000", textAlign: "center", padding: "12px", borderRadius: 8, marginTop: 16, fontSize: 13, fontWeight: 800, textDecoration: "none" }}>
                              View Full Report
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {loadingSims ? "Loading Top Simulations..." : "No fully simulated markets available"}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Trending/Breaking Panel (25%) ── */}
        <div className="hide-mobile" style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#050505" }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Breaking news &gt;</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", borderBottom: "1px solid var(--border)" }}>
          {newsTopics.filter(t => t.urgency === "breaking" || t.urgency === "hot").slice(0, 6).map((t, i) => (
              <div key={i} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: t.urgency === "breaking" ? "#ef4444" : "var(--accent)", flexShrink: 0 }}>
                    {t.urgency}
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.category}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {t.topic}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>Hot topics &gt;</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {trending.data.slice(0, 5).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", width: 14 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t.topic}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{t.moneyAtStake ? t.moneyAtStake + " Vol" : "Trending"}</span>
                  <Flame size={12} color="#ef4444" />
                </div>
              </div>
            ))}
            <div style={{ padding: "16px", textAlign: "center" }}>
               <Link href="/hot" style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 700, textDecoration: "none", padding: "8px 24px", borderRadius: 20, border: "1px solid var(--border)" }}>Explore all</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── EXPLORE ALL MARKETS ── */}
      <div id="top-simulations" style={{ borderTop: "1px solid var(--border)" }}>
        <ExploreMarkets />
      </div>
    </div>
  )
}
