"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, BarChart3, ExternalLink, Loader2, TrendingUp, Users, Zap } from "lucide-react";

export interface SimulationPayload {
  id: string;
  scenario: string;
  status: string;
  runtime_seconds: number;
  agent_count: number;
  rounds: number;
  domain: string;
  created_at: string;
  reality_seed: string;
  result: any;
  analysis_data?: any;
  report_text?: string;
  round_logs?: any[];
  primary_probability?: number;
  options?: string[];
}

type OutcomeRow = {
  label: string;
  marketPct: number | null;
  hemloPct: number | null;
  image?: string;
  icon?: string;
  tokenId?: string;
  clobTokenId?: string;
};

type HistoryPoint = { t: number; p: number };
type OrderBookLevel = { price: number; size: number };
type TradePoint = { price: number; size: number; side: string; timestamp: string; outcome: string };
type SimilarMarket = {
  id: string;
  title: string;
  source: string;
  category?: string;
  image?: string;
  icon?: string;
  volume?: string;
  volumeRaw?: number;
  endDate?: string;
  link?: string;
  outcomes?: Array<{ label: string; prob?: number; image?: string; icon?: string }>;
};

const MARKET_CARD_BG = "#1e2428";
const MARKET_CARD_HOVER_BG = "#2a3136";
const MARKET_CARD_BORDER = "#2a3444";

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toPct(value: unknown, fallback: number | null = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n >= 0 && n <= 1) return clampPct(n * 100);
  return clampPct(n);
}

function normalizeKey(value: string) {
  return String(value || "").trim().toLowerCase();
}

function sourceLabel(source?: string) {
  const clean = String(source || "").toLowerCase();
  if (clean === "kalshi") return "Kalshi";
  if (clean === "polymarket") return "Polymarket";
  return "Market";
}

function sourceIcon(source?: string) {
  const clean = String(source || "").toLowerCase();
  if (clean === "kalshi") return "/kalshi.webp";
  if (clean === "polymarket") return "/polymarket.webp";
  return "/logo.svg";
}

function formatMoney(value: unknown, fallback = "--") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string" && value.trim().startsWith("$")) return value.trim();
  const n = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function formatPrice(value: unknown, fallback = "--") {
  const pct = toPct(value, null);
  if (pct !== null) return `${pct}%`;
  return fallback;
}

function formatLivePrice(value: unknown, fallback = "--") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return formatPrice(n, fallback);
}

function formatDate(value: unknown, fallback = "--") {
  if (!value) return fallback;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function formatSignedPrice(value: unknown, fallback = "--") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const pct = Math.abs(n) <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

function parseDomainMeta(domain: string) {
  const [source = "", marketId = "", volume = "", liquidity = "", last = "", ...imageParts] = String(domain || "").split("|");
  return {
    source,
    marketId,
    volume,
    liquidity,
    last,
    image: imageParts.join("|"),
  };
}

function uniqueLabels(values: string[]) {
  const seen = new Set<string>();
  return values.filter((label) => {
    const key = normalizeKey(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topicTokens(value: string) {
  const stop = new Set([
    "will", "when", "what", "where", "which", "who", "the", "and", "for", "with", "from", "before", "after",
    "over", "under", "market", "markets", "yes", "no", "win", "hit", "reach", "return", "happen", "occur",
    "2025", "2026", "2027", "2028", "may", "june", "july", "december", "november", "april",
  ]);
  return String(value || "")
    .toLowerCase()
    .replace(/[$?,.:;'"()[\]{}]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stop.has(token));
}

function compactQuery(value: string) {
  return uniqueLabels(topicTokens(value)).slice(0, 7).join(" ");
}

function categoryKeyFor(value: unknown) {
  const text = String(value || "").toLowerCase();
  if (/\b(election|politic|president|senate|congress|nominee|primary|democrat|republican|world elections)\b/.test(text)) return "politics";
  if (/\b(nba|nfl|mlb|nhl|soccer|football|basketball|sports|champion|league|cup)\b/.test(text)) return "sports";
  if (/\b(bitcoin|btc|ethereum|crypto|solana|doge)\b/.test(text)) return "crypto";
  if (/\b(fed|finance|financial|stock|rate|inflation|gdp|economy|treasury|recession)\b/.test(text)) return "finance";
  if (/\b(iran|russia|ukraine|israel|gaza|china|taiwan|war|peace|ceasefire|geopolitic)\b/.test(text)) return "geopolitics";
  if (/\b(ai|tech|technology|openai|nvidia|apple|tesla|google|microsoft)\b/.test(text)) return "tech";
  if (/\b(movie|music|celebrity|taylor|concert|entertainment|culture|oscars|grammy)\b/.test(text)) return "culture";
  if (/\b(weather|hurricane|storm|rain|snow|temperature|climate)\b/.test(text)) return "weather";
  return "";
}

function MiniMarketChart({ history, loading, light = false }: { history: HistoryPoint[]; loading: boolean; light?: boolean }) {
  if (loading) {
    return (
      <div className={`flex h-[190px] items-center justify-center rounded-xl border ${light ? "border-black/10 bg-black/[0.035]" : "border-white/10 bg-white/[0.035]"}`}>
        <Loader2 className={`animate-spin ${light ? "text-zinc-500" : "text-zinc-500"}`} size={24} />
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className={`flex h-[190px] flex-col items-center justify-center gap-3 rounded-xl border ${light ? "border-black/10 bg-black/[0.035] text-zinc-500" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}>
        <BarChart3 size={34} />
        <span className="font-semibold text-heading-lg" style={{ fontSize: 12 }}>No price history yet</span>
      </div>
    );
  }

  const width = 420;
  const height = 160;
  const prices = history.map((point) => toPct(point.p, 0) || 0);
  const min = Math.max(0, Math.min(...prices) - 5);
  const max = Math.min(100, Math.max(...prices) + 5);
  const range = max - min || 1;
  const points = prices.map((price, index) => {
    const x = (index / Math.max(1, prices.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return [x, y];
  });
  const path = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const last = prices[prices.length - 1];
  const first = prices[0];
  const chartColor = last >= first ? "#38e88d" : "#fb7185";

  return (
    <div className={`rounded-xl border p-4 ${light ? "border-black/10 bg-black/[0.025]" : "border-white/10 bg-white/[0.035]"}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold text-heading-lg" style={{ color: light ? "#6b7280" : "#71717a", fontSize: 11 }}>7 day price</span>
        <span className="font-semibold text-heading-2xl text-[28px]" style={{ color: chartColor }}>{last}%</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="resultChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#resultChartGradient)" />
        <path d={path} fill="none" stroke={chartColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="4" fill={chartColor} />
      </svg>
    </div>
  );
}

export default function SimulationResultInteractive({ initialData }: { initialData: SimulationPayload }) {
  const data = initialData;
  const result = useMemo(() => data.result || {}, [data.result]);
  const domainMeta = useMemo(() => parseDomainMeta(data.domain || ""), [data.domain]);
  const marketInfo = useMemo(
    () => result.marketInfo || result.market_info || data.analysis_data?.predictionMarket || {},
    [data.analysis_data?.predictionMarket, result],
  );
  const source = String(marketInfo.source || domainMeta.source || "simulation").toLowerCase();
  const label = sourceLabel(source);
  const marketLookupCandidates = useMemo(
    () => {
      const textCandidates = [
        String(marketInfo.slug || ""),
        String(marketInfo.eventSlug || marketInfo.event_slug || ""),
        String(data.scenario || ""),
      ].filter((candidate) => candidate && !/^\d+$/.test(candidate));
      const numericCandidates = [
        String(marketInfo.id || ""),
        String(domainMeta.marketId || ""),
      ].filter((candidate) => /^\d+$/.test(candidate));
      return uniqueLabels([...textCandidates, ...numericCandidates]);
    },
    [data.scenario, domainMeta.marketId, marketInfo],
  );
  const marketLookup = marketLookupCandidates[0] || "";
  const isPolymarket = source === "polymarket";

  const dateStr = useMemo(() => formatDateTime(data.created_at), [data.created_at]);
  const [liveMarketData, setLiveMarketData] = useState<any>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [chartHistory, setChartHistory] = useState<HistoryPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [orderBook, setOrderBook] = useState<{ bids: OrderBookLevel[]; asks: OrderBookLevel[] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<TradePoint[]>([]);
  const [similarMarkets, setSimilarMarkets] = useState<SimilarMarket[]>([]);

  const outcomeRows = useMemo<OutcomeRow[]>(() => {
    const probabilityModel = result.probabilityModel || data.analysis_data?.probabilityModel || {};
    const hemloModel = result.outcome_probabilities || result.outcomeProbabilities || probabilityModel.hemloModel || {};
    const marketModel = probabilityModel.predictionMarket || {};
    const resultOutcomes = Array.isArray(result.market_outcomes) ? result.market_outcomes : [];
    const infoOutcomes = Array.isArray(marketInfo.outcomes) ? marketInfo.outcomes : [];
    const liveRootOutcomes = Array.isArray(liveMarketData?.outcomes) ? liveMarketData.outcomes : [];
    const liveMarketOutcomes = Array.isArray(liveMarketData?.markets)
      ? liveMarketData.markets.filter((market: any) => market?.active !== false && !market?.closed).flatMap((market: any) => {
          if (market?.groupItemTitle) {
            const option = Array.isArray(market.outcomes) ? market.outcomes[0] : null;
            return [{
              label: market.groupItemTitle,
              prob: option?.prob ?? market.lastTradePrice,
              image: market.image || market.icon,
              icon: market.icon || market.image,
              tokenId: market.clobTokenIds?.[0],
              clobTokenId: market.clobTokenIds?.[0],
            }];
          }
          return Array.isArray(market?.outcomes)
            ? market.outcomes.map((outcome: any, index: number) => ({
                ...outcome,
                image: outcome?.image || outcome?.icon || market.image || market.icon,
                icon: outcome?.icon || outcome?.image || market.icon || market.image,
                tokenId: outcome?.tokenId || outcome?.clobTokenId || market.clobTokenIds?.[index],
                clobTokenId: outcome?.clobTokenId || outcome?.tokenId || market.clobTokenIds?.[index],
              }))
            : [];
        })
      : [];
    const liveOutcomes = [...liveRootOutcomes, ...liveMarketOutcomes];
    const marketOutcomes = resultOutcomes.length ? resultOutcomes : infoOutcomes;
    const explicitOptions = Array.isArray(result.options)
      ? result.options
      : Array.isArray(data.options)
        ? data.options
        : [];

    const byLabel = new Map<string, any>();
    [...marketOutcomes, ...infoOutcomes, ...liveOutcomes].forEach((outcome: any) => {
      const key = normalizeKey(outcome?.label || outcome?.name || outcome);
      if (!key) return;
      const existing = byLabel.get(key) || {};
      byLabel.set(key, {
        ...outcome,
        ...existing,
        image: existing.image || outcome?.image || outcome?.icon,
        icon: existing.icon || outcome?.icon || outcome?.image,
        tokenId: existing.tokenId || existing.clobTokenId || outcome?.tokenId || outcome?.clobTokenId,
        clobTokenId: existing.clobTokenId || existing.tokenId || outcome?.clobTokenId || outcome?.tokenId,
      });
    });

    const labels = uniqueLabels([
      ...Object.keys(hemloModel || {}),
      ...marketOutcomes.map((outcome: any) => String(outcome?.label || outcome?.name || "").trim()),
      ...liveOutcomes.map((outcome: any) => String(outcome?.label || outcome?.name || "").trim()),
      ...Object.keys(marketModel || {}),
      ...explicitOptions.map((option: any) => typeof option === "string" ? option : String(option?.label || option?.name || "").trim()),
    ]);

    const finalLabels = labels.length >= 2 ? labels : ["Yes", "No"];
    const primaryHemlo = toPct(data.primary_probability ?? result.primary_probability ?? result.top_probability, null);
    const primaryMarket = toPct(marketInfo.crowdOdds ?? marketInfo.polymarketOdds ?? marketOutcomes[0]?.prob, null);

    return finalLabels.slice(0, 12).map((name, index) => {
      const saved = byLabel.get(normalizeKey(name)) || {};
      const hemloPct =
        toPct(hemloModel?.[name], null) ??
        (index === 0 ? primaryHemlo : finalLabels.length === 2 && primaryHemlo !== null ? 100 - primaryHemlo : null);
      const marketPct =
        toPct(saved?.prob, null) ??
        toPct(marketModel?.[name], null) ??
        (index === 0 ? primaryMarket : finalLabels.length === 2 && primaryMarket !== null ? 100 - primaryMarket : null);

      return {
        label: name,
        marketPct,
        hemloPct,
        image: saved?.image || saved?.icon,
        icon: saved?.icon || saved?.image,
        tokenId: saved?.tokenId || saved?.clobTokenId,
        clobTokenId: saved?.clobTokenId || saved?.tokenId,
      };
    });
  }, [data.analysis_data, data.options, data.primary_probability, liveMarketData, marketInfo, result]);

  useEffect(() => {
    if (!isPolymarket || marketLookupCandidates.length === 0) return;
    let cancelled = false;
    setMarketLoading(true);

    async function loadMarket() {
      for (const candidate of marketLookupCandidates) {
        try {
          const res = await fetch(`/api/polymarket-market?slug=${encodeURIComponent(candidate)}`);
          const payload = await res.json();
          if (!payload?.error) {
            if (!cancelled) setLiveMarketData(payload);
            return;
          }
        } catch {
          // Try the next available identifier.
        }
      }
      if (!cancelled) setLiveMarketData(null);
    }

    loadMarket()
      .catch(() => {
        if (!cancelled) setLiveMarketData(null);
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPolymarket, marketLookupCandidates]);

  const liveMarket = Array.isArray(liveMarketData?.markets) ? liveMarketData.markets[0] : null;
  const chartToken =
    outcomeRows.find((row) => row.tokenId || row.clobTokenId)?.tokenId ||
    outcomeRows.find((row) => row.tokenId || row.clobTokenId)?.clobTokenId ||
    liveMarket?.clobTokenIds?.[0] ||
    "";
  const marketTitle = liveMarketData?.title || marketInfo.title || data.scenario;
  const marketImage = liveMarketData?.image || marketInfo.image || marketInfo.icon || domainMeta.image || sourceIcon(source);
  const currentCategory = liveMarketData?.category || marketInfo.category || marketInfo.tag || marketInfo.tags?.[0]?.label || "";

  useEffect(() => {
    if (!chartToken) {
      setChartHistory([]);
      return;
    }
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/polymarket-history?tokenId=${encodeURIComponent(chartToken)}&interval=1w&fidelity=60`)
      .then((res) => res.json())
      .then((payload) => {
        if (!cancelled) setChartHistory(Array.isArray(payload.history) ? payload.history : []);
      })
      .catch(() => {
        if (!cancelled) setChartHistory([]);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartToken]);

  useEffect(() => {
    if (!chartToken || !isPolymarket) {
      setOrderBook({ bids: [], asks: [] });
      setRecentTrades([]);
      return;
    }
    let cancelled = false;

    Promise.all([
      fetch(`/api/polymarket-orderbook?tokenId=${encodeURIComponent(chartToken)}`).then((res) => res.json()).catch(() => null),
      fetch(`/api/polymarket-trades?tokenId=${encodeURIComponent(chartToken)}`).then((res) => res.json()).catch(() => null),
    ]).then(([book, trades]) => {
      if (cancelled) return;
      setOrderBook({
        bids: Array.isArray(book?.bids) ? book.bids : [],
        asks: Array.isArray(book?.asks) ? book.asks : [],
      });
      setRecentTrades(Array.isArray(trades?.trades) ? trades.trades : []);
    });

    return () => {
      cancelled = true;
    };
  }, [chartToken, isPolymarket]);

  useEffect(() => {
    const query = marketTitle.replace(/[^\w\s$.-]/g, " ").replace(/\s+/g, " ").trim();
    const topicQuery = compactQuery(query) || query;
    if (query.length < 3 && topicQuery.length < 3) return;
    let cancelled = false;

    async function loadSimilarMarkets() {
      const categoryKey = categoryKeyFor(`${currentCategory} ${marketTitle}`);
      const outcomeQuery = outcomeRows
        .map((row) => row.label)
        .filter((name) => !/^(yes|no|other)$/i.test(name))
        .slice(0, 3)
        .join(" ");
      const endpoints = source === "kalshi"
        ? uniqueLabels([
            `/api/kalshi-markets?q=${encodeURIComponent(topicQuery)}`,
            outcomeQuery ? `/api/kalshi-markets?q=${encodeURIComponent(outcomeQuery)}` : "",
            categoryKey ? `/api/kalshi-markets?category=${encodeURIComponent(categoryKey)}` : "",
            "/api/kalshi-markets?category=trending",
          ])
        : uniqueLabels([
            `/api/polymarket-browse?q=${encodeURIComponent(topicQuery)}&limit=24`,
            outcomeQuery ? `/api/polymarket-browse?q=${encodeURIComponent(outcomeQuery)}&limit=16` : "",
            categoryKey ? `/api/polymarket-browse?category=${encodeURIComponent(categoryKey)}&limit=24` : "",
            "/api/polymarket-browse?category=trending&limit=24",
          ]);

      const pages = await Promise.all(
        endpoints.map((endpoint) => fetch(endpoint).then((res) => res.json()).catch(() => null)),
      );
      const rawMarkets = pages.flatMap((page) => Array.isArray(page?.markets) ? page.markets : []);

      const currentKey = normalizeKey(marketTitle);
      const currentId = normalizeKey(String(marketInfo.id || domainMeta.marketId || liveMarketData?.slug || ""));
      const titleTokens = new Set(topicTokens(marketTitle));
      const outcomeTokens = new Set(outcomeRows.flatMap((row) => topicTokens(row.label)));
      const scoreMarket = (market: SimilarMarket) => {
        const marketTokens = topicTokens(`${market.title} ${market.category || ""}`);
        const overlap = marketTokens.reduce((sum, token) => sum + (titleTokens.has(token) ? 3 : outcomeTokens.has(token) ? 2 : 0), 0);
        const sameCategory = categoryKeyFor(`${market.category} ${market.title}`) === categoryKey && categoryKey ? 5 : 0;
        return overlap + sameCategory;
      };

      const mapped = rawMarkets
        .map((market: any): SimilarMarket => ({
          id: String(market.id || market.slug || market.event_ticker || market.title || market.question || ""),
          title: String(market.title || market.question || "Prediction market"),
          source: source === "kalshi" ? "Kalshi" : "Polymarket",
          category: String(market.category || ""),
          image: String(market.image || market.icon || sourceIcon(source)),
          icon: String(market.icon || market.image || sourceIcon(source)),
          volume: String(market.volume || ""),
          volumeRaw: Number(market.volumeRaw || 0),
          endDate: market.endDate ? String(market.endDate) : undefined,
          link: String(market.link || (market.slug ? `https://polymarket.com/event/${market.slug}` : "")),
          outcomes: Array.isArray(market.outcomes)
            ? market.outcomes.slice(0, 3).map((outcome: any) => ({
                label: String(outcome.label || outcome.name || ""),
                prob: outcome.prob,
                image: outcome.image || outcome.icon,
                icon: outcome.icon || outcome.image,
              }))
            : [],
        }))
        .filter((market: SimilarMarket) => {
          const marketKey = normalizeKey(market.title);
          const idKey = normalizeKey(market.id);
          return market.id && marketKey !== currentKey && (!currentId || idKey !== currentId);
        });
      const seen = new Set<string>();
      const related = mapped
        .filter((market) => {
          const key = normalizeKey(`${market.id}:${market.title}`);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((market) => ({ market, score: scoreMarket(market) }))
        .sort((a, b) => (b.score - a.score) || ((b.market.volumeRaw || 0) - (a.market.volumeRaw || 0)))
        .map(({ market }) => market)
        .slice(0, 8);

      if (!cancelled) setSimilarMarkets(related);
    }

    loadSimilarMarkets().catch(() => {
      if (!cancelled) setSimilarMarkets([]);
    });

    return () => {
      cancelled = true;
    };
  }, [currentCategory, domainMeta.marketId, liveMarketData?.slug, marketInfo.id, marketTitle, outcomeRows, source]);

  const visibleFactors: string[] = Array.isArray(result.key_factors)
    ? result.key_factors
    : Array.isArray(result.keyFactors)
      ? result.keyFactors
      : [];
  const notablePeople = Array.isArray(result.persona_highlights) && result.persona_highlights.length
    ? result.persona_highlights
    : Array.isArray(result.agents)
      ? result.agents.slice(0, 4).map((agent: any) => ({
          name: agent.name || "Agent",
          role: agent.type || agent.profession || "Simulation agent",
          stance: agent.stance || "",
          impact: agent.bio || agent.persona || "Participated in the simulation.",
        }))
      : [];
  const confidence = String(result.confidence || "").toUpperCase();
  const verdict = result.verdict || result.tldr || result.report_summary || "";
  const topOutcome = outcomeRows.reduce(
    (best, row) => ((row.hemloPct ?? -1) > (best.hemloPct ?? -1) ? row : best),
    outcomeRows[0],
  );
  const confidenceTone =
    confidence === "HIGH" ? "#38e88d" : confidence === "LOW" ? "#fb7185" : "#7db7ff";
  const eventVolume = liveMarketData?.volume || liveMarket?.volumeRaw || liveMarket?.volume || marketInfo.volume || domainMeta.volume;
  const eventLiquidity = liveMarketData?.liquidity || liveMarket?.liquidity || marketInfo.liquidity || domainMeta.liquidity;
  const bestBid = orderBook.bids[0]?.price;
  const bestAsk = orderBook.asks[0]?.price;
  const liveSpread = bestBid && bestAsk ? Math.max(0, bestAsk - bestBid) : liveMarket?.spread;
  const latestTrade = recentTrades[0]?.price;
  const metricVolume = formatMoney(eventVolume);
  const metricVolume24h = formatMoney(liveMarketData?.volume24h || liveMarket?.volume24h);
  const metricLiquidity = formatMoney(eventLiquidity);
  const metricBid = formatLivePrice(bestBid || liveMarket?.bestBid || marketInfo.bestBid || marketInfo.bid);
  const metricAsk = formatLivePrice(bestAsk || liveMarket?.bestAsk || marketInfo.bestAsk || marketInfo.ask);
  const metricLast = formatLivePrice(latestTrade || liveMarket?.lastTradePrice || marketInfo.lastTradePrice || domainMeta.last);
  const metricSpread = formatLivePrice(liveSpread);
  const metricChange = formatSignedPrice(liveMarket?.oneDayPriceChange);
  const metricEndDate = formatDate(liveMarketData?.endDate || liveMarket?.endDate || marketInfo.endDate);
  const metricStatus = liveMarketData?.closed || liveMarket?.closed ? "Closed" : liveMarketData?.active === false || liveMarket?.active === false ? "Inactive" : "Active";
  const marketUrl = isPolymarket && (liveMarketData?.slug || marketLookup)
    ? `https://polymarket.com/event/${liveMarketData?.slug || marketLookup}`
    : "";

  return (
    <main className="min-h-screen bg-[#05070b] py-8 text-white">
      <style>{`
        .result-main-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .result-main-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div
        className="flex flex-col gap-6"
        style={{
          width: "min(calc(100vw - 48px), 1360px)",
          marginInline: "auto",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/simulate/mirofish" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/[0.07]">
            <ArrowLeft size={16} />
            Back to simulate
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
            <span style={{ color: confidenceTone }}>{confidence || "MEDIUM"}</span>
            confidence
          </div>
        </div>

        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(340px,0.78fr)]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="result-main-scroll flex overflow-y-auto rounded-[22px] border border-[#25303a] bg-[#13191f] shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
            style={{
              flexDirection: "column",
              height: "clamp(640px, calc(100vh - 120px), 760px)",
            }}
          >
            <div className="border-b border-[#25303a] p-5 sm:p-7">
              <div className="flex items-start gap-4">
                <img src={marketImage} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-[#202a33] object-cover ring-1 ring-white/10" onError={(e) => { e.currentTarget.src = sourceIcon(source); }} />
                <div className="min-w-0">
                  <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#718093]">
                    {label} result {dateStr ? <span className="text-[#4f6072]">/ {dateStr}</span> : null}
                  </div>
                  <h1
                    className="font-semibold text-heading-lg text-text-primary"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {marketTitle}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#718093]">Hemlo vs {label}</div>
                  <div className="mt-1 font-semibold text-heading-lg text-text-primary">Outcome comparison</div>
                </div>
                {topOutcome && (
                  <div className="border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200/70">Hemlo leader</div>
                    <div className="font-semibold text-heading-lg text-emerald-200">{topOutcome.label} {topOutcome.hemloPct ?? "--"}%</div>
                  </div>
                )}
              </div>

              <div className="grid flex-1 border border-white/10 bg-[#13191f]" style={{ gridTemplateRows: "auto minmax(0, 1fr)" }}>
                <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] gap-4 border-b border-white/8 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 sm:grid-cols-[minmax(0,1fr)_118px_118px] sm:px-6">
                  <span>Outcome</span>
                  <span className="pr-1 text-right">{label}</span>
                  <span className="pr-1 text-right">Hemlo</span>
                </div>
                <div
                  className="grid gap-2 bg-[#13191f] p-3"
                  style={{
                    gridTemplateRows: outcomeRows.length
                      ? `repeat(${outcomeRows.length}, minmax(76px, 1fr))`
                      : undefined,
                  }}
                >
                  {outcomeRows.map((row, index) => {
                    const image = row.icon || row.image;
                    const delta = row.hemloPct !== null && row.marketPct !== null ? row.hemloPct - row.marketPct : null;
                    return (
                      <div key={`${row.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_84px_84px] items-center gap-4 border border-white/8 bg-[#171d22] px-5 py-4 sm:grid-cols-[minmax(0,1fr)_118px_118px] sm:px-6">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            {image && <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-lg bg-[#202a33] object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                            <div className="min-w-0">
                              <div className="font-semibold text-heading-lg text-text-primary truncate">{row.label}</div>
                              {delta !== null && (
                                <div className="mt-1 text-[11px] font-bold" style={{ color: delta >= 0 ? "#38e88d" : "#fb7185" }}>
                                  {delta >= 0 ? "+" : ""}{delta}% divergence
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="pr-1 text-right font-semibold text-heading-2xl text-[28px] text-[#dbe7f5]">{row.marketPct === null ? "--" : `${row.marketPct}%`}</div>
                        <div className="pr-1 text-right font-semibold text-heading-2xl text-[28px] text-[#38e88d]">{row.hemloPct === null ? "--" : `${row.hemloPct}%`}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {verdict && (
                <div className="self-end border border-white/10 bg-white/[0.035] p-5">
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                    <TrendingUp size={15} />
                    Verdict
                  </div>
                  <p className="text-sm leading-7 text-white">{verdict}</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="self-start rounded-b-[22px] rounded-t-none border border-black/10 bg-white p-5 text-black shadow-[0_18px_60px_rgba(0,0,0,0.34)] sm:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={sourceIcon(source)} alt="" className="h-8 w-8 rounded-lg object-contain" />
                <div>
                  <div className="font-semibold text-heading-lg" style={{ color: "#64748b", fontSize: 12 }}>{label}</div>
                  <div className="font-semibold text-heading-lg" style={{ color: "#111827" }}>Market data</div>
                </div>
              </div>
              {marketLoading && <Loader2 className="animate-spin text-zinc-500" size={18} />}
            </div>

            <MiniMarketChart history={chartHistory} loading={chartLoading} light />

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Volume", metricVolume],
                ["24h volume", metricVolume24h],
                ["Liquidity", metricLiquidity],
                ["Last bid", metricBid],
                ["Best ask", metricAsk],
                ["Last trade", metricLast],
                ["Spread", metricSpread],
                ["24h change", metricChange],
                ["Ends", metricEndDate],
                ["Status", metricStatus],
              ].map(([metric, value]) => (
                <div key={metric} className="rounded-xl border border-black/10 bg-black/[0.035] p-4">
                  <div className="mb-1 font-semibold text-heading-lg" style={{ color: "#64748b", fontSize: 11 }}>{metric}</div>
                  <div className="font-semibold text-heading-2xl text-[28px]" style={{ color: "#111827" }}>{value}</div>
                </div>
              ))}
            </div>

            {marketUrl && (
              <a href={marketUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 font-semibold text-heading-lg text-white transition hover:bg-zinc-800">
                <ExternalLink size={16} />
                View on {label}
              </a>
            )}
          </motion.aside>
        </section>

        <section className="grid items-stretch gap-5 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex min-h-[390px] flex-col border border-[#25303a] bg-[#13191f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:p-6"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center border border-amber-400/20 bg-amber-400/10 text-amber-300">
                <Zap size={19} />
              </div>
              <div>
                <div className="font-semibold text-heading-lg" style={{ color: "#71717a", fontSize: 12 }}>Why Hemlo moved</div>
                <h2 className="font-semibold text-heading-lg text-text-primary">Key Factors</h2>
              </div>
            </div>
            <div
              className="grid flex-1 gap-2"
              style={{
                gridTemplateRows: visibleFactors.length
                  ? `repeat(${Math.min(visibleFactors.length, 6)}, minmax(0, 1fr))`
                  : undefined,
              }}
            >
              {visibleFactors.length ? visibleFactors.slice(0, 6).map((factor, index) => (
                <div key={`${factor}-${index}`} className="grid h-full grid-cols-[34px_minmax(0,1fr)] items-center gap-4 border border-white/8 bg-[#171d22] p-4">
                  <span className="font-semibold text-heading-lg text-amber-300">{index + 1}.</span>
                  <p className="text-sm leading-6 text-white">{factor}</p>
                </div>
              )) : (
                <div className="border border-white/8 bg-[#171d22] p-5 text-sm font-semibold text-zinc-500">No key factors were generated for this run.</div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex min-h-[390px] flex-col border border-[#25303a] bg-[#13191f] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:p-6"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center border border-sky-400/20 bg-sky-400/10 text-sky-300">
                <Users size={19} />
              </div>
              <div>
                <div className="font-semibold text-heading-lg" style={{ color: "#71717a", fontSize: 12 }}>Agent signal</div>
                <h2 className="font-semibold text-heading-lg text-text-primary">Notable People</h2>
              </div>
            </div>
            <div
              className="grid flex-1 gap-2"
              style={{
                gridTemplateRows: notablePeople.length
                  ? `repeat(${Math.min(notablePeople.length, 5)}, minmax(0, 1fr))`
                  : undefined,
              }}
            >
              {notablePeople.length ? notablePeople.slice(0, 5).map((person: any, index: number) => {
                const stance = String(person.stance || "").toUpperCase();
                const positive = stance === "YES" || stance === topOutcome?.label?.toUpperCase();
                return (
                  <div key={`${person.name}-${index}`} className="grid h-full grid-cols-[44px_minmax(0,1fr)] items-center gap-4 border border-white/8 bg-[#171d22] p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border text-sm font-semibold" style={{
                      borderColor: positive ? "rgba(56,232,141,0.24)" : "rgba(125,183,255,0.22)",
                      background: positive ? "rgba(56,232,141,0.1)" : "rgba(125,183,255,0.1)",
                      color: positive ? "#38e88d" : "#7db7ff",
                    }}>
                      {String(person.name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-heading-lg text-text-primary">{person.name || "Agent"}</span>
                        {person.role && <span className="text-xs font-bold text-zinc-500">{person.role}</span>}
                        {stance && <span className="border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">{stance}</span>}
                      </div>
                      <p className="text-sm leading-6 text-zinc-300">{person.impact || "No specific impact summary was generated."}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="border border-white/8 bg-[#171d22] p-5 text-sm font-semibold text-zinc-500">No notable people were identified for this run.</div>
              )}
            </div>
          </motion.div>
        </section>

        {similarMarkets.length > 0 && (
          <section className="border border-[#25303a] bg-[#13191f] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] sm:p-7">
            <style>{`
              .similar-markets-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 16px;
              }
              @media (max-width: 1200px) { .similar-markets-grid { grid-template-columns: repeat(3, 1fr); } }
              @media (max-width: 900px)  { .similar-markets-grid { grid-template-columns: repeat(2, 1fr); } }
              @media (max-width: 560px)  { .similar-markets-grid { grid-template-columns: 1fr; gap: 12px; } }
            `}</style>
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="font-semibold text-heading-lg" style={{ color: "#71717a", fontSize: 12 }}>More context</div>
                <h2 className="font-semibold text-heading-lg text-text-primary">Similar Markets</h2>
              </div>
              <div className="text-xs font-semibold text-zinc-500">{label}</div>
            </div>

            <div className="similar-markets-grid">
              {similarMarkets.map((market) => {
                const displayOutcomes = (market.outcomes || []).slice(0, 2);
                const colors = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b"];
                const content = (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ borderColor: "#3a4658", backgroundColor: MARKET_CARD_HOVER_BG }}
                    style={{
                      background: MARKET_CARD_BG,
                      border: `1px solid ${MARKET_CARD_BORDER}`,
                      borderRadius: 14,
                      padding: "16px 20px",
                      display: "flex",
                      flexDirection: "column",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      minHeight: 220,
                      boxShadow: "0 14px 34px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      {(market.icon || market.image) ? (
                        <img
                          src={market.icon || market.image || sourceIcon(source)}
                          alt=""
                          style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                          onError={(e) => { e.currentTarget.src = sourceIcon(source); }}
                        />
                      ) : (
                        <img
                          src={sourceIcon(source)}
                          alt=""
                          style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: "#1f2330" }}
                        />
                      )}
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#8a94a6", textTransform: "uppercase", letterSpacing: 1.4 }}>
                        {market.category || market.source || ""}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#ffffff",
                        lineHeight: 1.4,
                        flex: 1,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginBottom: 14,
                      }}
                    >
                      {market.title}
                    </div>

                    {displayOutcomes.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {displayOutcomes.map((outcome, index) => {
                          const color = colors[index % colors.length];
                          const prob = toPct(outcome.prob, 0) ?? 0;
                          const optionImage = outcome.icon || outcome.image;
                          return (
                            <div key={`${market.id}-${outcome.label}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                  <span style={{ color: "#d1d5db", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, display: "flex", alignItems: "center", gap: 7 }}>
                                    {optionImage && (
                                      <img
                                        src={optionImage}
                                        alt=""
                                        style={{ width: 20, height: 20, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "#202a33" }}
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                      />
                                    )}
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{outcome.label}</span>
                                  </span>
                                </div>
                                <div style={{ height: 3, background: "#1f2330", borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${Math.max(prob, 1)}%`, background: color, borderRadius: 3 }} />
                                </div>
                              </div>
                              <div style={{ border: `1px solid ${color}`, borderRadius: 20, padding: "3px 10px", minWidth: 46, textAlign: "center", flexShrink: 0 }}>
                                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{prob}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(market.outcomes || []).length > 2 && (
                      <span style={{ fontSize: 10, color: "#8a94a6", fontStyle: "italic", marginTop: 2, marginBottom: 14 }}>
                        +{(market.outcomes || []).length - 2} more outcomes
                      </span>
                    )}

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      <span style={{ fontSize: 11, color: "#8a94a6" }}>{market.volume || "$0"} vol</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>Open</span>
                    </div>
                  </motion.div>
                );

                return market.link ? (
                  <a key={market.id} href={market.link} target="_blank" rel="noopener noreferrer" className="block no-underline">
                    {content}
                  </a>
                ) : (
                  <div key={market.id}>{content}</div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
