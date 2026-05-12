"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Lock, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { MirofishGraphPanel } from "@/components/mirofish-graph-panel";

export type MirofishLaunchOutcome = {
  label: string;
  prob?: number;
  tokenId?: string;
  clobTokenId?: string;
  image?: string;
  icon?: string;
};

export type MirofishLaunchMarket = {
  id?: string;
  slug?: string;
  question?: string;
  topic?: string;
  title?: string;
  source?: string;
  category?: string;
  image?: string;
  icon?: string;
  outcomes?: MirofishLaunchOutcome[];
  marketType?: "binary" | "categorical" | string;
  polymarketOdds?: string | number;
  yesPrice?: string | number;
  noPrice?: string | number;
  volume?: string | number;
  moneyAtStake?: string | number;
  liquidity?: string | number;
  liquidityClob?: string | number;
  lastTradePrice?: string | number;
  last?: string | number;
  endDate?: string;
  clobTokenIds?: string[];
};

function num(value: unknown, fallback?: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(value: unknown, fallback = 50) {
  const n = num(value, fallback) ?? fallback;
  const pct = n > 0 && n < 1 ? n * 100 : n;
  const rounded = Math.round(pct);
  if (pct > 0 && rounded === 0) return 1;
  return Math.max(0, Math.min(100, rounded));
}

function cleanMeta(value: unknown) {
  return String(value ?? "").replace(/\|/g, " ").trim();
}

export function toMirofishLaunchMarket(input: any, source = "polymarket"): MirofishLaunchMarket {
  const question = String(input?.question || input?.topic || input?.title || "").trim();
  const rawOutcomes = Array.isArray(input?.outcomes) ? input.outcomes : [];
  const yes = clampPct(input?.polymarketOdds ?? input?.yesPrice ?? rawOutcomes[0]?.prob ?? 50);
  const outcomes = rawOutcomes.length
    ? rawOutcomes
    : [
        { label: "Yes", prob: yes },
        { label: "No", prob: 100 - yes },
      ];

  return {
    ...input,
    question,
    source: input?.source || source,
    image: input?.image || input?.icon || "",
    icon: input?.icon || input?.image || "",
    volume: input?.volume || input?.moneyAtStake || "",
    liquidity: input?.liquidity || input?.liquidityClob || "",
    lastTradePrice: input?.lastTradePrice ?? input?.last ?? "",
    outcomes,
    marketType: input?.marketType || (outcomes.length > 2 ? "categorical" : "binary"),
  };
}

export function normalizeLaunchOutcomes(market?: MirofishLaunchMarket | null): MirofishLaunchOutcome[] {
  if (!market) return [];
  const raw = Array.isArray(market.outcomes) ? market.outcomes : [];
  const seen = new Set<string>();
  const normalized = raw
    .map((o, index) => {
      const label = String((o as any)?.label || (o as any)?.name || "").trim();
      return {
        label,
        prob: Number.isFinite(Number(o?.prob)) ? clampPct(o?.prob) : undefined,
        tokenId: o?.tokenId || o?.clobTokenId || market.clobTokenIds?.[index],
        clobTokenId: o?.clobTokenId || o?.tokenId || market.clobTokenIds?.[index],
        image: o?.image || o?.icon,
        icon: o?.icon || o?.image,
      };
    })
    .filter((o) => {
      const key = o.label.toLowerCase();
      if (!o.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  if (normalized.length >= 2) return normalized;
  const yes = clampPct(market.polymarketOdds ?? market.yesPrice ?? normalized[0]?.prob ?? 50);
  return [
    { label: "Yes", prob: yes },
    { label: "No", prob: 100 - yes },
  ];
}

function appendMarketOutcomesToSeed(base: string, outcomes: MirofishLaunchOutcome[]) {
  const seedText = (base || "").trim();
  if (!outcomes.length || seedText.includes("## Prediction Market Outcomes")) return seedText;
  const lines = [
    "## Prediction Market Outcomes",
    "The simulation must evaluate the question against these exact market outcomes:",
    ...outcomes.map((o) => `- ${o.label}${o.prob !== undefined ? ` (current market price: ${o.prob}%)` : ""}`),
    "Agents should choose among these outcomes, not collapse the market into a generic yes/no question.",
  ];
  return `${seedText || "Simulation context unavailable."}\n\n${lines.join("\n")}`;
}

function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss < 10 ? "0" : ""}${ss}`;
}

type LaunchPhase = "idle" | "launching" | "running" | "error";
type PipelineKey = "seed" | "ontology" | "graph" | "agents" | "config" | "simulation" | "verdict";

const PIPELINE_STEPS: { key: PipelineKey; label: string; sub: string }[] = [
  { key: "seed", label: "Reality Seed", sub: "Tavily context and market outcomes" },
  { key: "ontology", label: "Ontology", sub: "Entity and relation schema" },
  { key: "graph", label: "Knowledge Graph", sub: "Zep graph extraction" },
  { key: "agents", label: "Agents", sub: "Persona generation" },
  { key: "config", label: "Simulation Config", sub: "Platform and time settings" },
  { key: "simulation", label: "Simulation", sub: "Agent rounds running" },
  { key: "verdict", label: "Verdict", sub: "Final analysis and result" },
];

const PIPELINE_ORDER = PIPELINE_STEPS.map((step) => step.key);

export function MirofishLaunchPanel({
  market,
  onClose,
}: {
  market: MirofishLaunchMarket | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const normalizedMarket = useMemo(() => market ? toMirofishLaunchMarket(market, market.source || "polymarket") : null, [market]);
  const outcomes = useMemo(() => normalizeLaunchOutcomes(normalizedMarket), [normalizedMarket]);
  const [depthMode, setDepthMode] = useState<"standard" | "super" | "deep" | "custom">("standard");
  const [agents, setAgents] = useState(15);
  const [rounds, setRounds] = useState(5);
  const [parallelGen] = useState(3);
  const [llmModel] = useState("deepseek-v3");
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [launchStep, setLaunchStep] = useState("Ready");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [activePipelineStep, setActivePipelineStep] = useState<PipelineKey>("seed");
  const [completedPipelineSteps, setCompletedPipelineSteps] = useState<PipelineKey[]>([]);
  const [sseGraphData, setSseGraphData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [liveGraphEvent, setLiveGraphEvent] = useState<any | null>(null);
  const seedRef = useRef("");
  const timerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null);
  const completingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const currentSimIdRef = useRef<string | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const graphNodesAccRef = useRef<any[]>([]);
  const graphEdgesAccRef = useRef<any[]>([]);

  useEffect(() => {
    if (!market) return;
    setDepthMode("standard");
    setAgents(15);
    setRounds(5);
    setPhase("idle");
    setLaunchStep("Ready");
    setLaunchError(null);
    setLogs([]);
    setElapsed(0);
    setActivePipelineStep("seed");
    setCompletedPipelineSteps([]);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    seedRef.current = "";
    completingRef.current = false;
    cancelRequestedRef.current = false;
    currentSimIdRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    esRef.current?.close();
    esRef.current = null;
  }, [market]);

  useEffect(() => {
    return () => {
      cancelRequestedRef.current = true;
      abortRef.current?.abort();
      esRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight });
  }, [logs]);

  const addLog = (message: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev.slice(-180), `[${ts}] ${message}`]);
  };

  const markPipelineStep = (step: PipelineKey) => {
    const idx = PIPELINE_ORDER.indexOf(step);
    const done = PIPELINE_ORDER.slice(0, Math.max(0, idx));
    setActivePipelineStep(step);
    setCompletedPipelineSteps((prev) => Array.from(new Set([...prev, ...done])));
  };

  const completePipelineThrough = (step: PipelineKey) => {
    const idx = PIPELINE_ORDER.indexOf(step);
    const done = PIPELINE_ORDER.slice(0, idx + 1);
    setCompletedPipelineSteps((prev) => Array.from(new Set([...prev, ...done])));
  };

  const markModalPipelineStep = (step?: string) => {
    if (step === "ontology") markPipelineStep("ontology");
    else if (step === "graph_build" || step === "graph_chunk") markPipelineStep("graph");
    else if (step === "graph_chunk_done") completePipelineThrough("graph");
    else if (step === "agents") markPipelineStep("agents");
    else if (step === "config") markPipelineStep("config");
    else if (step === "simulation" || step === "graph_update") markPipelineStep("simulation");
    else if (step === "persist") markPipelineStep("verdict");
    else if (step === "done") completePipelineThrough("verdict");
  };

  const handleMode = (mode: "standard" | "super" | "deep" | "custom", nextAgents: number, nextRounds: number) => {
    setDepthMode(mode);
    if (mode !== "custom") {
      setAgents(nextAgents);
      setRounds(nextRounds);
    }
  };

  const handleSignIn = async () => {
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const currentPath = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/simulate/mirofish";
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(currentPath)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account", access_type: "offline" },
      },
    });
  };

  const handleGenerateSeed = async (scenario: string, onStep?: (msg: string) => void, signal?: AbortSignal) => {
    onStep?.("Optimizing search query...");
    const res = await fetch("/api/generate-seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
      signal,
    });
    const data = await res.json();
    if (!res.ok || !data.seed) throw new Error(data.error || "Failed to generate reality seed.");
    seedRef.current = data.seed;
    try {
      sessionStorage.setItem("hemlo_rag_query", data.searchQuery || "");
      sessionStorage.setItem("hemlo_rag_context", data.tavilyContext || "");
    } catch {}
    return data.seed as string;
  };

  const cancelSimulation = async (closePanel = false) => {
    if (phase !== "launching" && phase !== "running") {
      if (closePanel) onClose();
      return;
    }

    cancelRequestedRef.current = true;
    completingRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    esRef.current?.close();
    esRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const simId = currentSimIdRef.current;
    addLog("Simulation cancelled by user.");
    setLaunchError(null);
    setLaunchStep("Cancelled");
    setPhase("idle");
    setElapsed(0);
    setLiveGraphEvent(null);

    if (simId) {
      await fetch("/api/custom-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: simId,
          status: "cancelled",
          runtime_seconds: elapsed,
          completed_at: new Date().toISOString(),
        }),
      }).catch(() => {});
    }

    currentSimIdRef.current = null;
    completingRef.current = false;
    if (closePanel) onClose();
  };

  const startSimulation = async () => {
    if (!normalizedMarket) return;
    const scenario = normalizedMarket.question || normalizedMarket.topic || normalizedMarket.title || "";
    if (!scenario) return;

    cancelRequestedRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setPhase("launching");
    setLaunchError(null);
    setLogs([]);
    setElapsed(0);
    setActivePipelineStep("seed");
    setCompletedPipelineSteps([]);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    setLaunchStep("Verifying session...");

    try {
      const supabase = createClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setLaunchStep("Refreshing session...");
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) throw new Error("Your session has expired. Please sign in again.");
      }
    } catch (err: any) {
      setLaunchError(err?.message || "Authentication check failed. Please sign in again.");
      setPhase("error");
      return;
    }

    try {
      const usageRes = await fetch("/api/usage");
      if (usageRes.ok) {
        const usage = await usageRes.json();
        if (usage.usageToday >= usage.limit) {
          const paid = ["pro", "premium", "founder", "starter"].includes(String(usage.tier));
          setLaunchError(
            paid
              ? `${usage.usageToday}/${usage.limit} simulations used today on your ${usage.tier} plan. Your quota resets at midnight UTC.`
              : `You've used ${usage.usageToday}/${usage.limit} free simulations today.`
          );
          setPhase("error");
          return;
        }
      }
    } catch {}

    let simulationSeed = "";
    const activeOutcomes = outcomes;
    const activeMarketType = normalizedMarket.marketType === "categorical" || activeOutcomes.length > 2 ? "categorical" : "binary";
    const source = String(normalizedMarket.source || "polymarket").toLowerCase();
    const img = cleanMeta(normalizedMarket.icon || normalizedMarket.image || "");
    const volume = cleanMeta(normalizedMarket.volume || normalizedMarket.moneyAtStake || "");
    const liquidity = cleanMeta(normalizedMarket.liquidity || normalizedMarket.liquidityClob || "");
    const lastTrade = cleanMeta(normalizedMarket.lastTradePrice || normalizedMarket.last || "");

    try {
      setLaunchStep("Generating grounded reality seed...");
      markPipelineStep("seed");
      const generatedSeed = await handleGenerateSeed(scenario, (msg) => setLaunchStep(msg), signal);
      if (cancelRequestedRef.current || signal.aborted) return;
      completePipelineThrough("seed");
      simulationSeed = appendMarketOutcomesToSeed(generatedSeed, activeOutcomes);
      seedRef.current = simulationSeed;
      setLaunchStep("Creating simulation record...");
    } catch (err: any) {
      setLaunchError(err?.message || "Failed to generate reality seed.");
      setPhase("error");
      return;
    }

    let simDbId: string | null = null;
    try {
      const dbDomain = normalizedMarket.id
        ? `${source}|${cleanMeta(normalizedMarket.id)}|${volume}|${liquidity}|${lastTrade}|${img}`
        : source;
      const dbRes = await fetch("/api/custom-simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          scenario,
          domain: dbDomain,
          reality_seed: simulationSeed,
          agent_count: agents,
          rounds,
          llm_model: llmModel,
          parallel_gen: parallelGen,
          platforms: ["twitter", "reddit"],
        }),
      });
      const dbData = await dbRes.json().catch(() => ({}));
      if (dbRes.status === 401) throw new Error("Session expired. Please sign in and try again.");
      if (dbRes.status === 429) throw new Error(String(dbData.error || "Daily simulation limit reached.").replace(/^__(?:PAID|FREE)_LIMIT_REACHED__:/, ""));
      if (!dbRes.ok) throw new Error(dbData.error || "Could not create simulation record.");
      simDbId = dbData.simulation?.id || null;
      if (!simDbId) throw new Error("Could not create simulation in database.");
      currentSimIdRef.current = simDbId;
    } catch (err: any) {
      setLaunchError(err?.message || "Network error creating simulation.");
      setPhase("error");
      return;
    }

    setPhase("running");
    setLaunchStep("Connecting to Modal engine...");
    addLog("Connecting to Modal Serverless Engine...");
    const startT = Date.now();
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    const markFailed = async (message: string) => {
      if (timerRef.current) clearInterval(timerRef.current);
      addLog(`FAILED: ${message}`);
      setLaunchError(message);
      setPhase("error");
      if (simDbId) {
        await fetch("/api/custom-simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: simDbId, status: "failed" }),
        }).catch(() => {});
      }
    };

    try {
      const modalUrl = process.env.NEXT_PUBLIC_MODAL_URL || "https://vaishumaniket--hemlo-mirofish-run-simulation.modal.run";
      const url = new URL(modalUrl);
      url.searchParams.append("question", scenario);
      url.searchParams.append("sim_id", simDbId);
      url.searchParams.append("reality_seed", simulationSeed);
      url.searchParams.append("agent_count", String(agents));
      url.searchParams.append("rounds", String(rounds));
      url.searchParams.append("domain", source);
      if (activeOutcomes.length) {
        url.searchParams.append("market_options", JSON.stringify(activeOutcomes));
        url.searchParams.append("market_type", activeMarketType);
      }

      const es = new EventSource(url.toString());
      esRef.current = es;

      es.onmessage = (eventMessage) => {
        if (cancelRequestedRef.current) return;
        try {
          const event = JSON.parse(eventMessage.data);
          if (event.message) addLog(`[modal] ${event.message}`);
          if (event.step) {
            markModalPipelineStep(event.step);
            setLaunchStep(event.message || `Pipeline step: ${event.step}`);
          }

          if (event.step === "graph_chunk" && event.data?.type && Array.isArray(event.data?.items)) {
            if (event.data.type === "nodes") graphNodesAccRef.current = [...graphNodesAccRef.current, ...event.data.items];
            if (event.data.type === "edges") graphEdgesAccRef.current = [...graphEdgesAccRef.current, ...event.data.items];
            setSseGraphData({ nodes: graphNodesAccRef.current, edges: graphEdgesAccRef.current });
          }

          if (event.step === "graph_chunk_done" && event.status === "complete") {
            setSseGraphData({ nodes: graphNodesAccRef.current, edges: graphEdgesAccRef.current });
            addLog(`[graph] ${graphNodesAccRef.current.length} nodes + ${graphEdgesAccRef.current.length} edges received`);
          }

          if (event.step === "graph_update" && event.data) {
            setLiveGraphEvent(event.data);
          }

          if (event.step === "error") {
            es.close();
            markFailed(event.message || "Unknown error from Modal pipeline");
            return;
          }

          if (event.step === "done" && event.status === "complete") {
            completingRef.current = true;
            es.close();
            if (timerRef.current) clearInterval(timerRef.current);
            addLog("Simulation complete. Saving results...");

            const finalize = () => router.push(`/simulate/mirofish/${simDbId}`);
            const resultBase = activeOutcomes.length
              ? {
                  ...(event.result || {}),
                  options: Array.isArray(event.result?.options) && event.result.options.length > 0
                    ? event.result.options
                    : activeOutcomes.map((o) => o.label),
                  market_outcomes: Array.isArray(event.result?.market_outcomes) && event.result.market_outcomes.length > 0
                    ? event.result.market_outcomes
                    : activeOutcomes,
                  market_type: event.result?.market_type || activeMarketType,
                }
              : (event.result || {});

            const resultWithMarketOutcomes = {
              ...resultBase,
              marketInfo: {
                ...(resultBase.marketInfo || {}),
                source,
                id: normalizedMarket.id || resultBase.marketInfo?.id,
                slug: normalizedMarket.slug || resultBase.marketInfo?.slug,
                category: normalizedMarket.category || resultBase.marketInfo?.category,
                volume: volume || resultBase.marketInfo?.volume || "",
                liquidity: liquidity || resultBase.marketInfo?.liquidity || "",
                lastTradePrice: lastTrade || resultBase.marketInfo?.lastTradePrice || "",
                icon: img || resultBase.marketInfo?.icon || "",
                image: img || resultBase.marketInfo?.image || "",
                marketType: activeMarketType,
                outcomes: activeOutcomes,
                endDate: normalizedMarket.endDate || resultBase.marketInfo?.endDate,
              },
            };

            fetch("/api/custom-simulations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: simDbId,
                status: "completed",
                result: resultWithMarketOutcomes,
                report_text: resultWithMarketOutcomes.report_text,
                round_logs: resultWithMarketOutcomes.round_logs,
                confidence: resultWithMarketOutcomes.confidence,
                primary_probability: resultWithMarketOutcomes.primary_probability,
                runtime_seconds: Math.floor((Date.now() - startT) / 1000),
                completed_at: new Date().toISOString(),
              }),
            })
              .then(() => finalize())
              .catch(() => finalize());
          }
        } catch (err) {
          console.error("[mirofish-launch] SSE parse error", err);
        }
      };

      es.onerror = () => {
        if (cancelRequestedRef.current) return;
        if (completingRef.current) return;
        es.close();
        void markFailed("Modal stream interrupted. The run was stopped instead of auto-relaunching to prevent duplicate simulations and wasted credits. Please start it again.");
      };
    } catch (err: any) {
      if (cancelRequestedRef.current || err?.name === "AbortError") return;
      await markFailed(err?.message || String(err));
    }
  };

  const isAuthError = !!launchError && /session|sign in|authentication|unauthorized/i.test(launchError);
  const closeDisabled = phase === "launching" || phase === "running";
  const platformIcon = String(normalizedMarket?.source || "").toLowerCase() === "kalshi" ? "/kalshi.webp" : "/polymarket.webp";
  const platformName = String(normalizedMarket?.source || "").toLowerCase() === "kalshi" ? "Kalshi" : "Polymarket";

  return (
    <AnimatePresence>
      {normalizedMarket && (
        <motion.section
          key="mirofish-launch-panel"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 260, damping: 32 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9990,
            background: "linear-gradient(180deg, #f8f8f9 0%, #ffffff 100%)",
            color: "#000000",
            overflowY: "auto",
            boxShadow: "-28px 0 80px rgba(0,0,0,0.55)",
          }}
        >
          <style>{`
            .mirofish-launch-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.1fr) minmax(320px, 440px);
              gap: 22px;
              align-items: stretch;
              height: min(640px, calc(100vh - 150px));
              min-height: 520px;
            }
            @media (max-width: 900px) {
              .mirofish-launch-grid {
                grid-template-columns: 1fr;
                height: auto;
                min-height: 0;
              }
              .mirofish-launch-wrap { padding: 18px !important; }
              .mirofish-market-panel {
                order: -1;
                height: min(420px, 52vh) !important;
                max-height: min(420px, 52vh) !important;
              }
            }
          `}</style>

          <div className="mirofish-launch-wrap" style={{ width: "min(1440px, 100%)", margin: "0 auto", padding: "clamp(22px, 4vw, 44px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8b8b8b", marginBottom: 6 }}>
                  MiroFish Simulation
                </div>
                <div style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 600, lineHeight: 1, letterSpacing: 0 }}>
                  Simulation Setup
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {closeDisabled && (
                  <button
                    onClick={() => void cancelSimulation(false)}
                    style={{
                      height: 42,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "1px solid #f3b5b5",
                      background: "#fff3f3",
                      color: "#9f1d1d",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Cancel run
                  </button>
                )}
                <button
                  onClick={onClose}
                  disabled={closeDisabled}
                  aria-label="Close simulation panel"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid #e5e5e5",
                    background: closeDisabled ? "#f0f0f0" : "#ffffff",
                    color: closeDisabled ? "#aaa" : "#111",
                    cursor: closeDisabled ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="mirofish-launch-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0, minHeight: 0, height: "100%" }}>
                <motion.div
                  layout
                  style={{
                    background: "#0e1116",
                    color: "#ffffff",
                    border: "1px solid #222a33",
                    borderRadius: 18,
                    padding: "22px",
                    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#738093", fontWeight: 700, marginBottom: 8 }}>Market question</div>
                      <div style={{ color: "#ffffff", fontSize: "clamp(22px, 3vw, 32px)", lineHeight: 1.14, fontWeight: 600, letterSpacing: 0 }}>
                        {normalizedMarket.question}
                      </div>
                    </div>
                    {(normalizedMarket.icon || normalizedMarket.image) && (
                      <img
                        src={normalizedMarket.icon || normalizedMarket.image}
                        alt=""
                        style={{ width: 58, height: 58, borderRadius: 14, objectFit: "cover", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}
                  </div>

                  {(phase === "launching" || phase === "running") && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                      style={{ borderRadius: 16, overflow: "hidden", border: "1px solid #24303a", background: "#f8fafc", position: "relative" }}
                    >
                      <MirofishGraphPanel
                        projectId={null}
                        isSimulating={true}
                        liveData={sseGraphData}
                        liveEvent={liveGraphEvent}
                        height={300}
                      />
                    </motion.div>
                  )}
                </motion.div>

                {phase === "running" ? (
                  <div style={{ background: "#0e1116", color: "#ffffff", border: "1px solid #222a33", borderRadius: 18, padding: 22, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#738093", fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 }}>Reasoning engine</div>
                        <div style={{ fontSize: 24, fontWeight: 600 }}>Running simulation</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>{formatSecs(elapsed)}</div>
                        <button
                          onClick={() => void cancelSimulation(false)}
                          style={{
                            height: 36,
                            padding: "0 13px",
                            borderRadius: 10,
                            border: "1px solid rgba(248,113,113,0.45)",
                            background: "rgba(248,113,113,0.12)",
                            color: "#fecaca",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 18 }}>
                      {["Seed", "Graph", "Agents", "Rounds", "Verdict"].map((step, i) => (
                        <div key={step} style={{ height: 8, borderRadius: 999, background: i === 0 || logs.length > i * 3 ? "#ffffff" : "rgba(255,255,255,0.13)" }} />
                      ))}
                    </div>
                    <div style={{ color: "#aab4c0", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{launchStep}</div>
                    <div ref={logsRef} style={{ flex: 1, minHeight: 260, overflowY: "auto", background: "#07090d", border: "1px solid #1d2530", borderRadius: 12, padding: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, lineHeight: 1.55, color: "#d6deea" }}>
                      {logs.map((line, i) => <div key={`${line}-${i}`}>{line}</div>)}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#ffffff", border: "1px solid #e7e7e7", borderRadius: 18, padding: "22px", boxShadow: "0 18px 50px rgba(0,0,0,0.08)", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Choose simulation depth</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                      {[
                        { id: "standard", label: "Standard", desc: "15 agents, 5 rounds", agents: 15, rounds: 5, locked: false },
                        { id: "super", label: "Super", desc: "100 agents, 10 rounds", agents: 100, rounds: 10, locked: false },
                        { id: "deep", label: "Deep", desc: "250 agents, 15 rounds", agents: 250, rounds: 15, locked: false },
                        { id: "custom", label: "Custom", desc: "Adjust agents and rounds", agents: 50, rounds: 8, locked: false },
                      ].map((opt) => {
                        const active = depthMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            disabled={opt.locked || phase === "launching"}
                            onClick={() => handleMode(opt.id as any, opt.agents, opt.rounds)}
                            style={{
                              padding: 16,
                              minHeight: 104,
                              borderRadius: 14,
                              border: `2px solid ${active ? "#000000" : "#e8e8e8"}`,
                              background: active ? "#f8f8f8" : "#ffffff",
                              cursor: opt.locked ? "not-allowed" : "pointer",
                              textAlign: "left",
                              position: "relative",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.label}</span>
                              {active ? <Check size={16} /> : opt.locked ? <Lock size={15} /> : null}
                            </div>
                            <div style={{ color: "#777", fontSize: 13, lineHeight: 1.35 }}>{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {depthMode === "custom" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#666" }}>
                          Agents
                          <input
                            type="number"
                            min={5}
                            max={250}
                            value={agents}
                            onChange={(e) => setAgents(Math.max(5, Math.min(250, Number(e.target.value) || agents)))}
                            style={{ height: 42, borderRadius: 10, border: "1px solid #dedede", padding: "0 12px", fontSize: 15, fontWeight: 600 }}
                          />
                        </label>
                        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700, color: "#666" }}>
                          Rounds
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={rounds}
                            onChange={(e) => setRounds(Math.max(1, Math.min(20, Number(e.target.value) || rounds)))}
                            style={{ height: 42, borderRadius: 10, border: "1px solid #dedede", padding: "0 12px", fontSize: 15, fontWeight: 600 }}
                          />
                        </label>
                      </div>
                    )}

                    {phase === "error" && launchError && (
                      <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "#fff0f0", border: "1px solid #ffd0d0", color: "#9f1d1d", fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>
                        {launchError}
                        {isAuthError && (
                          <button onClick={handleSignIn} style={{ marginTop: 12, width: "100%", height: 40, borderRadius: 10, border: "none", background: "#000", color: "#fff", fontWeight: 800, cursor: "pointer" }}>
                            Sign in with Google
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      onClick={startSimulation}
                      disabled={phase === "launching"}
                      style={{
                        marginTop: 18,
                        width: "100%",
                        height: 54,
                        borderRadius: 12,
                        border: "none",
                        background: phase === "launching" ? "#d8d8d8" : "#000000",
                        color: "#ffffff",
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: phase === "launching" ? "default" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                      }}
                    >
                      {phase === "launching" ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                      {phase === "launching" ? launchStep : "Run MiroFish Simulation"}
                      {phase !== "launching" && <ArrowRight size={18} />}
                    </button>
                    {phase === "launching" && (
                      <button
                        onClick={() => void cancelSimulation(false)}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          height: 44,
                          borderRadius: 12,
                          border: "1px solid #efc2c2",
                          background: "#fff7f7",
                          color: "#9f1d1d",
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Cancel launch
                      </button>
                    )}
                  </div>
                )}
              </div>

              <aside
                className="mirofish-market-panel"
                style={{
                  background: "#10151b",
                  color: "#ffffff",
                  border: "1px solid #25303a",
                  borderRadius: 18,
                  padding: 20,
                  boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
                  minWidth: 0,
                  minHeight: 0,
                  height: "100%",
                  maxHeight: "100%",
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {(phase === "launching" || phase === "running") ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 18, flexShrink: 0 }}>
                      <div style={{ color: "#748293", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 }}>
                        Pipeline roadmap
                      </div>
                      <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 600 }}>{formatSecs(elapsed)}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2, position: "relative" }}>
                      <div style={{ position: "absolute", left: 15, top: 4, bottom: 12, width: 1, background: "rgba(255,255,255,0.08)" }} />
                      {PIPELINE_STEPS.map((step, index) => {
                        const done = completedPipelineSteps.includes(step.key);
                        const active = activePipelineStep === step.key && !done;
                        return (
                          <div key={step.key} style={{ display: "grid", gridTemplateColumns: "32px minmax(0,1fr)", gap: 14, paddingBottom: index === PIPELINE_STEPS.length - 1 ? 0 : 22, position: "relative", zIndex: 1 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: done ? "#22c55e" : active ? "#ffffff" : "#0a0d12",
                                border: `1px solid ${done ? "#22c55e" : active ? "#ffffff" : "#26313b"}`,
                                color: done || active ? "#000000" : "#566170",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 10,
                                fontWeight: 900,
                              }}
                            >
                              {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : `0${index + 1}`}
                            </div>
                            <div style={{ paddingTop: 3, minWidth: 0 }}>
                              <div style={{ color: done || active ? "#ffffff" : "#667487", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                                {step.label}
                              </div>
                              <div style={{ color: done ? "#74d99a" : active ? "#aab4c0" : "#4f5b6a", fontSize: 12, lineHeight: 1.35, fontWeight: 600 }}>
                                {active ? launchStep : step.sub}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 12, flexShrink: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#748293", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.4 }}>
                        <img src={platformIcon} alt={platformName} style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", flexShrink: 0 }} />
                        Outcomes
                      </div>
                      <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 600 }}>
                        {outcomes.length}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
                      {outcomes.map((outcome, index) => {
                        const hasProb = typeof outcome.prob === "number";
                        const prob = hasProb ? outcome.prob! : 0;
                        const color = ["#7db7ff", "#2d9cff", "#facc15", "#fb8c23", "#22c55e", "#a855f7"][index % 6];
                        return (
                          <div key={`${outcome.label}-${index}`} style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr) 48px", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            {(outcome.icon || outcome.image) ? (
                              <img src={outcome.icon || outcome.image} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", background: "#202a33" }} />
                            ) : (
                              <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, justifySelf: "center" }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#ffffff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outcome.label}</div>
                              <div style={{ height: 4, marginTop: 7, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ width: `${Math.max(prob, 1)}%`, height: "100%", background: color }} />
                              </div>
                            </div>
                            <div style={{ textAlign: "right", fontSize: 15, fontWeight: 600 }}>{hasProb ? `${prob}%` : "--"}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </aside>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
