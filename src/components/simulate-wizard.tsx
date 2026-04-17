"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, ExternalLink, ArrowRight, Brain, Beaker, FileText, Settings2, PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { MirofishGraphPanel } from "@/components/mirofish-graph-panel";

export function SimulateWizard({ defaultDomain = "polymarket" }: { defaultDomain?: string }) {
  const router = useRouter();

  // Wizard state
  const [uiStep, setUiStep] = useState(0); // 0: Scenario, 1: Reality Seed, 2: Parameters, 3: Running

  // Simulation settings
  const [domain] = useState(defaultDomain);
  const [scenario, setScenario] = useState("");
  const [seed, setSeed] = useState("");
  const seedRef = useRef(""); 
  const [seedMode, setSeedMode] = useState<"write" | "upload" | "auto">("write");
  const [depthLevel, setDepthLevel] = useState<"standard" | "deep" | "super">("standard");
  const [agents, setAgents] = useState(25);
  const [rounds, setRounds] = useState(6);
  const [parallelGen, setParallelGen] = useState(3);
  const [llmModel, setLlmModel] = useState("deepseek-v3");

  const [isGeneratingSeed, setIsGeneratingSeed] = useState(false);
  const [seedError, setSeedError] = useState("");
  
  // Running State
  const [engineStatus, setEngineStatus] = useState<"idle" | "queued" | "running">("idle");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const esRef = useRef<EventSource | null>(null); 

  const SESSION_KEY = "hemlo_running_sim_wizard";

  const [activeStep, setActiveStep] = useState(0);
  const [steps, setSteps] = useState([
    { label: "Map Construction", sub: "Reality seed extraction & memory injection", status: "pending", time: "" },
    { label: "Environment Setup", sub: "Entity relationship extraction & persona generation", status: "pending", time: "" },
    { label: "Agent Generation", sub: "Profile generation & LLM allocation", status: "pending", time: "" },
    { label: "Simulation Rounds", sub: "Dual-platform parallel simulation", status: "pending", time: "" },
    { label: "Report Generation", sub: "Deep analysis & structured prediction", status: "pending", time: "" }
  ]);

  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [miroProjectId, setMiroProjectId] = useState<string | null>(null);
  const [sseGraphData, setSseGraphData] = useState<{nodes: any[], edges: any[]} | null>(null);
  const [liveGraphEvent, setLiveGraphEvent] = useState<any>(null);
  const graphNodesAccRef = useRef<any[]>([]);
  const graphEdgesAccRef = useRef<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Restore logic
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (saved.uiStep !== 3 || !saved.miroProjectId) return;

      setUiStep(3);
      setEngineStatus("running");
      setElapsed(saved.elapsed ?? 0);
      setActiveStep(saved.activeStep ?? 0);
      setSteps(saved.steps ?? steps);
      setLiveLogs(saved.liveLogs ?? []);
      setMiroProjectId(saved.miroProjectId);
      if (saved.scenario) setScenario(saved.scenario);
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
      url.searchParams.append("domain", domain);

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
    } catch (e) { console.error("[mirofish wizard] sessionStorage error", e); }
  }, []);

  // Persist running state
  useEffect(() => {
    if (uiStep === 3 && miroProjectId) {
      const payload = { uiStep, elapsed, activeStep, steps, liveLogs, miroProjectId, scenario, agents, rounds };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    }
  }, [uiStep, elapsed, activeStep, steps, liveLogs, miroProjectId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveLogs]);

  const handleGenerateSeed = async (): Promise<boolean> => {
    if (!scenario) return false;
    setIsGeneratingSeed(true);
    setSeedError("");
    try {
      const res = await fetch("/api/generate-seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) });
      const data = await res.json();
      if (data.seed) {
        seedRef.current = data.seed;
        setSeed(data.seed);
        setSeedMode("write");
        return true;
      } else {
        setSeedError(data.error || "Seed generation returned empty response");
        return false;
      }
    } catch (err) {
      setSeedError("Network error contacting seed generation API");
      return false;
    } finally {
      setIsGeneratingSeed(false);
    }
  };

  const updateStep = (idx: number, status: string, time: string = "") => {
    setActiveStep(idx);
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status, time } : s));
  };

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLiveLogs(prev => [...prev.slice(-200), `[${ts}] ${msg}`]);
  };

  const formatSecs = (s: number) => {
    const m = Math.floor(s/60);
    const ss = s%60;
    return `${m}:${ss<10?'0':''}${ss}`;
  };

  const startSimulation = async () => {
    if (!scenario) return;
    
    setUiStep(3);
    setEngineStatus("queued");
    setElapsed(0);
    setLiveLogs([]);
    setSseGraphData(null);
    setLiveGraphEvent(null);
    graphNodesAccRef.current = [];
    graphEdgesAccRef.current = [];
    setSteps(steps.map(s => ({ ...s, status: "pending", time: "" })));
    
    if (seedMode === "auto" && !seed) {
      addLog(`→ Auto-generating context seed from your prompt...`);
      const genSuccess = await handleGenerateSeed();
      if (!genSuccess) {
         addLog(`✗ FAILED: Could not auto-generate seed!`);
         setEngineStatus("idle");
         return; 
      }
    }

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
            if (event.data.type === "nodes") graphNodesAccRef.current = [...graphNodesAccRef.current, ...event.data.items];
            else if (event.data.type === "edges") graphEdgesAccRef.current = [...graphEdgesAccRef.current, ...event.data.items];
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
            router.push(`/simulate/mirofish/${simDbId}`);
          }
        } catch (err) { console.error("SSE Parse error", err, e.data); }
      };

      es.onerror = (err) => {
        es.close();
        markFailed("Connection to Modal engine lost.");
      };
    } catch (e: any) { await markFailed(e?.message || String(e)); }
  };

  const slideVariants = {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
    exit: { opacity: 0, x: -40, transition: { duration: 0.2, ease: "easeIn" as const } }
  };

  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
      
      {/* Dynamic Header */}
      <div style={{ padding: "24px 30px", borderBottom: "1px solid var(--border)", background: "#050810", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        
        {uiStep < 3 ? (
          <div>
            <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              MiroFish Engine
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800 }}>
              {uiStep === 0 && "Define Scenario"}
              {uiStep === 1 && "Inject Reality Seed"}
              {uiStep === 2 && "Tuning & Execution"}
            </div>
          </div>
        ) : (
           <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: 10, height: 10, borderRadius: "50%", background: engineStatus === "queued" ? "#f59e0b" : "#22c55e", boxShadow: engineStatus === "queued" ? "0 0 12px rgba(245,158,11,0.6)" : "0 0 12px rgba(34,197,94,0.6)" }}
            />
            {engineStatus === "queued" ? "Engine in Queue..." : "Simulation Running"}
            <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>— {formatSecs(elapsed)} elapsed</span>
          </div>
        )}

        {/* Stepper Dots */}
        {uiStep < 3 && (
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 1, 2].map(step => (
              <div 
                key={step} 
                style={{
                  width: step === uiStep ? 24 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: step === uiStep ? "var(--accent)" : step < uiStep ? "#ccff0080" : "var(--border)",
                  transition: "all 0.3s"
                }} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Wizard Area */}
      <div style={{ flex: 1, position: "relative", overflowY: "auto", overflowX: "hidden", padding: "30px" }}>
        <AnimatePresence mode="wait">
          
          {/* STEP 0: Scenario */}
          {uiStep === 0 && (
            <motion.div key="step0" variants={slideVariants} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 640 }}>
               <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                 What polymarket, geopolitical scenario, or public discourse trend do you want to resolve logically?
               </div>
               
               <textarea
                 value={scenario}
                 onChange={(e) => setScenario(e.target.value)}
                 placeholder="e.g. How would Polymarket odds shift if Trump announced 50% tariffs on the EU immediately?"
                 style={{ 
                   width: "100%", height: 160, background: "#050810", 
                   border: "1px solid var(--border)", borderRadius: 12, 
                   color: "var(--text-primary)", padding: 20, fontSize: 16, 
                   outline: "none", resize: "none", lineHeight: 1.6,
                   boxShadow: "inset 0 2px 10px rgba(0,0,0,0.4)"
                 }}
                 autoFocus
               />

               <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", justifyContent: "flex-end" }}>
                 <motion.button
                   whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                   disabled={!scenario.trim()}
                   onClick={() => setUiStep(1)}
                   style={{
                     padding: "14px 28px", background: scenario.trim() ? "var(--accent)" : "#222", 
                     color: scenario.trim() ? "#000" : "#555", borderRadius: 12, fontWeight: 800, fontSize: 15,
                     border: "none", cursor: scenario.trim() ? "pointer" : "not-allowed",
                     display: "flex", alignItems: "center", gap: 10
                   }}
                 >
                   Inject Context <ArrowRight size={18} />
                 </motion.button>
               </div>
            </motion.div>
          )}

          {/* STEP 1: Reality Seed */}
          {uiStep === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 640 }}>
               
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                 <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
                   Provide background context. A rich Reality Seed drastically improves intelligence mapping.
                 </div>
               </div>

                {/* Mode selector */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                  {[
                    { id: "auto" as const, label: "Auto-generate", icon: <Brain size={16}/>, sub: "AI extrapolates context" },
                    { id: "write" as const, label: "Manual Input", icon: <FileText size={16}/>, sub: "Type or paste details" },
                    { id: "upload" as const, label: "Upload File", icon: <ExternalLink size={16}/>, sub: "PDF, MD, TXT" },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setSeedMode(m.id); setSeed(""); }}
                      style={{
                        padding: "16px 14px",
                        background: seedMode === m.id ? "rgba(204,255,0,0.08)" : "#050810",
                        border: `1px solid ${seedMode === m.id ? "var(--accent)" : "var(--border)"}`,
                        color: seedMode === m.id ? "var(--text-primary)" : "var(--text-muted)",
                        cursor: "pointer",
                        borderRadius: 12,
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>
                        {m.icon} {m.label}
                      </div>
                      <div style={{ fontSize: 10, color: seedMode === m.id ? "var(--accent)" : "#555", opacity: 0.7 }}>{m.sub}</div>
                    </button>
                  ))}
                </div>

                {seedMode === "write" && (
                  <textarea
                    value={seed}
                    onChange={(e) => { seedRef.current = e.target.value; setSeed(e.target.value); }}
                    placeholder={`Paste or write your reality seed here...\nDescribe key actors, events, context, and relationships.`}
                    style={{ flex: 1, minHeight: 180, background: "#050810", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-primary)", padding: 20, fontSize: 14, outline: "none", resize: "none", lineHeight: 1.6 }}
                  />
                )}

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
                    style={{ flex: 1, minHeight: 180, border: "1px dashed var(--border)", borderRadius: 12, padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#050810", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: 24, color: "#444", marginBottom: 12 }}>↑</div>
                    <div style={{ color: "#aaa", fontSize: 14, marginBottom: 6 }}>Drag and drop a file</div>
                    <div style={{ color: "#666", fontSize: 12 }}>or click to browse — PDF, MD, TXT</div>
                    {seed && <div style={{ marginTop: 16, fontSize: 12, color: "var(--accent)" }}>✓ File loaded ({seed.length} chars)</div>}
                  </div>
                )}

                {seedMode === "auto" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", background: "#050810", border: "1px solid var(--border)", borderRadius: 12, padding: 32 }}>
                    <div style={{ textAlign: "center", marginBottom: 20 }}>
                      <Brain size={48} color="var(--accent)" style={{ opacity: 0.5, marginBottom: 16 }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Automated Seed Generation</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 300, margin: "0 auto" }}>We will securely query the LLM to map out the geopolitical context of your scenario automatically before running the simulation.</div>
                    </div>
                  </div>
                )}

               <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", justifyContent: "space-between" }}>
                 <button onClick={() => setUiStep(0)} style={{ padding: "14px 24px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Back</button>
                 <motion.button
                   whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                   onClick={() => setUiStep(2)}
                   style={{
                     padding: "14px 28px", background: "var(--accent)", 
                     color: "#000", borderRadius: 12, fontWeight: 800, fontSize: 15,
                     border: "none", cursor: "pointer",
                     display: "flex", alignItems: "center", gap: 10
                   }}
                 >
                   Simulation Settings <Settings2 size={18} />
                 </motion.button>
               </div>
            </motion.div>
          )}

          {/* STEP 2: Parameters & Launch */}
          {uiStep === 2 && (
            <motion.div key="step2" variants={slideVariants} initial="hidden" animate="visible" exit="exit" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 640 }}>
               
               <div style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                 Determine the depth of the simulation grid. Higher tiers compute more network reactions but take longer.
               </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {[
                    { id: "standard" as const, label: "Standard", desc: "25 agents • 6 rounds • DeepSeek V3", time: "~28s", agents: 25, rounds: 6, gen: 3, model: "deepseek-v3" },
                    { id: "deep" as const, label: "Deep", desc: "100 agents • 12 rounds • GPT-4o Mini", time: "~1m 45s", agents: 100, rounds: 12, gen: 5, model: "gpt-4o-mini" },
                    { id: "super" as const, label: "Super", desc: "500 agents • 24 rounds • Qwen", time: "~8m", agents: 500, rounds: 24, gen: 10, model: "qwen" }
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
                        padding: "20px",
                        background: depthLevel === lvl.id ? "rgba(204,255,0,0.08)" : "#050810",
                        border: `1px solid ${depthLevel === lvl.id ? "var(--accent)" : "var(--border)"}`,
                        color: depthLevel === lvl.id ? "var(--text-primary)" : "var(--text-muted)",
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.1s"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>{lvl.label}</div>
                        <div style={{ fontSize: 12, color: depthLevel === lvl.id ? "var(--text-secondary)" : "#666" }}>{lvl.desc}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: depthLevel === lvl.id ? "var(--accent)" : "#555" }}>{lvl.time}</div>
                    </button>
                  ))}
                </div>

               <div style={{ marginTop: "auto", paddingTop: 24, display: "flex", justifyContent: "space-between" }}>
                 <button onClick={() => setUiStep(1)} style={{ padding: "14px 24px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Back</button>
                 <motion.button
                   whileHover={{ scale: 1.02, boxShadow: "0 4px 24px rgba(204,255,0,0.3)" }} 
                   whileTap={{ scale: 0.98 }}
                   onClick={startSimulation}
                   style={{
                     padding: "14px 28px", background: "var(--text-primary)", 
                     color: "var(--bg-primary)", borderRadius: 12, fontWeight: 900, fontSize: 15,
                     border: "none", cursor: "pointer",
                     display: "flex", alignItems: "center", gap: 10,
                     letterSpacing: 1, textTransform: "uppercase"
                   }}
                 >
                   Launch Simulation <PlayCircle size={18} />
                 </motion.button>
               </div>
            </motion.div>
          )}

          {/* STEP 3: Running (Graphs and Logs) */}
          {uiStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                {/* Visualizer */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>Knowledge Graph Extraction</div>
                    <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, background: "rgba(204,255,0,0.1)", padding: "2px 8px", borderRadius: 4 }}>Production Engine Core</div>
                  </div>
                  <MirofishGraphPanel projectId={miroProjectId} isSimulating={true} liveData={sseGraphData} liveEvent={liveGraphEvent} />
                </div>

                {/* Workflow Sequence & Logs grid */}
                <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24 }}>
                  
                  {/* Sequence */}
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Operation Status</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {steps.map((s, i) => {
                        const isActive = activeStep === i;
                        const isDone = s.status === "done";
                        
                        return (
                        <div key={i} style={{ display: "flex", gap: 16 }}>
                          <div style={{ fontSize: 14, color: isActive ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800 }}>
                            {i+1}
                          </div>
                          <div>
                            <div style={{ color: isActive ? "var(--accent)" : isDone ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 800, fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                              {s.label}
                              {isActive && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={12} color="var(--accent)" /></motion.div>}
                              {isDone && <Check size={12} color="#22c55e" />}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, fontWeight: 500 }}>
                              {s.sub}
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>

                  {/* Logs */}
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 16 }}>Serverless Pipe Output</div>
                    <div style={{ flex: 1, background: "#020408", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, minHeight: 250, overflowY: "auto", padding: "14px 18px", fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: 12 }}>
                      {liveLogs.length === 0 && (
                        <div style={{ color: "rgba(255,255,255,0.2)" }}>Waiting for container start...</div>
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

                </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
