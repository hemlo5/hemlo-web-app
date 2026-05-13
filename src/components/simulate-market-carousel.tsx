"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { cachedJson, readClientCache } from "@/lib/client-cache";

export type SimulateCarouselOutcome = {
  label: string;
  prob?: number;
  hemloProb?: number;
  tokenId?: string;
  clobTokenId?: string;
  image?: string;
  icon?: string;
};

export type SimulateCarouselMarket = {
  id?: string;
  marketId?: string;
  source?: string;
  topic: string;
  category?: string;
  marketType?: "binary" | "categorical" | string;
  outcomes?: SimulateCarouselOutcome[];
  polymarketOdds?: string;
  hemloOdds?: number;
  divergence?: number;
  confidence?: number;
  icon?: string;
  image?: string;
  moneyAtStake?: string;
  volume?: string;
  endDate?: string;
  clobTokenIds?: string[];
  resultHref?: string;
};

function getOutcomeImage(outcome?: SimulateCarouselOutcome) {
  return outcome?.icon || outcome?.image || "";
}

function toPercent(value: unknown, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getCarouselMarketOutcomes(market: SimulateCarouselMarket): SimulateCarouselOutcome[] {
  const yes = toPercent(market.polymarketOdds, 50);
  const raw = Array.isArray(market.outcomes) && market.outcomes.length > 0
    ? market.outcomes
    : [
        { label: "Yes", prob: yes },
        { label: "No", prob: 100 - yes },
      ];

  const seen = new Set<string>();
  return raw
    .map((outcome, index) => ({
      label: String(outcome.label || "").trim(),
      prob: Number.isFinite(Number(outcome.prob)) ? toPercent(outcome.prob) : undefined,
      hemloProb: Number.isFinite(Number(outcome.hemloProb)) ? toPercent(outcome.hemloProb) : undefined,
      tokenId: outcome.tokenId || outcome.clobTokenId || market.clobTokenIds?.[index],
      clobTokenId: outcome.clobTokenId || outcome.tokenId || market.clobTokenIds?.[index],
      image: outcome.image || outcome.icon,
      icon: outcome.icon || outcome.image,
    }))
    .filter((outcome) => {
      const key = outcome.label.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function formatEndDate(date?: string) {
  if (!date) return "Active market";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Active market";
  return `Ends ${parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function sourceLabel(source?: string) {
  if (source === "kalshi") return "Kalshi";
  if (source === "polymarket") return "Polymarket";
  return "Hemlo";
}

function sourceIcon(source?: string) {
  if (source === "kalshi") return "/kalshi.webp";
  if (source === "polymarket") return "/polymarket.webp";
  return "/logo.svg";
}

function getOutcomeMarketPercent(outcome: SimulateCarouselOutcome, market: SimulateCarouselMarket, index: number) {
  if (Number.isFinite(Number(outcome.prob))) return toPercent(outcome.prob);
  const crowd = Number(market.polymarketOdds);
  if (!Number.isFinite(crowd)) return 50;
  if (index === 0) return toPercent(crowd);
  if ((market.marketType === "binary" || getCarouselMarketOutcomes(market).length === 2) && index === 1) {
    return toPercent(100 - crowd);
  }
  return 50;
}

function getOutcomeHemloPercent(outcome: SimulateCarouselOutcome, market: SimulateCarouselMarket, index: number) {
  if (Number.isFinite(Number(outcome.hemloProb))) return toPercent(outcome.hemloProb);
  const hemlo = Number(market.hemloOdds);
  if (!Number.isFinite(hemlo)) return null;
  if (index === 0) return toPercent(hemlo);
  if ((market.marketType === "binary" || getCarouselMarketOutcomes(market).length === 2) && index === 1) {
    return toPercent(100 - hemlo);
  }
  return null;
}

/* ─── Mini price chart (SVG sparkline from Polymarket CLOB API) ───────── */
function MiniPriceChart({ tokenId, color = "#38e88d" }: { tokenId?: string; color?: string }) {
  const [points, setPoints] = useState<{ t: number; p: number }[]>([]);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;
    cachedJson<any>(`/api/polymarket-chart?token=${encodeURIComponent(tokenId)}&interval=1w&fidelity=60`, { ttlMs: 5 * 60_000 })
      .then(d => {
        if (!cancelled) {
          setPoints(Array.isArray(d.history) ? d.history : []);
          setLoadedToken(tokenId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPoints([]);
          setLoadedToken(tokenId);
        }
      });
    return () => { cancelled = true; };
  }, [tokenId]);

  if (tokenId && loadedToken !== tokenId) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#3a4a5c", fontSize: 12, fontWeight: 600 }}>
        Loading chart…
      </div>
    );
  }

  if (points.length < 2) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#3a4a5c", fontSize: 12, fontWeight: 600 }}>
        No chart data
      </div>
    );
  }

  // Build SVG path
  const W = 400;
  const H = 150;
  const PAD = 4;
  const prices = points.map(pt => pt.p);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 0.01;
  const pathParts = points.map((pt, i) => {
    const x = PAD + ((i / (points.length - 1)) * (W - PAD * 2));
    const y = PAD + ((1 - (pt.p - minP) / range) * (H - PAD * 2));
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = pathParts.join(" ");
  // gradient fill path
  const fillPath = `${linePath} L${(W - PAD).toFixed(1)},${H} L${PAD},${H} Z`;

  const lastPrice = prices[prices.length - 1];
  const firstPrice = prices[0];
  const change = lastPrice - firstPrice;
  const lineColor = change >= 0 ? color : "#f87171";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#chartFill)" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 13, fontWeight: 700, color: lineColor }}>
        {(lastPrice * 100).toFixed(0)}¢
        <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6, color: change >= 0 ? "#38e88d" : "#f87171" }}>
          {change >= 0 ? "+" : ""}{(change * 100).toFixed(1)}¢ 7d
        </span>
      </div>
    </div>
  );
}

function HemloMarketStats({
  market,
  outcomes: rawOutcomes,
  isCompact,
}: {
  market: SimulateCarouselMarket;
  outcomes: SimulateCarouselOutcome[];
  isCompact: boolean;
}) {
  const label = sourceLabel(market.source);
  // Sort outcomes by sum of (market% + hemlo%) descending, then cap at 4
  const sorted = (rawOutcomes.length ? [...rawOutcomes] : [{ label: "Yes", prob: 50 } as SimulateCarouselOutcome])
    .map((o, idx) => {
      const mkt = getOutcomeMarketPercent(o, market, idx);
      const hml = getOutcomeHemloPercent(o, market, idx);
      return { outcome: o, originalIndex: idx, combinedScore: (mkt ?? 0) + (hml ?? 0) };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore);
  const MAX_VISIBLE = 4;
  const visibleSorted = sorted.slice(0, MAX_VISIBLE);
  const extraCount = sorted.length - visibleSorted.length;
  const rows = visibleSorted.map(s => s.outcome);
  const rowOriginalIndices = visibleSorted.map(s => s.originalIndex);
  const tableColumns = isCompact ? "minmax(0, 1fr) 62px 62px" : "minmax(0, 1fr) 80px 80px";
  const shouldFillOutcomeSpace = rows.length > 0 && rows.length < 3;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: isCompact ? 10 : 12, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
        <div>
          <div style={{ color: "#778596", fontSize: 11, fontWeight: 950, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
            Hemlo vs {label}
          </div>
          <div style={{ color: "#f4f7fb", fontSize: isCompact ? 18 : 22, fontWeight: 700, lineHeight: 1 }}>
            Outcome Odds
          </div>
        </div>
        <div style={{ padding: "8px 10px", borderRadius: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#38e88d", fontSize: 13, fontWeight: 950, whiteSpace: "nowrap" }}>
          {Math.abs(Math.round(Number(market.divergence || 0)))}% div
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: tableColumns, gap: 10, alignItems: "center", padding: "0 10px", color: "#748399", fontSize: 10, fontWeight: 950, letterSpacing: 0.7, textTransform: "uppercase" }}>
        <span>Outcome</span>
        <span style={{ textAlign: "right" }}>{label}</span>
        <span style={{ textAlign: "right" }}>Hemlo</span>
      </div>

      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 8,
          minHeight: 0,
          overflowY: shouldFillOutcomeSpace ? "hidden" : "auto",
          paddingRight: 2,
          scrollbarWidth: "none",
        }}
      >
        {rows.map((outcome, visIdx) => {
          const origIdx = rowOriginalIndices[visIdx];
          const marketPct = getOutcomeMarketPercent(outcome, market, origIdx);
          const hemloPct = getOutcomeHemloPercent(outcome, market, origIdx);
          const optionImage = getOutcomeImage(outcome);
          return (
            <div
              key={`${outcome.label}-${visIdx}-stats`}
              style={{
                display: "grid",
                gridTemplateColumns: tableColumns,
                gap: 10,
                alignItems: "center",
                flex: shouldFillOutcomeSpace ? "1 1 0" : "0 0 auto",
                minHeight: shouldFillOutcomeSpace ? (isCompact ? 82 : 112) : undefined,
                padding: isCompact ? "12px" : "14px 14px",
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #e6e8ec",
                boxShadow: "0 8px 22px rgba(0,0,0,0.12)",
              }}
            >
              <div style={{ color: "#050505", fontSize: 14, fontWeight: 700, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {optionImage && (
                  <img src={optionImage} alt="" style={{ width: isCompact ? 24 : 28, height: isCompact ? 24 : 28, borderRadius: 7, objectFit: "cover", flexShrink: 0, background: "#eef1f5" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{outcome.label}</span>
              </div>
              <div style={{ textAlign: "right", color: "#050505", fontSize: isCompact ? 15 : 17, fontWeight: 700 }}>
                {marketPct}%
              </div>
              <div style={{ textAlign: "right", color: hemloPct === null ? "#627084" : "#38e88d", fontSize: isCompact ? 15 : 17, fontWeight: 700 }}>
                {hemloPct === null ? "--" : `${hemloPct}%`}
              </div>
            </div>
          );
        })}
        {extraCount > 0 && (
          <div style={{ textAlign: "center", color: "#58708a", fontSize: 12, fontWeight: 700, padding: "4px 0" }}>
            +{extraCount} more outcome{extraCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, color: "#58708a", fontSize: 13, fontWeight: 900, paddingTop: 2 }}>
        <span>{formatEndDate(market.endDate)}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <img src={sourceIcon(market.source)} alt="" style={{ width: 20, height: 20, objectFit: "contain", opacity: 0.78 }} />
          {label}
        </span>
      </div>
    </div>
  );
}

function TopDivergencesPanel({
  markets,
  isCompact,
}: {
  markets: SimulateCarouselMarket[];
  isCompact: boolean;
}) {
  const top = markets
    .filter((market) => market.resultHref || market.id)
    .sort((a, b) => Math.abs(Number(b.divergence || 0)) - Math.abs(Number(a.divergence || 0)))
    .slice(0, isCompact ? 3 : 5);

  return (
    <aside
      style={{
        border: "1px solid #25303a",
        borderRadius: 22,
        background: "linear-gradient(180deg, #111820, #0b0f15)",
        minHeight: 0,
        height: isCompact ? 126 : "100%",
        padding: isCompact ? 12 : 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        color: "#ffffff",
        boxShadow: "0 18px 60px rgba(0,0,0,0.32)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 950, lineHeight: 1.1 }}>
          Top divergences
        </div>
        <TrendingUp size={16} color="#38e88d" />
      </div>

      {top.length === 0 ? (
        <div style={{ color: "#748090", fontSize: 12, lineHeight: 1.4, fontWeight: 700 }}>
          Completed simulation signals will appear here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: isCompact ? "row" : "column", gap: 8, overflowX: isCompact ? "auto" : "hidden", overflowY: isCompact ? "hidden" : "auto", scrollbarWidth: "none", minHeight: 0 }}>
          {top.map((market, index) => {
            const href = market.resultHref || (market.id ? `/simulate/mirofish/${market.id}` : "/simulate/mirofish");
            const divergence = Math.abs(Math.round(Number(market.divergence || 0)));
            const marketImage = market.icon || market.image || sourceIcon(market.source);
            return (
              <Link key={`${market.source}-${market.id || market.topic}-${index}`} href={href} style={{ textDecoration: "none", minWidth: isCompact ? 260 : 0 }}>
                <div style={{ padding: 10, borderRadius: 13, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)", display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
                  <img src={marketImage} alt="" style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover", background: "#202a33" }} onError={(e) => { e.currentTarget.src = sourceIcon(market.source); }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#748399", fontSize: 10, fontWeight: 900, marginBottom: 4, textTransform: "capitalize" }}>
                      {sourceLabel(market.source)}
                    </div>
                    <div style={{ color: "#f3f6fa", fontSize: 12, lineHeight: 1.2, fontWeight: 850, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {market.topic}
                    </div>
                  </div>
                  <div style={{ color: divergence >= 10 ? "#38e88d" : "#7db7ff", fontSize: 14, fontWeight: 950, whiteSpace: "nowrap" }}>
                    {divergence}%
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export function SimulateMarketCarousel({
  initialMarkets = [],
  onMarketSelect,
}: {
  initialMarkets?: SimulateCarouselMarket[];
  onMarketSelect: (market: SimulateCarouselMarket) => void;
}) {
  const [markets, setMarkets] = useState<SimulateCarouselMarket[]>(initialMarkets);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(initialMarkets.length === 0);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth < 900);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCarouselMarkets(silent = false) {
      try {
        if (!silent) setLoading(true);
        const completedEndpoint = "/api/simulations-completed?scope=top&limit=12&lite=1";
        const completedData = await cachedJson<any>(completedEndpoint, { ttlMs: 45_000 });
        const completed = (Array.isArray(completedData.data) ? completedData.data : [])
          .map((sim: Record<string, unknown>) => {
            const outcomes = Array.isArray(sim.outcomes) ? sim.outcomes as SimulateCarouselOutcome[] : undefined;
            return {
              id: String(sim.id || ""),
              marketId: String(sim.marketId || ""),
              source: String(sim.source || "hemlo"),
              topic: String(sim.topic || "Completed simulation"),
              category: String(sim.category || sim.source || "Hemlo"),
              marketType: String(sim.marketType || ((outcomes?.length || 0) > 2 ? "categorical" : "binary")),
              polymarketOdds: String(sim.polymarketOdds ?? outcomes?.[0]?.prob ?? "50"),
              hemloOdds: Number.isFinite(Number(sim.hemloOdds)) ? Number(sim.hemloOdds) : undefined,
              divergence: Number.isFinite(Number(sim.divergence)) ? Number(sim.divergence) : undefined,
              confidence: Number.isFinite(Number(sim.confidence)) ? Number(sim.confidence) : undefined,
              outcomes,
              icon: String(sim.icon || sim.image || sourceIcon(String(sim.source || ""))),
              image: String(sim.image || sim.icon || sourceIcon(String(sim.source || ""))),
              moneyAtStake: String(sim.moneyAtStake || ""),
              endDate: sim.endDate ? String(sim.endDate) : undefined,
              resultHref: String(sim.resultHref || (sim.id ? `/simulate/mirofish/${sim.id}` : "")),
            } satisfies SimulateCarouselMarket;
          })
          .filter((market: SimulateCarouselMarket) => market.topic);

        if (cancelled) return;

        if (completed.length > 0) {
          setMarkets(completed);
          setActiveIndex((index) => Math.min(index, completed.length - 1));
          setLoading(false);
          return;
        }

        const polyEndpoint = "/api/polymarket-browse?category=trending&limit=12";
        const data = readClientCache<any>(polyEndpoint) || await cachedJson<any>(polyEndpoint, { ttlMs: 90_000 });
        if (cancelled) return;

        const mapped = (Array.isArray(data.markets) ? data.markets : []).map((market: Record<string, unknown>) => {
          const outcomes = Array.isArray(market.outcomes) ? market.outcomes as SimulateCarouselOutcome[] : undefined;
          return {
            ...market,
            id: String(market.id || market.conditionId || market.slug || ""),
            source: "polymarket",
            topic: String(market.question || market.title || "Prediction market"),
            category: String(market.category || "Polymarket"),
            marketType: String(market.marketType || ((outcomes?.length || 0) > 2 ? "categorical" : "binary")),
            polymarketOdds: String(outcomes?.[0]?.prob ?? market.polymarketOdds ?? "50"),
            outcomes,
            icon: String(market.image || market.icon || "/polymarket.webp"),
            image: String(market.image || market.icon || "/polymarket.webp"),
            moneyAtStake: String(market.volume || market.moneyAtStake || ""),
            endDate: market.endDate ? String(market.endDate) : undefined,
            clobTokenIds: Array.isArray(market.clobTokenIds) ? market.clobTokenIds.map(String) : undefined,
          } satisfies SimulateCarouselMarket;
        });
        setMarkets(mapped);
        setActiveIndex((index) => Math.min(index, Math.max(mapped.length - 1, 0)));
      } catch {
        if (!cancelled) setLoading(false);
        if (!cancelled && initialMarkets.length === 0) setMarkets([]);
        return;
      }

      if (!cancelled) setLoading(false);
    }

    const timer = window.setTimeout(() => {
      loadCarouselMarkets(initialMarkets.length > 0);
    }, initialMarkets.length > 0 ? 1800 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [initialMarkets.length]);

  useEffect(() => {
    if (markets.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % markets.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [markets.length]);

  const market = markets[activeIndex % Math.max(markets.length, 1)];
  const allOutcomes = market ? getCarouselMarketOutcomes(market) : [];
  const topOutcome = allOutcomes[0] || { label: "Yes", prob: 50 };

  return (
    <section
      style={{
        width: "100%",
        height: isCompact ? 630 : 467,
        minHeight: isCompact ? 630 : 467,
        maxHeight: isCompact ? 630 : 467,
        boxSizing: "border-box",
        padding: isCompact ? "20px 14px 16px" : "20px 117px 16px",
        background: "#15191d",
        display: "grid",
        gridTemplateColumns: isCompact ? "1fr" : "930px minmax(0, 1fr)",
        gridTemplateRows: isCompact ? "minmax(0, 1fr) auto" : undefined,
        gap: isCompact ? 14 : 16,
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0, minHeight: 0, height: "100%" }}>
        <AnimatePresence mode="wait">
          {market ? (
            <motion.div
              key={market.id || market.topic || activeIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.28 }}
              style={{
                width: "100%",
                height: isCompact ? "100%" : 431,
                maxWidth: 930,
                background: "#ffffff",
                border: "1px solid #ffffff",
                borderRadius: 16,
                padding: isCompact ? 10 : 12,
                overflow: "hidden",
                boxSizing: "border-box",
                boxShadow: "0 18px 60px rgba(0,0,0,0.42)",
                color: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isCompact ? "1fr" : "minmax(260px, 40%) minmax(0, 1fr)",
                  height: "100%",
                  minHeight: 0,
                  gap: isCompact ? 10 : 12,
                  background: "transparent",
                }}
              >
                <div style={{ padding: isCompact ? "20px" : "20px 20px 16px", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden", background: "#ffffff", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ width: 56, height: 56, minWidth: 56, borderRadius: 8, overflow: "hidden", background: "#eef1f5", flexShrink: 0 }}>
                      <img src={market.icon || market.image || "/polymarket.webp"} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#647386", lineHeight: 1.2, marginBottom: 4 }}>
                        {market.category || sourceLabel(market.source)}
                      </div>
                      <div style={{ fontSize: isCompact ? 20 : 24, fontWeight: 600, color: "#050505", lineHeight: 1.12, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {market.topic}
                      </div>
                    </div>
                  </div>

                  {/* Polymarket price chart */}
                  {!isCompact && (
                    <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: "hidden", background: "#f4f6f8", border: "1px solid #e2e7ee", marginTop: 4 }}>
                      <MiniPriceChart tokenId={topOutcome.tokenId || topOutcome.clobTokenId} />
                    </div>
                  )}

                  {/* Volume badge */}
                  <div style={{ paddingTop: 6, fontSize: 13, color: "#50677f", fontWeight: 600 }}>
                    {market.moneyAtStake ? `${market.moneyAtStake} Vol` : "Trending"}
                  </div>

                  {/* View Hemlo CTA */}
                  <div style={{ marginTop: 8 }}>
                    {market.resultHref ? (
                      <Link href={market.resultHref} style={{ textDecoration: "none" }}>
                        <motion.div
                          whileHover={{ y: -1, boxShadow: "0 10px 28px rgba(0,0,0,0.22)" }}
                          whileTap={{ scale: 0.97 }}
                          style={{
                            height: 48,
                            borderRadius: 8,
                            background: "#050505",
                            color: "#ffffff",
                            border: "none",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 10,
                            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                          }}
                        >
                          <img src="/hemlo-icon.svg" alt="Hemlo" style={{ width: 20, height: 20, objectFit: "contain" }} />
                          View Hemlo
                        </motion.div>
                      </Link>
                    ) : (
                      <motion.button
                        whileHover={{ y: -1, boxShadow: "0 10px 28px rgba(0,0,0,0.22)" }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onMarketSelect(market)}
                        style={{
                          height: 48,
                          borderRadius: 8,
                          background: "#050505",
                          color: "#ffffff",
                          border: "none",
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: 10,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
                        }}
                      >
                        <img src="/hemlo-icon.svg" alt="Hemlo" style={{ width: 20, height: 20, objectFit: "contain" }} />
                        View Hemlo
                      </motion.button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#050505", padding: isCompact ? "16px 20px 16px" : "20px 20px 16px 24px", borderRadius: 10, position: "relative", minWidth: 0, overflow: "hidden", minHeight: 0 }}>
                  <HemloMarketStats market={market} outcomes={allOutcomes.length ? allOutcomes : [topOutcome]} isCompact={isCompact} />
                </div>
              </div>
            </motion.div>
          ) : (
            <div style={{ height: "100%", width: "100%", maxWidth: 1180, borderRadius: 16, border: "1px solid #151a20", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a94a6", fontWeight: 600 }}>
              {loading ? "Loading simulated markets..." : "No simulated markets available"}
            </div>
          )}
        </AnimatePresence>
      </div>

      <TopDivergencesPanel markets={markets} isCompact={isCompact} />
    </section>
  );
}
