import "server-only";

import { getTradeScoutFilters, validateTradeScoutMarket } from "@/lib/trade-scout";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? value as JsonObject : {};
}

function asText(value: unknown) {
  return String(value || "").trim();
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizePrivateKey(value: string) {
  const key = value.trim();
  return key.startsWith("0x") ? key : `0x${key}`;
}

function parseOutcomeRows(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((row) => {
    const item = asObject(row);
    return {
      label: asText(item.label || item.name),
      prob: asNumber(item.prob, NaN),
      tokenId: asText(item.tokenId || item.clobTokenId),
      clobTokenId: asText(item.clobTokenId || item.tokenId),
    };
  }).filter((outcome) => outcome.label);
}

export function validateProposalTradeWindow(proposal: JsonObject) {
  return validateTradeScoutMarket({
    title: asText(proposal.title),
    category: asText(proposal.category),
    endDate: asText(proposal.end_date),
    volume: asNumber(proposal.volume),
    liquidity: asNumber(proposal.liquidity),
    outcomes: parseOutcomeRows(proposal.outcomes),
  }, getTradeScoutFilters());
}

export function getTradeExecutionReadiness() {
  const enabled = process.env.TRADE_EXECUTION_ENABLED === "true";
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY || process.env.POLYMARKET_SIGNER_PRIVATE_KEY || "";
  const missing: string[] = [];

  if (enabled && !privateKey) {
    missing.push("POLYMARKET_PRIVATE_KEY");
  }

  return {
    enabled,
    missing,
    host: process.env.POLYMARKET_CLOB_HOST || "https://clob.polymarket.com",
    chainId: Number(process.env.POLYMARKET_CHAIN_ID || 137),
    hasPrivateKey: Boolean(privateKey),
    canDeriveApiCredentials: Boolean(privateKey),
    hasStaticApiCredentials: Boolean(
      process.env.POLYMARKET_CLOB_API_KEY &&
      process.env.POLYMARKET_CLOB_SECRET &&
      (process.env.POLYMARKET_CLOB_PASSPHRASE || process.env.POLYMARKET_CLOB_PASS_PHRASE),
    ),
  };
}

function pickOutcome(proposal: JsonObject) {
  const outcomes = parseOutcomeRows(proposal.outcomes);
  const proposed = normalizeKey(asText(proposal.proposed_outcome));
  return outcomes.find((outcome) => normalizeKey(outcome.label) === proposed) || outcomes[0];
}

function resolveSignatureType(SignatureTypeV2: any, funderAddress: string) {
  const raw = asText(process.env.POLYMARKET_SIGNATURE_TYPE).toUpperCase();
  if (!raw) return funderAddress ? SignatureTypeV2.POLY_PROXY : SignatureTypeV2.EOA;
  if (/^\d+$/.test(raw)) return Number(raw);
  return SignatureTypeV2[raw] ?? SignatureTypeV2.EOA;
}

function resolveOrderType(OrderType: any) {
  const raw = asText(process.env.TRADE_EXECUTION_ORDER_TYPE || "FOK").toUpperCase();
  return raw === "FAK" ? OrderType.FAK : OrderType.FOK;
}

function resolvePrice(proposal: JsonObject) {
  const raw = asNumber(proposal.proposed_price, 0);
  const base = raw > 1 ? raw / 100 : raw;
  const slippageBps = Math.max(0, asNumber(process.env.TRADE_EXECUTION_MAX_SLIPPAGE_BPS, 300));
  return Math.min(0.99, Math.max(0.01, Number((base + slippageBps / 10_000).toFixed(4))));
}

function makeSerializable(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { raw: String(value) };
  }
}

export async function executeApprovedTrade(proposal: JsonObject) {
  const validation = validateProposalTradeWindow(proposal);
  if (!validation.ok) {
    return { ok: false, status: "blocked_filter_mismatch", reason: validation.reason, validation };
  }

  const readiness = getTradeExecutionReadiness();
  if (!readiness.enabled) {
    return { ok: false, status: "execution_disabled_by_env", reason: "TRADE_EXECUTION_ENABLED is not true." };
  }
  if (readiness.missing.length) {
    return { ok: false, status: "execution_config_missing", reason: "Missing Polymarket signing credentials.", missing: readiness.missing };
  }

  const outcome = pickOutcome(proposal);
  const tokenID = outcome?.clobTokenId || outcome?.tokenId;
  if (!tokenID) {
    return { ok: false, status: "execution_config_missing", reason: "Selected outcome has no Polymarket CLOB token id." };
  }

  const amount = asNumber(proposal.proposed_stake, 0);
  if (amount <= 0) {
    return { ok: false, status: "execution_config_missing", reason: "Proposed stake is missing or zero." };
  }

  const privateKey = normalizePrivateKey(process.env.POLYMARKET_PRIVATE_KEY || process.env.POLYMARKET_SIGNER_PRIVATE_KEY || "");
  const { ClobClient, Chain, OrderType, Side, SignatureTypeV2 } = await import("@polymarket/clob-client-v2");
  const { createWalletClient, http } = await import("viem");
  const { privateKeyToAccount } = await import("viem/accounts");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    transport: http(process.env.POLYGON_RPC_URL || undefined),
  });

  const host = readiness.host;
  const chain = readiness.chainId === 80002 ? Chain.AMOY : Chain.POLYGON;
  const funderAddress = asText(process.env.POLYMARKET_FUNDER_ADDRESS || process.env.POLYMARKET_ACCOUNT_ID || process.env.POLYMARKET_WALLET_ADDRESS);
  const signatureType = resolveSignatureType(SignatureTypeV2, funderAddress);
  const baseClient = new ClobClient({
    host,
    chain,
    signer: walletClient as any,
    signatureType,
    funderAddress: funderAddress || undefined,
    throwOnError: true,
  });
  const creds = readiness.hasStaticApiCredentials
    ? {
        key: process.env.POLYMARKET_CLOB_API_KEY as string,
        secret: process.env.POLYMARKET_CLOB_SECRET as string,
        passphrase: (process.env.POLYMARKET_CLOB_PASSPHRASE || process.env.POLYMARKET_CLOB_PASS_PHRASE) as string,
      }
    : await baseClient.createOrDeriveApiKey();

  const client = new ClobClient({
    host,
    chain,
    signer: walletClient as any,
    creds,
    signatureType,
    funderAddress: funderAddress || undefined,
    throwOnError: true,
  });

  const orderType = resolveOrderType(OrderType);
  const tickSize = await client.getTickSize(tokenID).catch(() => "0.01" as const);
  const negRisk = await client.getNegRisk(tokenID).catch(() => undefined);
  const price = resolvePrice(proposal);
  const response = await client.createAndPostMarketOrder(
    {
      tokenID,
      amount,
      side: Side.BUY,
      price,
      orderType,
    },
    { tickSize, ...(typeof negRisk === "boolean" ? { negRisk } : {}) },
    orderType,
  );
  const serializableResponse = makeSerializable(response);
  const rejected = asObject(serializableResponse).success === false || Boolean(asObject(serializableResponse).error);

  return {
    ok: !rejected,
    status: rejected ? "execution_rejected" : "submitted",
    request: {
      host,
      chain,
      tokenID,
      outcome: outcome.label,
      side: "BUY",
      amount,
      price,
      orderType: orderType === OrderType.FAK ? "FAK" : "FOK",
      tickSize,
      negRisk,
    },
    response: serializableResponse,
  };
}
