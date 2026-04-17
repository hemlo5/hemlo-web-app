"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface Simulation {
  id?: string;
  topic: string;
  category?: string;
  marketType?: "binary" | "categorical";
  outcomes?: Array<{ label: string; prob: number }>;
  polymarketOdds?: string;
  divergence?: number;
  confidence?: number;
  icon?: string;
}

export function TopSimulationsSection() {
  const [completedSims, setCompletedSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [simFilter, setSimFilter] = useState("all");
  const [simSort, setSimSort] = useState("divergence");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    fetch("/api/simulations-completed")
      .then((r) => r.json())
      .then((d) => {
        setCompletedSims(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...completedSims].sort((a, b) => {
    if (simSort === "divergence")
      return Math.abs(b.divergence ?? 0) - Math.abs(a.divergence ?? 0);
    if (simSort === "confidence")
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    return 0;
  });

  const displayed = showMore ? sorted : sorted.slice(0, 9);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Top Simulations Today
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Highest-divergence AI simulations vs. market consensus
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {["all", "markets", "news"].map((f) => (
            <button
              key={f}
              onClick={() => setSimFilter(f)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: `1px solid ${
                  simFilter === f ? "var(--accent)" : "var(--border)"
                }`,
                background:
                  simFilter === f ? "rgba(102,244,255,0.1)" : "transparent",
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 0",
            gap: 10,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={18} color="#ccff00" />
          </motion.div>
          <span
            style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}
          >
            Loading simulations...
          </span>
        </div>
      ) : displayed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          No completed simulations available today.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {displayed.map((t, i) => {
              const isCat = t.marketType === "categorical";
              const outcomes =
                isCat && (t.outcomes?.length ?? 0) > 0
                  ? t.outcomes!
                  : [
                      {
                        label: "Yes",
                        prob: parseInt(t.polymarketOdds || "50"),
                      },
                      {
                        label: "No",
                        prob: 100 - parseInt(t.polymarketOdds || "50"),
                      },
                    ];
              const colors = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7"];
              return (
                <motion.div
                  key={t.id ?? i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ borderColor: "#ccff0050" }}
                  style={{
                    background: "#0c0e12",
                    border: "1px solid #1e222b",
                    borderRadius: 12,
                    padding: 20,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    minHeight: 200,
                    transition: "border-color 0.2s",
                  }}
                  onClick={() =>
                    (window.location.href = `/simulate/staple/report?topic=${encodeURIComponent(
                      t.topic
                    )}`)
                  }
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {t.icon && (
                      <img
                        src={t.icon}
                        alt=""
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#8a94a6",
                        textTransform: "uppercase",
                        letterSpacing: 0.6,
                      }}
                    >
                      {t.category || "Simulation"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#f8f9fa",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      flex: 1,
                    }}
                  >
                    {t.topic}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {outcomes.slice(0, 2).map((o: any, j: number) => (
                      <div
                        key={j}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                            paddingRight: 16,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#f1f5f9",
                            }}
                          >
                            {o.label}
                          </div>
                          <div
                            style={{
                              height: 2,
                              background: "#1e293b",
                              position: "relative",
                              width: "100%",
                              maxWidth: 100,
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                height: "100%",
                                width: `${o.prob}%`,
                                background: colors[j % colors.length],
                              }}
                            />
                          </div>
                        </div>
                        <div
                          style={{
                            border: `1px solid ${colors[j % colors.length]}60`,
                            borderRadius: 20,
                            minWidth: 50,
                            height: 28,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 13,
                            fontWeight: 800,
                            color: "#f8f9fa",
                          }}
                        >
                          {Math.round(o.prob)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  {t.divergence !== undefined && Math.abs(t.divergence) > 5 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: t.divergence > 0 ? colors[0] : colors[1],
                        fontWeight: 700,
                      }}
                    >
                      {Math.abs(t.divergence)}% AI Divergence
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {sorted.length > 9 && !showMore && (
            <div style={{ textAlign: "center", paddingTop: 24 }}>
              <button
                onClick={() => setShowMore(true)}
                style={{
                  padding: "10px 28px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--accent)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
