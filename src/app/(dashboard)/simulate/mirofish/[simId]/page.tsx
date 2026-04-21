"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2, FileDown, RefreshCw, Loader2, ChevronDown, ChevronRight, MessageSquare, Send, Sparkles } from "lucide-react";
import Link from "next/link";

interface QAMsg { role: "user" | "ai"; text: string; loading?: boolean; }

export default function SimulationResultPage() {
  const { simId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openRaw, setOpenRaw] = useState(false);
  const [openIntel, setOpenIntel] = useState(true); // open by default
  const [ragQuery, setRagQuery] = useState("");
  const [ragContext, setRagContext] = useState("");
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>(() => {
    return { 0: true }; // open first round by default
  });
  const [feedTab, setFeedTab] = useState<"events" | "report">("events");

  // Verdict state
  const [verdict, setVerdict] = useState<string>("");
  const [verdictLoading, setVerdictLoading] = useState(false);

  // Q&A state
  const [qaMessages, setQaMessages] = useState<QAMsg[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const qaEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!simId) return;
    fetch(`/api/custom-simulations/${simId}`)
      .then(r => r.json())
      .then(d => {
        setData(d.simulation);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [simId]);

  // Read Tavily RAG intel from sessionStorage (written by mirofish/page.tsx during seed generation)
  useEffect(() => {
    try {
      const q = sessionStorage.getItem("hemlo_rag_query") || "";
      const ctx = sessionStorage.getItem("hemlo_rag_context") || "";
      if (q) setRagQuery(q);
      if (ctx) setRagContext(ctx);
    } catch {}
  }, []);

  // Auto-generate verdict when data loads
  useEffect(() => {
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
        report_text: data.result?.report_text || data.report_text || data.result?.report?.report_text || data.result?.markdown_content || "",
        round_logs: data.result?.round_logs || data.round_logs || [],
      }),
    })
      .then(r => r.json())
      .then(d => setVerdict(d.answer || ""))
      .catch(() => setVerdict(""))
      .finally(() => setVerdictLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Scroll Q&A to bottom
  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaMessages]);

  const askQuestion = async (q?: string) => {
    const question = q || qaInput.trim();
    if (!question || qaLoading || !data) return;
    setQaInput("");
    setQaMessages(prev => [...prev, { role: "user", text: question }, { role: "ai", text: "", loading: true }]);
    setQaLoading(true);
    try {
      const res = await fetch("/api/sim-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          scenario: data.scenario,
          report_text: data.result?.report_text || data.report_text || data.result?.report?.report_text || data.result?.markdown_content || "",
          round_logs: data.result?.round_logs || data.round_logs || [],
        }),
      });
      const result = await res.json();
      setQaMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", text: result.answer || "No answer generated." };
        return updated;
      });
    } catch {
      setQaMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "ai", text: "Error fetching answer. Check your connection." };
        return updated;
      });
    } finally {
      setQaLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="#fff" className="animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif", padding: 40 }}>
        <h2 className="text-xl font-semibold mb-4">Simulation not found</h2>
        <Link href="/simulate/mirofish" style={{ color: "#aaa", textDecoration: "underline" }}>← Back to simulation engine</Link>
      </div>
    );
  }

  const toggleRound = (idx: number) => setOpenRounds(prev => ({ ...prev, [idx]: !prev[idx] }));

  // Read logs from data.result if present, otherwise fallback
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
    if (data.result?.primary_probability !== undefined) return Math.round(data.result.primary_probability);
    if (data.primary_probability !== undefined) return Math.round(data.primary_probability);
    if (data.result?.bullish_pct !== undefined) return Math.round(data.result.bullish_pct);
    if (data.result?.final_probability !== undefined) return Math.round(data.result.final_probability * 100);
    if (totalYes + totalNo > 0) return Math.round((totalYes / (totalYes + totalNo)) * 100);
    return null;
  })();

  const reportText: string = data.result?.report_text || data.report_text || data.result?.report?.report_text || data.result?.markdown_content || "";

  // Monochromatic agent styling
  const getInitials = (name: string) => {
    const p = (name || "A").trim().split(/\s+/);
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : (name[0] || "A").toUpperCase();
  };

  const SUGGESTED = ["Who wins?", "Why did the outcome shift?", "What was the turning point?", "Which agent had the most influence?"];

  return (
    <div style={{ backgroundColor: "#000000", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#ffffff", padding: "40px 6% 80px", overflowY: "auto" }}>
      <style>{`
        .glass-panel-bw {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
        }
        .clean-input::placeholder { color: #666; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #555; }
        .mono-text { font-family: 'Roboto Mono', monospace; }
      `}</style>


      <Link href="/simulate/mirofish" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#888", textDecoration: "none", marginBottom: 32, fontSize: 13, transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "#fff"} onMouseOut={e => e.currentTarget.style.color = "#888"}>
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Header Info & Q&A Box */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 40, marginBottom: 40 }}>
        
        {/* Left side: Scenario */}
        <div style={{ flex: "1 1 500px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: data.status === "complete" ? "#fff" : data.status === "failed" ? "#666" : "#aaa" }} />
            <div className="mono-text" style={{ fontSize: 11, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 2, color: "#888" }}>
              SIMULATION {data.status} · {data.runtime_seconds || 0}S · {data.agent_count} AGENTS · {data.rounds} ROUNDS
            </div>
          </div>
          
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: 16 }}>
            "{data.scenario}"
          </div>
          
          <div className="mono-text" style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span style={{ color: "#fff" }}>{data.domain}</span> · {new Date(data.created_at).toLocaleString()}
          </div>
        </div>

        {/* Right side: ASK HEMLO PROMPT BOX */}
        <div className="glass-panel-bw" style={{ width: "100%", maxWidth: 450, flexShrink: 0, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <MessageSquare size={16} color="#fff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: 0.5 }}>Ask questions about this simulation</span>
          </div>
          
          <div style={{ padding: 20 }}>
            {qaMessages.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 20, display: "flex", flexDirection: "column", gap: 16, paddingRight: 8 }}>
                {qaMessages.map((msg, mi) => (
                  <div key={mi} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 4, background: msg.role === "user" ? "#222" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: msg.role === "user" ? "#fff" : "#000", fontSize: 11, fontWeight: "bold", flexShrink: 0 }}>
                      {msg.role === "user" ? "U" : "H"}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: msg.role === "user" ? "#aaa" : "#fff", lineHeight: 1.6 }}>
                      {msg.loading ? <span className="animate-pulse">Analyzing logs...</span> : msg.text}
                    </div>
                  </div>
                ))}
                <div ref={qaEndRef} />
              </div>
            )}
            
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="clean-input mono-text"
                value={qaInput}
                onChange={e => setQaInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                placeholder={qaMessages.length > 0 ? "Ask a follow up..." : "Why did the outcome shift..."}
                style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: "12px 14px", fontSize: 12, outline: "none", transition: "border-color 0.2s" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              />
              <button
                onClick={() => askQuestion()}
                disabled={!qaInput.trim() || qaLoading}
                style={{ padding: "0 18px", background: qaInput.trim() && !qaLoading ? "#fff" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 6, color: qaInput.trim() && !qaLoading ? "#000" : "#666", cursor: qaInput.trim() && !qaLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
              >
                {qaLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
            
            {qaMessages.length === 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {SUGGESTED.slice(0, 2).map(q => (
                  <button key={q} onClick={() => askQuestion(q)} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#888", fontSize: 11, padding: "6px 12px", borderRadius: 4, cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }} onMouseOut={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HEMLO Verdict Box */}
      <div style={{ marginBottom: 40 }}>
        
        <div className="glass-panel-bw" style={{ padding: "40px" }}>
          
          <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: "40px 60px", marginBottom: verdictLoading || verdict ? 40 : 0 }}>
            
            {/* Probability Block */}
            <div style={{ minWidth: 140 }}>
              <div className="mono-text" style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Primary Probability</div>
              <div style={{ fontSize: 72, fontWeight: 800, color: "#fff", lineHeight: 0.9, letterSpacing: "-0.03em" }}>
                {hemloPct !== null ? `${Math.round(hemloPct)}%` : "—"}
              </div>
            </div>
            
            {/* Progress Bar equivalent in Mono B/W */}
            {hemloPct !== null && (
              <div style={{ flex: "1 1 300px", paddingTop: 20 }}>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 16, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ width: `${hemloPct}%`, background: "#fff" }} />
                  <div style={{ width: `${100 - hemloPct}%`, background: "rgba(255,255,255,0.2)" }} />
                </div>
                <div className="mono-text" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>Primary ({Math.round(hemloPct)}%)</span>
                  <span>Secondary ({100 - Math.round(hemloPct)}%)</span>
                </div>
              </div>
            )}
            
            {/* Stats Row */}
            <div style={{ display: "flex", gap: 40, paddingTop: 20, flexShrink: 0 }}>
              <div><div className="mono-text" style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Total Events</div><div style={{ fontSize: 24, color: "#fff", fontWeight: 600 }}>{totalEvents}</div></div>
              <div><div className="mono-text" style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Supporting ↑</div><div style={{ fontSize: 24, color: "#fff", fontWeight: 600 }}>{totalYes}</div></div>
              <div><div className="mono-text" style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Opposing ↓</div><div style={{ fontSize: 24, color: "#888", fontWeight: 600 }}>{totalNo}</div></div>
            </div>
          </div>

          {/* AI verdict answer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="mono-text" style={{ fontSize: 12, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: "bold" }}>Simulation Verdict</span>
            </div>
            
            {verdictLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#888", fontSize: 14 }}>
                <Loader2 size={16} className="animate-spin" color="#fff" />
                Synthesizing final verdict from log artifacts...
              </div>
            ) : verdict ? (
              <div style={{ fontSize: 16, color: "#e5e5e5", lineHeight: 1.7, maxWidth: 1000 }}>{verdict}</div>
            ) : (
              <div style={{ fontSize: 14, color: "#666" }}>
                {reportText ? "Generating verdict..." : "No report data available for verdict synthesis."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        
        {/* Left Col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {/* Reality Seed */}
          <div>
            <div className="mono-text" style={{ color: "#aaa", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>{`// Initial Condition Vectors`}</div>
            <div className="glass-panel-bw" style={{ padding: 24, maxHeight: 300, overflowY: "auto" }}>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, color: "#888", lineHeight: 1.6, fontFamily: "inherit" }}>
                {data.reality_seed || "No conditional parameters provided."}
              </pre>
            </div>
          </div>

          {/* Intelligence Sources (Tavily RAG) */}
          <div>
            <div
              onClick={() => setOpenIntel(v => !v)}
              className="mono-text"
              style={{ display: "flex", alignItems: "center", gap: 8, color: openIntel ? "#fff" : "#aaa", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, cursor: "pointer", transition: "color 0.2s", userSelect: "none" }}
            >
              {openIntel ? <ChevronDown size={14} color="#fff" /> : <ChevronRight size={14} color="#666" />}
              {`// RAG Intelligence Trace`}
            </div>
            {openIntel && (
              <div className="glass-panel-bw" style={{ padding: 0, overflow: "hidden" }}>
                {/* AI Search Query */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="mono-text" style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>AI → Tavily Search Query</div>
                  <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 13, color: "#e5e5e5", fontWeight: 700, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)", wordBreak: "break-word" }}>
                    {ragQuery || <span style={{ color: "#444", fontWeight: 400 }}>Not captured for this simulation (run a new one to see the query).</span>}
                  </div>
                </div>
                {/* Tavily Sources */}
                <div style={{ padding: "16px 20px", maxHeight: 320, overflowY: "auto" }}>
                  <div className="mono-text" style={{ fontSize: 9, color: "#555", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Tavily → Sources Retrieved</div>
                  {ragContext ? (
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, color: "#888", lineHeight: 1.7, fontFamily: "'Roboto Mono', monospace" }}>{ragContext}</pre>
                  ) : (
                    <div style={{ color: "#444", fontSize: 13 }}>No source data captured. Run a fresh simulation to see Tavily's web intelligence.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Round Logs */}
          <div>
            <div className="mono-text" style={{ color: "#aaa", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>{`// Agent Event Timeline`}</div>
            <div className="glass-panel-bw">
              {logEntries.length === 0 && <div style={{ padding: 32, color: "#666", fontSize: 13, textAlign: "center" }}>No timeline events compiled.</div>}
              {logEntries.map((r: any, i: number) => {
                const isOpen = openRounds[i];
                return (
                  <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div onClick={() => toggleRound(i)} style={{ padding: "20px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}>
                      {isOpen ? <ChevronDown size={16} color="#fff" /> : <ChevronRight size={16} color="#666" />}
                      <span style={{ fontSize: 14, color: isOpen ? "#fff" : "#ccc", fontWeight: isOpen ? 600 : 400 }}>Round {i + 1 < 10 ? `0${i + 1}` : i + 1}</span>
                      <span className="mono-text" style={{ fontSize: 11, color: "#666", marginLeft: "auto", textTransform: "uppercase", letterSpacing: 1 }}>
                        {r?.posts || 0} events · <span style={{ color: "#fff" }}>{r?.yes || 0} ↑</span> · <span>{r?.no || 0} ↓</span>
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 24px 24px 56px" }}>
                        {(r?.sample_posts || []).length === 0
                          ? <div style={{ paddingTop: 16, fontSize: 13, color: "#555" }}>Empty round matrix.</div>
                          : (r?.sample_posts || []).map((p: any, pi: number) => (
                            <div key={pi} style={{ paddingTop: 20, borderTop: pi > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                                <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{p.agent}</span>
                                <span className="mono-text" style={{ fontSize: 10, color: "#000", background: "#eee", padding: "2px 8px", borderRadius: 4, letterSpacing: 1, textTransform: "uppercase" }}>{p.action || "ACT"}</span>
                              </div>
                              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6, paddingLeft: 18 }}>{p.content || p.text || "—"}</div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {/* Feed / Report Tabs */}
          <div>
            <div style={{ display: "flex", gap: 24, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
              <div 
                onClick={() => setFeedTab("events")} 
                className="mono-text"
                style={{ color: feedTab === "events" ? "#fff" : "#666", letterSpacing: 1, textTransform: "uppercase", fontSize: 11, cursor: "pointer", transition: "color 0.2s" }}
              >
                Event Stream
              </div>
              <div 
                onClick={() => setFeedTab("report")}
                className="mono-text"
                style={{ color: feedTab === "report" ? "#fff" : "#666", letterSpacing: 1, textTransform: "uppercase", fontSize: 11, cursor: "pointer", transition: "color 0.2s" }}
              >
                Final Report Document
              </div>
            </div>

            <div className="glass-panel-bw" style={{ height: 650, overflowY: "auto" }}>
              {feedTab === "events" ? (
                <>
                  <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", zIndex: 1, display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="mono-text" style={{ fontSize: 10, color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>{totalEvents} DATA POINTS</span>
                  </div>
                  {allEvents.length === 0 ? (
                    <div style={{ padding: 48, textAlign: "center", color: "#666", fontSize: 14 }}>No events compiled in the stream.</div>
                  ) : allEvents.map((ev, ei) => (
                    <div key={ei} style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 16 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", color: "#fff", flexShrink: 0 }}>
                        {getInitials(ev.agent)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{ev.agent}</span>
                          <span className="mono-text" style={{ fontSize: 10, color: "#666", letterSpacing: 1 }}>RD{ev.round}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#999", lineHeight: 1.6 }}>{ev.content}</div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ padding: 40 }}>
                  {reportText
                    ? <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13, color: "#ccc", lineHeight: 1.8, fontFamily: "inherit" }}>{reportText}</pre>
                    : <div style={{ color: "#666", fontSize: 14, textAlign: "center" }}>Artifact empty.</div>}
                </div>
              )}
            </div>
          </div>

          {/* Raw Data Toggle */}
          <div>
            <div onClick={() => setOpenRaw(!openRaw)} className="mono-text" style={{ display: "flex", alignItems: "center", gap: 8, color: openRaw ? "#fff" : "#aaa", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16, cursor: "pointer", transition: "color 0.2s" }}>
              {openRaw ? <ChevronDown size={14} color="#fff" /> : <ChevronRight size={14} color="#666" />}
              View Raw JSON Payload
            </div>
            {openRaw && (
              <div className="glass-panel-bw" style={{ padding: 24, maxHeight: 300, overflowY: "auto" }}>
                <pre style={{ margin: 0, fontSize: 11, color: "#666", fontFamily: "'Roboto Mono', monospace" }}>{JSON.stringify(data, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 80, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 40 }}>
        <button onClick={() => router.push(`/simulate/mirofish?scenario=${encodeURIComponent(data.scenario)}&domain=${data.domain}&agents=${data.agent_count}&rounds=${data.rounds}&seed=${encodeURIComponent(data.reality_seed || "")}`)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "#fff", border: "none", color: "#000", fontWeight: 600, cursor: "pointer", fontSize: 13, borderRadius: 8, transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#ddd"} onMouseOut={e => e.currentTarget.style.background = "#fff"}>
          <RefreshCw size={16} /> Re-run Architecture
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 13, borderRadius: 8, transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
          <Share2 size={16} /> Share Artifact
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 13, borderRadius: 8, transition: "background 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
          <FileDown size={16} /> Download Source
        </button>
      </div>

    </div>
  );
}
