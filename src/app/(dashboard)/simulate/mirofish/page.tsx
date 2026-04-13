"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, ArrowRight, Check, Lock,
  DollarSign, BarChart2, MessageCircle, Brain
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AgentNetworkCanvas } from "@/components/agent-network-canvas";
import { MirofishGraphPanel } from "@/components/mirofish-graph-panel";

// ── DOMAIN PILLS ──────────────────────────────────────────────────────────────
const DOMAINS = [
  { id: "stocks", label: "Stocks" },
  { id: "polymarket", label: "Polymarket" },
  { id: "geopolitics", label: "Geopolitics" },
  { id: "social", label: "Social" },
  { id: "custom", label: "Custom" },
];

const DOMAIN_EXAMPLES: Record<string, string> = {
  stocks: "What public opinion trends would emerge if the Fed announced emergency rate cuts?",
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
  const [seedMode, setSeedMode] = useState<"write" | "upload" | "auto">("write");
  const [depthLevel, setDepthLevel] = useState<"standard" | "deep" | "super">("standard");
  const [agents, setAgents] = useState(25);
  const [rounds, setRounds] = useState(6);
  const [parallelGen, setParallelGen] = useState(3);
  const [llmModel, setLlmModel] = useState("deepseek-v3");

  const [isPro] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [seedError, setSeedError] = useState("");
  
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
  const logsEndRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef(0); // mirror of activeStep for use inside closures

  // Computed
  // Accurate runtime estimate: each "batch" takes ~2.5s, plus 60s fixed setup overhead
  const estimatedSeconds = Math.round((agents * rounds) / parallelGen * 2.5) + 60;
  const estMins = Math.floor(estimatedSeconds / 60);
  const estSecs = estimatedSeconds % 60;
  
  // ── PERSIST running state to sessionStorage so navigation away doesn't lose it
  useEffect(() => {
    if (phase === "running" && miroProjectId) {
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
    try {
      const saved = JSON.parse(raw);
      if (saved.phase !== "running" || !saved.miroProjectId) return;

      // Restore state
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

      // Restart elapsed timer
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);

      // Reconnect SSE to Modal
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
            sessionStorage.removeItem(SESSION_KEY);
            router.push(`/simulate/mirofish/${simDbId}`);
          }
          if (event.step === "error") {
            es.close();
            clearInterval(timerRef.current);
            addLogR(`✗ FAILED: ${event.message || "Unknown error"}`);
            sessionStorage.removeItem(SESSION_KEY);
          }
        } catch (err) { console.error("SSE reconnect parse error", err); }
      };

      es.onerror = () => {
        es.close();
        clearInterval(timerRef.current);
        addLogR("✗ Connection to Modal engine lost after reconnect.");
        sessionStorage.removeItem(SESSION_KEY);
      };

    } catch (e) { console.error("[mirofish] sessionStorage restore error", e); }
  }, []); // run once on mount

  useEffect(() => {
    // Health check via server-side proxy (avoids CORS on direct localhost fetch)
    fetch("/api/mirofish-health").then(r => setServerReady(r.ok)).catch(() => setServerReady(false));
    // Fetch user sims
    fetch("/api/custom-simulations").then(r => r.json()).then(d => setPastSims(d.simulations || []));
  }, []);

  // Auto-scroll logs to bottom on new entry
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

    // If auto mode is selected, generate seed FIRST before proceeding
    if (seedMode === "auto") {
      const genSuccess = await handleGenerateSeed(scenario);
      if (!genSuccess) return; // abort start if seed generation fails
    }

    setPhase("running");
    setElapsed(0);
    setLiveLogs([]);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    setSteps(steps.map(s => ({ ...s, status: "pending", time: "" })));
    
    // Save placeholder to DB
    let simDbId: string | null = null;
    try {
      const dbRes = await fetch("/api/custom-simulations", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ scenario, domain, reality_seed: seedRef.current || seed || scenario, agent_count: agents, rounds, llm_model: llmModel, parallel_gen: parallelGen, platforms: ["twitter", "reddit"] })
      });
      const dbData = await dbRes.json();
      simDbId = dbData.simulation?.id || null;
      if (simDbId) setMiroProjectId(simDbId);
    } catch {}
    
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    const startT = Date.now();
    const MIRO = "http://localhost:5001";
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
        try {
          const event = JSON.parse(e.data);
          
          if (event.step === "error") {
            es.close();
            markFailed(event.message || "Unknown error from Modal pipeline");
            return;
          }

          if (event.message) addLog(`  [modal] ${event.message}`);

          // Map the Modal pipeline steps to the UI steps
          if (event.step === "init") updateStep(0, "active");
          if (event.step === "ontology" || event.step === "graph_build") updateStep(0, "active");

          // graph_chunk: accumulate nodes/edges as they stream in
          if (event.step === "graph_chunk" && event.data?.type && event.data?.items) {
            if (event.data.type === "nodes") {
              graphNodesAccRef.current = [...graphNodesAccRef.current, ...event.data.items];
            } else if (event.data.type === "edges") {
              graphEdgesAccRef.current = [...graphEdgesAccRef.current, ...event.data.items];
            }
          }

          // graph_chunk_done: all chunks received — commit to state and render
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
            router.push(`/simulate/mirofish/${simDbId}`);
          }
        } catch (err) {
          console.error("SSE Parse error", err, e.data);
        }
      };

      es.onerror = (err) => {
        es.close();
        markFailed("Connection to Modal engine lost.");
      };

    } catch (e: any) {
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
    <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh", fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-primary)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
      
      <div style={{ padding: "clamp(24px, 5vw, 60px) clamp(16px, 4vw, 40px)", flex: 1, position: "relative" }}>
        
        {/* TOP SPLIT */}
        <div className="poly-layout" style={{ display: "grid", gridTemplateColumns: "38% 1fr", gap: "clamp(20px, 4vw, 40px)", maxWidth: 1200, margin: "0 auto" }}>
          
          {/* LEFT PANEL */}
          <div className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            
            {/* System Status */}
            <div className="hide-mobile" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>System status</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <div style={{ width: 12, height: 12, background: serverReady ? "#22c55e" : "#ef4444", borderRadius: "50%", boxShadow: serverReady ? "0 0 10px rgba(34,197,94,0.4)" : "0 0 10px rgba(239,68,68,0.4)" }} />
                <div style={{ fontSize: 28, fontWeight: 800, color: serverReady ? "#fff" : "var(--text-muted)", lineHeight: 1 }}>{serverReady ? "Engine Ready" : "Offline"}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {serverReady 
                  ? "The prediction engine is online. Upload a reality seed and define your scenario to begin parallel agent simulation." 
                  : "MiroFish engine is unreachable. Please verify localhost connection."}
              </div>
            </div>

            {/* Stats Block */}
            <div className="resp-grid-2 hide-mobile" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(12px, 3vw, 20px)" }}>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>low cost</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Each simulation<br/>costs ~$0.10-0.50</div>
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>High Availability</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>Up to 1,000,000<br/>agents simulated</div>
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>Fast</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>25 agents runs<br/>in ~28 seconds</div>
              </div>
              <div>
                <div style={{ color: "#fff", fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>Accurate</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>87% avg confidence<br/>across all sims</div>
              </div>
            </div>

            {/* Workflow Sequence (Desktop only) */}
            <div className="hide-mobile" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Workflow pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {steps.map((s, i) => {
                  const isActive = phase === "running" && activeStep === i;
                  const isDone = s.status === "done";
                  
                  return (
                  <div key={i} style={{ display: "flex", gap: 16 }}>
                    <div style={{ fontSize: 16, color: isActive ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800 }}>
                      0{i+1}
                    </div>
                    <div>
                      <div style={{ color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        {s.label}
                        {isActive && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={14} color="var(--accent)" /></motion.div>}
                        {isDone && <Check size={14} color="#22c55e" />}
                        {s.time && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontWeight: 600 }}>{s.time}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontWeight: 500 }}>
                        {s.sub}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </div>

          </div>


          {/* RIGHT PANEL */}
          <div className="miro-right" style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            
            {phase === "running" ? (
              
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

                {/* ── Running Header ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.6)" }}
                    />
                    Simulation Running
                    <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>— {formatSecs(elapsed)} elapsed</span>
                  </div>
                  <button
                    onClick={() => { sessionStorage.removeItem(SESSION_KEY); window.location.reload(); }}
                    style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, borderRadius: 8 }}
                  >
                    Cancel
                  </button>
                </div>

                {/* ── Real MiroFish Graph RAG Visualization ── */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>Knowledge Graph — RAG Build</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>Live stream from Production Engine</div>
                  </div>
                  <MirofishGraphPanel projectId={miroProjectId} isSimulating={true} liveData={sseGraphData} liveEvent={liveGraphEvent} />
                </div>

                {/* ── Live Engine Log ── */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 16 }}>Live Engine Output</div>
                  <div style={{ background: "#020408", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, height: 200, overflowY: "auto", padding: "14px 18px", fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 12 }}>
                    {liveLogs.length === 0 && (
                      <div style={{ color: "rgba(255,255,255,0.2)" }}>Waiting for engine response...</div>
                    )}
                    {liveLogs.map((log, i) => (
                      <div key={i} style={{
                        color: log.includes("✓") ? "#22c55e"
                          : log.includes("✗") || log.includes("FAILED") ? "#ef4444"
                          : log.includes("→") ? "var(--text-primary)"
                          : "rgba(255,255,255,0.45)",
                        lineHeight: 1.8,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all"
                      }}>
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>

                {/* Workflow Sequence moved here so it only shows when deployed and at the bottom */}
                <div className="mobile-only" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Workflow pipeline</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {steps.map((s, i) => {
                      const isActive = phase === "running" && activeStep === i;
                      const isDone = s.status === "done";
                      
                      return (
                      <div key={i} style={{ display: "flex", gap: 16 }}>
                        <div style={{ fontSize: 16, color: isActive ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800 }}>
                          0{i+1}
                        </div>
                        <div>
                          <div style={{ color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800, fontSize: 14, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                            {s.label}
                            {isActive && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={14} color="var(--accent)" /></motion.div>}
                            {isDone && <Check size={14} color="#22c55e" />}
                            {s.time && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", fontWeight: 600 }}>{s.time}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, fontWeight: 500 }}>
                            {s.sub}
                          </div>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>

              </div>

            ) : (

              <>
              {/* 01 Reality Seed */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 18 }}>01. Reality Seed</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13, fontWeight: 500 }}>Context document for the simulation</div>
                </div>

                {/* Mode selector — big buttons */}
                <div className="resp-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                  {[
                    { id: "write" as const, label: "Write it", sub: "Type or paste context" },
                    { id: "upload" as const, label: "Upload file", sub: "PDF, MD, TXT" },
                    { id: "auto" as const, label: "Auto-generate", sub: "Generate from prompt" },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSeedMode(m.id); setSeed(""); }}
                      style={{
                        padding: "16px 14px",
                        background: seedMode === m.id ? "rgba(255,107,0,0.08)" : "transparent",
                        border: `1px solid ${seedMode === m.id ? "var(--accent)" : "var(--border)"}`,
                        color: seedMode === m.id ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer",
                        borderRadius: 12,
                        textAlign: "left" as const,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: seedMode === m.id ? "#aaa" : "#555" }}>{m.sub}</div>
                    </button>
                  ))}
                </div>

                {/* Write mode */}
                {seedMode === "write" && (
                  <textarea
                    value={seed}
                    onChange={(e) => { seedRef.current = e.target.value; setSeed(e.target.value); }}
                    placeholder={`Paste or write your reality seed here...\nDescribe key actors, events, context, and relationships.\nThe more detail you provide, the better the intelligence will be.`}
                    style={{ width: "100%", height: 180, background: "#050810", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", padding: 20, fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                  />
                )}

                {/* Upload mode */}
                {seedMode === "upload" && (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setSeed(ev.target?.result as string || "");
                      reader.readAsText(file);
                    }}
                    onClick={() => { const i = document.createElement("input"); i.type = "file"; i.accept = ".pdf,.md,.txt"; i.onchange = (e: any) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setSeed(ev.target?.result as string || ""); r.readAsText(f); }; i.click(); }}
                    style={{ border: "1px dashed #444", padding: "48px 32px", textAlign: "center", background: "#111", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 28, color: "#444", marginBottom: 12 }}>↑</div>
                    <div style={{ color: "#aaa", fontSize: 14, marginBottom: 6 }}>Drag and drop a file</div>
                    <div style={{ color: "#666", fontSize: 12 }}>or click to browse — PDF, MD, TXT</div>
                    {seed && <div style={{ marginTop: 16, fontSize: 12, color: "#cccccc" }}>✓ File loaded ({seed.length} chars)</div>}
                  </div>
                )}

                {/* Auto-generate mode */}
                {seedMode === "auto" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 12, color: "#888" }}>Generates a detailed context document from your scenario prompt using Gemini Flash.</div>
                    <button
                      onClick={() => handleGenerateSeed()}
                      disabled={isGeneratingSeed || !scenario.trim()}
                      style={{ padding: "16px", background: isGeneratingSeed ? "var(--bg-card)" : "var(--accent)", border: "none", borderRadius: 12, color: isGeneratingSeed ? "var(--text-muted)" : "#000", cursor: isGeneratingSeed || !scenario.trim() ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      {isGeneratingSeed ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} /></motion.div> Generating Seed...</>) : "Generate seed from scenario prompt"}
                    </button>
                    {!scenario.trim() && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Fill in the scenario prompt below first.</div>}
                    {seed && (
                      <div style={{ border: "1px solid var(--border)", padding: 20, borderRadius: 12, background: "#050810", position: "relative" }}>
                        <div style={{ position: "absolute", top: 12, right: 16, fontSize: 12, color: "var(--text-muted)", cursor: "pointer", fontWeight: 700 }} onClick={() => setSeed("")}>Clear</div>
                        <textarea value={seed} onChange={(e) => { seedRef.current = e.target.value; setSeed(e.target.value); }} style={{ width: "100%", height: 120, background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 02 Parameters */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 18, marginBottom: 20 }}>02. Simulation Parameters</div>
                
                <div className="resp-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { id: "standard" as const, label: "Standard", desc: "25 agents • 6 rounds • DeepSeek V3", agents: 25, rounds: 6, gen: 3, model: "deepseek-v3" },
                    { id: "deep" as const, label: "Deep", desc: "100 agents • 12 rounds • GPT-4o Mini", agents: 100, rounds: 12, gen: 5, model: "gpt-4o-mini" },
                    { id: "super" as const, label: "Super", desc: "500 agents • 24 rounds • Qwen", agents: 500, rounds: 24, gen: 10, model: "qwen" }
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      onClick={() => {
                        setDepthLevel(lvl.id);
                        setAgents(lvl.agents);
                        setRounds(lvl.rounds);
                        setParallelGen(lvl.gen);
                        setLlmModel(lvl.model);
                      }}
                      style={{
                        padding: "20px 16px",
                        background: depthLevel === lvl.id ? "rgba(255,107,0,0.08)" : "transparent",
                        border: `1px solid ${depthLevel === lvl.id ? "var(--accent)" : "var(--border)"}`,
                        color: depthLevel === lvl.id ? "var(--text-primary)" : "var(--text-muted)",
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        transition: "all 0.1s"
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase" }}>{lvl.label}</div>
                      <div style={{ fontSize: 10, lineHeight: 1.4 }}>{lvl.desc}</div>
                    </button>
                  ))}
                </div>

                <div style={{ marginTop: 24, fontSize: 11, color: "#888" }}>
                  Estimated runtime: ~{estMins > 0 ? `${estMins} minutes ` : ""}{estSecs} seconds
                </div>
              </div>


              {/* 03 Prompt */}
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>03. Simulated Prompt Words</div>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {DOMAINS.map(d => (
                    <button key={d.id} onClick={() => handleDomain(d.id)} style={{ padding: "6px 14px", background: domain === d.id ? "rgba(255,255,255,0.1)" : "transparent", borderRadius: 99, border: `1px solid ${domain === d.id ? "var(--text-primary)" : "var(--border)"}`, color: domain === d.id ? "var(--text-primary)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                      {d.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder={`Use natural language to define your scenario...\ne.g. "What public opinion trends would emerge..."`}
                  style={{ width: "100%", height: 160, background: "#050810", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", padding: 20, fontSize: 14, outline: "none", resize: "vertical", lineHeight: 1.5 }}
                />
                
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "#666" }}>
                  <div>{scenario.length} characters</div>
                  <div>Engine: MiroFish-V1.0</div>
                </div>
              </div>


              {/* Generating seed banner */}
              {isGeneratingSeed && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0d1a0d", border: "1px solid #1a4a1a", color: "#5a9a5a", fontSize: 12, fontFamily: "monospace" }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={13} />
                  </motion.div>
                  ⚙ Generating 500-word reality seed via DeepSeek… Start button will enable when complete.
                </div>
              )}

              {/* Seed error banner */}
              {seedError && !isGeneratingSeed && (
                <div style={{ padding: "10px 14px", background: "#1a0d0d", border: "1px solid #4a1a1a", color: "#ff6666", fontSize: 12, fontFamily: "monospace" }}>
                  ✗ Seed generation failed: {seedError}
                  <button onClick={() => handleGenerateSeed()} style={{ marginLeft: 12, background: "transparent", border: "1px solid #ff6666", color: "#ff6666", cursor: "pointer", padding: "2px 8px", fontSize: 11, fontFamily: "monospace" }}>
                    Retry
                  </button>
                </div>
              )}

              {/* Launch */}
              <button
                onClick={startSimulation}
                disabled={!btnReady}
                style={{ 
                  width: "100%", padding: "18px 24px", background: btnReady ? "var(--accent)" : "var(--border)", color: btnReady ? "#000" : "var(--text-muted)",
                  border: "none", borderRadius: 16, fontSize: 18, fontWeight: 800, cursor: btnReady ? "pointer" : "not-allowed",
                  display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s"
                }}
              >
                <span>DEPLOY SIMULATION</span>
                <ArrowRight size={18} />
              </button>

              </>
            )}

          </div>
        </div>

        {/* BOTTOM TABLE */}
        <div style={{ maxWidth: 1200, margin: "60px auto 0", borderTop: "1px solid #222", paddingTop: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>◇ Previous simulations</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #333", textAlign: "left", color: "#666" }}>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>#</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Scenario</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Domain</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Agents</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Rounds</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Status</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Date</th>
                <th style={{ padding: "12px 8px", fontWeight: "normal" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pastSims.map((sim, idx) => {
                const isFail = sim.status === "failed";
                const isRun = sim.status === "running" || sim.status === "pending";
                return (
                <tr key={sim.id} style={{ borderBottom: "1px solid #222", color: "#ccc" }}>
                  <td style={{ padding: "12px 8px" }}>0{idx+1}</td>
                  <td style={{ padding: "12px 8px" }}>{sim.scenario.substring(0, 40)}{sim.scenario.length > 40 ? "..." : ""}</td>
                  <td style={{ padding: "12px 8px", textTransform: "capitalize" }}>{sim.domain}</td>
                  <td style={{ padding: "12px 8px" }}>{sim.agent_count}</td>
                  <td style={{ padding: "12px 8px" }}>{sim.rounds}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <span style={{ color: isFail ? "#888888" : isRun ? "#ffffff" : "#cccccc" }}>
                      {sim.status.charAt(0).toUpperCase() + sim.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 8px", color: "#777" }}>{new Date(sim.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: "12px 8px" }}>
                    <Link href={`/simulate/mirofish/${sim.id}`} style={{ color: "#fff", textDecoration: "none" }}>
                      {[isRun ? "[Live →]" : "[View →]"]}
                    </Link>
                  </td>
                </tr>
              )})}
              {pastSims.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "24px 8px", textAlign: "center", color: "#555" }}>No previous simulations found.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>

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
