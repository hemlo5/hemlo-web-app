"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, ArrowRight, Check, Lock, Zap, X
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { NewsTicker } from "@/components/news-ticker";
import { SimulateMarketCarousel, getCarouselMarketOutcomes, type SimulateCarouselMarket } from "@/components/simulate-market-carousel";
import { cachedJson, readClientCache, writeClientCache } from "@/lib/client-cache";
import type { SimulateHomeData } from "@/lib/simulate-home-data";

const MirofishGraphPanel = dynamic(
  () => import("@/components/mirofish-graph-panel").then((mod) => mod.MirofishGraphPanel),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", color: "#718096", fontSize: 13, fontWeight: 700 }}>
        Preparing graph canvas...
      </div>
    ),
  },
);

const TopSimulationsSection = dynamic(
  () => import("@/components/top-simulations-section").then((mod) => mod.TopSimulationsSection),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: "44px 0", color: "#8a94a6", fontSize: 13, fontWeight: 700 }}>
        Loading simulations...
      </div>
    ),
  },
);

// ── DOMAIN PILLS ──────────────────────────────────────────────────────────────
const DOMAINS = [
  { id: "polymarket", label: "Polymarket" },
  { id: "geopolitics", label: "Geopolitics" },
  { id: "social", label: "Social" },
  { id: "custom", label: "Custom" },
];

const DOMAIN_EXAMPLES: Record<string, string> = {
  polymarket: "How would Polymarket odds shift if Trump announced 50% tariffs on the EU immediately?",
  geopolitics: "What happens to global supply chains and opinion if the Iranian regime falls by June 2026?",
  social: "How does the social media ecosystem react and spread information if Elon Musk buys Apple?",
  custom: "",
};

type MarketOutcome = { label: string; prob?: number; tokenId?: string; clobTokenId?: string; image?: string; icon?: string };

function parseMarketOutcomesParam(raw: string | null): MarketOutcome[] {
  if (!raw) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      parsed = JSON.parse(decodeURIComponent(raw));
    } catch {
      return [];
    }
  }

  const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.outcomes) ? parsed.outcomes : [];
  const seen = new Set<string>();
  return arr
    .map((o: any) => ({
      label: String(o?.label || o?.name || "").trim(),
      prob: Number.isFinite(Number(o?.prob)) ? Math.round(Number(o.prob)) : undefined,
      tokenId: o?.tokenId || o?.clobTokenId,
      clobTokenId: o?.clobTokenId || o?.tokenId,
      image: o?.image || o?.icon,
      icon: o?.icon || o?.image,
    }))
    .filter((o: MarketOutcome) => {
      const key = o.label.toLowerCase();
      if (!o.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function appendMarketOutcomesToSeed(base: string, outcomes: MarketOutcome[]) {
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


function MirofishTerminalContent({ initialHomeData }: { initialHomeData?: SimulateHomeData }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Settings
  const [domain, setDomain] = useState("custom");
  const [scenario, setScenario] = useState("");
  const [seed, setSeed] = useState("");
  const seedRef = useRef(""); // keep ref in sync so startSimulation always reads latest
  const [depthLevel, setDepthLevel] = useState<"standard" | "deep" | "super">("standard");
  const [agents, setAgents] = useState(15);
  const [rounds, setRounds] = useState(5);
  const [parallelGen, setParallelGen] = useState(3);
  const [llmModel, setLlmModel] = useState("deepseek-v3");

  const [subStep, setSubStep] = useState<"prompt" | "params">("prompt");
  const [depthMode, setDepthMode] = useState<"standard" | "super" | "deep" | "custom">("standard");
  const [standardUses, setStandardUses] = useState(0); // For free tier limit demo

  const [isPro] = useState(true);
  const [userTier, setUserTier] = useState<string>("free");
  const [engineStatus, setEngineStatus] = useState<"idle" | "queued" | "running">("idle");
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [seedError, setSeedError] = useState("");
  const [tavilyQuery, setTavilyQuery] = useState("");
  const [tavilyContext, setTavilyContext] = useState("");
  const [marketOutcomes, setMarketOutcomes] = useState<MarketOutcome[]>([]);
  const [marketType, setMarketType] = useState<"binary" | "categorical" | "">("");
  const [marketQuestions, setMarketQuestions] = useState<string[]>(() => initialHomeData?.questions?.length ? initialHomeData.questions : []);
  const [marketQuestionIndex, setMarketQuestionIndex] = useState(0);
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);

  useEffect(() => {
    if (!initialHomeData) return;
    writeClientCache("/api/simulate-home", initialHomeData, 60_000);
    writeClientCache("/api/simulations-completed?scope=top&limit=20&lite=1", { data: initialHomeData.tickerItems || [] }, 45_000);
    writeClientCache("/api/simulations-completed?scope=all&limit=12&lite=1", { data: initialHomeData.carouselMarkets || [] }, 45_000);
  }, [initialHomeData]);

  // Fetch user tier on mount
  useEffect(() => {
    const cached = readClientCache<any>("/api/usage");
    if (cached?.tier) setUserTier(cached.tier);
    cachedJson<any>("/api/usage", { ttlMs: 30_000 }).then(d => {
      if (d.tier) setUserTier(d.tier)
    }).catch(() => {})
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallbackQuestions = [
      "When will Bitcoin hit $150k?",
      "Democratic Presidential Nominee 2028",
      "Who will win the 2026 NBA Championship?",
      "Will there be a US x Iran peace deal in 2026?",
    ];

    const addQuestion = (questions: string[], raw: unknown) => {
      const text = String(raw || "").trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (!questions.some((q) => q.toLowerCase() === key)) questions.push(text);
    };

    async function loadMarketQuestions() {
      const questions: string[] = [];
      await cachedJson<any>("/api/simulate-home", { ttlMs: 60_000 })
        .then((d) => {
          (d.questions || []).forEach((q: string) => addQuestion(questions, q));
          (d.carouselMarkets || []).forEach((market: any) => addQuestion(questions, market.topic || market.question || market.title));
        })
        .catch(() => {});
      if (!cancelled) setMarketQuestions((questions.length ? questions : fallbackQuestions).slice(0, 24));
    }

    const delay = initialHomeData?.questions?.length ? window.setTimeout(loadMarketQuestions, 1800) : window.setTimeout(loadMarketQuestions, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(delay);
    };
  }, [initialHomeData]);

  useEffect(() => {
    if (marketQuestions.length <= 1) return;
    const id = window.setInterval(() => {
      setMarketQuestionIndex((idx) => (idx + 1) % marketQuestions.length);
    }, 3400);
    return () => window.clearInterval(id);
  }, [marketQuestions.length]);

  // ── Launch queue state: provides immediate feedback between button click and SSE start
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState<string>("Initializing...");
  const [launchError, setLaunchError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!searchParams) return;
    const s = searchParams.get("scenario");
    const d = searchParams.get("domain");
    const a = searchParams.get("agents");
    const r = searchParams.get("rounds");

    if (s) {
      setScenario(s);
      setSubStep("params");
      setPromptPanelOpen(true);
    }
    if (d) setDomain(d);
    if (a) setAgents(parseInt(a) || 100);
    if (r) setRounds(parseInt(r) || 10);
    const parsedOutcomes = parseMarketOutcomesParam(searchParams.get("outcomes") || searchParams.get("options"));
    setMarketOutcomes(parsedOutcomes);
    const mt = searchParams.get("marketType");
    if (mt === "binary" || mt === "categorical") setMarketType(mt);
  }, [searchParams]);

  const [marketStats, setMarketStats] = useState<{id?: string, vol?: string, liq?: string, last?: string, img?: string}>({});
  useEffect(() => {
    if (!searchParams) return;
    const mId = searchParams.get("marketId");
    if (mId) {
      setMarketStats({
        id: mId,
        vol: searchParams.get("vol") || "",
        liq: searchParams.get("liq") || "",
        last: searchParams.get("last") || "",
        img: searchParams.get("img") || ""
      });
    }
  }, [searchParams]);

  const handleCarouselMarketSelect = (market: SimulateCarouselMarket) => {
    const outcomes = getCarouselMarketOutcomes(market);
    setScenario(market.topic || "");
    setDomain(market.source === "kalshi" ? "kalshi" : market.source === "polymarket" ? "polymarket" : "custom");
    setMarketOutcomes(outcomes);
    setMarketType(market.marketType === "categorical" || outcomes.length > 2 ? "categorical" : "binary");
    setMarketStats({
      id: market.marketId || market.id || "",
      vol: market.moneyAtStake || market.volume || "",
      liq: "",
      last: "",
      img: market.icon || market.image || "",
    });
    setSubStep("params");
    setPromptPanelOpen(true);
  };

  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null); // keep SSE ref for reconnect
  // Prevents the persist effect from re-writing sessionStorage AFTER a done/error
  // handler has already cleared it (React state batching race condition).
  const isCompletingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const currentSimIdRef = useRef<string | null>(null);

  const SESSION_KEY = "hemlo_running_sim";

  const [activeStep, setActiveStep] = useState(0);
  const [steps, setSteps] = useState([
    { label: "Map Construction", sub: "Reality seed extraction & memory injection", status: "pending", time: "" },
    { label: "Environment Setup", sub: "Entity relationship extraction & persona generation", status: "pending", time: "" },
    { label: "Agent Generation", sub: "Profile generation & LLM allocation", status: "pending", time: "" },
    { label: "Simulation Rounds", sub: "Dual-platform parallel simulation", status: "pending", time: "" },
    { label: "Report Generation", sub: "Deep analysis & structured prediction", status: "pending", time: "" }
  ]);

  const [pastSims, setPastSims] = useState<any[]>([]);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [miroProjectId, setMiroProjectId] = useState<string | null>(null);
  const [sseGraphData, setSseGraphData] = useState<{nodes: any[], edges: any[]} | null>(null);
  const [liveGraphEvent, setLiveGraphEvent] = useState<any>(null);
  const graphNodesAccRef = useRef<any[]>([]);
  const graphEdgesAccRef = useRef<any[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null); // ref on the scrollable box, NOT a sentinel
  const activeStepRef = useRef(0); // mirror of activeStep for use inside closures
  const stepTimesRef = useRef<Record<string, number>>({}); // step name → Date.now() when it started
  const [liveTimings, setLiveTimings] = useState<Record<string, number>>({}); // step → elapsed seconds


  // Computed
  // Accurate runtime estimate: each "batch" takes ~2.5s, plus 60s fixed setup overhead
  const estimatedSeconds = Math.round((agents * rounds) / parallelGen * 2.5) + 60;
  const estMins = Math.floor(estimatedSeconds / 60);
  const estSecs = estimatedSeconds % 60;
  const rotatingMarketQuestion = marketQuestions[marketQuestionIndex] || "What are you thinking about today?";
  
  // ── PERSIST running state to sessionStorage so navigation away doesn't lose it
  useEffect(() => {
    if (phase === "running" && miroProjectId && !isCompletingRef.current && !cancelRequestedRef.current) {
      const payload = { phase, elapsed, activeStep, steps, liveLogs, miroProjectId, scenario, domain, seed: seedRef.current || seed, agents, rounds, llmModel, parallelGen, marketOutcomes, marketType };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }
  }, [phase, elapsed, activeStep, steps, liveLogs, miroProjectId, scenario, domain, seed, agents, rounds, llmModel, parallelGen, marketOutcomes, marketType]);

  // Keep activeStepRef in sync
  useEffect(() => { activeStepRef.current = activeStep; }, [activeStep]);

  useEffect(() => {
    return () => {
      cancelRequestedRef.current = true;
      abortRef.current?.abort();
      esRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── RESTORE + RECONNECT SSE if simulation was running when user left
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    let saved: any;
    try { saved = JSON.parse(raw); } catch { sessionStorage.removeItem(SESSION_KEY); return; }
    if (saved.phase !== "running" || !saved.miroProjectId) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    // ── Everything is async so the DB check BLOCKS the reconnect — no race condition
    (async () => {
      // Step 1: Check if this simulation already completed in the DB.
      // If yes: clear storage and go to results. Do NOT reconnect to Modal.
      try {
        const res = await fetch("/api/custom-simulations");
        const data = await res.json();
        const existing = (data.simulations || []).find((s: any) => s.id === saved.miroProjectId);
        if (existing?.status === "completed" || existing?.status === "failed" || existing?.status === "cancelled") {
          sessionStorage.removeItem(SESSION_KEY);
          if (existing.status === "completed") {
            router.push(`/simulate/mirofish/${saved.miroProjectId}`);
          }
          return; // exit — never reconnect
        }
      } catch {
        // Network error during check — also abort to be safe
        // We could reconnect here, but it's safer not to risk double-runs
        sessionStorage.removeItem(SESSION_KEY);
        return;
      }

      // Step 2: Simulation is genuinely still in progress. Restore UI state and reconnect.
      setPhase("running");
      setElapsed(saved.elapsed ?? 0);
      setActiveStep(saved.activeStep ?? 0);
      setSteps(saved.steps ?? steps);
      setLiveLogs(saved.liveLogs ?? []);
      setMiroProjectId(saved.miroProjectId);
      currentSimIdRef.current = saved.miroProjectId;
      if (saved.scenario) setScenario(saved.scenario);
      if (saved.domain) setDomain(saved.domain);
      if (saved.agents) setAgents(saved.agents);
      if (saved.rounds) setRounds(saved.rounds);
      if (Array.isArray(saved.marketOutcomes)) setMarketOutcomes(saved.marketOutcomes);
      if (saved.marketType === "binary" || saved.marketType === "categorical") setMarketType(saved.marketType);

      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

      const MODAL_URL = process.env.NEXT_PUBLIC_MODAL_URL || "https://vaishumaniket--hemlo-mirofish-run-simulation.modal.run";
      const simDbId = saved.miroProjectId;
      const addLogR = (msg: string) => {
        const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
        setLiveLogs(prev => [...prev.slice(-200), `[${ts}] ${msg}`]);
      };

      addLogR(`→ Reconnecting to simulation ${simDbId}...`);

      const url = new URL(MODAL_URL);
      url.searchParams.append("question", saved.scenario || "");
      url.searchParams.append("sim_id", simDbId);
      url.searchParams.append("reality_seed", saved.seed || saved.scenario || "");
      url.searchParams.append("agent_count", String(saved.agents || 25));
      url.searchParams.append("rounds", String(saved.rounds || 6));
      url.searchParams.append("domain", saved.domain || "custom");
      if (Array.isArray(saved.marketOutcomes) && saved.marketOutcomes.length > 0) {
        url.searchParams.append("market_options", JSON.stringify(saved.marketOutcomes));
        url.searchParams.append("market_type", saved.marketType || (saved.marketOutcomes.length > 2 ? "categorical" : "binary"));
      }

      const startT = Date.now();
      const getT = () => formatSecs(Math.floor((Date.now() - startT) / 1000));

      const es = new EventSource(url.toString());
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.message) addLogR(`  [modal] ${event.message}`);
          if (event.step === "init") { setActiveStep(0); setSteps(p => p.map((s, i) => i === 0 ? { ...s, status: "active" } : s)); }
          if (event.step === "ontology" || event.step === "graph_build") { setActiveStep(0); }
          if (event.step === "graph_chunk" && event.data?.type && event.data?.items) {
            if (event.data.type === "nodes") graphNodesAccRef.current = [...graphNodesAccRef.current, ...event.data.items];
            else if (event.data.type === "edges") graphEdgesAccRef.current = [...graphEdgesAccRef.current, ...event.data.items];
          }
          if (event.step === "graph_chunk_done" && event.status === "complete") {
            setSseGraphData({ nodes: graphNodesAccRef.current, edges: graphEdgesAccRef.current });
          }
          if (event.step === "agents") { setActiveStep(1); setSteps(p => p.map((s, i) => i === 1 ? { ...s, status: "active" } : s)); }
          if (event.step === "config") { setActiveStep(2); setSteps(p => p.map((s, i) => i === 2 ? { ...s, status: "active" } : s)); }
          if (event.step === "simulation") {
            setSteps(p => p.map((s, i) => i < 3 ? { ...s, status: i < 3 ? "done" : s.status } : i === 3 ? { ...s, status: "active" } : s));
            setActiveStep(3);
          }
          if (event.step === "report" || event.step === "persist") { setActiveStep(4); setSteps(p => p.map((s, i) => i === 4 ? { ...s, status: "active" } : s)); }
          if (event.step === "done" && event.status === "complete") {
            es.close();
            clearInterval(timerRef.current);
            setSteps(p => p.map((s, i) => i >= 3 ? { ...s, status: "done", time: getT() } : s));
            addLogR(`✓ Simulation complete! Redirecting...`);
            isCompletingRef.current = true;
            sessionStorage.removeItem(SESSION_KEY);
            router.push(`/simulate/mirofish/${simDbId}`);
          }
          if (event.step === "error") {
            es.close();
            clearInterval(timerRef.current);
            addLogR(`✗ FAILED: ${event.message || "Unknown error"}`);
            isCompletingRef.current = true;
            sessionStorage.removeItem(SESSION_KEY);
          }
        } catch (err) { console.error("SSE reconnect parse error", err); }
      };

      es.onerror = () => {
        if (isCompletingRef.current) return;
        es.close();
        clearInterval(timerRef.current);
        addLogR("✗ Modal stream interrupted. Auto-reconnect disabled to prevent launching a duplicate Modal simulation.");
        isCompletingRef.current = true;
        sessionStorage.removeItem(SESSION_KEY);
      };
    })();
  }, []); // run once on mount

  useEffect(() => {
    // Fetch user sims
    fetch("/api/custom-simulations").then(r => r.json()).then(d => setPastSims(d.simulations || []));
  }, []);

  // Auto-scroll the log box to bottom on new entry — scrolls ONLY the log container,
  // not the page. Using scrollTop instead of scrollIntoView to avoid page hijacking.
  useEffect(() => {
    const el = logsContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveLogs]);

  const handleDomain = (id: string) => {
    setDomain(id);
    setScenario(DOMAIN_EXAMPLES[id] || "");
  };

  const handleGenerateSeed = async (scenarioOverride?: string, onStep?: (msg: string) => void, signal?: AbortSignal): Promise<boolean> => {
    const q = scenarioOverride || scenario;
    if (!q) return false;
    setIsGeneratingSeed(true);
    setSeedError("");
    try {
      // Show RAG pipeline steps in the UI
      onStep?.("🔍 Step 1/3 — Optimizing search query with AI...");
      const res = await fetch("/api/generate-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: q }),
        signal,
      });
      const data = await res.json();
      console.log("[generate-seed] RAG pipeline result:", {
        ok: res.ok, status: res.status,
        hasSeed: !!data.seed, error: data.error,
        provider: data.provider, searchQuery: data.searchQuery,
        tavilySuccess: data.tavilySuccess,
      });
      if (data.seed) {
        seedRef.current = data.seed;
        setSeed(data.seed);
        setGeneratedSeed(data.seed);
        // Store Tavily intel in state + sessionStorage for the results page to pick up
        const q = data.searchQuery || "";
        const ctx = data.tavilyContext || "";
        setTavilyQuery(q);
        setTavilyContext(ctx);
        try {
          sessionStorage.setItem("hemlo_rag_query", q);
          sessionStorage.setItem("hemlo_rag_context", ctx);
        } catch {}
        return true;
      } else {
        const errMsg = data.error || "Seed generation returned empty response";
        console.error("[generate-seed] failed:", errMsg);
        setSeedError(errMsg);
        return false;
      }
    } catch (err) {
      console.error("[generate-seed] fetch error:", err);
      setSeedError("Network error contacting seed generation API");
      return false;
    } finally {
      setIsGeneratingSeed(false);
    }
  };


  // File upload fake
  const handleFileDrop = (e: any) => {
    e.preventDefault();
    setSeed("Loaded from file. Parsing text...");
  }

  const updateStep = (idx: number, status: string, time: string = "") => {
    setActiveStep(idx);
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, time } : s));
  }

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLiveLogs(prev => [...prev.slice(-200), `[${ts}] ${msg}`]);
  }

  const cancelActiveSimulation = async () => {
    if (phase !== "running" && !isLaunching) return;

    cancelRequestedRef.current = true;
    isCompletingRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    esRef.current?.close();
    esRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const simId = currentSimIdRef.current || miroProjectId;
    sessionStorage.removeItem(SESSION_KEY);
    addLog("Simulation cancelled by user.");
    setIsLaunching(false);
    setLaunchError(null);
    setLaunchStep("Cancelled");
    setPhase("idle");
    setEngineStatus("idle");
    setElapsed(0);
    setMiroProjectId(null);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    setLiveTimings({});
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    setSteps(prev => prev.map(s => ({ ...s, status: "pending", time: "" })));

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
    isCompletingRef.current = false;
  };

  const startSimulation = async () => {
    if (!scenario) return;

    cancelRequestedRef.current = false;
    isCompletingRef.current = false;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // ── Step 0: Immediately show the launch overlay so the user knows something is happening
    setIsLaunching(true);
    setLaunchError(null);
    setLaunchStep("Verifying session...");

    // ── Step 1: Auth guard — ensure we have a valid session before any API calls
    try {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        // Attempt a silent refresh first before giving up
        setLaunchStep("Refreshing session...");
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) {
          if (cancelRequestedRef.current || signal.aborted) return;
          setLaunchError("Your session has expired. Please sign in again.");
          return;
        }
      }
    } catch (authErr) {
      if (cancelRequestedRef.current || signal.aborted) return;
      console.error("[mirofish] auth check failed:", authErr);
      setLaunchError("Authentication check failed. Please refresh the page.");
      return;
    }

    // ── Step 1.5: Silent pre-flight limit check (overlay stays alive — error shows inside it)
    try {
      const usageRes = await fetch("/api/usage", { signal });
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        if (usageData.usageToday >= usageData.limit) {
          const isPaid = usageData.tier === "pro" || usageData.tier === "premium" || usageData.tier === "founder" || usageData.tier === "starter";
          setLaunchError(isPaid
            ? `__PAID_LIMIT_REACHED__:${usageData.usageToday}/${usageData.limit} simulations used today on your ${usageData.tier} plan. Your quota resets at midnight UTC.`
            : `__FREE_LIMIT_REACHED__:You've used ${usageData.usageToday}/${usageData.limit} free simulations today. Upgrade to Pro for 50/day.`
          );
          // NOTE: do NOT call setIsLaunching(false) here — React batches state and the overlay
          // would disappear before the error renders. The overlay stays open; user dismisses it.
          setPhase("idle");
          return;
        }
      }
    } catch {
      // Ignore — DB save will catch the limit server-side too
    }

    if (cancelRequestedRef.current || signal.aborted) return;

    // Step 2: Always generate a grounded reality seed (RAG pipeline)
    {
      setLaunchStep("🔍 Step 1/3 — Generating optimized search query...");
      // Small delay so the user sees the first step message
      await new Promise(r => setTimeout(r, 400));
      setLaunchStep("🌐 Step 2/3 — Deep-searching the internet (Tavily)...");
      const genSuccess = await handleGenerateSeed(scenario, (msg) => setLaunchStep(msg), signal);
      if (cancelRequestedRef.current || signal.aborted) return;
      if (!genSuccess) {
        setLaunchError(seedError || "Failed to generate reality seed. Please try again.");
        return;
      }
      setLaunchStep("✅ Reality seed grounded in real-time data. Launching simulation...");
      await new Promise(r => setTimeout(r, 500));
    }

    const activeMarketOutcomes = marketOutcomes;
    const activeMarketType = marketType || (activeMarketOutcomes.length > 2 ? "categorical" : "binary");
    const simulationSeed = appendMarketOutcomesToSeed(seedRef.current || seed || scenario, activeMarketOutcomes);
    if (activeMarketOutcomes.length > 0) {
      seedRef.current = simulationSeed;
      setSeed(simulationSeed);
    }

    // ── Step 3: Transition UI to running state
    setLaunchStep("Creating simulation record...");
    setPhase("running");
    setEngineStatus("queued");
    setElapsed(0);
    setLiveLogs([]);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    setSteps(steps.map(s => ({ ...s, status: "pending", time: "" })));
    
    // ── Step 4: Save placeholder to DB
    let simDbId: string | null = null;
    try {
      const dbDomain = marketStats.id 
        ? `${domain}|${marketStats.id}|${marketStats.vol}|${marketStats.liq}|${marketStats.last}|${marketStats.img}`
        : domain;
        
      const dbRes = await fetch("/api/custom-simulations", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ scenario, domain: dbDomain, reality_seed: simulationSeed, agent_count: agents, rounds, llm_model: llmModel, parallel_gen: parallelGen, platforms: ["twitter", "reddit"] }),
        signal,
      });
      const dbData = await dbRes.json();
      if (dbRes.status === 401) {
        setLaunchError("Session expired. Please sign in and try again.");
        setPhase("idle");
        return;
      }
      if (dbRes.status === 429) {
        const rawErr = dbData.error || "";
        const isPaidLimit = rawErr.startsWith("__PAID_LIMIT_REACHED__");
        const errBody = rawErr.replace(/^__(?:PAID|FREE)_LIMIT_REACHED__:/, "");
        setLaunchError(isPaidLimit
          ? `__PAID_LIMIT_REACHED__:${errBody}`
          : `__FREE_LIMIT_REACHED__:${errBody}`
        );
        setPhase("idle");
        return;
      }
      simDbId = dbData.simulation?.id || null;
      if (simDbId) {
        setMiroProjectId(simDbId);
        currentSimIdRef.current = simDbId;
      }
    } catch (err: any) {
      if (cancelRequestedRef.current || signal.aborted || err?.name === "AbortError") return;
      setLaunchError("Network error creating simulation. Please check your connection.");
      setPhase("idle");
      return;
    }

    // ── Step 5: Connect to Modal engine via SSE
    if (cancelRequestedRef.current || signal.aborted) return;
    setLaunchStep("Connecting to engine...");
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    const startT = Date.now();
    const getT = () => formatSecs(Math.floor((Date.now() - startT)/1000));

    const markFailed = async (msg: string) => {
      if (cancelRequestedRef.current) return;
      addLog(`✗ FAILED: ${msg}`);
      clearInterval(timerRef.current);
      setSteps(prev => prev.map((s, i) => i === activeStep ? {...s, status: "failed"} : s));
      if (simDbId) await fetch("/api/custom-simulations", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id: simDbId, status: "failed"}) }).catch(() => {});
    };

    const MODAL_URL = process.env.NEXT_PUBLIC_MODAL_URL || "https://vaishumaniket--hemlo-mirofish-run-simulation.modal.run";

    if (!simDbId) {
      await markFailed("Could not create simulation in database");
      setIsLaunching(false);
      return;
    }

    try {
      const url = new URL(MODAL_URL);
      url.searchParams.append("question", scenario);
      url.searchParams.append("sim_id", simDbId);
      url.searchParams.append("reality_seed", simulationSeed);
      url.searchParams.append("agent_count", agents.toString());
      url.searchParams.append("rounds", rounds.toString());
      url.searchParams.append("domain", domain);
      if (activeMarketOutcomes.length > 0) {
        url.searchParams.append("market_options", JSON.stringify(activeMarketOutcomes));
        url.searchParams.append("market_type", activeMarketType);
      }

    addLog(`→ Connecting to Modal Serverless Engine...`);

      // ── Frontend step timer: records when each SSE step fires ──────────────
      const _st = stepTimesRef.current;
      const _recordStep = (finished: string, next: string) => {
        const now = Date.now();
        // Only log timing for 'finished' once (guard with _done flag)
        if (_st[finished] && !_st[`${finished}_done`]) {
          _st[`${finished}_done`] = 1;
          const secs = Math.round((now - _st[finished]) / 100) / 10;
          setLiveTimings(t => ({ ...t, [finished]: secs }));
          addLog(`  ⏱ ${finished}: ${secs}s`);
        }
        // Only set start time for 'next' on its first occurrence
        if (!_st[next]) {
          _st[next] = now;
        }
      };

      // Start the pipeline timer on first connection
      _st['init'] = Date.now();

      const es = new EventSource(url.toString());
      esRef.current = es;

      es.onmessage = (e) => {
        if (cancelRequestedRef.current) return;
        // Dismiss the launch overlay on first SSE message
        setIsLaunching(false);
        try {
          if (engineStatus !== "running") setEngineStatus("running");
          const event = JSON.parse(e.data);
          
          if (event.step === "error") {
            es.close();
            markFailed(event.message || "Unknown error from Modal pipeline");
            return;
          }

          if (event.message) addLog(`  [modal] ${event.message}`);

          if (event.step === "init") { updateStep(0, "active"); _st['init'] = _st['init'] || Date.now(); }
          if (event.step === "ontology") { _recordStep('init', 'ontology'); updateStep(0, "active"); }
          if (event.step === "graph_build") { _recordStep('ontology', 'graph_build'); updateStep(0, "active"); }


          if (event.step === "graph_chunk" && event.data?.type && event.data?.items) {
            if (event.data.type === "nodes") {
              graphNodesAccRef.current = [...graphNodesAccRef.current, ...event.data.items];
            } else if (event.data.type === "edges") {
              graphEdgesAccRef.current = [...graphEdgesAccRef.current, ...event.data.items];
            }
          }

          if (event.step === "graph_chunk_done" && event.status === "complete") {
            const nodes = graphNodesAccRef.current;
            const edges = graphEdgesAccRef.current;
            addLog(`  [graph] ✓ ${nodes.length} nodes + ${edges.length} edges received — rendering graph`);
            setSseGraphData({ nodes, edges });
          }

          if (event.step === "graph_update" && event.data) {
            setLiveGraphEvent(event.data);
            if (event.data.type === "add_node" && event.data.node) {
              setSseGraphData(prev => prev ? { nodes: [...prev.nodes, event.data.node], edges: prev.edges } : null);
            } else if (event.data.type === "add_node_with_edge" && event.data.node && event.data.edge) {
              setSseGraphData(prev => prev ? { 
                nodes: [...prev.nodes, event.data.node], 
                edges: [...prev.edges, event.data.edge] 
              } : null);
            }
          }

          if (event.step === "agents") { _recordStep('graph_build', 'agents'); updateStep(1, "active"); }
          if (event.step === "config") { _recordStep('agents', 'config'); updateStep(2, "active"); }
          if (event.step === "simulation") {
            _recordStep('config', 'simulation');

            if (activeStep < 3) {
              updateStep(0, "done", getT());
              updateStep(1, "done", getT());
              updateStep(2, "done", getT());
            }
            updateStep(3, "active");
          }
          if (event.step === "report" || event.step === "persist") { _recordStep('simulation', 'verdict'); updateStep(4, "active"); }

          
          if (event.step === "done" && event.status === "complete") {
            _recordStep('verdict', 'done');
            const totalSecs = _st['init'] ? Math.round((Date.now() - _st['init']) / 100) / 10 : null;
            if (totalSecs) addLog(`  🏁 Total pipeline time: ${totalSecs}s`);

            es.close();
            clearInterval(timerRef.current);
            updateStep(3, "done", getT());
            updateStep(4, "done", getT());
            addLog(`✓ Simulation complete! Saving results...`);
            
            const finalize = () => {
              isCompletingRef.current = true;
              currentSimIdRef.current = null;
              sessionStorage.removeItem(SESSION_KEY);
              router.push(`/simulate/mirofish/${simDbId}`);
            };

            if (event.result) {
              const resultBase = activeMarketOutcomes.length > 0
                ? {
                    ...event.result,
                    options: Array.isArray(event.result.options) && event.result.options.length > 0
                      ? event.result.options
                      : activeMarketOutcomes.map((o) => o.label),
                    market_outcomes: Array.isArray(event.result.market_outcomes) && event.result.market_outcomes.length > 0
                      ? event.result.market_outcomes
                      : activeMarketOutcomes,
                    market_type: event.result.market_type || activeMarketType,
                  }
                : event.result;
              const resultWithMarketOutcomes = marketStats.id || activeMarketOutcomes.length > 0
                ? {
                    ...resultBase,
                    marketInfo: {
                      ...(event.result.marketInfo || {}),
                      source: domain,
                      id: marketStats.id || event.result.marketInfo?.id,
                      volume: marketStats.vol || event.result.marketInfo?.volume || "",
                      liquidity: marketStats.liq || event.result.marketInfo?.liquidity || "",
                      lastTradePrice: marketStats.last || event.result.marketInfo?.lastTradePrice || "",
                      icon: marketStats.img || event.result.marketInfo?.icon || event.result.marketInfo?.image || "",
                      image: marketStats.img || event.result.marketInfo?.image || event.result.marketInfo?.icon || "",
                      marketType: activeMarketType,
                      outcomes: activeMarketOutcomes,
                    },
                  }
                : resultBase;
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
                  completed_at: new Date().toISOString()
                })
              }).then(async (res) => {
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  console.error(`[hemlo] Failed to save result: HTTP ${res.status}`, err);
                  addLog(`⚠ Save returned ${res.status}: ${err.error || "unknown error"}`);
                } else {
                  addLog(`✓ Results saved to database.`);
                }
                finalize();
              }).catch(err => {
                console.error("Failed to save result:", err);
                finalize();
              });
            } else {
              finalize();
            }
          }
        } catch (err) {
          console.error("SSE Parse error", err, e.data);
        }
      };

      es.onerror = () => {
        if (cancelRequestedRef.current) return;
        setIsLaunching(false);
        if (isCompletingRef.current) return;
        es.close();
        isCompletingRef.current = true;
        sessionStorage.removeItem(SESSION_KEY);
        markFailed("Modal stream interrupted. Auto-reconnect disabled to prevent launching a duplicate Modal simulation.");
      };

    } catch (e: any) {
      if (cancelRequestedRef.current || e?.name === "AbortError") return;
      setIsLaunching(false);
      await markFailed(e?.message || String(e));
    }
  };

  // Poll GET-based graph task status
  const pollGraphTask = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        try {
          const r = await fetch(url).then(x => x.json());
          const st = r.data?.status;
          const msg = r.data?.message || "";
          if (msg) addLog(`  [graph] ${msg} (${r.data?.progress || 0}%)`);
          if (st === "completed") resolve();
          else if (st === "failed") reject(new Error(r.data?.error || "Graph build failed"));
          else setTimeout(check, 4000);
        } catch(e) { reject(e); }
      };
      check();
    });
  };

  // Poll prepare status (POST endpoint)
  const pollPrepareStatus = (url: string, taskId: string, simId: string) => {
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        try {
          const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({task_id: taskId, simulation_id: simId}) }).then(x => x.json());
          const st = r.data?.status;
          const msg = r.data?.message || "";
          if (msg) addLog(`  [prepare] ${msg}`);
          if (st === "completed" || r.data?.already_prepared) {
            // Check actual sim state — prepare task can 'complete' but leave sim in 'failed' state
            const simCheck = await fetch(`http://localhost:5001/api/simulation/${simId}`).then(x => x.json());
            if (simCheck.data?.status === "failed") {
              reject(new Error(simCheck.data?.error || "Profile generation failed internally"));
            } else {
              resolve();
            }
          }
          else if (st === "failed") reject(new Error(r.data?.error || "Prepare failed"));
          else setTimeout(check, 4000);
        } catch(e) { reject(e); }
      };
      check();
    });
  };

  // Poll run status (GET endpoint)
  const pollRunStatus = (url: string, simId: string) => {
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        try {
          const r = await fetch(url).then(x => x.json());
          const st = r.data?.runner_status || r.data?.status;
          const round = r.data?.current_round;
          const total = r.data?.total_rounds;
          if (round !== undefined) addLog(`  [sim] Round ${round}/${total} — ${st}`);
          if (st === "completed" || st === "finished") resolve();
          else if (st === "failed" || st === "error") reject(new Error(r.data?.error || "Simulation failed"));
          else setTimeout(check, 5000);
        } catch(e) { reject(e); }
      };
      check();
    });
  };

  // Poll report generation status (POST endpoint)
  const pollReportStatus = (url: string, taskId: string) => {
    return new Promise<void>((resolve, reject) => {
      const check = async () => {
        try {
          const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({task_id: taskId}) }).then(x => x.json());
          const st = r.data?.status;
          const msg = r.data?.message || "";
          if (msg) addLog(`  [report] ${msg}`);
          if (st === "completed") resolve();
          else if (st === "failed") reject(new Error(r.data?.error || "Report failed"));
          else setTimeout(check, 4000);
        } catch(e) { reject(e); }
      };
      check();
    });
  };

  const formatSecs = (s: number) => {
    const m = Math.floor(s/60);
    const ss = s%60;
    return `${m}:${ss<10?'0':''}${ss}`;
  }

  const btnReady = !!scenario && !isGeneratingSeed;
  const isAuthLaunchError = !!launchError
    && !launchError.startsWith("__")
    && /session|sign in|authentication|unauthorized/i.test(launchError);

  const handleSignIn = async () => {
    try {
      setLaunchStep("Redirecting to Google sign in...");
      const supabase = createClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/simulate/mirofish")}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account", access_type: "offline" },
        },
      });
      if (error) setLaunchError(`Sign in failed: ${error.message}`);
    } catch (err: any) {
      setLaunchError(`Sign in failed: ${err?.message || "Please try again."}`);
    }
  };


  return (
    <div style={{ position: "relative", flex: 1, backgroundColor: "#15191d", color: "#ffffff", display: "flex", flexDirection: "column", overflowY: "auto" }}>

      {/* ── LAUNCH OVERLAY: Full-screen animated queue state ─────────────────── */}
      <AnimatePresence>
        {isLaunching && (
          <motion.div
            key="launch-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.92)", backdropFilter: "blur(24px)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 32,
            }}
          >
            {launchError ? (
              /* Error state */
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
              >
                {/* Icon */}
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: launchError.startsWith("__PAID") ? "rgba(99,102,241,0.15)" : launchError.startsWith("__FREE") ? "rgba(255,107,0,0.15)" : "rgba(239,68,68,0.15)",
                  border: launchError.startsWith("__PAID") ? "1px solid rgba(99,102,241,0.4)" : launchError.startsWith("__FREE") ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(239,68,68,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
                }}>
                  {launchError.startsWith("__PAID") ? "📦" : launchError.startsWith("__FREE") ? "⚡" : "✗"}
                </div>

                {/* Title + Message */}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                    {launchError.startsWith("__PAID") ? "Daily Quota Used" : launchError.startsWith("__FREE") ? "Upgrade Required" : "Launch Failed"}
                  </div>
                  <div style={{ fontSize: 13, color: "#aaa", maxWidth: 340, lineHeight: 1.6 }}>
                    {launchError.replace(/^__(?:PAID|FREE)_LIMIT_REACHED__:/, "")}
                  </div>
                </div>

                {/* CTAs */}
                {launchError.startsWith("__PAID") ? (
                  // Paid user — just dismiss, quota resets at midnight
                  <button
                    onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                    style={{
                      padding: "10px 32px", borderRadius: 8, background: "rgba(99,102,241,0.2)",
                      border: "1px solid rgba(99,102,241,0.5)", color: "#a5b4fc", fontSize: 13,
                      fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Got it — Come back tomorrow
                  </button>
                ) : launchError.startsWith("__FREE") ? (
                  // Free user — push to pricing
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                      style={{
                        padding: "10px 24px", borderRadius: 8, background: "transparent",
                        border: "1px solid rgba(255,255,255,0.18)", color: "#888", fontSize: 13, cursor: "pointer",
                      }}
                    >Cancel</button>
                    <button
                      onClick={() => router.push("/pricing")}
                      style={{
                        padding: "10px 28px", borderRadius: 8,
                        background: "linear-gradient(135deg, #FF6B00, #FF3D00)",
                        border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                        boxShadow: "0 4px 20px rgba(255,107,0,0.35)",
                      }}
                    >⚡ Upgrade to Pro</button>
                  </div>
                ) : (
                  // Generic error
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                    <button
                      onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                      style={{
                        padding: "10px 24px", borderRadius: 10, background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13,
                        fontWeight: 700, cursor: "pointer",
                      }}
                    >Dismiss & Retry</button>
                    {isAuthLaunchError && (
                      <button
                        onClick={handleSignIn}
                        style={{
                          padding: "10px 26px", borderRadius: 10, background: "#ffffff",
                          border: "1px solid rgba(255,255,255,0.85)", color: "#000000", fontSize: 13,
                          fontWeight: 800, cursor: "pointer",
                        }}
                      >Sign in with Google</button>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              /* Queue animation state */
              <>
                {/* Pulsing orb */}
                <div style={{ position: "relative", width: 96, height: 96 }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scale: [1, 1.6 + i * 0.3, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
                      style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.25)",
                      }}
                    />
                  ))}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute", inset: 8, borderRadius: "50%",
                      border: "2px solid transparent",
                      borderTopColor: "rgba(255,255,255,0.8)",
                      borderRightColor: "rgba(255,255,255,0.3)",
                    }}
                  />
                  <div style={{
                    position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                  </div>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.4)",
                    letterSpacing: 3, textTransform: "uppercase", marginBottom: 10,
                  }}>
                    Mirofish Engine
                  </div>
                  <motion.div
                    key={launchStep}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}
                  >
                    {launchStep}
                  </motion.div>
                </div>

                {/* Step dots */}
                <div style={{ display: "flex", gap: 8 }}>
                  {["Verifying session", "Generating seed", "Creating record", "Connecting"].map((s, i) => {
                    const stepLabels: Record<string, number> = {
                      "Verifying session...": 0,
                      "Refreshing session...": 0,
                      "Generating reality seed...": 1,
                      "Creating simulation record...": 2,
                      "Connecting to engine...": 3,
                      "Initializing...": 0,
                    };
                    const current = stepLabels[launchStep] ?? 0;
                    const isDone = i < current;
                    const isNow = i === current;
                    return (
                      <motion.div
                        key={s}
                        animate={isNow ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        style={{
                          width: isNow ? 24 : 8, height: 8,
                          borderRadius: 4,
                          background: isDone
                            ? "rgba(255,255,255,0.8)"
                            : isNow
                            ? "rgba(255,255,255,0.9)"
                            : "rgba(255,255,255,0.15)",
                          transition: "width 0.3s, background 0.3s",
                        }}
                      />
                    );
                  })}
                </div>

                <button
                  onClick={() => void cancelActiveSimulation()}
                  style={{
                    position: "absolute", bottom: 32,
                    background: "transparent", border: "none",
                    color: "rgba(255,255,255,0.3)", fontSize: 12, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <NewsTicker initialItems={initialHomeData?.tickerItems as any[] | undefined} />
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>

        {phase === "idle" ? (
          <>
            <div style={{ position: "relative", overflow: "hidden", background: "#15191d", paddingTop: 16 }}>
              <SimulateMarketCarousel
                initialMarkets={initialHomeData?.carouselMarkets as SimulateCarouselMarket[] | undefined}
                onMarketSelect={handleCarouselMarketSelect}
              />

              <AnimatePresence>
                {promptPanelOpen && (
                  <motion.section
                    key="prompt-panel"
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", stiffness: 280, damping: 32 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 40,
                      width: "100%",
                      minHeight: "100%",
                      background: "linear-gradient(180deg, #f8f8f9 0%, #ffffff 100%)",
                      color: "#000000",
                      boxShadow: "-28px 0 80px rgba(0,0,0,0.45)",
                      overflowY: "auto",
                      padding: "clamp(22px, 4vw, 48px)",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 24 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8b8b8b", marginBottom: 6 }}>
                          MiroFish Simulation
                        </div>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 950, lineHeight: 1 }}>
                          {subStep === "prompt" ? "Ask Hemlo" : "Simulation Setup"}
                        </div>
                      </div>
                      <button
                        onClick={() => setPromptPanelOpen(false)}
                        style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid #e5e5e5", background: "#f8f8f8", color: "#111", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
                <AnimatePresence mode="wait">
                  {subStep === "prompt" && (
                    <motion.div
                      key="prompt"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                    >
                      <div style={{ 
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: "clamp(24px, 4.6vw, 36px)", fontWeight: 900, color: "#000000", marginBottom: "40px",
                        textAlign: "center", letterSpacing: "-1px", lineHeight: 1.08, minHeight: "78px",
                        display: "flex", alignItems: "center", justifyContent: "center", maxWidth: "900px"
                      }}>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={rotatingMarketQuestion}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.32 }}
                            style={{ display: "inline-block" }}
                          >
                            {rotatingMarketQuestion}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                      <div style={{ 
                        width: "100%", background: "rgba(10,10,10,0.85)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "24px", padding: "18px 24px",
                        boxShadow: "0 40px 100px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "16px"
                      }}>
                        <textarea
                          value={scenario}
                          onChange={(e) => setScenario(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setSubStep("params"); } }}
                          placeholder="Tell us what you'd like to simulate..."
                          style={{ 
                            width: "100%", background: "transparent", border: "none", color: "#ffffff", 
                            fontSize: "18px", fontWeight: 500, outline: "none", resize: "none", height: "60px", 
                            lineHeight: "22px" 
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button style={{ padding: "0 18px", height: 36, borderRadius: "18px", background: "rgba(10,10,10,0.85)", border: "1px solid rgba(255,255,255,0.05)", color: "#fff", fontSize: "14px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", backdropFilter: "blur(12px)", transition: "all 0.2s" }}>
                               Auto-detect
                            </button>
                          </div>
                          <button 
                            disabled={!scenario}
                            onClick={() => setSubStep("params")} 
                            style={{ 
                              width: 36, height: 36, borderRadius: "50%", background: scenario ? "#000" : "#ccc", border: "none", color: "#fff", 
                              display: "flex", alignItems: "center", justifyContent: "center", cursor: scenario ? "pointer" : "not-allowed", transition: "all 0.2s" 
                            }}
                          >
                            <ArrowRight size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {subStep === "params" && (
                    <motion.div
                      key="params"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{ display: "flex", flexDirection: "column" }}
                    >
                      <button onClick={() => setSubStep("prompt")} style={{ background: "transparent", border: "none", color: "#888", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        BACK TO PROMPT
                      </button>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 900, color: "#000000", marginBottom: 32 }}>
                        Simulation Parameters
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                        {[
                          { id: "standard", label: "Standard", desc: `15 Agents · 5 Rounds ${!isPro ? `(Remaining: ${2 - standardUses}/2)` : ""}`, agents: 15, rounds: 5, pro: false },
                          { id: "super", label: "Super", desc: "100 Agents · 10 Rounds", agents: 100, rounds: 10, pro: true },
                          { id: "deep", label: "Deep", desc: "250 Agents · 15 Rounds", agents: 250, rounds: 15, pro: true },
                          { id: "custom", label: "Custom", desc: "Manually adjust every detail", agents: 50, rounds: 8, pro: false },
                        ].map(opt => {
                          const locked = opt.pro && !isPro;
                          return (
                            <button
                              key={opt.id}
                              disabled={locked}
                              onClick={() => {
                                setDepthMode(opt.id as any);
                                if (opt.id !== "custom") {
                                  setAgents(opt.agents);
                                  setRounds(opt.rounds);
                                }
                              }}
                              style={{
                                padding: "16px", borderRadius: 16, 
                                border: `2px solid ${depthMode === opt.id ? "#000" : "#eee"}`,
                                background: depthMode === opt.id ? "#fff" : "transparent", 
                                textAlign: "left", cursor: locked ? "not-allowed" : "pointer", 
                                transition: "all 0.2s", opacity: locked ? 0.5 : 1,
                                position: "relative"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "#000" }}>{opt.label} Mode</div>
                                {locked && <Lock size={12} color="#888" />}
                              </div>
                              <div style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>{opt.desc}</div>
                              {depthMode === opt.id && <div style={{ position: "absolute", top: 12, right: 12, width: 6, height: 6, borderRadius: "50%", background: "#000" }} />}
                            </button>
                          );
                        })}
                      </div>

                      {depthMode === "custom" && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32, background: "#f8f8f9", padding: 20, borderRadius: 16 }}
                        >
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#666" }}>AGENTS COUNT</span>
                              <span style={{ fontSize: 10, fontWeight: 900, color: "#000" }}>{agents}</span>
                            </div>
                            <input type="range" min="10" max="250" step="10" value={agents} onChange={(e) => setAgents(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#000" }} />
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: "#666" }}>SIMULATION ROUNDS</span>
                              <span style={{ fontSize: 10, fontWeight: 900, color: "#000" }}>{rounds}</span>
                            </div>
                            <input type="range" min="2" max="15" step="1" value={rounds} onChange={(e) => setRounds(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#000" }} />
                          </div>
                        </motion.div>
                      )}


                      <button
                        onClick={() => {
                          if (!isPro && depthMode === "standard" && standardUses >= 2) {
                            alert("You have reached the 2-use limit for Standard mode. Please upgrade to Pro!");
                            return;
                          }
                          if (!isPro && depthMode === "standard") setStandardUses(prev => prev + 1);
                          startSimulation();
                        }}
                        style={{
                          width: "100%", padding: "18px", background: "#000", color: "#fff", borderRadius: 12, fontWeight: 950, fontSize: 16, cursor: "pointer", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", letterSpacing: 1.5
                        }}
                      >
                        LAUNCH SIMULATION
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            <div style={{ maxWidth: 1410, width: "100%", margin: "0 auto", padding: "0 8px 60px" }}>
              <div style={{ paddingTop: 40 }}>
                <TopSimulationsSection />
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: "clamp(20px, 5vw, 40px)", flex: 1, backgroundColor: "#15191d" }}>
            <div className="resp-grid-2" style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 340px", gap: 32 }}>
              
              {/* Main Column: Graph & Logs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ width: 10, height: 10, borderRadius: "50%", background: engineStatus === "queued" ? "#f59e0b" : "#22c55e" }}
                    />
                    {engineStatus === "queued" ? "Engine in Queue..." : "Simulation Running"}
                    <span style={{ fontSize: 14, color: "#aaa", fontWeight: 500 }}>— {formatSecs(elapsed)}</span>
                  </div>
                  <button onClick={() => void cancelActiveSimulation()} style={{ background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.45)", color: "#fecaca", padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700, borderRadius: 8 }}>
                    Cancel run
                  </button>
                </div>

                {/* Traffic Notification Upsell — free tier only */}
                {userTier === "free" && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column", gap: 16, marginBottom: 8 }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "#f59e0b", fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>
                    <div style={{ marginTop: 2 }}>⚠️</div>
                    <div>
                      Simulations might be slow because we're experiencing huge traffic right now. Please do not close this page.
                    </div>
                  </div>
                  <button onClick={() => router.push('/pricing')} style={{ alignSelf: "flex-start", marginLeft: 30, background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(245,158,11,0.2)" }}>
                    <Zap size={16} fill="currentColor" /> Buy Pro to get into Fast Lane
                  </button>
                </motion.div>
                )}

                {/* Big Graph Card */}
                <div style={{ background: "rgba(10,10,10,0.8)", border: "1px solid #222", borderRadius: 24, padding: 24, minHeight: 480, display: "flex", flexDirection: "column" }}>
                   <MirofishGraphPanel projectId={miroProjectId} isSimulating={true} liveData={sseGraphData} liveEvent={liveGraphEvent} />
                </div>

                {/* Logs Section */}
                <div style={{ background: "#050505", border: "1px solid #1f1f1f", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ 
                    padding: "14px 20px", borderBottom: "1px solid #1a1a1a",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "#0a0a0a"
                  }}>
                    <div style={{ fontSize: 11, color: "#fff", fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                      <motion.div
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        style={{ width: 7, height: 7, borderRadius: "50%", background: engineStatus === "running" ? "#22c55e" : "#f59e0b", boxShadow: engineStatus === "running" ? "0 0 8px #22c55e" : "0 0 8px #f59e0b" }}
                      />
                      Live Output Stream
                    </div>
                    <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace", fontWeight: 700 }}>
                      {liveLogs.length} lines
                    </span>
                  </div>
                  <div 
                    ref={logsContainerRef} 
                    style={{ 
                      height: 360, overflowY: "auto", 
                      fontFamily: "'Fira Code', 'Cascadia Code', monospace", 
                      fontSize: 12, lineHeight: 1.7,
                      padding: "16px 20px",
                      scrollbarWidth: "thin",
                      scrollbarColor: "#222 transparent"
                    }}
                  >
                    {liveLogs.length === 0 && (
                      <div style={{ color: "#333", fontStyle: "italic" }}>Waiting for pipeline signals...</div>
                    )}
                    {liveLogs.map((log, i) => {
                      const isSuccess = log.includes("✓") || log.includes("✅");
                      const isError   = log.includes("✗") || log.includes("FAIL");
                      const isWarn    = log.includes("⚠");
                      const isRound   = log.includes("Round") || log.includes("▶");
                      const color = isError ? "#ef4444" : isSuccess ? "#22c55e" : isWarn ? "#f59e0b" : isRound ? "#a78bfa" : "#888";
                      return (
                        <div key={i} style={{ color, marginBottom: 3, wordBreak: "break-word" }}>
                          {log}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Sidebar: Workflow Pipeline */}
              <div style={{ position: "sticky", top: 40, height: "fit-content" }}>
                 <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 2, fontWeight: 900, marginBottom: 32 }}>
                    Workflow Pipeline
                 </div>
                 
                 <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
                    <div style={{ position: "absolute", left: 15, top: 0, bottom: 0, width: 1, background: "#1a1a1a", zIndex: 0 }} />
                    
                    {steps.map((s, i) => {
                      const isActive = activeStep === i;
                      const isDone = s.status === "done";
                      return (
                        <div key={i} style={{ display: "flex", gap: 20, marginBottom: 32, position: "relative", zIndex: 1 }}>
                           <div style={{ 
                             width: 32, height: 32, borderRadius: "50%", 
                             background: isDone ? "#22c55e" : isActive ? "#fff" : "#000",
                             border: `1px solid ${isDone ? "#22c55e" : isActive ? "#fff" : "#222"}`,
                             display: "flex", alignItems: "center", justifyContent: "center",
                             fontSize: 10, fontWeight: 900, color: isDone || isActive ? "#000" : "#444",
                             transition: "all 0.3s"
                           }}>
                              {isDone ? "✓" : `0${i+1}`}
                           </div>
                           <div style={{ flex: 1, paddingTop: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: isDone || isActive ? "#fff" : "#444", marginBottom: 4 }}>
                                {s.label}
                              </div>
                              <div style={{ fontSize: 11, color: isDone || isActive ? "#888" : "#222", lineHeight: 1.4 }}>
                                {s.sub}
                              </div>
                              {isDone && s.time && (
                                <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, marginTop: 4 }}>
                                   Completed in {s.time}
                                </div>
                              )}
                           </div>
                        </div>
                      )
                    })}
                 </div>

                 <div style={{ marginTop: 40, padding: 20, background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)", borderRadius: 16, border: "1px solid #222" }}>
                    <div style={{ fontSize: 10, color: "#555", fontWeight: 800, marginBottom: 8 }}>ENGINE ESTIMATE</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>
                       {estMins}m {estSecs}s
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                       Allocating {agents} agents across 2 nodes
                    </div>
                 </div>

                 {/* Live Step Timing Panel — fills in as each step completes */}
                 {Object.keys(liveTimings).length > 0 && (
                   <div style={{ marginTop: 16, padding: 16, background: "#0a0a0a", borderRadius: 16, border: "1px solid #1a1a1a" }}>
                     <div style={{ fontSize: 10, color: "#555", fontWeight: 800, marginBottom: 12, letterSpacing: 1.5 }}>⏱ STEP TIMING</div>
                     {(["init","ontology","graph_build","agents","config","simulation","verdict"] as const)
                       .filter(k => liveTimings[k] !== undefined)
                       .map(step => {
                         const label: Record<string,string> = { init:"Init", ontology:"Ontology", graph_build:"Graph Build", agents:"Agents", config:"Config", simulation:"Simulation", verdict:"Verdict" };
                         const secs = liveTimings[step];
                         const color = secs < 10 ? "#22c55e" : secs < 45 ? "#f59e0b" : "#ef4444";
                         const runningTotal = Object.values(liveTimings).reduce((a,b) => a+b, 0) || 1;
                         const pct = Math.min(100, Math.round((secs / runningTotal) * 100));
                         return (
                           <div key={step} style={{ marginBottom: 10 }}>
                             <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                               <span style={{ fontSize: 11, color: "#888" }}>{label[step]}</span>
                               <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "monospace" }}>{secs}s</span>
                             </div>
                             <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                               <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
                             </div>
                           </div>
                         );
                       })}
                     <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a1a1a", display: "flex", justifyContent: "space-between" }}>
                       <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>TOTAL</span>
                       <span style={{ fontSize: 11, fontWeight: 900, color: "#22c55e", fontFamily: "monospace" }}>
                         {Object.values(liveTimings).reduce((a,b) => a+b, 0).toFixed(1)}s
                       </span>
                     </div>
                   </div>
                 )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense to avoid de-opt errors with useSearchParams
export default function MirofishTerminalPage({ initialHomeData }: { initialHomeData?: SimulateHomeData }) {
  return (
    <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }} />}>
      <MirofishTerminalContent initialHomeData={initialHomeData} />
    </Suspense>
  );
}
