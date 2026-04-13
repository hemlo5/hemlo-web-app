"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Share2, FileDown, RefreshCw, Loader2, ChevronDown, ChevronRight, MessageSquare, TrendingUp, TrendingDown, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { AgentNetworkCanvas } from "@/components/agent-network-canvas";

interface QAMsg { role: "user" | "ai"; text: string; loading?: boolean; }

export default function SimulationResultPage() {
  const { simId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openRaw, setOpenRaw] = useState(false);
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});
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
      <div style={{ backgroundColor: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="#FF6B00" className="animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ backgroundColor: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5", fontFamily: "monospace", padding: 40 }}>
        <h2>Simulation not found</h2>
        <Link href="/simulate/mirofish" style={{ color: "#FF6B00", textDecoration: "underline" }}>← Back</Link>
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
    if (data.result?.primary_probability) return Math.round(data.result.primary_probability);
    if (data.primary_probability) return Math.round(data.primary_probability);
    if (data.result?.bullish_pct) return Math.round(data.result.bullish_pct);
    if (data.result?.final_probability) return Math.round(data.result.final_probability * 100);
    if (totalYes + totalNo > 0) return Math.round((totalYes / (totalYes + totalNo)) * 100);
    return null;
  })();

  const reportText: string = data.result?.report_text || data.report_text || data.result?.report?.report_text || data.result?.markdown_content || "";

  const agentColors = ["#ffffff", "#3b82f6", "#cccccc", "#a855f7", "#aaaaaa", "#ec4899", "#06b6d4", "#888888"];
  const agentColorMap: Record<string, string> = {};
  allEvents.forEach(e => {
    if (!agentColorMap[e.agent]) agentColorMap[e.agent] = agentColors[Object.keys(agentColorMap).length % agentColors.length];
  });
  const getInitials = (name: string) => {
    const p = (name || "A").trim().split(/\s+/);
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : (name[0] || "A").toUpperCase();
  };

  const SUGGESTED = ["Who wins?", "Why did the outcome shift?", "What was the turning point?", "Which agent had the most influence?"];

  return (
    <div style={{ backgroundColor: "#0a0a0a", minHeight: "100vh", fontFamily: "monospace", color: "#e5e5e5", padding: "40px 60px", overflowY: "auto" }}>

      {/* Header */}
      <Link href="/simulate/mirofish" style={{ color: "#888", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 32, fontSize: 13 }}>
        <ArrowLeft size={14} /> Back to simulations
      </Link>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 12, height: 12, background: data.status === "complete" ? "#22c55e" : data.status === "failed" ? "#ef4444" : "#FF6B00" }} />
          <div style={{ fontSize: 14, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1 }}>
            Simulation {data.status} · {data.runtime_seconds || 0}s · {data.agent_count} agents · {data.rounds} rounds
          </div>
        </div>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff", lineHeight: 1.4, maxWidth: 900, marginBottom: 12 }}>
          "{data.scenario}"
        </div>
        <div style={{ fontSize: 13, color: "#888" }}>
          <span style={{ textTransform: "capitalize", color: "#aaa" }}>{data.domain}</span> · {new Date(data.created_at).toLocaleString()}
        </div>
      </div>

      {/* Agent Network */}
      <div style={{ marginBottom: 40, border: "1px solid #333", borderRadius: 8, overflow: "hidden" }}>
        <AgentNetworkCanvas agentCount={data.agent_count || 50} isRunning={false} />
      </div>

      {/* ── HEMLO VERDICT — full width ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>{`>_ HEMLO Verdict`}</div>
        <div style={{ border: "1px solid #FF6B00", background: "#0d0a00", padding: 28 }}>
          {/* Probability row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 40, marginBottom: verdictLoading || verdict ? 24 : 0 }}>
            <div>
              <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Primary Probability</div>
              <div style={{ fontSize: 52, fontWeight: "bold", color: "#FF6B00", lineHeight: 1 }}>
                {hemloPct !== null ? `${hemloPct}%` : "—"}
              </div>
            </div>
            {hemloPct !== null && (
              <div style={{ flex: 1, paddingTop: 24 }}>
                <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 8, background: "#1a1a1a" }}>
                  <div style={{ width: `${hemloPct}%`, background: "#FF6B00" }} />
                  <div style={{ width: `${100 - hemloPct}%`, background: "#22c55e" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#FF6B00", display: "flex", alignItems: "center", gap: 4 }}>
                    <TrendingUp size={10} /> Primary ({hemloPct}%)
                  </span>
                  <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
                    Secondary ({100 - hemloPct}%) <TrendingDown size={10} />
                  </span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 32, paddingTop: 8, flexShrink: 0 }}>
              <div><div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Events</div><div style={{ fontSize: 18, color: "#fff" }}>{totalEvents}</div></div>
              <div><div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Support ↑</div><div style={{ fontSize: 18, color: "#FF6B00" }}>{totalYes}</div></div>
              <div><div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Oppose ↓</div><div style={{ fontSize: 18, color: "#22c55e" }}>{totalNo}</div></div>
              <div><div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Rounds</div><div style={{ fontSize: 18, color: "#fff" }}>{logEntries.length}</div></div>
            </div>
          </div>

          {/* AI verdict answer — direct response to the question */}
          <div style={{ borderTop: "1px solid #2a1a00", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Sparkles size={14} color="#FF6B00" />
              <span style={{ fontSize: 10, color: "#FF6B00", textTransform: "uppercase", letterSpacing: 1 }}>Direct Answer</span>
            </div>
            {verdictLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#555", fontSize: 13 }}>
                <Loader2 size={14} className="animate-spin" color="#FF6B00" />
                Analyzing report and generating verdict...
              </div>
            ) : verdict ? (
              <div style={{ fontSize: 15, color: "#f5f5f5", lineHeight: 1.8, fontFamily: "inherit" }}>{verdict}</div>
            ) : (
              <div style={{ fontSize: 13, color: "#444" }}>
                {reportText ? "Generating verdict..." : "No report data available for verdict generation."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          {/* Reality Seed */}
          <div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>{`>_ Section 0 — Reality Seed`}</div>
            <div style={{ border: "1px solid #333", padding: 24, background: "#111", maxHeight: 250, overflowY: "auto" }}>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
                {data.reality_seed || "No reality seed provided."}
              </pre>
            </div>
          </div>

          {/* Round Log */}
          <div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>{`>_ Section 3 — Simulation Log`}</div>
            <div style={{ border: "1px solid #333", background: "#111" }}>
              {logEntries.length === 0 && <div style={{ padding: 24, color: "#555", fontSize: 12 }}>No round logs available.</div>}
              {logEntries.map((r: any, i: number) => {
                const isOpen = openRounds[i];
                return (
                  <div key={i} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <div onClick={() => toggleRound(i)} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      {isOpen ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
                      <span style={{ fontSize: 13, color: "#ccc" }}>Round {i + 1 < 10 ? `0${i + 1}` : i + 1}</span>
                      <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>
                        {r?.posts || 0} posts · <span style={{ color: "#FF6B00" }}>{r?.yes || 0} ↑</span> · <span style={{ color: "#22c55e" }}>{r?.no || 0} ↓</span>
                      </span>
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 16px 16px 40px", background: "#0a0a0a", borderTop: "1px solid #1a1a1a" }}>
                        {(r?.sample_posts || []).length === 0
                          ? <div style={{ paddingTop: 12, fontSize: 11, color: "#555" }}>No sample posts.</div>
                          : (r?.sample_posts || []).map((p: any, pi: number) => (
                            <div key={pi} style={{ paddingTop: 12, borderTop: pi > 0 ? "1px solid #111" : "none" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: agentColorMap[p.agent] || "#444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: "bold", color: "#000", flexShrink: 0 }}>
                                  {getInitials(p.agent || "A")}
                                </div>
                                <span style={{ fontSize: 11, color: "#ccc", fontWeight: "bold" }}>{p.agent}</span>
                                <span style={{ fontSize: 9, color: "#555", marginLeft: "auto" }}>{p.action || "POST"}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, paddingLeft: 30 }}>{p.content || p.text || "—"}</div>
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

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>

          {/* Events Feed + Report tabs */}
          <div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>{`>_ Section 2 — Events Feed`}</div>
            <div style={{ display: "flex", border: "1px solid #333", borderBottom: "none" }}>
              <button onClick={() => setFeedTab("events")} style={{ flex: 1, padding: "10px 16px", background: feedTab === "events" ? "#1a1a1a" : "transparent", border: "none", borderRight: "1px solid #333", color: feedTab === "events" ? "#FF6B00" : "#666", cursor: "pointer", fontFamily: "monospace", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MessageSquare size={12} /> Events ({totalEvents})
              </button>
              <button onClick={() => setFeedTab("report")} style={{ flex: 1, padding: "10px 16px", background: feedTab === "report" ? "#1a1a1a" : "transparent", border: "none", color: feedTab === "report" ? "#FF6B00" : "#666", cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}>
                📄 Full Report
              </button>
            </div>

            {feedTab === "events" ? (
              <div style={{ border: "1px solid #333", background: "#111", height: 480, overflowY: "auto" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, background: "#111", zIndex: 1, display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 10, color: "#FF6B00", textTransform: "uppercase", letterSpacing: 1 }}>TOTAL EVENTS: {totalEvents}</span>
                  <span style={{ fontSize: 11, color: "#555", marginLeft: "auto" }}>{totalYes} / {totalNo}</span>
                </div>
                {allEvents.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#444", fontSize: 12 }}>No events recorded.</div>
                ) : allEvents.map((ev, ei) => (
                  <div key={ei} style={{ padding: "12px 16px", borderBottom: "1px solid #0f0f0f", display: "flex", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: agentColorMap[ev.agent] || "#444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", color: "#000", flexShrink: 0 }}>
                      {getInitials(ev.agent)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 12, fontWeight: "bold", color: "#d4d4d4" }}>{ev.agent}</span>
                        <span style={{ fontSize: 9, padding: "2px 6px", background: "#222", color: "#888", borderRadius: 2 }}>{ev.action}</span>
                        <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>R{ev.round}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#999", lineHeight: 1.65 }}>{ev.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: "1px solid #333", padding: 24, background: "#111", height: 480, overflowY: "auto" }}>
                {reportText
                  ? <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", fontSize: 12, color: "#aaa", lineHeight: 1.7 }}>{reportText}</pre>
                  : <div style={{ color: "#444", fontSize: 12 }}>No report available.</div>}
              </div>
            )}
          </div>

          {/* Signal Breakdown */}
          <div>
            <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>{`>_ Section 4 — Signal Breakdown`}</div>
            <div style={{ border: "1px solid #333", padding: 24, background: "#111", display: "flex", alignItems: "center", gap: 32 }}>
              <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", background: hemloPct !== null ? `conic-gradient(#FF6B00 0% ${hemloPct}%, #22c55e ${hemloPct}% 100%)` : "conic-gradient(#333 0% 100%)", border: "4px solid #1a1a1a" }} />
                {hemloPct !== null && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: "bold", color: "#fff" }}>{hemloPct}%</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ccc" }}>
                  <div style={{ width: 12, height: 12, background: "#FF6B00" }} /> Primary ({hemloPct ?? "N/A"}%)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#ccc" }}>
                  <div style={{ width: 12, height: 12, background: "#22c55e" }} /> Secondary ({hemloPct !== null ? 100 - hemloPct : "N/A"}%)
                </div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6 }}>
                  {totalYes + totalNo} signals across {logEntries.length} rounds.
                </div>
              </div>
            </div>
          </div>

          {/* Raw */}
          <div>
            <div onClick={() => setOpenRaw(!openRaw)} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
              {openRaw ? <ChevronDown size={14} color="#888" /> : <ChevronRight size={14} color="#888" />}
              {`>_ Section 5 — Raw Data`}
            </div>
            {openRaw && (
              <div style={{ border: "1px solid #333", padding: 16, background: "#111", maxHeight: 300, overflowY: "auto" }}>
                <pre style={{ margin: 0, fontFamily: "inherit", fontSize: 11, color: "#888" }}>{JSON.stringify(data, null, 2)}</pre>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Q&A SECTION — full width ── */}
      <div style={{ marginTop: 40 }}>
        <div style={{ color: "#fff", fontWeight: "bold", fontSize: 13, marginBottom: 12 }}>
          {`>_ Ask HEMLO`}
          <span style={{ fontSize: 11, color: "#555", fontWeight: "normal", marginLeft: 12 }}>Ask any follow-up question about this simulation</span>
        </div>
        <div style={{ border: "1px solid #333", background: "#111" }}>
          {/* Suggested questions */}
          {qaMessages.length === 0 && (
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a" }}>
              <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Suggested questions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => askQuestion(q)}
                    style={{ padding: "6px 14px", background: "#1a1a1a", border: "1px solid #333", color: "#aaa", cursor: "pointer", fontFamily: "monospace", fontSize: 12, borderRadius: 2 }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {qaMessages.length > 0 && (
            <div style={{ maxHeight: 400, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {qaMessages.map((msg, mi) => (
                <div key={mi} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: msg.role === "user" ? "#333" : "#FF6B00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: "bold", color: msg.role === "user" ? "#fff" : "#000", flexShrink: 0 }}>
                    {msg.role === "user" ? "U" : "H"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {msg.role === "user" ? "You" : "HEMLO"}
                    </div>
                    {msg.loading
                      ? <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 13 }}><Loader2 size={13} className="animate-spin" color="#FF6B00" /> Analyzing...</div>
                      : <div style={{ fontSize: 13, color: msg.role === "user" ? "#d4d4d4" : "#f0f0f0", lineHeight: 1.75 }}>{msg.text}</div>}
                  </div>
                </div>
              ))}
              <div ref={qaEndRef} />
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px 20px 16px", borderTop: qaMessages.length > 0 ? "1px solid #1a1a1a" : "none", display: "flex", gap: 10, alignItems: "center" }}>
            <input
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
              placeholder="Ask a question about this simulation..."
              style={{ flex: 1, background: "#0d0d0d", border: "1px solid #333", color: "#e5e5e5", padding: "10px 14px", fontFamily: "monospace", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={() => askQuestion()}
              disabled={!qaInput.trim() || qaLoading}
              style={{ padding: "10px 16px", background: qaInput.trim() && !qaLoading ? "#FF6B00" : "#222", border: "none", color: qaInput.trim() && !qaLoading ? "#000" : "#555", cursor: qaInput.trim() && !qaLoading ? "pointer" : "default", fontFamily: "monospace", fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}
            >
              <Send size={14} /> Ask
            </button>
          </div>
        </div>
      </div>

      {/* Action Row */}
      <div style={{ display: "flex", gap: 16, marginTop: 40, borderTop: "1px solid #222", paddingTop: 32 }}>
        <Link href="/simulate/mirofish" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", border: "1px solid #444", color: "#ccc", textDecoration: "none", fontSize: 12 }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <button onClick={() => router.push(`/simulate/mirofish?scenario=${encodeURIComponent(data.scenario)}&domain=${data.domain}&agents=${data.agent_count}&rounds=${data.rounds}&seed=${encodeURIComponent(data.reality_seed || "")}`)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "transparent", border: "1px solid #FF6B00", color: "#FF6B00", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          <RefreshCw size={14} /> Run again with same params
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "transparent", border: "1px solid #444", color: "#ccc", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          <Share2 size={14} /> Share
        </button>
        <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "transparent", border: "1px solid #444", color: "#ccc", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
          <FileDown size={14} /> Export JSON
        </button>
      </div>

    </div>
  );
}
