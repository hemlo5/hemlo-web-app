"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { cachedJson, readClientCache } from "@/lib/client-cache";

interface Simulation {
  id?: string;
  topic: string;
  category?: string;
  source?: string;
  marketType?: "binary" | "categorical";
  outcomes?: Array<{ label: string; prob?: number; tokenId?: string; clobTokenId?: string; image?: string; icon?: string }>;
  polymarketOdds?: string;
  hemloOdds?: number;
  divergence?: number;
  confidence?: number;
  confidenceLabel?: string;
  icon?: string;
  image?: string;
  moneyAtStake?: string;
  endDate?: string;
  resultHref?: string;
}

function getOutcomeImage(outcome?: NonNullable<Simulation["outcomes"]>[number]) {
  return outcome?.icon || outcome?.image || "";
}

export function TopSimulationsSection() {
  const [completedSims, setCompletedSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [simFilter, setSimFilter] = useState("all");
  const [simSort, setSimSort] = useState("divergence");

  useEffect(() => {
    let cancelled = false;
    const endpoint = "/api/simulations-completed?scope=all&limit=120";
    const cached = readClientCache<any>(endpoint);
    if (cached) {
      setCompletedSims(cached.data || []);
      setLoading(false);
    }
    const timer = window.setTimeout(() => {
      cachedJson<any>(endpoint, { ttlMs: 45_000 })
      .then((d) => {
        if (cancelled) return;
        setCompletedSims(d.data || []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    }, cached ? 1200 : 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const filtered = completedSims.filter((sim) => {
    if (simFilter === "all") return true;
    if (simFilter === "markets") return sim.source === "polymarket" || sim.source === "kalshi";
    return sim.source !== "polymarket" && sim.source !== "kalshi";
  });

  const sorted = [...filtered].sort((a, b) => {
    if (simSort === "divergence") return Math.abs(b.divergence ?? 0) - Math.abs(a.divergence ?? 0);
    if (simSort === "confidence") return (b.confidence ?? 0) - (a.confidence ?? 0);
    return 0;
  });

  const MAX_OUTCOMES = 2;

  return (
    <div>
      <style>{`
        .all-sims-grid {
          display: grid;
          grid-template-columns: repeat(4, 336px);
          justify-content: center;
          gap: 16px;
        }
        @media (max-width: 1420px) { .all-sims-grid { grid-template-columns: repeat(3, 336px); } }
        @media (max-width: 1080px) { .all-sims-grid { grid-template-columns: repeat(2, 336px); } }
        @media (max-width: 740px)  { .all-sims-grid { grid-template-columns: minmax(0, 336px); } }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="font-semibold text-heading-xl" style={{ color: "var(--text-primary)", marginBottom: 4 }}>
            All simulations
          </h2>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Every completed MiroFish run, including market and custom simulations
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {["all", "markets", "news"].map((f) => (
            <button
              key={f}
              onClick={() => setSimFilter(f)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: `1px solid ${simFilter === f ? "var(--accent)" : "var(--border)"}`,
                background: simFilter === f ? "rgba(102,244,255,0.1)" : "transparent",
                color: simFilter === f ? "var(--accent)" : "var(--text-muted)",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          <select
            value={simSort}
            onChange={(e) => setSimSort(e.target.value)}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "#0a0a0a",
              color: "var(--text-muted)",
              fontSize: 10,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <option value="divergence">Highest Divergence</option>
            <option value="confidence">Highest Confidence</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Loader2 size={18} color="#ccff00" />
          </motion.div>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
            Loading simulations...
          </span>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
          No completed simulations available.
        </div>
      ) : (
        <div className="all-sims-grid">
          {sorted.map((t, i) => {
            const outcomes = (t.outcomes && t.outcomes.length > 0)
              ? t.outcomes
              : [
                  { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
                  { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") },
                ];

            // Sort outcomes by combined market + hemlo probability descending
            const scored = outcomes.map((o, idx) => {
              const mktPct = Number(o.prob ?? 0);
              const hemloPct = idx === 0 && t.hemloOdds !== undefined ? t.hemloOdds : null;
              return { outcome: o, originalIndex: idx, mktPct, hemloPct, score: mktPct + (hemloPct ?? 0) };
            }).sort((a, b) => b.score - a.score);

            const visible = scored.slice(0, MAX_OUTCOMES);
            const href = t.resultHref || (t.id ? `/simulate/mirofish/${t.id}` : "/simulate/mirofish");
            const srcLabel = t.source === "kalshi" ? "Kalshi" : t.source === "polymarket" ? "Polymarket" : "Hemlo";
            const cardImage = t.icon || t.image || (t.source === "kalshi" ? "/kalshi.webp" : t.source === "polymarket" ? "/polymarket.webp" : "/logo.svg");

            return (
              <motion.div
                key={t.id ?? i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ borderColor: "#37506a" }}
                style={{ width: "100%", maxWidth: 336, minWidth: 0 }}
              >
                <Link href={href} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 336,
                      height: 235,
                      background: "#1e2428",
                      border: "1px solid #25303a",
                      borderRadius: 16,
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      color: "#fff",
                      cursor: "pointer",
                      transition: "box-shadow 0.2s, border-color 0.2s",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, minWidth: 38, borderRadius: 8, overflow: "hidden", background: "#202a33", flexShrink: 0 }}>
                        <img src={cardImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.src = t.source === "kalshi" ? "/kalshi.webp" : t.source === "polymarket" ? "/polymarket.webp" : "/logo.svg"; }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#768493", lineHeight: 1.1, marginBottom: 4 }}>
                          {t.category || srcLabel}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#f6f8fb", lineHeight: 1.14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {t.topic}
                        </div>
                      </div>
                    </div>

                    {/* Column headers */}
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 54px 54px", gap: 7, alignItems: "center", padding: "0 5px", color: "#748399", fontSize: 8, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 5 }}>
                      <span>Outcome</span>
                      <span style={{ textAlign: "right" }}>{srcLabel}</span>
                      <span style={{ textAlign: "right" }}>Hemlo</span>
                    </div>

                    {/* Outcome rows */}
                    <div style={{ display: "grid", gridTemplateRows: `repeat(${Math.max(visible.length, 1)}, minmax(0, 1fr))`, gap: 7, flex: 1, minHeight: 0 }}>
                      {visible.map((s, vi) => {
                        const mktPct = Math.round(s.mktPct);
                        // For hemlo: first outcome uses hemloOdds, second outcome (binary) uses 100 - hemloOdds
                        let hemloPct: number | null = null;
                        if (t.hemloOdds !== undefined) {
                          if (s.originalIndex === 0) hemloPct = Math.round(t.hemloOdds);
                          else if (outcomes.length === 2 && s.originalIndex === 1) hemloPct = Math.round(100 - t.hemloOdds);
                        }
                        const optImg = getOutcomeImage(s.outcome);
                        return (
                          <div key={`${s.outcome.label}-${vi}`} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 54px 54px", gap: 7, alignItems: "center", padding: "12px 8px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ color: "#e9eef5", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden" }}>
                              {optImg && (
                                <img src={optImg} alt="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", background: "#202a33", flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.outcome.label}</span>
                            </div>
                            <div style={{ textAlign: "right", color: "#dbe7f5", fontSize: 13, fontWeight: 700 }}>
                              {mktPct}%
                            </div>
                            <div style={{ textAlign: "right", color: hemloPct === null ? "#627084" : "#38e88d", fontSize: 13, fontWeight: 700 }}>
                              {hemloPct === null ? "--" : `${hemloPct}%`}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 7, color: "#58708a", fontSize: 11, fontWeight: 600 }}>
                      <span>{t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Cron run"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {t.divergence !== undefined && (
                          <span style={{ color: t.divergence >= 0 ? "#22c55e" : "#60a5fa", fontWeight: 700 }}>
                            {Math.abs(Math.round(t.divergence))}% div
                          </span>
                        )}
                        <span style={{ color: "#6b7f96" }}>-</span>
                        {srcLabel}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
