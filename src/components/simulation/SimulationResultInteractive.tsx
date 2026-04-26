"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Share2, FileDown, RefreshCw, Loader2, ChevronDown, ChevronRight, MessageSquare, Send, CheckCircle2, TrendingUp, TrendingDown, Terminal, Activity, Droplets, Clock, History, BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export interface SimulationPayload {
  id: string;
  scenario: string;
  status: string;
  runtime_seconds: number;
  agent_count: number;
  rounds: number;
  domain: string;
  created_at: string;
  reality_seed: string;
  result: any;
  analysis_data?: any;
  report_text?: string;
  round_logs?: any[];
  primary_probability?: number;
  options?: string[];
}

export default function SimulationResultInteractive({ initialData }: { initialData: SimulationPayload }) {
  const router = useRouter();
  const data = initialData;

  // Derive domain info early so hooks can reference it
  const parsedDomain = data.domain || "";
  const baseDomain = parsedDomain.includes("|") ? parsedDomain.split("|")[0] : parsedDomain;
  const marketSlug = parsedDomain.includes("|") ? parsedDomain.split("|")[1] : "";

  const [openRaw, setOpenRaw] = useState(false);
  const [openIntel, setOpenIntel] = useState(true);
  const [ragQuery, setRagQuery] = useState("");
  const [ragContext, setRagContext] = useState("");
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>(() => {
    return { 0: true };
  });
  
  // Replaced old feedTab with new 3-tab layout state
  const [activeTab, setActiveTab] = useState<"timeline" | "stream">("timeline");
  const [showPolymarket, setShowPolymarket] = useState(false);
  const [polyMarketData, setPolyMarketData] = useState<any>(null);
  const [polyMarketLoading, setPolyMarketLoading] = useState(false);
  const [chartHistory, setChartHistory] = useState<{t:number;p:number}[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const [verdict, setVerdict] = useState<string>("");
  const [verdictLoading, setVerdictLoading] = useState(false);

  // Extract enriched result fields from backend
  const backendVerdict: string = data.result?.verdict || data.result?.tldr || "";
  const backendConfidence: string = data.result?.confidence || "";
  const keyFactors: string[] = Array.isArray(data.result?.key_factors) ? data.result.key_factors : [];
  const personaHighlights: {name: string; role: string; stance: string; impact: string}[] = 
    Array.isArray(data.result?.persona_highlights) ? data.result.persona_highlights : [];
  const agentList: {name: string; bio: string; type: string; persona: string}[] =
    Array.isArray(data.result?.agents) ? data.result.agents : [];

  // Read Tavily RAG intel from sessionStorage
  useEffect(() => {
    try {
      const q = sessionStorage.getItem("hemlo_rag_query") || "";
      const ctx = sessionStorage.getItem("hemlo_rag_context") || "";
      if (q) setRagQuery(q);
      if (ctx) setRagContext(ctx);
    } catch {}
  }, []);

  // Fetch Polymarket live data when panel is toggled on
  useEffect(() => {
    if (!showPolymarket || !marketSlug || polyMarketData) return;
    setPolyMarketLoading(true);
    fetch(`/api/polymarket-market?slug=${encodeURIComponent(marketSlug)}`)
      .then(r => r.json())
      .then(d => {
        setPolyMarketData(d);
        // Fetch chart history for the first market's YES token
        const tokenId = d?.markets?.[0]?.clobTokenIds?.[0];
        if (tokenId) {
          setChartLoading(true);
          fetch(`/api/polymarket-history?tokenId=${encodeURIComponent(tokenId)}&interval=1w&fidelity=60`)
            .then(r => r.json())
            .then(h => setChartHistory(h.history || []))
            .catch(() => setChartHistory([]))
            .finally(() => setChartLoading(false));
        }
      })
      .catch(() => setPolyMarketData(null))
      .finally(() => setPolyMarketLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPolymarket]);

  // "Peek" hint: briefly slide in Polymarket panel on load so user knows it's there
  useEffect(() => {
    if (!marketSlug || baseDomain.toLowerCase() !== "polymarket") return;
    // Wait for page to settle, then peek
    const peekIn = setTimeout(() => setShowPolymarket(true), 1800);
    // Slide back after 1.8s of showing
    const peekOut = setTimeout(() => setShowPolymarket(false), 3600);
    return () => { clearTimeout(peekIn); clearTimeout(peekOut); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use backend verdict if available, otherwise call /api/sim-qa
  useEffect(() => {
    // If backend already gave us a verdict, use it directly
    if (backendVerdict) {
      setVerdict(backendVerdict);
      return;
    }
    const reportTextRaw = data?.result?.report_text || data?.report_text || data?.result?.report?.report_text || "";
    if (!reportTextRaw) return;
    if (verdict || verdictLoading) return;
    setVerdictLoading(true);
    fetch("/api/sim-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: data.scenario,
        scenario: data.scenario,
        report_text: reportTextRaw,
        round_logs: data.result?.round_logs || data.round_logs || [],
      }),
    })
      .then(r => r.json())
      .then(d => setVerdict(d.answer || ""))
      .catch(() => setVerdict(""))
      .finally(() => setVerdictLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const toggleRound = (idx: number) => setOpenRounds(prev => ({ ...prev, [idx]: !prev[idx] }));

  const roundLogsData = data.result?.round_logs || data.round_logs;
  const logEntries: any[] = Array.isArray(roundLogsData)
    ? roundLogsData
    : roundLogsData ? Object.values(roundLogsData) : [];

  const allEvents: any[] = [];
  logEntries.forEach((r: any, roundIdx: number) => {
    (Array.isArray(r?.sample_posts) ? r.sample_posts : []).forEach((p: any, pi: number) => {
      allEvents.push({ agent: p.agent || p.agent_name || "Agent", platform: p.platform || "", action: p.action || p.action_type || "POST", content: p.content || p.text || p.result?.content || "", round: roundIdx, idx: pi });
    });
  });

  const totalEvents = allEvents.length;
  const totalYes = logEntries.reduce((s: number, r: any) => s + (r?.yes || 0), 0);
  const totalNo  = logEntries.reduce((s: number, r: any) => s + (r?.no  || 0), 0);

  const hemloPct = (() => {
    if (data.result?.primary_probability != null) return Math.round(data.result.primary_probability);
    if (data.primary_probability != null) return Math.round(data.primary_probability);
    if (data.result?.bullish_pct != null) return Math.round(data.result.bullish_pct);
    if (data.result?.final_probability != null) return Math.round(data.result.final_probability * 100);
    if (totalYes + totalNo > 0) return Math.round((totalYes / (totalYes + totalNo)) * 100);
    return null;
  })();

  // Derive the actual market option names from whichever data source is available.
  // Priority: Polymarket probabilityModel keys → explicit options array → "Yes"/"No" default
  const outcomeLabels: [string, string] = (() => {
    // 1. Polymarket/Kalshi path: analysis_data has probabilityModel with real option keys
    const probModel = data.analysis_data?.probabilityModel || data.result?.probabilityModel;
    if (probModel?.hemloModel) {
      const keys = Object.keys(probModel.hemloModel);
      if (keys.length >= 2) return [keys[0], keys[1]] as [string, string];
      if (keys.length === 1) return [keys[0], `Not ${keys[0]}`] as [string, string];
    }
    if (probModel?.predictionMarket) {
      const keys = Object.keys(probModel.predictionMarket);
      if (keys.length >= 2) return [keys[0], keys[1]] as [string, string];
      if (keys.length === 1) return [keys[0], `Not ${keys[0]}`] as [string, string];
    }
    // 2. Explicit options array saved on the simulation record
    const opts = data.result?.options || data.options;
    if (Array.isArray(opts) && opts.length >= 2) return [opts[0], opts[1]] as [string, string];
    if (Array.isArray(opts) && opts.length === 1) return [opts[0], `Not ${opts[0]}`] as [string, string];
    // 3. Default binary Yes / No
    return ["Yes", "No"];
  })();

  const reportText: string = data.result?.report_text || data.report_text || data.result?.report?.report_text || data.result?.markdown_content || "";

  const getInitials = (name: string) => {
    const p = (name || "A").trim().split(/\s+/);
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : (name[0] || "A").toUpperCase();
  };

  // Extract Market Metrics if available, otherwise default fallbacks
  const marketStats = (() => {
    // 1. Check if market stats were packed into the domain string (e.g. "polymarket|0x123|vol|liq|last")
    const dStr = data.domain || "";
    if (dStr.includes("|")) {
      const parts = dStr.split("|");
      if (parts.length >= 6) {
        return {
          volume: parts[2],
          liquidity: parts[3] === "0" ? "Unknown" : parts[3],
          lastTrade: parts[4] === "0" ? "Unknown" : `$${parts[4]}`,
          timeLeft: "Live",
          image: parts.slice(5).join("|") || ""
        };
      }
      if (parts.length >= 5) {
        return {
          volume: parts[2],
          liquidity: parts[3] === "0" ? "Unknown" : parts[3],
          lastTrade: parts[4] === "0" ? "Unknown" : `$${parts[4]}`,
          timeLeft: "Live"
        };
      }
    }
    
    // 2. Fallback to analysis_data or default fallbacks
    const mkt = data.analysis_data?.predictionMarket || data.result?.marketInfo || {};
    return {
      volume: mkt.volume !== undefined ? `$${Number(mkt.volume).toLocaleString()}` : "$2.4M",
      liquidity: mkt.liquidity !== undefined ? `$${Number(mkt.liquidity).toLocaleString()}` : "$485K",
      lastTrade: mkt.lastTrade || "Just now",
      timeLeft: mkt.endDate ? new Date(mkt.endDate).toLocaleDateString() : "3 days"
    };
  })();



  // Hydration-safe date formatting
  const [dateStr, setDateStr] = useState<string>("");
  useEffect(() => {
    if (data.created_at) setDateStr(new Date(data.created_at).toLocaleString());
  }, [data.created_at]);

  return (
    <div className="h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col pt-10">
      <div className="flex-1 w-full max-w-[1600px] mx-auto px-6 pb-10 min-h-0">
        {/* 70 / 30 SPLIT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">

          {/* ── LEFT COLUMN (~66%) ──────────────────────────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-6 h-full overflow-y-auto sim-scroll pr-2 pb-10">

            {/* Question Header */}
            <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 mb-4 bg-white p-5 sm:p-6 rounded-none shadow-[0_8px_30px_rgba(255,255,255,0.1)]">
                {marketStats.image && (
                  <img src={marketStats.image} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-black/10 shrink-0 shadow-sm" onError={e => e.currentTarget.style.display = 'none'} />
                )}
                <div className="flex flex-col gap-2">
                  <h1 className="text-3xl md:text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight text-black pb-1">
                    &ldquo;{data.scenario}&rdquo;
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm font-mono text-zinc-500 uppercase tracking-wide">
                <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-inner">
                  {baseDomain}
                </span>
                <span>{dateStr || "Loading date..."}</span>
              </div>
            </motion.div>

            {/* ① Probability Spread (Moved from Right Column) */}
            <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="pt-4 pb-6 w-[94%] xl:w-[96%] self-center">
              <div className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase mb-6">Hemlo Probability</div>

              {/* Option 1 */}
              <div className="mb-7">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs font-bold tracking-widest text-emerald-400/80 uppercase">{outcomeLabels[0]}</span>
                  <span className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_16px_rgba(52,211,153,0.5)] tracking-tighter px-3 py-1 bg-emerald-400/10 rounded-xl border border-emerald-400/20">
                    {hemloPct !== null ? `${Math.round(hemloPct)}%` : "—"}
                  </span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: hemloPct !== null ? `${Math.round(hemloPct)}%` : "0%" }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
                  />
                </div>
              </div>

              {/* Option 2 */}
              <div className="mb-8">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-xs font-bold tracking-widest text-rose-400/80 uppercase">{outcomeLabels[1]}</span>
                  <span className="text-4xl font-black text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.5)] tracking-tighter px-3 py-1 bg-rose-400/10 rounded-xl border border-rose-400/20">
                    {hemloPct !== null ? `${100 - Math.round(hemloPct)}%` : "—"}
                  </span>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: hemloPct !== null ? `${100 - Math.round(hemloPct)}%` : "0%" }}
                    transition={{ duration: 1.0, ease: "easeOut", delay: 0.1 }}
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                  />
                </div>
              </div>

              {/* Agent Volume Bar — BIG */}
              <div className="mt-2 p-5 bg-zinc-900/60 border border-white/8 rounded-2xl">
                <div className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase mb-4">Agent Volume ({totalEvents} actions)</div>
                <div className="h-8 bg-zinc-900 rounded-xl overflow-hidden flex border border-white/5 shadow-inner mb-4">
                  {totalYes + totalNo > 0 ? (
                    <>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(totalYes / (totalYes + totalNo)) * 100}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(totalNo / (totalYes + totalNo)) * 100}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-rose-500 to-rose-600"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <span className="text-[10px] text-zinc-600 font-mono">No agent data yet</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-[13px] font-mono font-black">
                  <span className="text-emerald-400 flex items-center gap-2 bg-emerald-400/10 px-3 py-1.5 rounded-lg border border-emerald-400/20">
                    <TrendingUp size={13}/> {totalYes} {outcomeLabels[0]}
                  </span>
                  <span className="text-rose-400 flex items-center gap-2 bg-rose-400/10 px-3 py-1.5 rounded-lg border border-rose-400/20">
                    {outcomeLabels[1]} {totalNo} <TrendingDown size={13}/>
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ── Key Factors ── */}
            {keyFactors.length > 0 && (
              <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.18}} className="pt-2 w-[94%] xl:w-[96%] self-center">
                <h2 className="text-xl font-black mb-4 flex items-center gap-3 tracking-tight">
                  <span className="text-amber-400">⚡</span>
                  Key Factors
                </h2>
                <div className="flex flex-col gap-2">
                  {keyFactors.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-3">
                      <span className="text-amber-400 font-black text-sm shrink-0 mt-0.5">{i + 1}.</span>
                      <span className="text-sm text-zinc-300 leading-relaxed">{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Notable Personas ── */}
            {personaHighlights.length > 0 && (
              <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.22}} className="pt-2 w-[94%] xl:w-[96%] self-center">
                <h2 className="text-xl font-black mb-4 flex items-center gap-3 tracking-tight">
                  <span className="text-purple-400">👤</span>
                  Notable Personas
                </h2>
                <div className="flex flex-col gap-3">
                  {personaHighlights.map((p, i) => (
                    <div key={i} className="bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-4 flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-lg ${
                        p.stance === 'YES' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {(p.name || "?").split(" ").map((n:string) => n[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-bold text-white">{p.name}</span>
                          <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">{p.role}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest ${
                            p.stance === 'YES' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>{p.stance}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{p.impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Agent List (collapsed) ── */}
            {agentList.length > 0 && (
              <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:0.24}} className="pt-2 w-[94%] xl:w-[96%] self-center">
                <h2 className="text-xl font-black mb-4 flex items-center gap-3 tracking-tight">
                  <span className="text-blue-400">🤖</span>
                  Participating Agents ({agentList.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agentList.slice(0, 12).map((a, i) => (
                    <div key={i} className="bg-zinc-900/40 border border-white/5 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400 shrink-0">
                        {(a.name || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-300 truncate">{a.name}</div>
                        <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-wide">{a.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Reasoning Engine */}
            <motion.div initial={{opacity:0, x:-20}} animate={{opacity:1, x:0}} transition={{delay:0.15}} className="flex flex-col flex-1 w-[94%] xl:w-[96%] self-center pb-8">
              <h2 className="text-xl font-black mb-4 mt-6 flex items-center gap-3 tracking-tight">
                <Terminal size={20} className="text-blue-500" />
                The Reasoning Engine
              </h2>

              {/* Tab Bar */}
              <div className="flex gap-2 mb-4 bg-zinc-900/60 p-1.5 rounded-xl w-fit border border-white/5 backdrop-blur-sm overflow-x-auto max-w-full sim-scroll">
                {[
                  { id: "timeline", label: "Agent Timeline" },
                  { id: "stream", label: "Raw Event Stream" }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-5 sm:px-7 py-2 rounded-lg text-sm font-bold tracking-wide transition-all duration-300 whitespace-nowrap ${
                      activeTab === t.id
                        ? 'bg-zinc-800 text-white shadow-md border border-white/10'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden relative min-h-[600px] shadow-2xl">

                {/* Tab 2: Agent Timeline */}
                {activeTab === "timeline" && (
                  <div className="absolute inset-0 overflow-y-auto p-6 sim-scroll bg-[#0c0f16]">
                    {logEntries.length === 0 && <div className="text-center text-zinc-600 mt-20 font-mono">No timeline events compiled.</div>}
                    <div className="space-y-4">
                      {logEntries.map((r: any, i: number) => {
                        const isOpen = openRounds[i];
                        return (
                          <div key={i} className="bg-black/40 rounded-xl border border-white/5 overflow-hidden transition-colors hover:border-white/10 shadow-sm">
                            <div onClick={() => toggleRound(i)} className="p-5 cursor-pointer flex items-center gap-4 select-none">
                              <div className={`p-1.5 rounded-full transition-colors ${isOpen ? 'bg-zinc-800 text-white' : 'text-zinc-500 bg-zinc-900/50'}`}>
                                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </div>
                              <span className={`text-lg font-bold tracking-tight ${isOpen ? 'text-white' : 'text-zinc-400'}`}>
                                Round {i + 1 < 10 ? `0${i + 1}` : i + 1}
                              </span>
                              <div className="ml-auto flex items-center gap-3 sm:gap-6 font-mono text-[11px] tracking-widest font-semibold">
                                <span className="text-zinc-500 hidden sm:inline">{r?.posts || 0} EVENTS</span>
                                <div className="flex gap-2">
                                  <span className="text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-md border border-emerald-400/20 shadow-inner">{r?.yes || 0} ↑</span>
                                  <span className="text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-md border border-rose-400/20 shadow-inner">{r?.no || 0} ↓</span>
                                </div>
                              </div>
                            </div>
                            {isOpen && (
                              <div className="px-6 pb-8 pt-4 sm:pl-[76px] border-t border-white/5 bg-gradient-to-b from-black/20 to-transparent">
                                {(r?.sample_posts || []).length === 0
                                  ? <div className="text-zinc-500 text-sm italic">Empty round matrix.</div>
                                  : (r?.sample_posts || []).map((p: any, pi: number) => (
                                    <div key={pi} className="py-5 first:pt-2 border-b border-white/5 last:border-0 group">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500/50 group-hover:bg-blue-400 transition-colors shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        <span className="text-[15px] font-bold text-zinc-200">{p.agent}</span>
                                        <span className="font-mono text-[9px] font-bold text-black bg-zinc-300 px-2 py-0.5 rounded uppercase tracking-widest">{p.action || "ACT"}</span>
                                      </div>
                                      <div className="text-[14px] text-zinc-400 sm:pl-5 leading-relaxed">{p.content || p.text || "—"}</div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab 3: Raw Event Stream */}
                {activeTab === "stream" && (
                  <div className="absolute inset-0 flex flex-col bg-[#050505]">
                    <div className="bg-black/60 backdrop-blur-xl border-b border-zinc-800/50 p-4 sm:px-6 flex items-center gap-4 sticky top-0 z-10">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-widest">Live Terminal</span>
                      <span className="ml-auto font-mono text-[10px] sm:text-xs font-bold text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                        {totalEvents} DATA POINTS
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sim-scroll font-mono">
                      {allEvents.length === 0 ? (
                        <div className="text-center text-zinc-600 text-sm mt-20">No events in stream.</div>
                      ) : allEvents.map((ev, ei) => (
                        <div key={ei} className="flex gap-4 group">
                          <div className="w-9 h-9 rounded bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-center text-[11px] font-black text-zinc-500 group-hover:border-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 shadow-inner">
                            {getInitials(ev.agent)}
                          </div>
                          <div className="flex-1 min-w-0 bg-zinc-900/20 p-3 sm:p-4 rounded-lg border border-transparent group-hover:border-white/5 transition-colors">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-[13px] font-bold text-zinc-300">{ev.agent}</span>
                              <span className="text-[10px] text-zinc-600 tracking-widest font-bold">RD{ev.round}</span>
                            </div>
                            <div className="text-[13px] text-zinc-400/90 leading-[1.7] whitespace-pre-wrap">{ev.content}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN (~33%) ─────────────────────────────────────── */}
          <motion.div
            initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} transition={{delay:0.2}}
            className="lg:col-span-4 flex flex-col h-full bg-white"
            style={{
              paddingRight: "clamp(16px, 3vw, 40px)",
              paddingLeft: "clamp(16px, 2vw, 24px)",
              paddingTop: 32,
            }}
          >

            {/* Toggle button — only shown for Polymarket markets */}
            {baseDomain.toLowerCase() === "polymarket" && marketSlug && (
              <div className="flex justify-end mb-4 shrink-0">
                <button
                  onClick={() => setShowPolymarket(!showPolymarket)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-xs font-bold tracking-tight transition-colors"
                >
                  {showPolymarket ? <ArrowLeft size={12} /> : <ExternalLink size={12} />}
                  {showPolymarket ? "Back to Simulation" : "View Polymarket Data"}
                </button>
              </div>
            )}

            {/* Sliding panel container */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              <AnimatePresence mode="wait">

                {/* ── Polymarket iframe panel ── */}
                {showPolymarket ? (
                  <motion.div
                    key="polymarket-iframe"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute inset-0 overflow-y-auto sim-scroll"
                  >
                    {polyMarketLoading ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 size={28} className="animate-spin text-blue-500" />
                        <span className="text-sm text-zinc-500 font-mono">Fetching live data...</span>
                      </div>
                    ) : polyMarketData ? (
                      <div className="p-4 flex flex-col gap-5">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          {polyMarketData.image && (
                            <img src={polyMarketData.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" onError={e => e.currentTarget.style.display='none'} />
                          )}
                          <div>
                            <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-1">POLYMARKET LIVE</div>
                            <div className="text-sm font-black text-black leading-snug">{polyMarketData.title}</div>
                          </div>
                        </div>

                        {/* Price Chart */}
                        {chartLoading ? (
                          <div className="h-28 bg-zinc-50 rounded-xl flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-zinc-400" />
                          </div>
                        ) : chartHistory.length > 2 ? (() => {
                          const W = 320, H = 96;
                          const ps = chartHistory.map(p => p.p * 100);
                          const minP = Math.max(0, Math.min(...ps) - 5);
                          const maxP = Math.min(100, Math.max(...ps) + 5);
                          const range = maxP - minP || 1;
                          const pts = chartHistory.map((p, i) => [
                            (i / (chartHistory.length - 1)) * W,
                            H - ((p.p * 100 - minP) / range) * H
                          ]);
                          const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
                          const areaD = `${pathD} L${W},${H} L0,${H} Z`;
                          const lastP = ps[ps.length - 1];
                          const firstP = ps[0];
                          const isUp = lastP >= firstP;
                          const color = isUp ? '#22c55e' : '#ef4444';
                          return (
                            <div className="rounded-xl overflow-hidden border border-black/6 bg-zinc-50 p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase">YES — 7 day price</span>
                                <span className={`text-xs font-black ${isUp ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {lastP.toFixed(1)}%
                                </span>
                              </div>
                              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{height: 80}} preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                                    <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                                  </linearGradient>
                                </defs>
                                <path d={areaD} fill="url(#chartGrad)" />
                                <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Current price dot */}
                                <circle cx={pts[pts.length-1][0].toFixed(1)} cy={pts[pts.length-1][1].toFixed(1)} r="3" fill={color} />
                              </svg>
                            </div>
                          );
                        })() : null}

                        {/* Markets / Outcomes */}
                        {(polyMarketData.markets || []).map((mkt: any, mi: number) => (
                          <div key={mi} className="border border-black/8 rounded-xl p-4">
                            {polyMarketData.markets.length > 1 && (
                              <div className="text-[11px] text-zinc-500 font-medium mb-3 leading-snug">{mkt.question}</div>
                            )}
                            <div className="flex flex-col gap-2.5">
                              {(mkt.outcomes || []).map((o: any, oi: number) => (
                                <div key={oi}>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-black">{o.label}</span>
                                    <span className={`text-sm font-black ${
                                      o.label.toLowerCase() === 'yes' ? 'text-emerald-600' : 'text-rose-500'
                                    }`}>{o.prob}%</span>
                                  </div>
                                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${o.prob}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut', delay: oi * 0.1 }}
                                      className={`h-full rounded-full ${
                                        o.label.toLowerCase() === 'yes'
                                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                          : 'bg-gradient-to-r from-rose-500 to-rose-400'
                                      }`}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Mini stats */}
                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <div className="bg-zinc-50 rounded-lg p-2.5">
                                <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Volume</div>
                                <div className="text-sm font-black text-black">{mkt.volume}</div>
                              </div>
                              <div className="bg-zinc-50 rounded-lg p-2.5">
                                <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Liquidity</div>
                                <div className="text-sm font-black text-black">
                                  {mkt.liquidity >= 1000 ? `$${(mkt.liquidity/1000).toFixed(0)}K` : `$${Math.round(mkt.liquidity)}`}
                                </div>
                              </div>
                              <div className="bg-zinc-50 rounded-lg p-2.5">
                                <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Best Bid</div>
                                <div className="text-sm font-black text-black">{Math.round(mkt.bestBid * 100)}¢</div>
                              </div>
                              <div className="bg-zinc-50 rounded-lg p-2.5">
                                <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Best Ask</div>
                                <div className="text-sm font-black text-black">{Math.round(mkt.bestAsk * 100)}¢</div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* End date */}
                        {polyMarketData.endDate && (
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <Clock size={12} />
                            <span>Closes {new Date(polyMarketData.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                        )}

                        {/* Market stats from simulation record */}
                        <div className="border-t border-black/6 pt-4">
                          <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-3">Market Snapshot</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-zinc-50 rounded-lg p-2.5">
                              <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Volume</div>
                              <div className="text-sm font-black text-black">{marketStats.volume}</div>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-2.5">
                              <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Liquidity</div>
                              <div className="text-sm font-black text-black">{marketStats.liquidity}</div>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-2.5">
                              <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Last Trade</div>
                              <div className="text-sm font-black text-black">{marketStats.lastTrade}</div>
                            </div>
                            <div className="bg-zinc-50 rounded-lg p-2.5">
                              <div className="text-[9px] font-bold tracking-widest text-zinc-400 uppercase mb-0.5">Status</div>
                              <div className="text-sm font-black text-black">{marketStats.timeLeft}</div>
                            </div>
                          </div>
                        </div>

                        {/* CTA */}
                        <a
                          href={`https://polymarket.com/event/${marketSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                        >
                          <ExternalLink size={12} />
                          Trade on Polymarket
                        </a>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
                        <BarChart3 size={32} className="opacity-30" />
                        <span className="text-sm">Could not load market data</span>
                      </div>
                    )}
                  </motion.div>
                ) : (

                  /* ── Simulation results panel ── */
                  <motion.div
                    key="sim-results"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="absolute inset-0 overflow-y-auto sim-scroll pb-10 flex flex-col"
                  >

                    {/* ② Verdict */}
                    <div className="pb-8">
                      <div className="bg-white p-5 sm:p-6 rounded-none shadow-none border border-black/8">
                        {backendConfidence && (
                          <div className={`inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full mb-3 ${
                            backendConfidence === 'HIGH' ? 'bg-emerald-100 text-emerald-700' :
                            backendConfidence === 'LOW' ? 'bg-rose-100 text-rose-700' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            <span>◉</span> {backendConfidence} confidence
                          </div>
                        )}
                        {verdictLoading ? (
                          <div className="flex items-center gap-3 text-zinc-500 text-sm">
                            <Loader2 size={16} className="animate-spin text-blue-500" />
                            <span className="animate-pulse">Synthesizing consensus...</span>
                          </div>
                        ) : verdict ? (
                          <p className="text-base md:text-lg font-bold text-black leading-relaxed">{verdict}</p>
                        ) : (
                          <p className="text-sm text-zinc-600 italic">
                            {reportText ? "Generating verdict..." : "No report data available."}
                          </p>
                        )}
                      </div>
                    </div>


                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
