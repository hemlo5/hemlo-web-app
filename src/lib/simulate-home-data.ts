import "server-only";

import { createClient } from "@supabase/supabase-js";
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

function asNumberWithFallback(value: unknown, fallback = 0) {
  return asNumber(value) ?? fallback;
}

function confidenceScore(value: unknown) {
  const numeric = asNumber(value);
  if (numeric !== undefined) return numeric;
  const text = String(value || "").toUpperCase();
  if (text === "HIGH") return 90;
  if (text === "MEDIUM") return 65;
  if (text === "LOW") return 40;
  return 0;
}

function parseDomainMeta(domain: unknown) {
  const parts = String(domain || "").split("|");
  const [source = "", marketId = "", volume = "", , , ...imageParts] = parts;
  return {
    source,
    marketId,
    volume,
    image: imageParts.join("|") || "",
  };
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

function normalizeKey(label: string) {
  return label.trim().toLowerCase();
}

function resultTotalActions(result: RawObject) {
  const explicit = asNumberWithFallback(result.total_actions, 0);
  const rounds = Array.isArray(result.round_logs) ? result.round_logs : [];
  const fromRounds = rounds.reduce((sum, row) => sum + asNumberWithFallback(asObject(row).total_actions, 0), 0);
  return Math.max(explicit, fromRounds);
}

function isUsableCustomResult(row: RawObject) {
  const result = asObject(row.result);
  const verdict = asText(result.verdict);
  const agents = Array.isArray(result.agents) ? result.agents.map(asObject) : [];
  const genericAgents = agents.filter((agent) => {
    const name = asText(agent.name).toLowerCase();
    const bio = asText(agent.bio).toLowerCase();
    return (
      name.startsWith("participant ") ||
      name.startsWith("agent ") ||
      bio.includes("interested observer") ||
      bio.includes("social media user following and discussing")
    );
  }).length;

  if (resultTotalActions(result) <= 0) return false;
  if (!Array.isArray(result.round_logs) || result.round_logs.length === 0) return false;
  if (!verdict || verdict.startsWith("Simulation complete. Top outcome:")) return false;
  if (agents.length >= 5 && genericAgents / agents.length >= 0.8) return false;
  return true;
}

function normalizeHomeOutcomes(result: RawObject, marketInfo: RawObject): SimulateHomeOutcome[] {
  const marketOutcomes = Array.isArray(result.market_outcomes) ? result.market_outcomes : [];
  const infoOutcomes = Array.isArray(marketInfo.outcomes) ? marketInfo.outcomes : [];
  const options = Array.isArray(result.options) ? result.options : [];
  const probabilityModel = asObject(result.probabilityModel);
  const predictionMarket = asObject(probabilityModel.predictionMarket);
  const hemloModel =
    asObject(probabilityModel.hemloModel || result.outcome_probabilities || result.outcomeProbabilities);

  const raw = marketOutcomes.length
    ? marketOutcomes
    : infoOutcomes.length
      ? infoOutcomes
      : options.map((label) => ({ label, prob: predictionMarket[String(label)] }));

  const infoByLabel = new Map<string, RawObject>();
  infoOutcomes.forEach((item) => {
    const outcome = asObject(item);
    const key = normalizeKey(asText(outcome.label || outcome.name || item));
    if (key) infoByLabel.set(key, outcome);
  });

  return raw
    .map((item, index) => {
      const outcome = asObject(item);
      const label = asText(outcome.label || outcome.name || item);
      const info = infoByLabel.get(normalizeKey(label)) || asObject(infoOutcomes[index]);
      const marketProb = asNumber(outcome.prob) ?? asNumber(info.prob);
      const hemloProb = asNumber(outcome.hemloProb) ?? asNumber(hemloModel[label]);
      return {
        label,
        prob: marketProb !== undefined ? Math.round(marketProb) : undefined,
        hemloProb: hemloProb !== undefined ? Math.round(hemloProb) : undefined,
        tokenId: asText(outcome.tokenId || outcome.clobTokenId || info.tokenId || info.clobTokenId) || undefined,
        clobTokenId: asText(outcome.clobTokenId || outcome.tokenId || info.clobTokenId || info.tokenId) || undefined,
        image: asText(outcome.image || outcome.icon || info.image || info.icon) || undefined,
        icon: asText(outcome.icon || outcome.image || info.icon || info.image) || undefined,
      };
    })
    .filter((outcome) => outcome.label)
    .slice(0, 8);
}

function mapCompletedRow(rowValue: unknown): SimulateHomeMarket | null {
  const row = asObject(rowValue);
  const result = asObject(row.result);
  const marketInfo = asObject(result.marketInfo || result.market_info);
  const domainMeta = parseDomainMeta(row.domain);
  const outcomes = normalizeHomeOutcomes(result, marketInfo);
  const probabilityModel = asObject(result.probabilityModel);
  const predictionMarket = asObject(probabilityModel.predictionMarket);
  const hemloModel = asObject(probabilityModel.hemloModel || result.outcome_probabilities || result.outcomeProbabilities);
  const firstLabel = outcomes[0]?.label;
  const source = asText(marketInfo.source) || domainMeta.source || "simulation";
  const crowdOdds = asNumberWithFallback(
    marketInfo.crowdOdds ??
      (firstLabel ? predictionMarket[firstLabel] : undefined) ??
      outcomes[0]?.prob,
    50,
  );
  const hemloOdds = asNumberWithFallback(
    row.primary_probability ??
      result.primary_probability ??
      result.top_probability ??
      (firstLabel ? hemloModel[firstLabel] : undefined),
    50,
  );
  const id = asText(row.id);
  const topic = asText(row.scenario);
  if (!id || !topic) return null;

  const icon = asText(marketInfo.icon || marketInfo.image || domainMeta.image) || undefined;

  return {
    id,
    topic,
    source,
    category: asText(marketInfo.category) || source || "Simulation",
    marketId: asText(marketInfo.id) || domainMeta.marketId,
    confidence: confidenceScore(result.confidence),
    hemloOdds,
    polymarketOdds: String(Math.round(crowdOdds)),
    divergence: Math.round(hemloOdds - crowdOdds),
    marketType: asMarketType(result.market_type || marketInfo.marketType, outcomes.length),
    outcomes,
    icon: icon || (source === "kalshi" ? "/kalshi.webp" : source === "polymarket" ? "/polymarket.webp" : "/logo.svg"),
    image: asText(marketInfo.image || marketInfo.icon || domainMeta.image) || icon,
    moneyAtStake: asText(marketInfo.volume) || domainMeta.volume,
    endDate: asText(marketInfo.endDate),
    resultHref: `/simulate/mirofish/${id}`,
  };
}

function dedupeMarkets(markets: SimulateHomeMarket[]) {
  const bestByMarket = new Map<string, SimulateHomeMarket>();
  for (const market of markets) {
    const key = `${normalizeKey(market.source || "simulation")}:${normalizeKey(market.topic).replace(/[^a-z0-9]+/g, "-")}`;
    const existing = bestByMarket.get(key);
    if (!existing || Math.abs(market.divergence || 0) > Math.abs(existing.divergence || 0)) {
      bestByMarket.set(key, market);
    }
  }
  return Array.from(bestByMarket.values());
}

async function getCompletedHomeMarkets() {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) return [];

  const supa = createClient(supaUrl, supaKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supa
    .from("custom_simulations")
    .select("id, scenario, domain, status, created_at, completed_at, result, primary_probability, agent_count, rounds")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(80);

  if (error) return [];

  return dedupeMarkets(
    (data || [])
      .filter((row) => isUsableCustomResult(asObject(row)))
      .map(mapCompletedRow)
      .filter(Boolean) as SimulateHomeMarket[],
  )
    .sort((a, b) => Math.abs(b.divergence || 0) - Math.abs(a.divergence || 0))
    .slice(0, 12);
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
  let carouselMarkets = await getCompletedHomeMarkets();

  if (carouselMarkets.length === 0) {
    const completedData = await serverJson<{ data?: unknown[] }>("/api/simulations-completed?scope=top&limit=12&lite=1", 60, 6000);
    carouselMarkets = (completedData?.data || [])
      .map((item) => asMarket(item))
      .filter(Boolean) as SimulateHomeMarket[];
  }

  if (carouselMarkets.length === 0) {
    const polyData = await serverJson<{ markets?: unknown[] }>("/api/polymarket-browse?category=trending&limit=12", 120, 5000);
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
