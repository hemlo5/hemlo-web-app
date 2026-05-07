"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, TrendingUp } from "lucide-react";

type HotSimulation = {
  id?: string;
  topic: string;
  category?: string;
  source?: string;
  icon?: string;
  image?: string;
  hemloOdds?: number;
  divergence?: number;
  resultHref?: string;
};

function sourceFallback(source?: string) {
  if (source === "kalshi") return "/kalshi.webp";
  if (source === "polymarket") return "/polymarket.webp";
  return "/logo.svg";
}

export function HotSimulationsRail({ limit = 5 }: { limit?: number }) {
  const [items, setItems] = useState<HotSimulation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/simulations-completed")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data.data) ? data.data.slice(0, limit) : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <div className="hide-mobile" style={{ width: 380, height: 460, display: "flex", flexDirection: "column", overflow: "hidden", background: "transparent" }}>
      <div style={{ padding: "0 0 14px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#ffffff" }}>Hot simulations</span>
        <ChevronRight size={18} color="#8a94a6" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, overflowY: "auto", scrollbarWidth: "none", paddingRight: 2 }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a6", gap: 8, fontSize: 13, fontWeight: 700 }}>
            <Loader2 size={15} className="animate-spin" />
            Loading simulations
          </div>
        ) : items.length === 0 ? (
          <div style={{ color: "#748090", fontSize: 13, fontWeight: 700, paddingTop: 10 }}>
            No completed simulations yet.
          </div>
        ) : (
          items.map((item, index) => {
            const href = item.resultHref || (item.id ? `/simulate/mirofish/${item.id}` : "/simulate/mirofish");
            const img = item.icon || item.image || sourceFallback(item.source);
            const divergence = Math.abs(Math.round(Number(item.divergence || 0)));

            return (
              <Link key={`${item.source}-${item.id || item.topic}`} href={href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    minHeight: 74,
                    border: "1px solid #1f2a35",
                    background: "rgba(18,24,31,0.86)",
                    borderRadius: 12,
                    padding: 10,
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                    color: "#ffffff",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                  }}
                >
                  <img
                    src={img}
                    alt=""
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", background: "#0b1016" }}
                    onError={(e) => {
                      e.currentTarget.src = sourceFallback(item.source);
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#748399", fontSize: 10, fontWeight: 900, textTransform: "capitalize", marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: "#8aa0ba" }}>{index + 1}</span>
                      <span>{item.category || item.source || "Simulation"}</span>
                    </div>
                    <div style={{ color: "#f3f6fa", fontSize: 13, lineHeight: 1.22, fontWeight: 850, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.topic}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 56 }}>
                    <span style={{ fontSize: 17, fontWeight: 950, color: "#ffffff" }}>
                      {Math.round(Number(item.hemloOdds || 0))}%
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 900, color: divergence >= 10 ? "#22c55e" : "#7db7ff" }}>
                      <TrendingUp size={10} />
                      {divergence}% div
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}

        <Link href="/simulate/mirofish" style={{ display: "block", textAlign: "center", color: "#ffffff", fontSize: 13, fontWeight: 800, textDecoration: "none", padding: "11px 12px", borderRadius: 22, border: "1px solid #1f2330", background: "rgba(255,255,255,0.025)", marginTop: 2 }}>
          Explore all
        </Link>
      </div>
    </div>
  );
}
