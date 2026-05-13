import "server-only";

import { serverJson } from "@/lib/server-prefetch";

export type SimulateHomeOutcome = {
  label: string;
  prob?: number;
  hemloProb?: number;
  tokenId?: string;
  clobTokenId?: string;
  image?: string;
  icon?: string;
};

export type SimulateHomeMarket = {
  id?: string;
  marketId?: string;
  source?: string;
  topic: string;
  category?: string;
  marketType?: "binary" | "categorical";
  outcomes?: SimulateHomeOutcome[];
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

export type SimulateHomeData = {
  carouselMarkets: SimulateHomeMarket[];
  tickerItems: SimulateHomeMarket[];
  questions: string[];
  generatedAt: string;
};

const FALLBACK_QUESTIONS = [
  "When will Bitcoin hit $150k?",
  "Democratic Presidential Nominee 2028",
  "Who will win the 2026 NBA Championship?",
  "Will there be a US x Iran peace deal in 2026?",
];

type RawObject = Record<string, unknown>;

function asObject(value: unknown): RawObject {
  return value && typeof value === "object" ? value as RawObject : {};
}

function asText(value: unknown) {
  return String(value || "").trim();
}

function asNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asMarketType(value: unknown, outcomeCount: number): "binary" | "categorical" {
  return value === "categorical" || outcomeCount > 2 ? "categorical" : "binary";
}

function asMarket(inputValue: unknown, fallbackSource?: string): SimulateHomeMarket | null {
  const input = asObject(inputValue);
  const topic = asText(input.topic || input.question || input.title);
  if (!topic) return null;

  const outcomes = Array.isArray(input.outcomes)
    ? input.outcomes
        .map((outcomeValue) => {
          const outcome = asObject(outcomeValue);
          return {
            label: asText(outcome.label || outcome.name),
            prob: asNumber(outcome.prob) !== undefined ? Math.round(asNumber(outcome.prob) as number) : undefined,
            hemloProb: asNumber(outcome.hemloProb) !== undefined ? Math.round(asNumber(outcome.hemloProb) as number) : undefined,
            tokenId: asText(outcome.tokenId || outcome.clobTokenId) || undefined,
            clobTokenId: asText(outcome.clobTokenId || outcome.tokenId) || undefined,
            image: asText(outcome.image || outcome.icon) || undefined,
            icon: asText(outcome.icon || outcome.image) || undefined,
          };
        })
        .filter((outcome: SimulateHomeOutcome) => outcome.label)
    : undefined;

  const id = asText(input.id || input.conditionId || input.slug) || undefined;
  const marketId = asText(input.marketId || input.conditionId) || undefined;
  const source = asText(input.source) || fallbackSource;
  const fallbackIcon = fallbackSource === "kalshi" ? "/kalshi.webp" : fallbackSource === "polymarket" ? "/polymarket.webp" : "/logo.svg";
  const icon = asText(input.icon || input.image) || fallbackIcon;
  const image = asText(input.image || input.icon) || fallbackIcon;
  const hemloOdds = asNumber(input.hemloOdds);
  const divergence = asNumber(input.divergence);
  const confidence = asNumber(input.confidence);

  return {
    id,
    marketId,
    source,
    topic,
    category: asText(input.category) || fallbackSource,
    marketType: asMarketType(input.marketType, outcomes?.length || 0),
    outcomes,
    polymarketOdds: input.polymarketOdds !== undefined
      ? String(input.polymarketOdds)
      : outcomes?.[0]?.prob !== undefined
        ? String(outcomes[0].prob)
        : undefined,
    hemloOdds,
    divergence,
    confidence,
    icon,
    image,
    moneyAtStake: asText(input.moneyAtStake || input.volume),
    volume: asText(input.volume || input.moneyAtStake),
    endDate: asText(input.endDate || input.marketEndDate),
    clobTokenIds: Array.isArray(input.clobTokenIds) ? input.clobTokenIds.map(String) : undefined,
    resultHref: asText(input.resultHref) || (id ? `/simulate/mirofish/${id}` : undefined),
  };
}

function uniqueQuestions(markets: SimulateHomeMarket[]) {
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const market of markets) {
    const key = market.topic.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    questions.push(market.topic);
  }

  return (questions.length ? questions : FALLBACK_QUESTIONS).slice(0, 24);
}

export async function getSimulateHomeData(): Promise<SimulateHomeData> {
  const completedData = await serverJson<{ data?: unknown[] }>("/api/simulations-completed?scope=top&limit=12", 60);
  let carouselMarkets = (completedData?.data || [])
    .map((item) => asMarket(item))
    .filter(Boolean) as SimulateHomeMarket[];

  if (carouselMarkets.length === 0) {
    const polyData = await serverJson<{ markets?: unknown[] }>("/api/polymarket-browse?category=trending&limit=12", 120);
    carouselMarkets = (polyData?.markets || [])
      .map((item) => asMarket(item, "polymarket"))
      .filter(Boolean) as SimulateHomeMarket[];
  }

  return {
    carouselMarkets,
    tickerItems: carouselMarkets.slice(0, 20),
    questions: uniqueQuestions(carouselMarkets),
    generatedAt: new Date().toISOString(),
  };
}
