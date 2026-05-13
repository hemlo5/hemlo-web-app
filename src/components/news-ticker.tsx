"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { TrendingTopic } from "@/lib/types"
import { cachedJson, readClientCache } from "@/lib/client-cache"

function useSection(endpoint: string, initialData: TrendingTopic[] = []) {
  const [data, setData] = useState<TrendingTopic[]>(initialData)
  const [loading, setLoading] = useState(initialData.length === 0)

  useEffect(() => {
    let cancelled = false
    const cached = readClientCache<any>(endpoint)
    if (cached) {
      setData(cached.data || [])
      setLoading(false)
    }
    const timer = window.setTimeout(() => {
      cachedJson<any>(endpoint, { ttlMs: 45_000 })
      .then(d => { if (!cancelled) setData(d.data || []) })
      .catch(() => { if (!cancelled) setData([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    }, initialData.length > 0 ? 1800 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [endpoint, initialData.length])

  return { data, loading }
}

export function NewsTicker({ initialItems = [] }: { initialItems?: TrendingTopic[] }) {
  const pathname = usePathname() || ""
  const completed = useSection("/api/simulations-completed", initialItems)
  const [isMobile, setIsMobile] = useState(false)
  const topics = completed.data.slice(0, 20)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  const items = topics.length > 0 ? topics : [
    { topic: "Top MiroFish simulations are loading", category: "hemlo" },
    { topic: "Run AI simulations on any market with one click", category: "hemlo" },
    { topic: "Real-time divergence signals powered by MiroFish", category: "hemlo" },
  ]

  const ticker = [...items, ...items]

  if (completed.loading) return <div style={{ height: 50, background: "#ffffff", borderBottom: "1px solid #e5e7eb" }} />

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .news-ticker-bar {
            display: flex !important;
            height: 38px !important;
          }
          .news-ticker-item {
            padding: 0 20px !important;
            font-size: 12px !important;
            gap: 9px !important;
          }
        }
      `}</style>
      <div className={`news-ticker-bar ${['/simulate', '/polymarket', '/kalshi'].some(p => pathname.includes(p)) ? 'sim-nav-padding' : ''}`} style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", height: 50, overflow: "hidden", display: "flex", alignItems: "center", flexShrink: 0, boxSizing: "border-box" }}>
        <div style={{ overflow: "hidden", flex: 1, position: "relative", height: "100%" }}>
          <motion.div
            key={`${items.length}-${isMobile ? "mobile" : "desktop"}`}
            animate={{ x: ["-0%", "-50%"] }}
            transition={{
              duration: isMobile ? 6 : 25,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ display: "flex", alignItems: "center", height: "100%", gap: 0, whiteSpace: "nowrap" }}
          >
            {ticker.map((item, i) => {
              const divColor = item.divergence && item.divergence > 0 ? "#4ade80" : item.divergence && item.divergence < 0 ? "#f87171" : "#999999"
              const odds = item.hemloOdds !== undefined ? `${item.hemloOdds}% Hemlo` : item.polymarketOdds ? `${item.polymarketOdds}% Market` : null
              return (
                <span key={i} className="news-ticker-item" style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "0 34px", fontSize: 13, color: "#111827", fontWeight: 700 }}>
                  <span style={{ color: "#cbd5e1", fontSize: 11 }}>•</span>
                  {(item.icon || item.image) ? (
                    <img src={item.icon || item.image} alt="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flexShrink: 0, background: "#e5e7eb" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : item.category ? (
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 1.2 }}>{item.category}</span>
                  ) : null}
                  <span style={{ color: "#111827" }}>{item.topic}</span>
                  {odds && <span style={{ fontWeight: 900, color: divColor }}>{odds}</span>}
                </span>
              )
            })}
          </motion.div>
        </div>
      </div>
    </>
  )
}
