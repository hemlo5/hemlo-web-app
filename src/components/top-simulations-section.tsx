"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createChart, ColorType, LineSeries } from "lightweight-charts";

type ChartSeries = {
  label: string;
  color?: string;
  data: Array<{ time: number; value: number }>;
};

interface Simulation {
  id?: string;
  topic: string;
  category?: string;
  source?: string;
  marketType?: "binary" | "categorical";
  outcomes?: Array<{ label: string; prob?: number; tokenId?: string; clobTokenId?: string }>;
  polymarketOdds?: string;
  hemloOdds?: number;
  divergence?: number;
  confidence?: number;
  confidenceLabel?: string;
  icon?: string;
  image?: string;
  moneyAtStake?: string;
  endDate?: string;
  chartSeries?: ChartSeries[];
  resultHref?: string;
}

const CHART_COLORS = ["#7db7ff", "#2d9cff", "#facc15", "#fb8c23"];

function normalizeChartSeries(series?: ChartSeries[]) {
  return (series || [])
    .map((item, index) => {
      const seen = new Set<number>();
      const data = (item.data || [])
        .map((pt) => ({ time: Number(pt.time), value: Number(pt.value) }))
        .filter((pt) => Number.isFinite(pt.time) && Number.isFinite(pt.value))
        .sort((a, b) => a.time - b.time)
        .filter((pt) => {
          if (seen.has(pt.time)) return false;
          seen.add(pt.time);
          return true;
        });
      return { ...item, color: item.color || CHART_COLORS[index % CHART_COLORS.length], data };
    })
    .filter((s) => s.data.length >= 2);
}

function MarketMiniChart({
  series,
  outcomes,
  source,
}: {
  series?: ChartSeries[];
  outcomes?: Simulation["outcomes"];
  source?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [remoteSeries, setRemoteSeries] = useState<ChartSeries[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  const savedSeries = useMemo(() => normalizeChartSeries(series), [series]);
  const usableSeries = savedSeries.length ? savedSeries : normalizeChartSeries(remoteSeries);
  const outcomeKey = useMemo(
    () => (outcomes || []).map((o) => `${o.label}:${o.prob}:${o.tokenId || o.clobTokenId || ""}`).join("|"),
    [outcomes],
  );

  useEffect(() => {
    if (savedSeries.length > 0 || source !== "polymarket") {
      setRemoteSeries([]);
      setLoadingRemote(false);
      return;
    }

    const withTokens = (outcomes || [])
      .slice(0, 4)
      .map((outcome, index) => ({
        label: outcome.label,
        prob: Number(outcome.prob),
        tokenId: String(outcome.tokenId || outcome.clobTokenId || ""),
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .filter((outcome) => outcome.tokenId);

    if (withTokens.length === 0) {
      setRemoteSeries([]);
      setLoadingRemote(false);
      return;
    }

    let cancelled = false;
    setLoadingRemote(true);

    Promise.all(
      withTokens.map((outcome) =>
        fetch(`/api/polymarket-history?tokenId=${encodeURIComponent(outcome.tokenId)}&interval=1w&fidelity=60`)
          .then((r) => r.json())
          .then((data) => {
            const seen = new Set<number>();
            const points = (Array.isArray(data.history) ? data.history : [])
              .map((pt: any) => ({
                time: Number(pt.t),
                value: Math.max(0, Math.min(100, Number(pt.p) * 100)),
              }))
              .filter((pt: any) => Number.isFinite(pt.time) && Number.isFinite(pt.value))
              .sort((a: any, b: any) => a.time - b.time)
              .filter((pt: any) => {
                if (seen.has(pt.time)) return false;
                seen.add(pt.time);
                return true;
              });

            const last = points[points.length - 1];
            const current = Number(outcome.prob);
            const now = Math.floor(Date.now() / 1000);
            if (last && Number.isFinite(current) && now > last.time && Math.abs(last.value - current) >= 0.2) {
              points.push({ time: now, value: Math.max(0, Math.min(100, current)) });
            }

            return { label: outcome.label, color: outcome.color, data: points };
          })
          .catch(() => ({ label: outcome.label, color: outcome.color, data: [] }))
      )
    ).then((next) => {
      if (!cancelled) setRemoteSeries(next);
    }).finally(() => {
      if (!cancelled) setLoadingRemote(false);
    });

    return () => {
      cancelled = true;
    };
  }, [savedSeries.length, source, outcomeKey]);

  useEffect(() => {
    const container = ref.current;
    if (!container || usableSeries.length === 0) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#667282",
        fontFamily: "Inter, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.055)" },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.12, bottom: 0.12 },
        minimumWidth: 42,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      localization: { priceFormatter: (v: number) => `${Math.round(v)}%` },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { color: "rgba(125,183,255,0.25)", labelBackgroundColor: "#1d4ed8" },
        horzLine: { color: "rgba(125,183,255,0.16)", labelBackgroundColor: "#1d4ed8" },
      },
    });

    usableSeries.slice(0, 4).forEach((item, index) => {
      const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: index === 0 ? 3 : 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceFormat: { type: "custom", formatter: (v: number) => `${Math.round(v)}%` },
      });
      line.setData(item.data.map((pt) => ({ time: pt.time as any, value: pt.value })));
    });

    chart.timeScale().fitContent();
    const resize = () => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      chart.timeScale().fitContent();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    requestAnimationFrame(resize);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [usableSeries]);

  if (loadingRemote) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#708196", fontSize: 12, fontWeight: 800 }}>
        Loading price history...
      </div>
    );
  }

  if (usableSeries.length === 0) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#5d6978", fontSize: 12, fontWeight: 700 }}>
        No price history yet
      </div>
    );
  }

  return <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden" }} />;
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

  const displayed = showMore ? sorted : sorted.slice(0, 6);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            Top Simulations Today
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Scheduled MiroFish runs on the freshest Polymarket and Kalshi markets
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
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
          No completed simulations available today.
        </div>
      ) : (
        <>
          <div className="top-sim-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))", gap: 16 }}>
            {displayed.map((t, i) => {
              const outcomes = (t.outcomes && t.outcomes.length > 0)
                ? t.outcomes
                : [
                    { label: "Yes", prob: parseInt(t.polymarketOdds || "50") },
                    { label: "No", prob: 100 - parseInt(t.polymarketOdds || "50") },
                  ];
              const topOutcome = outcomes[0] || { label: "Yes", prob: 50 };
              const chartSeries = t.chartSeries || [];
              const href = t.resultHref || (t.id ? `/simulate/mirofish/${t.id}` : "/simulate/mirofish");
              const sourceLabel = t.source === "kalshi" ? "Kalshi" : t.source === "polymarket" ? "Polymarket" : "Hemlo";
              const cardImage = t.icon || t.image || (t.source === "kalshi" ? "/kalshi.webp" : t.source === "polymarket" ? "/polymarket.webp" : "/logo.svg");

              return (
                <motion.div
                  key={t.id ?? i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ borderColor: "#37506a" }}
                  style={{ minWidth: 0 }}
                >
                  <Link href={href} style={{ textDecoration: "none" }}>
                    <div
                      className="top-sim-card"
                      style={{
                        background: "#13191f",
                        border: "1px solid #25303a",
                        borderRadius: 18,
                        overflow: "hidden",
                        color: "#fff",
                        display: "grid",
                        gridTemplateColumns: "minmax(230px, 38%) minmax(0, 1fr)",
                        minHeight: 320,
                        boxShadow: "0 14px 42px rgba(0,0,0,0.32)",
                      }}
                    >
                      <div className="top-sim-left" style={{ padding: "22px 24px 18px", display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <div className="top-sim-header" style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
                          <img className="top-sim-thumb" src={cardImage} alt="" style={{ width: 54, height: 54, borderRadius: 13, objectFit: "cover", flexShrink: 0, background: "#0b1016" }} onError={(e) => { e.currentTarget.src = t.source === "kalshi" ? "/kalshi.webp" : t.source === "polymarket" ? "/polymarket.webp" : "/logo.svg"; }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#7b8794", fontWeight: 800, marginBottom: 6 }}>
                              {t.category || sourceLabel} <span style={{ color: "#51606f" }}>-</span> {sourceLabel}
                            </div>
                            <div style={{ fontSize: 22, lineHeight: 1.08, fontWeight: 900, color: "#f7f9fc", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.topic}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          {outcomes.slice(0, 4).map((o, oi) => (
                            <div key={`${o.label}-${oi}`} style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "8px 0", borderBottom: oi < Math.min(outcomes.length, 4) - 1 ? "1px solid rgba(255,255,255,0.045)" : "none" }}>
                              <span style={{ color: "#dbe2ea", fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {o.label}
                              </span>
                              <span style={{ color: "#f4f7fb", fontSize: 20, fontWeight: 900, flexShrink: 0 }}>
                                {Math.round(Number(o.prob ?? 0))}%
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: "auto", paddingTop: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", color: "#55708c", fontSize: 13, fontWeight: 900 }}>
                          <span>{t.moneyAtStake ? `${t.moneyAtStake} Vol` : "Cron run"}</span>
                          {t.divergence !== undefined && (
                            <span style={{ color: t.divergence >= 0 ? "#22c55e" : "#60a5fa" }}>
                              {Math.abs(Math.round(t.divergence))}% div
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="top-sim-chart-pane" style={{ padding: "22px 22px 18px 26px", borderLeft: "1px solid #25303a", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", minWidth: 0 }}>
                            <span style={{ color: "#f4f7fb", fontSize: 22, fontWeight: 900 }}>{Math.round(Number(t.hemloOdds ?? topOutcome.prob ?? 50))}%</span>
                            {outcomes.slice(0, 4).map((o, oi) => (
                              <span key={`${o.label}-legend`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#8290a0", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: chartSeries[oi]?.color || CHART_COLORS[oi % CHART_COLORS.length] }} />
                                {o.label} {Math.round(Number(o.prob ?? 0))}%
                              </span>
                            ))}
                          </div>
                          <ExternalLink size={17} color="#dce3ea" style={{ flexShrink: 0 }} />
                        </div>

                        <div className="top-sim-chart" style={{ flex: 1, minHeight: 190, minWidth: 0 }}>
                          <MarketMiniChart series={chartSeries} outcomes={outcomes} source={t.source} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#58708a", fontSize: 13, fontWeight: 900, paddingTop: 10 }}>
                          <span>{t.endDate ? `Ends ${new Date(t.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : "Completed today"}</span>
                          <span>{sourceLabel}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {sorted.length > displayed.length && !showMore && (
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
