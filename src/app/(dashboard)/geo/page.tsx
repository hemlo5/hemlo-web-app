// @ts-nocheck
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Globe, Radio, X, Zap, Users, BarChart3, ArrowRight } from "lucide-react"
import { useTrendingTopics } from "@/lib/useTrendingTopics"
import { WorldMap } from "@/components/world-map"
import { useRouter } from "next/navigation"
import type { TrendingTopic } from "@/lib/types"

const CATEGORY_COLORS: Record<string, string> = {
  tech:    "#06b6d4",
  finance: "#22c55e",
  policy:  "#b3e600",
  geo:     "#ffffff",
  social:  "#1DA1F2",
}

function getSentimentColor(score: number) {
  if (score > 20) return "#22c55e"
  if (score < -20) return "#ef4444"
  return "#ccff00"
}

export default function GeoImpactPage() {
  const { topics, loading } = useTrendingTopics()
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const router = useRouter()

  const FILTERS = ["all", "geo", "finance", "tech", "policy", "social"]
  const filtered = filter === "all" ? topics : topics.filter((t) => t.category === filter)

  return (
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ padding: "clamp(12px, 3vw, 20px) clamp(16px, 4vw, 28px) 0", borderBottom: "1px solid #000000" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Radio size={14} color="var(--accent)" fill="var(--accent)" />
            </motion.div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 0.5, color: "var(--text-primary)" }}>
              Geo Impact Map
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", background: "#050505", border: "1px solid #000000", borderRadius: 999, padding: "2px 10px" }}>
              LIVE
            </span>
          </div>

          {/* Category filters */}
          <div style={{ display: "flex", gap: "clamp(4px, 2vw, 6px)", flexWrap: "nowrap", overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "clamp(4px, 1.5vw, 5px) clamp(10px, 3vw, 14px)", borderRadius: 999, fontSize: "clamp(9px, 2.5vw, 11px)", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 0.8, cursor: "pointer", flexShrink: 0,
                  border: filter === f ? "1px solid var(--accent)" : "1px solid #000000",
                  background: filter === f ? "rgba(255, 255, 255,0.12)" : "transparent",
                  color: filter === f ? "var(--accent)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width world map */}
      <div style={{ padding: "20px 28px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #000000" }}
        >
          {loading ? (
            <div style={{ height: 420, background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Globe size={32} color="var(--text-muted)" />
              </motion.div>
            </div>
          ) : (
            <WorldMap topics={filtered} size="large" highlightBySentiment={true} />
          )}
        </motion.div>

        {/* Map legend */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { color: "#22c55e", label: "Bullish / Positive" },
            { color: "#ef4444", label: "Bearish / Threat" },
            { color: "#ccff00", label: "Controversial" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Events grid */}
      <div style={{ padding: "0 28px 40px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
          {filtered.length} Active Events
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 100, background: "#050505", border: "1px solid #000000", borderRadius: 12 }} className="skeleton" />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {filtered.map((topic, i) => {
              const catColor = CATEGORY_COLORS[topic.category] ?? "#ccff00"
              const sentColor = getSentimentColor(topic.sentimentScore)
              const isBreaking = topic.urgency === "breaking"
              const isHot = topic.urgency === "hot"

              return (
                <motion.div
                  key={topic.id ?? i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  whileHover={{ y: -3, borderColor: "var(--accent)" }}
                  onClick={() => setSelectedTopic(topic)}
                  style={{
                    background: "#050505", border: "1px solid #000000",
                    borderRadius: 12, padding: "14px 16px",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    transition: "border-color 0.2s",
                  }}
                >
                  {/* Sentiment stripe */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: sentColor }} />

                  <div style={{ marginLeft: 8 }}>
                    {/* Category + urgency */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: catColor, textTransform: "uppercase", letterSpacing: 1, background: `${catColor}18`, padding: "2px 8px", borderRadius: 999 }}>
                        {topic.category}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {(isBreaking || isHot) && (
                          <motion.div
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                            style={{ width: 6, height: 6, borderRadius: "50%", background: isBreaking ? "#ef4444" : "#ccff00" }}
                          />
                        )}
                        <span style={{ fontSize: 10, color: isBreaking ? "#ef4444" : isHot ? "#ccff00" : "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                          {topic.urgency}
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.4, marginBottom: 6 }}>
                      {topic.topic}
                    </div>

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                        <Users size={10} /> {topic.agentCount.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sentColor }}>
                        {topic.sentimentScore > 0 ? "+" : ""}{topic.sentimentScore}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick-simulate modal on click */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#000000", border: "1px solid #000000", borderRadius: 16, width: "100%", maxWidth: 480, padding: 28, position: "relative" }}
            >
              <button
                onClick={() => setSelectedTopic(null)}
                style={{ position: "absolute", top: 14, right: 14, width: 28, height: 28, borderRadius: "50%", background: "#050505", border: "1px solid #000000", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={13} color="var(--text-muted)" />
              </button>

              <div style={{ fontSize: 10, fontWeight: 700, color: CATEGORY_COLORS[selectedTopic.category], textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                {selectedTopic.category} · {selectedTopic.urgency}
              </div>

              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.35, marginBottom: 10 }}>
                {selectedTopic.topic}
              </h2>

              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20 }}>
                {selectedTopic.impact}
              </p>

              {/* Mini map */}
              <div style={{ marginBottom: 20, borderRadius: 10, overflow: "hidden" }}>
                <WorldMap topics={[selectedTopic]} size="small" />
              </div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 4px 24px rgba(255, 255, 255,0.3)" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(`/simulate/mirofish?prefill=${encodeURIComponent(selectedTopic.topic + ": " + selectedTopic.impact)}`)}
                style={{
                  width: "100%", padding: "14px 20px",
                  background: "#ffffff",
                  border: "none", borderRadius: 10,
                  color: "#000000", fontSize: 14, fontWeight: 800,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                SIMULATE
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
