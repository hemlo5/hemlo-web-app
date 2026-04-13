// @ts-nocheck
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp, TrendingDown, Zap, Search, Loader2,
  BarChart2, Activity, ArrowRight, DollarSign, Flame,
  ArrowUpRight, ArrowDownRight, Eye, Layers, Target, AlignLeft, Info
} from "lucide-react"
import { createChart, ColorType, AreaSeries, CandlestickSeries } from "lightweight-charts"
import type { Asset, AssetChartPoint, AssetNews, MarketStats } from "@/lib/types"
import { TRACKED_ASSETS } from "@/lib/types"

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmtPrice(n: number) {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function fmtLarge(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${Math.round(n).toLocaleString()}`
}

function fmtSupply(n: number, sym: string) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B ${sym}`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M ${sym}`
  return `${Math.round(n).toLocaleString()} ${sym}`
}

// ── SPARKLINE SVG ────────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ")
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── PRICE CHART ──────────────────────────────────────────────────────────────
function PriceChart({ data, color }: { data: AssetChartPoint[]; color: string }) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current || !data.length) return
    chartRef.current.innerHTML = ""

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 340,
      layout: { background: { type: ColorType.Solid, color: "#000" }, textColor: "#888", fontSize: 11, fontFamily: "Inter, sans-serif" },
      grid: { vertLines: { color: "#111" }, horzLines: { color: "#111" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#333", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: "#333", timeVisible: true, secondsVisible: false },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: `${color}40`,
      bottomColor: `${color}05`,
      lineWidth: 2,
    })

    const chartData = data.map(pt => ({
      time: Math.floor(pt.t / 1000) as any,
      value: pt.p,
    }))
    series.setData(chartData)
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth })
    }
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [data, color])

  return <div ref={chartRef} style={{ width: "100%", height: 340 }} />
}

// ── STAT PILL ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 10, padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 3vw, 16px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, minWidth: "fit-content" }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(12px, 3.5vw, 14px)", fontWeight: 800, color: color ?? "var(--text-primary)", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ fontSize: "clamp(8px, 2.5vw, 9px)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  )
}

// ── NEWS CARD ────────────────────────────────────────────────────────────────
function NewsCard({ item, symbol, isActive, onClick }: { item: AssetNews; symbol: string; isActive: boolean; onClick: () => void }) {
  const sentColor = item.sentiment === "bullish" ? "#22c55e" : item.sentiment === "bearish" ? "#ef4444" : "#888"
  const impactColor = item.priceImpact === "high" ? "#ef4444" : item.priceImpact === "medium" ? "#ccff00" : "#555"
  const dirIcon = item.priceDirection === "up" ? <ArrowUpRight size={10} /> : item.priceDirection === "down" ? <ArrowDownRight size={10} /> : null

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
      whileHover={{ backgroundColor: isActive ? "rgba(102,244,255,0.08)" : "rgba(102,244,255,0.04)" }}
      onClick={onClick}
      style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: isActive ? "rgba(102,244,255,0.06)" : "transparent" }}
    >
      {/* Item metadata tags */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 4, padding: "1px 6px" }}>{item.symbol}</span>
        {item.urgency === "breaking" && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", background: "#ef444418", border: "1px solid #ef444430", borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>Breaking</span>
        )}
        {item.urgency === "hot" && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#ccff00", background: "#ccff0018", border: "1px solid #ccff0030", borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.5 }}>Hot</span>
        )}
        <span style={{ fontSize: 9, fontWeight: 800, color: impactColor, background: `${impactColor}18`, border: `1px solid ${impactColor}30`, borderRadius: 4, padding: "1px 6px", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 2 }}>
          {item.priceImpact} impact {dirIcon}
        </span>
      </div>

      {/* Headline */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 6 }}>{item.headline}</div>

      {/* Summary */}
      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>{item.summary}</div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: sentColor, textTransform: "capitalize", background: `${sentColor}18`, padding: "2px 8px", borderRadius: 4 }}>{item.sentiment}</span>
        <a
          href={`/simulate/mirofish?domain=stocks&scenario=${encodeURIComponent(`How will the event "${item.headline}" affect ${item.symbol} stock price?`)}&seed=${encodeURIComponent(item.headline + (item.summary ? " - " + item.summary : ""))}&seedMode=write`}
          style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}
        >
          Simulate <ArrowRight size={10} />
        </a>
      </div>
    </motion.div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function StocksPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [stats, setStats] = useState<MarketStats | null>(null)
  const [selected, setSelected] = useState("BTC")
  const [range, setRange] = useState<"1H" | "1D" | "1W" | "1M">("1D")
  const [chart, setChart] = useState<AssetChartPoint[]>([])
  const [news, setNews] = useState<AssetNews[]>([])
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)

  // Expanded News State
  const [activeNews, setActiveNews] = useState<AssetNews | null>(null)
  const [newsDetails, setNewsDetails] = useState<any | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const handleNewsClick = (item: AssetNews) => {
    setSelected(item.symbol) // Sync chart to this asset automatically
    setActiveNews(item)
    setNewsDetails(null)
    setLoadingDetails(true)

    fetch("/api/analyze-news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headline: item.headline, symbol: item.symbol, summary: item.summary })
    })
      .then(r => r.json())
      .then(d => { if (d.analysis) setNewsDetails(d.analysis) })
      .finally(() => setLoadingDetails(false))
  }

  // Fetch prices
  useEffect(() => {
    setLoadingPrices(true)
    fetch("/api/stocks-prices").then(r => r.json()).then(d => setAssets(d.assets ?? [])).catch(() => {}).finally(() => setLoadingPrices(false))
  }, [])

  // Fetch stats
  useEffect(() => {
    fetch("/api/market-stats").then(r => r.json()).then(d => setStats(d)).catch(() => {})
  }, [])

  // Fetch chart when asset or range changes
  useEffect(() => {
    setLoadingChart(true)
    fetch(`/api/stocks-chart?symbol=${selected}&range=${range}`)
      .then(r => r.json())
      .then(d => setChart(d.chart ?? []))
      .catch(() => setChart([]))
      .finally(() => setLoadingChart(false))
  }, [selected, range])

  // Fetch all news once on load
  useEffect(() => {
    setLoadingNews(true)
    fetch(`/api/stocks-news?symbol=ALL`)
      .then(r => r.json())
      .then(d => setNews(d.news ?? []))
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false))
  }, [])

  const selectedAsset = assets.find(a => a.symbol === selected) ?? null
  const fauxAsset = !selectedAsset && chart.length > 0 ? {
    symbol: selected,
    name: selected,
    price: chart[chart.length - 1].p,
    changePct24h: chart[0]?.p ? ((chart[chart.length - 1].p - chart[0].p) / chart[0].p) * 100 : 0,
    marketCap: 0,
    high24h: Math.max(...chart.map(c => c.p)),
    low24h: Math.min(...chart.map(c => c.p)),
    volume24h: chart.reduce((s, c) => s + c.v, 0)
  } : null;
  const displayAsset = selectedAsset || fauxAsset;
  
  const isCrypto = TRACKED_ASSETS.find(a => a.symbol === selected)?.type === "crypto" || selected.endsWith("USD")
  const chartColor = displayAsset && displayAsset.changePct24h >= 0 ? "#22c55e" : "#ef4444"

  return (
    <div style={{ background: "var(--bg-primary)", height: "100vh", maxHeight: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* ── TOP BAR ── */}
      <div style={{ padding: "10px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
        <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DollarSign size={16} color="#000" />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 800 }}>Stocks & Crypto</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Live prices · AI news · Simulation</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "clamp(4px, 2vw, 8px)", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
          {stats ? (
            <>
              <StatPill label="NYSE" value={stats.nyseOpen ? "OPEN" : "CLOSED"} color={stats.nyseOpen ? "#22c55e" : "#ef4444"} />
              <StatPill label="Fear & Greed" value={`${stats.fearGreedValue} · ${stats.fearGreedLabel}`} color={stats.fearGreedValue > 60 ? "#22c55e" : stats.fearGreedValue < 40 ? "#ef4444" : "#ccff00"} />
              <StatPill label="Crypto MCap" value={fmtLarge(stats.cryptoMarketCap)} />
              <StatPill label="BTC Dom" value={`${stats.btcDominance.toFixed(1)}%`} />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ width: 100, height: 42, borderRadius: 10 }} />)
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="poly-layout" style={{ display: "grid", gridTemplateColumns: "1fr 380px", flex: 1, overflow: "hidden" }}>

        {/* ── LEFT: Chart ── */}
        <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "auto" }}>

          {/* Asset selector tabs */}
          <div className="hide-mobile" style={{ padding: "16px 24px 0" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Crypto</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {TRACKED_ASSETS.filter(a => a.type === "crypto").map(a => {
                const asset = assets.find(x => x.symbol === a.symbol)
                const isActive = selected === a.symbol
                return (
                  <motion.button key={a.symbol} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSelected(a.symbol)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                      background: isActive ? "rgba(102,244,255,0.12)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                      transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {a.symbol}
                    {asset && (
                      <span style={{ fontSize: 10, color: asset.changePct24h >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                        {asset.changePct24h >= 0 ? "+" : ""}{asset.changePct24h.toFixed(1)}%
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>

            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Stocks</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {TRACKED_ASSETS.filter(a => a.type === "stock").map(a => {
                const asset = assets.find(x => x.symbol === a.symbol)
                const isActive = selected === a.symbol
                return (
                  <motion.button key={a.symbol} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => setSelected(a.symbol)}
                    style={{
                      padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                      background: isActive ? "rgba(102,244,255,0.12)" : "transparent",
                      color: isActive ? "var(--accent)" : "var(--text-muted)",
                      transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {a.symbol}
                    {asset && (
                      <span style={{ fontSize: 10, color: asset.changePct24h >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                        {asset.changePct24h >= 0 ? "+" : ""}{asset.changePct24h.toFixed(1)}%
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </div>

          {/* Price header */}
          <div style={{ padding: "0 24px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>
                {displayAsset?.name ?? selected} ({selected})
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>
                  {displayAsset ? fmtPrice(displayAsset.price) : "—"}
                </span>
                {displayAsset && (
                  <span style={{ fontSize: 16, fontWeight: 700, color: chartColor, display: "flex", alignItems: "center", gap: 3 }}>
                    {displayAsset.changePct24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {displayAsset.changePct24h >= 0 ? "+" : ""}{displayAsset.changePct24h.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Time range toggle */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["1H", "1D", "1W", "1M"] as const).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: range === r ? "var(--accent)" : "transparent",
                  color: range === r ? "#000" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}>{r}</button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div style={{ padding: "0 24px", flexShrink: 0 }}>
            {loadingChart ? (
              <div className="skeleton" style={{ width: "100%", height: 340, borderRadius: 12 }} />
            ) : chart.length > 0 ? (
              <PriceChart data={chart} color={chartColor} />
            ) : (
              <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                No chart data available
              </div>
            )}
          </div>

          {/* Stats row */}
          {displayAsset && (
            <div style={{ padding: "16px 24px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "24H High", value: fmtPrice(displayAsset.high24h) },
                { label: "24H Low", value: fmtPrice(displayAsset.low24h) },
                { label: "Market Cap", value: fmtLarge(displayAsset.marketCap) },
                { label: "24H Volume", value: fmtLarge(displayAsset.volume24h) },
                ...(displayAsset.circulatingSupply ? [{ label: "Supply", value: fmtSupply(displayAsset.circulatingSupply, selected) }] : []),
              ].filter(s => s.value !== "$0" && s.value !== "$0.00").map(s => (
                <div key={s.label} style={{ background: "#0a0a0a", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 11 }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{s.label}: </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── EXPANDED NEWS DEEP DIVE ── */}
          <AnimatePresence>
            {activeNews && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: "hidden", borderTop: "1px solid var(--border)" }}
              >
                <div style={{ padding: "24px", background: "rgba(102,244,255,0.02)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#000", background: "var(--accent)", padding: "2px 8px", borderRadius: 4 }}>{activeNews.symbol}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>Deep Dive Analysis</span>
                    </div>
                    <button onClick={() => setActiveNews(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Close (X)</button>
                  </div>

                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 8 }}>
                    {activeNews.headline}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 20 }}>
                    {activeNews.summary}
                  </div>

                  {loadingDetails ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px", background: "#050505", borderRadius: 12, border: "1px dashed var(--border)" }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader2 size={16} color="var(--accent)" /></motion.div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>HEMLO agents generating impact assessment...</span>
                    </div>
                  ) : newsDetails ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {/* Left Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "#0a0a0a", borderRadius: 12, padding: "16px", border: "1px solid #1a1a1a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            <Info size={12} /> Catalyst / Root Cause
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{newsDetails.causes}</div>
                        </div>

                        <div style={{ background: "#0a0a0a", borderRadius: 12, padding: "16px", border: "1px solid #1a1a1a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            <Layers size={12} /> Sectors Affected
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {newsDetails.sectors?.map((s: string) => (
                              <span key={s} style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#111", border: "1px solid #222", padding: "4px 8px", borderRadius: 6 }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: "#0a0a0a", borderRadius: 12, padding: "16px", border: "1px solid #1a1a1a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            <AlignLeft size={12} /> Investor Reaction
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{newsDetails.reaction}</div>
                        </div>

                        <div style={{ background: "#0a0a0a", borderRadius: 12, padding: "16px", border: "1px solid #1a1a1a" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                            <Target size={12} /> Expected Market Move
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", lineHeight: 1.5 }}>{newsDetails.expectedMove}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── WATCHLIST ── */}
          <div style={{ padding: "16px 24px 32px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={13} color="var(--accent)" /> Watchlist
            </div>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 120px 100px 90px 80px 50px", gap: 8, padding: "6px 12px", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8 }}>
              <span>Symbol</span><span>Name</span><span>Price</span><span>24H</span><span>7D</span><span>MCap</span><span></span>
            </div>

            {loadingPrices ? (
              Array.from({ length: 7 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 38, borderRadius: 8, margin: "3px 0" }} />)
            ) : (
              assets.map((a, i) => {
                const isActive = selected === a.symbol
                const pctColor = a.changePct24h >= 0 ? "#22c55e" : "#ef4444"
                // Generate fake sparkline data from price ± random
                const sparkData = Array.from({ length: 14 }, (_, j) => a.price * (1 + (Math.sin(j * 0.8 + i) * 0.02)))
                return (
                  <motion.div key={a.symbol}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    onClick={() => { setSelected(a.symbol); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                    style={{
                      display: "grid", gridTemplateColumns: "70px 1fr 120px 100px 90px 80px 50px", gap: 8,
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer", alignItems: "center",
                      borderBottom: "1px solid #111",
                      background: isActive ? "rgba(102,244,255,0.06)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? "var(--accent)" : "var(--text-primary)" }}>{a.symbol}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", fontFamily: "'Space Grotesk', sans-serif" }}>{fmtPrice(a.price)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pctColor, display: "flex", alignItems: "center", gap: 2 }}>
                      {a.changePct24h >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {a.changePct24h >= 0 ? "+" : ""}{a.changePct24h.toFixed(2)}%
                    </span>
                    <span><Sparkline data={sparkData} color={pctColor} /></span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtLarge(a.marketCap)}</span>
                    <span><Eye size={12} color={isActive ? "var(--accent)" : "var(--text-muted)"} /></span>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>

        {/* ── RIGHT: News Feed ── */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#050505" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Flame size={14} color="var(--accent)" />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 800 }}>AI News Feed</span>
            {loadingNews && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={12} color="var(--accent)" /></motion.div>}
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingNews ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div className="skeleton" style={{ height: 12, width: "60%", borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 40, borderRadius: 4, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 10, width: "40%", borderRadius: 4 }} />
                </div>
              ))
            ) : news.length > 0 ? (
              news.map((item, i) => <NewsCard key={i} item={item} symbol={selected} isActive={activeNews?.id === item.id || activeNews?.headline === item.headline} onClick={() => handleNewsClick(item)} />)
            ) : (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                No news available
              </div>
            )}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
            AI-powered · Gemini Flash · Refreshes every 30min
          </div>
        </div>
      </div>
    </div>
  )
}
