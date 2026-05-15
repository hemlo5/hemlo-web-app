import "server-only";

export type TradeScoutOutcome = {
  label: string;
  prob?: number;
  tokenId?: string;
  clobTokenId?: string;
  image?: string;
  icon?: string;
};

export type TradeScoutCandidate = {
  source: "polymarket";
  marketId: string;
  slug: string;
  title: string;
  category: string;
  endDate: string;
  hoursToClose: number;
  volume: number;
  volume24h: number;
  liquidity: number;
  marketType: "binary" | "categorical";
  outcomes: TradeScoutOutcome[];
  icon?: string;
  image?: string;
  score: number;
  reasons: string[];
  simulationQuestion: string;
};

export type TradeScoutFilters = {
  minHoursToClose: number;
  maxHoursToClose: number;
  minVolume: number;
  minLiquidity: number;
  maxMarkets: number;
  excludedTerms: string[];
};

export type FundSnapshot = {
  accountId: string;
  availableUsdc: number;
  minRequiredUsdc: number;
  perTradeStakeUsdc: number;
  canScout: boolean;
  mode: "paper" | "manual" | "live-unavailable";
  reason?: string;
};

const POLY_HEADERS = {
  "User-Agent": "hemlo-trade-scout/1.0",
};

const DEFAULT_EXCLUDED_TERMS = [
  "sports",
  "sport",
  "nba",
  "nfl",
  "mlb",
  "nhl",
  "ufc",
  "mma",
  "soccer",
  "football",
  "tennis",
  "golf",
  "cricket",
  "f1",
  "formula",
  "esports",
  "gaming",
  "counter-strike",
  "cs2",
  "league of legends",
  "lol",
];

export function getTradeScoutFilters(): TradeScoutFilters {
  return {
    minHoursToClose: Number(process.env.TRADE_SCOUT_MIN_HOURS ?? 24),
    maxHoursToClose: Number(process.env.TRADE_SCOUT_MAX_HOURS ?? 72),
    minVolume: Number(process.env.TRADE_SCOUT_MIN_VOLUME_USD ?? 100_000),
    minLiquidity: Number(process.env.TRADE_SCOUT_MIN_LIQUIDITY_USD ?? 10_000),
    maxMarkets: Number(process.env.TRADE_SCOUT_MAX_MARKETS ?? 8),
    excludedTerms: (process.env.TRADE_SCOUT_EXCLUDED_TERMS || DEFAULT_EXCLUDED_TERMS.join(","))
      .split(",")
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function getFundSnapshot(): FundSnapshot {
  const accountId = process.env.POLYMARKET_ACCOUNT_ID || process.env.POLYMARKET_WALLET_ADDRESS || "paper-account";
  const availableUsdc = Number(
    process.env.TRADE_SCOUT_PAPER_BALANCE_USDC ??
      process.env.POLYMARKET_MANUAL_AVAILABLE_USDC ??
      0,
  );
  const minRequiredUsdc = Number(process.env.TRADE_SCOUT_MIN_AVAILABLE_USDC ?? 5);
  const maxStake = Number(process.env.TRADE_SCOUT_MAX_STAKE_USDC ?? 10);
  const bankrollFraction = Number(process.env.TRADE_SCOUT_BANKROLL_FRACTION ?? 0.05);
  const perTradeStakeUsdc = Math.max(0, Math.min(maxStake, availableUsdc * bankrollFraction));
  const hasManualBalance =
    process.env.TRADE_SCOUT_PAPER_BALANCE_USDC !== undefined ||
    process.env.POLYMARKET_MANUAL_AVAILABLE_USDC !== undefined;

  return {
    accountId,
    availableUsdc,
    minRequiredUsdc,
    perTradeStakeUsdc: Number(perTradeStakeUsdc.toFixed(2)),
    canScout: availableUsdc >= minRequiredUsdc,
    mode: hasManualBalance ? "paper" : "live-unavailable",
    reason: hasManualBalance
      ? undefined
      : "Set TRADE_SCOUT_PAPER_BALANCE_USDC or wire authenticated Polymarket CLOB balance before scouting.",
  };
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseClobTokenIds(market: Record<string, unknown>): string[] {
  try {
    const raw = market.clobTokenIds || "[]";
    const ids = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(ids) ? ids.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function firstOutcomeProb(market: Record<string, unknown>, fallback = 50) {
  const lastTrade = toNumber(market.lastTradePrice, 0);
  if (lastTrade > 0 && lastTrade < 1) return Math.round(lastTrade * 100);

  try {
    const raw = market.outcomePrices || "[0.5,0.5]";
    const prices = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Math.round(toNumber(prices?.[0], 0.5) * 100);
  } catch {
    return fallback;
  }
}

export function hasTradeScoutExcludedTerm(candidate: {
  title?: string;
  category?: string;
  tags?: unknown[];
  outcomes?: Array<{ label?: string }>;
}, excludedTerms: string[]) {
  const tagText = Array.isArray(candidate.tags)
    ? candidate.tags.map((tag) => {
        const item = tag && typeof tag === "object" ? tag as Record<string, unknown> : {};
        return `${item.label || ""} ${item.slug || ""}`;
      }).join(" ")
    : "";
  const outcomeText = Array.isArray(candidate.outcomes)
    ? candidate.outcomes.map((outcome) => outcome.label || "").join(" ")
    : "";
  const text = `${candidate.title || ""} ${candidate.category || ""} ${tagText} ${outcomeText}`.toLowerCase();
  return excludedTerms.some((term) => text.includes(term));
}

export function validateTradeScoutMarket(candidate: {
  title?: string;
  category?: string;
  tags?: unknown[];
  outcomes?: Array<{ label?: string }>;
  endDate?: string | null;
  volume?: number | null;
  liquidity?: number | null;
}, filters = getTradeScoutFilters(), now = Date.now()) {
  const endTs = Date.parse(String(candidate.endDate || ""));
  if (!Number.isFinite(endTs)) {
    return { ok: false, reason: "missing or invalid market end date" };
  }

  const minClose = now + filters.minHoursToClose * 60 * 60 * 1000;
  const maxClose = now + filters.maxHoursToClose * 60 * 60 * 1000;
  const hoursToClose = Number(((endTs - now) / (60 * 60 * 1000)).toFixed(1));

  if (endTs < minClose) {
    return { ok: false, reason: `ends too soon (${hoursToClose}h)`, hoursToClose };
  }
  if (endTs > maxClose) {
    return { ok: false, reason: `ends too late (${hoursToClose}h)`, hoursToClose };
  }
  if (hasTradeScoutExcludedTerm(candidate, filters.excludedTerms)) {
    return { ok: false, reason: "excluded sports/esports/volatile category", hoursToClose };
  }
  if (Number(candidate.volume || 0) < filters.minVolume) {
    return { ok: false, reason: `volume below $${filters.minVolume}`, hoursToClose };
  }
  if (Number(candidate.liquidity || 0) < filters.minLiquidity) {
    return { ok: false, reason: `liquidity below $${filters.minLiquidity}`, hoursToClose };
  }

  return { ok: true, reason: "eligible", hoursToClose };
}

function parseEventOutcomes(event: Record<string, unknown>) {
  const markets = Array.isArray(event.markets) ? event.markets as Record<string, unknown>[] : [];
  const activeMarkets = markets.filter((market) => !market.closed);
  const grouped = activeMarkets.filter((market) => String(market.groupItemTitle || "").trim());

  if (grouped.length >= 2) {
    const outcomes = grouped
      .map((market) => {
        const tokenIds = parseClobTokenIds(market);
        const prob = Math.max(1, Math.min(99, firstOutcomeProb(market)));
        return {
          label: String(market.groupItemTitle || market.question || "Option").trim(),
          prob,
          tokenId: tokenIds[0],
          clobTokenId: tokenIds[0],
          image: String(market.image || market.icon || event.image || event.icon || ""),
          icon: String(market.icon || market.image || event.icon || event.image || ""),
        };
      })
      .filter((outcome) => outcome.label)
      .sort((a, b) => (b.prob || 0) - (a.prob || 0))
      .slice(0, 10);

    if (outcomes.length >= 2) {
      return { marketType: "categorical" as const, outcomes };
    }
  }

  const market = activeMarkets[0] || markets[0] || {};
  const tokenIds = parseClobTokenIds(market);
  const yesProb = Math.max(0, Math.min(100, firstOutcomeProb(market)));
  return {
    marketType: "binary" as const,
    outcomes: [
      { label: "Yes", prob: yesProb, tokenId: tokenIds[0], clobTokenId: tokenIds[0] },
      { label: "No", prob: 100 - yesProb, tokenId: tokenIds[1], clobTokenId: tokenIds[1] },
    ],
  };
}

function scoreCandidate(candidate: Omit<TradeScoutCandidate, "score" | "reasons" | "simulationQuestion">) {
  const reasons: string[] = [];
  const volumeScore = Math.log10(Math.max(candidate.volume, 1)) * 12;
  const liquidityScore = Math.log10(Math.max(candidate.liquidity, 1)) * 8;
  const urgencyScore = Math.max(0, 72 - candidate.hoursToClose) / 72 * 18;
  const activityScore = Math.log10(Math.max(candidate.volume24h, 1)) * 8;
  const structureScore = candidate.marketType === "binary" ? 8 : 4;
  const score = volumeScore + liquidityScore + urgencyScore + activityScore + structureScore;

  if (candidate.volume >= 1_000_000) reasons.push("high total volume");
  if (candidate.volume24h >= 100_000) reasons.push("active in last 24h");
  if (candidate.liquidity >= 50_000) reasons.push("enough visible liquidity");
  if (candidate.hoursToClose <= 48) reasons.push("resolves soon enough for content");
  if (candidate.marketType === "binary") reasons.push("clean binary resolution");

  return { score: Number(score.toFixed(2)), reasons };
}

export async function fetchTradeScoutCandidates(filters = getTradeScoutFilters()) {
  const now = Date.now();
  const minClose = new Date(now + filters.minHoursToClose * 60 * 60 * 1000).toISOString();
  const maxClose = new Date(now + filters.maxHoursToClose * 60 * 60 * 1000).toISOString();
  const url = new URL("https://gamma-api.polymarket.com/events");
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("end_date_min", minClose);
  url.searchParams.set("end_date_max", maxClose);
  url.searchParams.set("volume_min", String(filters.minVolume));
  url.searchParams.set("liquidity_min", String(filters.minLiquidity));
  url.searchParams.set("limit", String(Math.min(100, Math.max(40, filters.maxMarkets * 6))));
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");

  const res = await fetch(url, { headers: POLY_HEADERS, next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Polymarket fetch failed: ${res.status}`);
  const events = await res.json();
  const rows = Array.isArray(events) ? events as Record<string, unknown>[] : [];

  const candidates: TradeScoutCandidate[] = [];
  for (const event of rows) {
    const markets = Array.isArray(event.markets) ? event.markets as Record<string, unknown>[] : [];
    const firstMarket = markets[0] || {};
    const endRaw = String(event.endDate || firstMarket.endDate || "");
    const endTs = Date.parse(endRaw);
    if (!Number.isFinite(endTs)) continue;

    const tags = Array.isArray(event.tags) ? event.tags : [];
    const category = String((tags[0] as Record<string, unknown> | undefined)?.label || event.category || "");
    const title = String(event.title || event.description || "").trim();
    if (!title) continue;

    const volume = toNumber(event.volume, 0);
    const volume24h = toNumber(event.volume24hr, 0);
    const liquidity = toNumber(event.liquidity, 0);

    const parsed = parseEventOutcomes(event);
    const validation = validateTradeScoutMarket({
      title,
      category,
      tags,
      outcomes: parsed.outcomes,
      endDate: new Date(endTs).toISOString(),
      volume,
      liquidity,
    }, filters, now);
    if (!validation.ok) continue;

    const base = {
      source: "polymarket" as const,
      marketId: String(event.id || event.slug || ""),
      slug: String(event.slug || event.id || ""),
      title,
      category,
      endDate: new Date(endTs).toISOString(),
      hoursToClose: validation.hoursToClose || Number(((endTs - now) / (60 * 60 * 1000)).toFixed(1)),
      volume,
      volume24h,
      liquidity,
      marketType: parsed.marketType,
      outcomes: parsed.outcomes,
      icon: String(event.icon || event.image || firstMarket.icon || firstMarket.image || ""),
      image: String(event.image || event.icon || firstMarket.image || firstMarket.icon || ""),
    };
    const scoring = scoreCandidate(base);
    candidates.push({
      ...base,
      ...scoring,
      simulationQuestion: title,
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.volume - a.volume)
    .slice(0, filters.maxMarkets);
}

export function buildTradeProposal(candidate: TradeScoutCandidate, fund: FundSnapshot) {
  const topOutcome = candidate.outcomes[0];
  return {
    source: candidate.source,
    market_id: candidate.marketId,
    market_slug: candidate.slug,
    title: candidate.title,
    category: candidate.category,
    end_date: candidate.endDate,
    volume: candidate.volume,
    volume_24h: candidate.volume24h,
    liquidity: candidate.liquidity,
    market_type: candidate.marketType,
    outcomes: candidate.outcomes,
    filter_snapshot: getTradeScoutFilters(),
    fund_snapshot: fund,
    scout_score: candidate.score,
    scout_reasons: candidate.reasons,
    simulation_question: candidate.simulationQuestion,
    proposed_outcome: topOutcome?.label || null,
    proposed_price: topOutcome?.prob ?? null,
    proposed_stake: fund.perTradeStakeUsdc,
    status: "needs_simulation",
    approval_step: 0,
    execution_status: "disabled_until_double_approval",
  };
}
