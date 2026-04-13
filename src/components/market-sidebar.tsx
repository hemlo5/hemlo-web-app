"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { TrendingTopic } from "@/lib/types";

// ── CATEGORY ICON (letter fallback) ──────────────────────────────────────────
export function catIcon(cat: string): { letter: string; bg: string } {
  const map: Record<string, { letter: string; bg: string }> = {
    politics: { letter: "P", bg: "var(--accent)" },
    crypto: { letter: "₿", bg: "#ffffff" },
    finance: { letter: "F", bg: "#22c55e" },
    world: { letter: "W", bg: "#06b6d4" },
    science: { letter: "S", bg: "var(--accent-strong)" },
    sports: { letter: "⚽", bg: "#ef4444" },
    tech: { letter: "T", bg: "#0ea5e9" },
    health: { letter: "H", bg: "#10b981" },
    entertainment: { letter: "E", bg: "#f43f5e" },
    prediction: { letter: "Ψ", bg: "#a855f7" },
  };
  return map[cat?.toLowerCase()] ?? { letter: "◈", bg: "#666666" };
}

// ── SIDEBAR ROW ───────────────────────────────────────────────────────────────
export function MarketSideRow({
  t,
  selected,
  onSelect,
  index,
  badge,
}: {
  t: TrendingTopic;
  selected: boolean;
  onSelect: () => void;
  index: number;
  badge?: string;
}) {
  const crowd = parseInt(t.polymarketOdds ?? "50");
  const hemlo = t.hemloOdds ?? 50;
  const div = t.divergence ?? hemlo - crowd;
  const divColor = div > 0 ? "#22c55e" : div < 0 ? "#ef4444" : "#999999";
  const icon = catIcon(t.category ?? "");
  const isCat = t.marketType === "categorical";
  const topOutcome = isCat && t.outcomes ? t.outcomes[0] : null;
  const displayHemlo =
    isCat && topOutcome ? (topOutcome.hemloProb ?? topOutcome.prob) : hemlo;
  const displayLabel = isCat && topOutcome ? topOutcome.label : null;

  // Use the server-provided icon URL directly
  const imgSrc = t.icon || t.image || null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        cursor: "pointer",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.15s",
        background: selected ? "rgba(102,244,255,0.08)" : "transparent",
        borderLeft: `3px solid ${selected ? "var(--accent)" : "transparent"}`,
      }}
    >
      {/* Market image — real Poly CDN image layered over letter fallback */}
      <div
        style={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: 12,
          overflow: "hidden",
          flexShrink: 0,
          background: icon.bg,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Letter fallback always rendered underneath */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 800,
            color: "white",
          }}
        >
          {icon.letter}
        </div>
        {/* Real Polymarket image on top — hides if it fails to load */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 1,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.35,
            marginBottom: 6,
          }}
        >
          {t.topic}
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {t.category}
          {isCat && (
            <span
              style={{
                background: "#06b6d418",
                border: "1px solid #06b6d430",
                borderRadius: 3,
                padding: "0px 4px",
                fontSize: 8,
                fontWeight: 800,
                color: "#06b6d4",
                letterSpacing: 0.5,
              }}
            >
              MULTI
            </span>
          )}
          {badge && (
            <span
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                borderRadius: 3,
                padding: "0px 4px",
                fontSize: 8,
                fontWeight: 800,
                color: "var(--accent)",
                letterSpacing: 0.5,
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--accent)",
            display: "flex",
            alignItems: "baseline",
            gap: 2,
            justifyContent: "flex-end",
            marginBottom: 2,
          }}
        >
          {displayLabel && (
            <span
              style={{
                fontSize: 9,
                color: "#999999",
                fontWeight: 600,
                maxWidth: 40,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayLabel}
            </span>
          )}
          {displayHemlo}%
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: divColor,
            display: "flex",
            alignItems: "center",
            gap: 2,
            justifyContent: "flex-end",
          }}
        >
          {div > 0 ? (
            <TrendingUp size={9} />
          ) : div < 0 ? (
            <TrendingDown size={9} />
          ) : null}
          {div > 0 ? "+" : ""}
          {div}%
        </div>
      </div>
    </motion.div>
  );
}

// ── DATA HOOK ─────────────────────────────────────────────────────────────────
// Fetches rows from the given endpoint. The backend now handles icon
// enrichment server-side, returning real Polymarket icons directly.
export function useSection(endpoint: string) {
  const [data, setData] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const raw = (Array.isArray(j?.data) ? j.data : []) as Array<{
          id?: string;
          topic?: string;
          category?: string;
          impact?: string;
          sentiment?: TrendingTopic["sentiment"];
          sentiment_score?: number;
          agent_count?: number;
          confidence?: number;
          affected_groups?: string[];
          urgency?: TrendingTopic["urgency"];
          source_url?: string;
          polymarket_odds?: string;
          money_at_stake?: string;
          hemlo_odds?: number;
          divergence?: number;
          divergence_signal?: string;
          market_end_date?: string;
          section?: string;
          market_type?: TrendingTopic["marketType"];
          outcomes?: TrendingTopic["outcomes"];
          icon?: string;
          image?: string;
        }>;
        const topics: TrendingTopic[] = raw.map((r) => ({
          id: r.id,
          type: "prediction" as const,
          topic: r.topic ?? "",
          category: r.category,
          impact: r.impact,
          sentiment: r.sentiment,
          sentimentScore: r.sentiment_score,
          agentCount: r.agent_count,
          confidence: r.confidence,
          affectedGroups: r.affected_groups,
          urgency: r.urgency,
          sourceUrl: r.source_url,
          polymarketOdds: r.polymarket_odds,
          moneyAtStake: r.money_at_stake,
          hemloOdds: r.hemlo_odds,
          divergence: r.divergence,
          divergenceSignal: r.divergence_signal,
          marketEndDate: r.market_end_date,
          section: r.section,
          marketType: r.market_type ?? "binary",
          outcomes: r.outcomes ?? undefined,
          icon: r.icon || undefined,
          image: r.image || undefined,
        }));
        setData(topics);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [endpoint]);

  return { data, loading };
}
