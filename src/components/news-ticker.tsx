"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { TrendingTopic } from "@/lib/types"

function useSection(endpoint: string) {
  const [data, setData] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(endpoint).then(r => r.json()).then(d => { setData(d.data || []); setLoading(false) })
  }, [endpoint])
  return { data, loading }
}

export function NewsTicker() {
  const staples = useSection("/api/hemlo-staples")
  const trending = useSection("/api/daily-trending")
  
  const topics = [...staples.data, ...trending.data].slice(0, 20)

  const items = topics.length > 0 ? topics : [
    { topic: "Polymarket × HEMLO — Live Prediction Intelligence", category: "hemlo" },
    { topic: "Run AI simulations on any market with one click", category: "hemlo" },
    { topic: "Real-time divergence signals powered by MiroFish", category: "hemlo" },
  ]

  const ticker = [...items, ...items] // duplicate for seamless loop

  if (staples.loading || trending.loading) return <div style={{ height: 52, background: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }} />

  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.1)", height: 52, overflow: "hidden", display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div style={{ overflow: "hidden", flex: 1, position: "relative", height: "100%" }}>
        <motion.div
          key={items.length}
          animate={{ x: ["-0%", "-50%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          style={{ display: "flex", alignItems: "center", height: "100%", gap: 0, whiteSpace: "nowrap" }}
        >
          {ticker.map((item, i) => {
            const divColor = (item as any).divergence > 0 ? "#16a34a" : (item as any).divergence < 0 ? "#dc2626" : "#666666"
            const odds = (item as any).polymarketOdds ? `${(item as any).polymarketOdds}%` : null
            return (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "0 34px", fontSize: 13, color: "#000000", fontWeight: 700 }}>
                <span style={{ color: "rgba(0,0,0,0.2)", fontSize: 11 }}>◆</span>
                {(item as any).category && <span style={{ fontSize: 11, fontWeight: 900, color: "#000000", textTransform: "uppercase", letterSpacing: 1.2, opacity: 0.5 }}>{(item as any).category}</span>}
                <span style={{ color: "#000000" }}>{(item as any).topic}</span>
                {odds && <span style={{ fontWeight: 900, color: divColor }}>{odds}</span>}
              </span>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}
