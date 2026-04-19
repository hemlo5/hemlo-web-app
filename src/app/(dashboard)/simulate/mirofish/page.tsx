"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, ArrowRight, Check, Lock
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { MirofishGraphPanel } from "@/components/mirofish-graph-panel";
import { TopSimulationsSection } from "@/components/top-simulations-section";

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


function MirofishTerminalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Settings
  const [domain, setDomain] = useState("custom");
  const [scenario, setScenario] = useState("");
  const [seed, setSeed] = useState("");
  const seedRef = useRef(""); // keep ref in sync so startSimulation always reads latest
  const [seedMode, setSeedMode] = useState<"write" | "upload" | "auto">("auto");
  const [depthLevel, setDepthLevel] = useState<"standard" | "deep" | "super">("standard");
  const [agents, setAgents] = useState(25);
  const [rounds, setRounds] = useState(6);
  const [parallelGen, setParallelGen] = useState(3);
  const [llmModel, setLlmModel] = useState("deepseek-v3");

  const [subStep, setSubStep] = useState<"prompt" | "seed" | "params">("prompt");
  const [depthMode, setDepthMode] = useState<"standard" | "super" | "deep" | "custom">("standard");
  const [standardUses, setStandardUses] = useState(0); // For free tier limit demo

  const [isPro] = useState(true);
  const [engineStatus, setEngineStatus] = useState<"idle" | "queued" | "running">("idle");
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [seedError, setSeedError] = useState("");

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
    const seedParam = searchParams.get("seed");

    if (s) setScenario(s);
    if (d) setDomain(d);
    if (a) setAgents(parseInt(a) || 100);
    if (r) setRounds(parseInt(r) || 10);
    if (seedParam) {
      seedRef.current = seedParam;
      setSeed(seedParam);
      setSeedMode("write");
    }
    const sm = searchParams.get("seedMode");
    if (sm === "auto" || sm === "write" || sm === "upload") {
      setSeedMode(sm as any);
    }
  }, [searchParams]);

  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null); // keep SSE ref for reconnect
  // Prevents the persist effect from re-writing sessionStorage AFTER a done/error
  // handler has already cleared it (React state batching race condition).
  const isCompletingRef = useRef(false);

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

  // Computed
  // Accurate runtime estimate: each "batch" takes ~2.5s, plus 60s fixed setup overhead
  const estimatedSeconds = Math.round((agents * rounds) / parallelGen * 2.5) + 60;
  const estMins = Math.floor(estimatedSeconds / 60);
  const estSecs = estimatedSeconds % 60;
  
  // ── PERSIST running state to sessionStorage so navigation away doesn't lose it
  useEffect(() => {
    if (phase === "running" && miroProjectId && !isCompletingRef.current) {
      const payload = { phase, elapsed, activeStep, steps, liveLogs, miroProjectId, scenario, domain, agents, rounds, llmModel, parallelGen };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }
  }, [phase, elapsed, activeStep, steps, liveLogs, miroProjectId]);

  // Keep activeStepRef in sync
  useEffect(() => { activeStepRef.current = activeStep; }, [activeStep]);

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
        if (existing?.status === "completed" || existing?.status === "failed") {
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
      if (saved.scenario) setScenario(saved.scenario);
      if (saved.domain) setDomain(saved.domain);
      if (saved.agents) setAgents(saved.agents);
      if (saved.rounds) setRounds(saved.rounds);

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
      url.searchParams.append("reality_seed", saved.scenario || "");
      url.searchParams.append("agent_count", String(saved.agents || 25));
      url.searchParams.append("rounds", String(saved.rounds || 6));
      url.searchParams.append("domain", saved.domain || "custom");

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
        es.close();
        clearInterval(timerRef.current);
        addLogR("✗ Connection to Modal engine lost after reconnect.");
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

  const handleGenerateSeed = async (scenarioOverride?: string): Promise<boolean> => {
    const q = scenarioOverride || scenario;
    if (!q) return false;
    setIsGeneratingSeed(true);
    setSeedError("");
    try {
      const res = await fetch("/api/generate-seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario: q }) });
      const data = await res.json();
      console.log("[generate-seed] response:", { ok: res.ok, status: res.status, hasSeed: !!data.seed, error: data.error, provider: data.provider });
      if (data.seed) {
        seedRef.current = data.seed;
        setSeed(data.seed);
        setGeneratedSeed(data.seed);
        setSeedMode("write");
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

  const startSimulation = async () => {
    if (!scenario) return;

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
          setLaunchError("Your session has expired. Please sign in again.");
          return;
        }
      }
    } catch (authErr) {
      console.error("[mirofish] auth check failed:", authErr);
      setLaunchError("Authentication check failed. Please refresh the page.");
      return;
    }

    // ── Step 2: Generate reality seed if auto mode
    if (seedMode === "auto") {
      setLaunchStep("Generating reality seed...");
      const genSuccess = await handleGenerateSeed(scenario);
      if (!genSuccess) {
        setLaunchError(seedError || "Failed to generate reality seed. Please try again.");
        return;
      }
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
      const dbRes = await fetch("/api/custom-simulations", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ scenario, domain, reality_seed: seedRef.current || seed || scenario, agent_count: agents, rounds, llm_model: llmModel, parallel_gen: parallelGen, platforms: ["twitter", "reddit"] })
      });
      const dbData = await dbRes.json();
      if (dbRes.status === 401) {
        setLaunchError("Session expired. Please sign in and try again.");
        setPhase("idle");
        return;
      }
      if (dbRes.status === 429) {
        setLaunchError(dbData.error || "Daily limit reached. Please upgrade to run more simulations.");
        setPhase("idle");
        return;
      }
      simDbId = dbData.simulation?.id || null;
      if (simDbId) setMiroProjectId(simDbId);
    } catch {
      setLaunchError("Network error creating simulation. Please check your connection.");
      setPhase("idle");
      return;
    }

    // ── Step 5: Connect to Modal engine via SSE
    setLaunchStep("Connecting to engine...");
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    const startT = Date.now();
    const getT = () => formatSecs(Math.floor((Date.now() - startT)/1000));

    const markFailed = async (msg: string) => {
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
      url.searchParams.append("reality_seed", seedRef.current || seed || scenario);
      url.searchParams.append("agent_count", agents.toString());
      url.searchParams.append("rounds", rounds.toString());
      url.searchParams.append("domain", domain);

      addLog(`→ Connecting to Modal Serverless Engine...`);
      
      const es = new EventSource(url.toString());

      es.onmessage = (e) => {
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

          if (event.step === "init") updateStep(0, "active");
          if (event.step === "ontology" || event.step === "graph_build") updateStep(0, "active");

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

          if (event.step === "agents") updateStep(1, "active");
          if (event.step === "config") updateStep(2, "active");
          if (event.step === "simulation") {
            if (activeStep < 3) {
              updateStep(0, "done", getT());
              updateStep(1, "done", getT());
              updateStep(2, "done", getT());
            }
            updateStep(3, "active");
          }
          if (event.step === "report" || event.step === "persist") updateStep(4, "active");
          
          if (event.step === "done" && event.status === "complete") {
            es.close();
            clearInterval(timerRef.current);
            updateStep(3, "done", getT());
            updateStep(4, "done", getT());
            addLog(`✓ Simulation complete! Redirecting...`);
            // Set completing flag FIRST — blocks the persist effect from re-writing
            // sessionStorage due to React's batched state updates.
            isCompletingRef.current = true;
            sessionStorage.removeItem(SESSION_KEY);
            router.push(`/simulate/mirofish/${simDbId}`);
          }
        } catch (err) {
          console.error("SSE Parse error", err, e.data);
        }
      };

      es.onerror = () => {
        setIsLaunching(false);
        es.close();
        isCompletingRef.current = true;
        sessionStorage.removeItem(SESSION_KEY);
        markFailed("Connection to Modal engine lost.");
      };

    } catch (e: any) {
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

  const btnReady = !!scenario && (seedMode === "auto" || seed || scenario) && !isGeneratingSeed;


  return (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "#000000", color: "#ffffff", display: "flex", flexDirection: "column" }}>

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
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: launchError.includes("limit") ? "rgba(255,107,0,0.15)" : "rgba(239,68,68,0.15)", border: launchError.includes("limit") ? "1px solid rgba(255,107,0,0.4)" : "1px solid rgba(239,68,68,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28,
                }}>
                  {launchError.includes("limit") ? "⚡" : "✕"}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                    {launchError.includes("limit") ? "Daily Limit Reached" : "Launch Failed"}
                  </div>
                  <div style={{ fontSize: 13, color: "#999", maxWidth: 320 }}>{launchError}</div>
                </div>
                {launchError.includes("limit") ? (
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                      style={{
                        padding: "10px 24px", borderRadius: 8, background: "transparent",
                        border: "1px solid rgba(255,255,255,0.2)", color: "#ccc", fontSize: 13, cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => router.push("/pricing")}
                      style={{
                        padding: "10px 24px", borderRadius: 8, background: "#FF6B00",
                        border: "none", color: "#000", fontSize: 13, fontWeight: "bold", cursor: "pointer",
                      }}
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setIsLaunching(false); setLaunchError(null); }}
                    style={{
                      padding: "10px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontSize: 13,
                      fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Dismiss & Retry
                  </button>
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
                  onClick={() => { setIsLaunching(false); setPhase("idle"); }}
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

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>

        {phase === "idle" ? (
          <>
            {/* Mirofish White Setup Zone */}
            <div style={{ width: "100%", backgroundColor: "#ffffff", padding: "60px 20px", borderBottom: "1px solid #eaeaea" }}>
              <div style={{ maxWidth: 800, margin: "0 auto" }}>
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
                        fontSize: "36px", fontWeight: 900, color: "#000000", marginBottom: "40px",
                        textAlign: "center", letterSpacing: "-1px"
                      }}>
                        What are you thinking about today?
                      </div>
                      <div style={{ 
                        width: "100%", background: "rgba(10,10,10,0.85)", backdropFilter: "blur(18px)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "24px", padding: "18px 24px",
                        boxShadow: "0 40px 100px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", gap: "16px"
                      }}>
                        <textarea
                          value={scenario}
                          onChange={(e) => setScenario(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setSubStep("seed"); } }}
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
                            onClick={() => setSubStep("seed")} 
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

                  {subStep === "seed" && (
                    <motion.div
                      key="seed"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      style={{ display: "flex", flexDirection: "column" }}
                    >
                      <button onClick={() => setSubStep("prompt")} style={{ background: "transparent", border: "none", color: "#888", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        ← BACK TO PROMPT
                      </button>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 900, color: "#000000", marginBottom: 8 }}>
                        Reality Seed
                      </div>
                      <div style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>
                        Provide context or data for the simulation to ground itself in.
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                        {[
                          { id: "auto", label: "Autogenerate", desc: "AI builds a seed from your prompt" },
                          { id: "write", label: "Write Manually", desc: "Input your own context text" },
                          { id: "upload", label: "Upload File", desc: "PDF, TXT or CSV contextual data" },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setSeedMode(opt.id as any)}
                            style={{
                              padding: 20, borderRadius: 16, border: `2px solid ${seedMode === opt.id ? "#000" : "#eee"}`,
                              background: seedMode === opt.id ? "#fff" : "transparent", textAlign: "left", cursor: "pointer", transition: "all 0.2s"
                            }}
                          >
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#000", marginBottom: 4 }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {seedMode === "write" && (
                        <textarea
                          value={seed}
                          onChange={(e) => { setSeed(e.target.value); seedRef.current = e.target.value; }}
                          placeholder="Paste your context here..."
                          style={{ width: "100%", height: 120, background: "#f5f5f7", border: "1px solid #e5e5e7", borderRadius: 12, padding: 16, fontSize: 14, outline: "none", marginBottom: 24 }}
                        />
                      )}

                      <button
                        onClick={() => setSubStep("params")}
                        style={{
                          width: "100%", padding: "16px", background: "#000", color: "#fff", borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: "pointer", border: "none"
                        }}
                      >
                        CONTINUE TO PARAMETERS
                      </button>
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
                      <button onClick={() => setSubStep("seed")} style={{ background: "transparent", border: "none", color: "#888", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        ← BACK TO SEED
                      </button>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "28px", fontWeight: 900, color: "#000000", marginBottom: 32 }}>
                        Simulation Parameters
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
                        {[
                          { id: "standard", label: "Standard", desc: `25 Agents · 6 Rounds ${!isPro ? `(Remaining: ${2 - standardUses}/2)` : ""}`, agents: 25, rounds: 6, pro: false },
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
            </div>

            <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "60px 20px" }}>
              <div style={{ borderTop: "1px solid #222222", paddingTop: 40 }}>
                <TopSimulationsSection />
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: "clamp(20px, 5vw, 40px)", flex: 1, backgroundColor: "#000000" }}>
            <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 340px", gap: 32 }}>
              
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
                  <button onClick={() => { sessionStorage.removeItem('hemlo_running_sim'); window.location.reload(); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#ccc", padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
                    Cancel
                  </button>
                </div>

                {/* Big Graph Card */}
                <div style={{ background: "rgba(10,10,10,0.8)", border: "1px solid #222", borderRadius: 24, padding: 24, minHeight: 480, display: "flex", flexDirection: "column" }}>
                   <MirofishGraphPanel projectId={miroProjectId} isSimulating={true} liveData={sseGraphData} liveEvent={liveGraphEvent} />
                </div>

                {/* Logs Section */}
                <div style={{ background: "#0c0c0c", border: "1px solid #1a1a1a", borderRadius: 16, padding: "20px" }}>
                  <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#444" }} />
                    Live Output Stream
                  </div>
                  <div ref={logsContainerRef} style={{ height: 200, overflowY: "auto", fontFamily: "'Fira Code', monospace", fontSize: 12, scrollbarWidth: "none" }}>
                    {liveLogs.length === 0 && <div style={{ color: "rgba(255,255,255,0.1)" }}>Waiting for pipeline signals...</div>}
                    {liveLogs.map((log, i) => (
                      <div key={i} style={{ color: log.includes("✓") ? "#22c55e" : log.includes("✗") ? "#ef4444" : "#888", marginBottom: 6, lineHeight: 1.5 }}>
                        {log}
                      </div>
                    ))}
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
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrap in Suspense to avoid de-opt errors with useSearchParams
export default function MirofishTerminalPage() {
  return (
    <Suspense fallback={<div style={{ background: "#0a0a0a", minHeight: "100vh" }} />}>
      <MirofishTerminalContent />
    </Suspense>
  );
}
