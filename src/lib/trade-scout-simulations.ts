import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getFundSnapshot, getTradeScoutFilters, validateTradeScoutMarket, type TradeScoutFilters } from "@/lib/trade-scout";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? value as JsonObject : {};
}

function asText(value: unknown) {
  return String(value || "").trim();
}

function asNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toMoneyNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value || "").replace("$", "").replace(",", "").trim().toUpperCase();
  if (!text) return 0;
  const multiplier = text.endsWith("M") ? 1_000_000 : text.endsWith("K") ? 1_000 : 1;
  const numeric = Number(text.replace(/[MK]$/, ""));
  return Number.isFinite(numeric) ? numeric * multiplier : 0;
}

function normalizeKey(label: string) {
  return label.trim().toLowerCase();
}

function parseDomainMeta(domain: unknown) {
  const parts = String(domain || "").split("|");
  const [source = "", marketId = "", volume = "", liquidity = "", last = "", ...imageParts] = parts;
  return {
    source,
    marketId,
    volume,
    liquidity,
    last,
    image: imageParts.join("|") || "",
  };
}

function outcomeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeOutcomes(result: JsonObject, marketInfo: JsonObject) {
  const probabilityModel = asObject(result.probabilityModel);
  const hemloModel = asObject(probabilityModel.hemloModel || result.outcome_probabilities || result.outcomeProbabilities);
  const predictionMarket = asObject(probabilityModel.predictionMarket);
  const marketOutcomes = outcomeArray(result.market_outcomes);
  const infoOutcomes = outcomeArray(marketInfo.outcomes);
  const options = outcomeArray(result.options);
  const raw = marketOutcomes.length
    ? marketOutcomes
    : infoOutcomes.length
      ? infoOutcomes
      : options.map((label) => ({ label, prob: predictionMarket[String(label)] }));

  const infoByLabel = new Map<string, JsonObject>();
  infoOutcomes.forEach((item) => {
    const info = asObject(item);
    const key = normalizeKey(asText(info.label || info.name || item));
    if (key) infoByLabel.set(key, info);
  });

  return raw
    .map((item, index) => {
      const row = asObject(item);
      const label = asText(row.label || row.name || item);
      const info = infoByLabel.get(normalizeKey(label)) || asObject(infoOutcomes[index]);
      const marketProb = asNumber(row.prob) ?? asNumber(info.prob) ?? asNumber(predictionMarket[label]);
      const hemloProb = asNumber(row.hemloProb) ?? asNumber(hemloModel[label]);
      return {
        label,
        prob: marketProb !== undefined ? Math.round(marketProb) : undefined,
        hemloProb: hemloProb !== undefined ? Math.round(hemloProb) : undefined,
        tokenId: asText(row.tokenId || row.clobTokenId || info.tokenId || info.clobTokenId) || undefined,
        clobTokenId: asText(row.clobTokenId || row.tokenId || info.clobTokenId || info.tokenId) || undefined,
        image: asText(row.image || row.icon || info.image || info.icon) || undefined,
        icon: asText(row.icon || row.image || info.icon || info.image) || undefined,
      };
    })
    .filter((outcome) => outcome.label)
    .slice(0, 12);
}

function pickProposedOutcome(
  outcomes: ReturnType<typeof normalizeOutcomes>,
  result: JsonObject,
) {
  const topOutcome = asText(result.top_outcome || result.topOutcome);
  const matched = topOutcome
    ? outcomes.find((outcome) => normalizeKey(outcome.label) === normalizeKey(topOutcome))
    : undefined;
  if (matched) return matched;

  return [...outcomes].sort((a, b) => (b.hemloProb ?? -1) - (a.hemloProb ?? -1))[0] || outcomes[0];
}

function mapSimulationToProposal(rowValue: unknown, filters: TradeScoutFilters) {
  const row = asObject(rowValue);
  const result = asObject(row.result);
  const marketInfo = asObject(result.marketInfo || result.market_info);
  const domainMeta = parseDomainMeta(row.domain);
  const source = asText(marketInfo.source) || domainMeta.source;
  const simulatedBy = asText(marketInfo.simulatedBy);

  if (source !== "polymarket") return null;
  if (simulatedBy && simulatedBy !== "modal_trending_cron") return null;
  if (!simulatedBy && asText(row.user_id) !== "modal_trending_cron") return null;

  const outcomes = normalizeOutcomes(result, marketInfo);
  if (!outcomes.length) return null;

  const proposed = pickProposedOutcome(outcomes, result);
  const topHemlo = proposed?.hemloProb ?? asNumber(result.top_probability) ?? asNumber(result.primary_probability) ?? 50;
  const marketPrice = proposed?.prob;
  const divergence = marketPrice !== undefined ? Math.round(topHemlo - marketPrice) : undefined;
  const marketId = asText(marketInfo.id || domainMeta.marketId || row.domain || row.id);
  const title = asText(row.scenario || marketInfo.title || marketInfo.question);
  if (!marketId || !title || !proposed) return null;

  const category = asText(marketInfo.category) || source;
  const endDate = asText(marketInfo.endDate || marketInfo.marketEndDate || marketInfo.end_date) || null;
  const volume = toMoneyNumber(marketInfo.volume || domainMeta.volume);
  const volume24h = toMoneyNumber(marketInfo.volume24h || marketInfo.volume_24h);
  const liquidity = toMoneyNumber(marketInfo.liquidity || domainMeta.liquidity);
  const validation = validateTradeScoutMarket({
    title,
    category,
    endDate,
    volume,
    liquidity,
    outcomes,
  }, filters);
  if (!validation.ok) return null;

  const fund = getFundSnapshot();
  const reasons = [
    "completed Hemlo cron simulation",
    divergence !== undefined ? `${Math.abs(divergence)}% Hemlo-market divergence` : "Hemlo verdict available",
    `${asNumber(row.agent_count) || result.agent_count || 15} agents, ${asNumber(row.rounds) || result.rounds_completed || 5} rounds`,
  ];

  return {
    source,
    market_id: marketId,
    market_slug: asText(marketInfo.slug || marketInfo.marketSlug || marketInfo.id || domainMeta.marketId) || null,
    title,
    category,
    end_date: endDate,
    volume,
    volume_24h: volume24h,
    liquidity,
    market_type: asText(result.market_type || marketInfo.marketType) || (outcomes.length > 2 ? "categorical" : "binary"),
    outcomes,
    filter_snapshot: {
      ...filters,
      source: "recent_cron_simulations",
      simulatedBy: "modal_trending_cron",
    },
    fund_snapshot: fund,
    scout_score: Math.abs(divergence ?? 0) + Math.min(40, Math.log10(Math.max(toMoneyNumber(marketInfo.volume || domainMeta.volume), 1)) * 5),
    scout_reasons: reasons,
    simulation_question: title,
    hemlo_simulation_id: asText(row.id),
    hemlo_verdict: {
      simulationId: asText(row.id),
      resultHref: `/simulate/mirofish/${asText(row.id)}`,
      topOutcome: proposed.label,
      topProbability: Math.round(topHemlo),
      marketProbability: marketPrice,
      divergence,
      confidence: result.confidence,
      verdict: result.verdict,
      completedAt: asText(row.completed_at || row.created_at),
    },
    proposed_outcome: proposed.label,
    proposed_price: marketPrice ?? null,
    proposed_stake: fund.perTradeStakeUsdc,
    updated_at: new Date().toISOString(),
  };
}

export async function syncRecentSimulationProposals(
  supa: SupabaseClient,
  options: { hours?: number; limit?: number } = {},
) {
  const hours = options.hours ?? Number(process.env.TRADE_SCOUT_SYNC_HOURS ?? 72);
  const limit = options.limit ?? Number(process.env.TRADE_SCOUT_SYNC_LIMIT ?? 40);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const filters = getTradeScoutFilters();

  const { data: rows, error: rowsError } = await supa
    .from("custom_simulations")
    .select("id,user_id,scenario,domain,status,created_at,completed_at,result,primary_probability,agent_count,rounds")
    .eq("status", "completed")
    .gte("completed_at", since)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (rowsError) throw rowsError;

  const proposals = (rows || [])
    .map((row) => mapSimulationToProposal(row, filters))
    .filter(Boolean) as Array<ReturnType<typeof mapSimulationToProposal> & JsonObject>;

  if (!proposals.length) {
    return { scanned: rows?.length || 0, upserted: 0 };
  }

  const marketIds = Array.from(new Set(proposals.map((proposal) => String(proposal.market_id)).filter(Boolean)));
  const { data: existingRows, error: existingError } = await supa
    .from("trade_proposals")
    .select("source,market_id,status,approval_step,approval_1_at,approval_2_at,execution_status,execution_result")
    .in("market_id", marketIds);

  if (existingError) throw existingError;

  const existingByKey = new Map<string, JsonObject>();
  (existingRows || []).forEach((row) => {
    const item = asObject(row);
    existingByKey.set(`${item.source}|${item.market_id}`, item);
  });

  const payload = proposals.map((proposal) => {
    const existing = existingByKey.get(`${proposal.source}|${proposal.market_id}`);
    const approvalStep = asNumber(existing?.approval_step) ?? 0;
    return {
      ...proposal,
      status: approvalStep > 0 ? existing?.status || "approval_1_complete" : "simulation_complete",
      approval_step: approvalStep,
      approval_1_at: existing?.approval_1_at ?? null,
      approval_2_at: existing?.approval_2_at ?? null,
      execution_status: existing?.execution_status || "disabled_until_double_approval",
      execution_result: existing?.execution_result ?? null,
    };
  });

  const { data, error } = await supa
    .from("trade_proposals")
    .upsert(payload, { onConflict: "source,market_id" })
    .select("id");

  if (error) throw error;

  return {
    scanned: rows?.length || 0,
    upserted: data?.length || 0,
  };
}
