"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, ChevronDown, ChevronRight, TrendingUp,
  TrendingDown, Zap, BarChart2, Brain, Network, MessageSquare,
  AlertTriangle, Send, Sparkles, RefreshCw, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface QAMsg { role: "user" | "ai"; text: string; loading?: boolean; }

export default function StapleSimulationPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [sim,     setSim]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openOnt, setOpenOnt] = useState(false);
  const [openRaw, setOpenRaw] = useState(false);
  const [feedTab, setFeedTab] = useState<"agents" | "formula" | "report">("agents");

  const [verdict,        setVerdict]        = useState("");
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [qaMessages,     setQaMessages]     = useState<QAMsg[]>([]);
  const [qaInput,        setQaInput]        = useState("");
  const [qaLoading,      setQaLoading]      = useState(false);
  const qaEndRef = useRef<HTMLDivElement>(null);

  // Fetch sim row
  useEffect(() => {
    if (!id) return;
    const urlParams = new URLSearchParams(window.location.search);
    const rawTopic = urlParams.get("topic");

    if (id === "report" && rawTopic) {
      fetch(`/api/staple-simulation?topic=${encodeURIComponent(rawTopic)}`)
        .then(r => r.json())
        .then(d => { setSim(d.simulation); setLoading(false); })
        .catch(() => setLoading(false));
    } else if (id !== "report") {
      fetch(`/api/staple-simulation?id=${encodeURIComponent(id)}`)
        .then(r => r.json())
        .then(d => { setSim(d.simulation); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  // Auto-generate HEMLO verdict from report_text inside analysis_data
  useEffect(() => {
    if (!sim) return;
    const report = sim.analysis_data?.reportText || sim.analysis_data?.whyDivergent || "";
    if (!report || verdict || verdictLoading) return;
    setVerdictLoading(true);
    fetch("/api/sim-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: sim.topic,
        scenario: sim.topic,
        report_text: report,
        round_logs: [],
      }),
    })
      .then(r => r.json())
      .then(d => setVerdict(d.answer || ""))
      .catch(() => setVerdict(""))
      .finally(() => setVerdictLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);

  useEffect(() => { qaEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [qaMessages]);

  const askQuestion = async (q?: string) => {
    const question = q || qaInput.trim();
    if (!question || qaLoading || !sim) return;
    setQaInput("");
    setQaMessages(prev => [...prev, { role: "user", text: question }, { role: "ai", text: "", loading: true }]);
    setQaLoading(true);
    try {
      const res = await fetch("/api/sim-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          scenario: sim.topic,
          report_text: sim.analysis_data?.whyDivergent || "",
          round_logs: [],
        }),
      });
      const result = await res.json();
      setQaMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: "ai", text: result.answer || "No answer generated." };
        return u;
      });
    } catch {
      setQaMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: "ai", text: "Error fetching answer." };
        return u;
      });
    } finally { setQaLoading(false); }
  };

  if (loading) return (
    <div style={{ background: "#080c18", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={36} color="var(--accent, #FF6B00)" className="animate-spin" />
    </div>
  );

  if (!sim) return (
    <div style={{ background: "#080c18", minHeight: "100vh", color: "#e5e5e5", padding: 60 }}>
      <h2 style={{ color: "#fff" }}>Simulation not found</h2>
      <Link href="/polymarket" style={{ color: "var(--accent, #FF6B00)", textDecoration: "underline" }}>← Back to Markets</Link>
    </div>
  );

  const ad        = sim.analysis_data || {};
  const hemloVerdict = ad.hemloVerdict ?? sim.hemlo_odds ?? 50;
  const crowdOdds    = ad.stateSnapshot?.crowdOdds ?? sim.crowd_odds ?? 50;
  const divergence   = hemloVerdict - crowdOdds;
  const confidence   = ad.confidence ?? 75;
  const sentiment    = ad.stateSnapshot?.sentiment?.Analyst || "neutral";
  const diffColor    = divergence > 0 ? "#22c55e" : divergence < 0 ? "#ef4444" : "#888";
  const agentFeed    = (ad.agentFeed || []) as any[];
  const simFormula   = (ad.simulationFormula || []) as any[];
  const shockEvents  = (ad.shockEvents || []) as any[];
  const keySignals   = (ad.keySignals || []) as string[];
  const normalizeBinary = (probs: any) => {
    const obj = { ...probs };
    const keys = Object.keys(obj);
    if (keys.length === 2) {
      let v0 = parseFloat(obj[keys[0]]);
      let v1 = parseFloat(obj[keys[1]]);
      if (v0 > 1) v0 = v0 / 100; // auto-fix whole percentages
      if (v1 > 1) v1 = v1 / 100;
      if (!isNaN(v0) && !isNaN(v1) && (v0 + v1 > 1.05 || v0 + v1 < 0.95)) {
        if (v0 >= v1) {
          obj[keys[0]] = v0.toString();
          obj[keys[1]] = Math.max(0, 1 - v0).toFixed(4); // precision format
        } else {
          obj[keys[1]] = v1.toString();
          obj[keys[0]] = Math.max(0, 1 - v1).toFixed(4);
        }
      }
    }
    return obj;
  };

  const probMarket   = normalizeBinary(ad.probabilityModel?.predictionMarket || {});
  const probHemlo    = normalizeBinary(ad.probabilityModel?.hemloModel || {});
  const ontology     = ad.ontology || {};
  const agentsDeployed = ad.agentsDeployed ?? 35000;

  const SUGGESTED = ["What will happen if YES?", "What's the key risk?", "Is Polymarket wrong?", "What would change this outcome?"];

  const formulaTotal = simFormula.reduce((s: number, f: any) => s + f.weight * (f.score / 100), 0);

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#e5e5e5", fontFamily: "'Space Grotesk', sans-serif", overflowX: "hidden" }}>

      {/* ── HERO BAND ── */}
      <div style={{ background: "#000", borderBottom: "1px solid #1a1a1a", padding: "clamp(20px,5vw,32px) clamp(16px,6vw,60px) clamp(16px,4vw,28px)" }}>
        <Link href="/polymarket" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#555", textDecoration: "none", fontSize: 12, marginBottom: 24, letterSpacing: 0.5 }}>
          <ArrowLeft size={13} /> Back to Markets
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "clamp(16px,4vw,40px)", flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#555", fontWeight: 700 }}>SIMULATION COMPLETE</span>
              <span style={{ fontSize: 10, color: "#333" }}>·</span>
              <span style={{ fontSize: 10, color: "#444" }}>{new Date(sim.created_at).toLocaleString()}</span>
            </div>
            <h1 style={{ fontSize: "clamp(16px,4vw,28px)", fontWeight: 800, color: "#fff", lineHeight: 1.3, maxWidth: 900, margin: "0 0 16px" }}>
              {sim.topic}
            </h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, padding: "3px 10px", background: "#111", border: "1px solid #222", borderRadius: 4, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                {sim.section?.replace("hemlo_", "")} market
              </span>
              <span style={{ fontSize: 10, padding: "3px 10px", background: "#111", border: "1px solid #222", borderRadius: 4, color: "#666", letterSpacing: 0.5 }}>
                {agentsDeployed.toLocaleString()} agents
              </span>
              <span style={{ fontSize: 10, padding: "3px 10px", background: "#111", border: "1px solid #222", borderRadius: 4, color: "#666", letterSpacing: 0.5 }}>
                {confidence}% confidence
              </span>
            </div>
          </div>

          {/* Big verdict number */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" }}>HEMLO VERDICT</div>
            <div style={{ fontSize: "clamp(40px,8vw,72px)", fontWeight: 900, lineHeight: 1, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>
              {hemloVerdict}%
            </div>
            <div style={{ fontSize: 11, color: diffColor, fontWeight: 700, marginTop: 6 }}>
              {divergence >= 0 ? "+" : ""}{divergence.toFixed(1)}% vs Polymarket
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ padding: "clamp(20px,5vw,40px) clamp(16px,6vw,60px)", maxWidth: 1400, margin: "0 auto" }}>

        {/* TOP STATS ROW */}
        <div className="resp-grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, marginBottom: 40, border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
          {[
            { label: "Polymarket", value: `${crowdOdds}%`, sub: "Trader Odds", color: "#fff" },
            { label: "HEMLO Score", value: `${hemloVerdict}%`, sub: "AI Consensus", color: "#fff" },
            { label: "Divergence", value: `${divergence >= 0 ? "+" : ""}${divergence.toFixed(1)}%`, sub: ad.divergenceSignal?.slice(0, 30), color: diffColor },
            { label: "Sentiment", value: sentiment.charAt(0).toUpperCase() + sentiment.slice(1), sub: `${confidence}% confidence`, color: sentiment === "bullish" ? "#22c55e" : sentiment === "bearish" ? "#ef4444" : "#aaa" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#0a0a0a", padding: "22px 24px", borderRight: i < 3 ? "1px solid #1a1a1a" : "none" }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#444", marginBottom: 10 }}>{s.label}</div>
              <div style={{ fontSize: "clamp(20px,4vw,30px)", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 8 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* PROBABILITY BAR */}
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "24px 28px", marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#444" }}>Probability Comparison</div>
            <div style={{ fontSize: 11, color: "#333" }}>{ad.probabilityModel?.insight?.slice(0, 80)}</div>
          </div>
          <div className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            {[
              { label: "Polymarket", probs: probMarket, accent: "#555" },
              { label: "HEMLO Model", probs: probHemlo, accent: "#fff" },
            ].map((m, mi) => (
              <div key={mi}>
                <div style={{ fontSize: 10, color: m.accent, fontWeight: 700, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>{m.label}</div>
                {Object.entries(m.probs).map(([label, val], i) => {
                  const pct = Math.round(parseFloat(val as string) * 100);
                  const col = i === 0 ? m.accent : "#666";
                  return (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{pct}%</span>
                      </div>
                      <div style={{ height: 3, background: "#111", borderRadius: 99, overflow: "hidden" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, delay: mi * 0.2 }}
                          style={{ height: "100%", background: col, borderRadius: 99 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* TWO COLUMN GRID */}
        <div className="resp-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 40 }}>

          {/* LEFT — Formula + Shock Events */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Simulation Formula */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#444", marginBottom: 20 }}>Simulation Formula</div>
              {simFormula.map((f: any, i: number) => {
                const fc = f.signal === "bullish" ? "#22c55e" : f.signal === "bearish" ? "#ef4444" : "#555";
                const contribution = f.weight * (f.score / 100);
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, background: "#111", border: "1px solid #222", color: "#666", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>×{f.weight.toFixed(2)}</span>
                        <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600, textTransform: "capitalize" }}>{f.factor}</span>
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: fc }}>{f.score}</span>
                        <span style={{ fontSize: 11, color: "#333" }}>→ +{contribution.toFixed(3)}</span>
                      </div>
                    </div>
                    <div style={{ height: 2, background: "#111", borderRadius: 99, overflow: "hidden" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${f.score}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                        style={{ height: "100%", background: fc, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 14, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>HEMLO Score</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: divergence >= 0 ? "#22c55e" : "#ef4444" }}>{formulaTotal.toFixed(3)}</span>
              </div>
            </div>


            {/* Shock Events */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#444" }}>Shock Events</span>
                <span style={{ fontSize: 9, background: "#111", border: "1px solid #ef444430", color: "#ef4444", padding: "2px 8px", borderRadius: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>High Impact</span>
              </div>
              {shockEvents.length === 0 && <div style={{ fontSize: 12, color: "#333" }}>No shock events recorded.</div>}
              {shockEvents.map((ev: any, i: number) => (
                <div key={i} style={{ padding: "14px 16px", background: "#000", border: "1px solid #1a1a1a", borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ddd", marginBottom: 4 }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>{ev.description}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ background: "#0a0a0a", border: "1px solid #22c55e22", borderRadius: 4, padding: "6px 10px" }}>
                      <div style={{ fontSize: 9, color: "#22c55e", fontWeight: 700, letterSpacing: 0.8, marginBottom: 3 }}>IF YES</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#22c55e" }}>{ev.impactYes >= 0 ? "+" : ""}{(ev.impactYes * 100).toFixed(0)}%</div>
                    </div>
                    <div style={{ background: "#0a0a0a", border: "1px solid #ef444422", borderRadius: 4, padding: "6px 10px" }}>
                      <div style={{ fontSize: 9, color: "#ef4444", fontWeight: 700, letterSpacing: 0.8, marginBottom: 3 }}>IF NO</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>{ev.impactNo >= 0 ? "+" : ""}{(ev.impactNo * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Signals */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#444", marginBottom: 16 }}>Key Signals Missed by Crowd</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {keySignals.map((sig: string, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ width: 1, height: 1, padding: "2px 3px", background: "#333", borderRadius: 2, color: "#555", fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>{sig}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Agent Feed / State Snapshot tabs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Tabs */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a" }}>
                {(["agents", "formula", "report"] as const).map(tab => (
                  <button key={tab} onClick={() => setFeedTab(tab)} style={{
                    flex: 1, padding: "12px 0", background: "transparent",
                    border: "none", borderBottom: feedTab === tab ? "2px solid #fff" : "2px solid transparent",
                    color: feedTab === tab ? "#fff" : "#444", cursor: "pointer", fontSize: 10,
                    fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", transition: "all 0.2s",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    {tab === "agents" ? "Agent Feed" : tab === "formula" ? "State Snapshot" : "Report"}
                  </button>
                ))}
              </div>
              <div style={{ height: 480, overflowY: "auto", padding: "16px 0" }}>
                <AnimatePresence mode="wait">
                  {feedTab === "agents" && (
                    <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {agentFeed.length === 0 && <div style={{ padding: 32, color: "#444", fontSize: 12, textAlign: "center" }}>No agent data available.</div>}
                      {agentFeed.map((a: any, i: number) => (
                        <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid #0f1629", display: "flex", gap: 12 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,107,0,0.2)", border: "1px solid rgba(255,107,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#FF6B00", flexShrink: 0 }}>
                            {(a.agentType || "A").charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#d4d4d4" }}>{a.handle}</span>
                              <span style={{ fontSize: 9, padding: "1px 6px", background: "#1a2040", color: "#666", borderRadius: 4 }}>{a.agentType}</span>
                              <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>R{a.round} · {a.time}</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#999", lineHeight: 1.65 }}>{a.post}</div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                  {feedTab === "formula" && (
                    <motion.div key="formula" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "0 20px" }}>
                      <div style={{ background: "#080c18", border: "1px solid #1a2040", borderRadius: 10, padding: "14px 16px", marginBottom: 16, fontFamily: "monospace", fontSize: 11, color: "#7dd3fc", lineHeight: 1.8 }}>
{`{
  "timestamp": "${ad.stateSnapshot?.timestamp || new Date().toISOString().split("T")[0]}",
  "crowd_odds": ${crowdOdds}%,
  "hemlo_odds": ${hemloVerdict}%,
  "sentiment": ${JSON.stringify(ad.stateSnapshot?.sentiment || {})},
  "context": ${JSON.stringify(ad.stateSnapshot?.contextFactors || {}, null, 4)
    .split("\n").join("\n  ")}
}`}
                      </div>
                      {ad.stateSnapshot?.insight && (
                        <div style={{ padding: "10px 14px", background: "#000", border: "1px solid #1a1a1a", borderRadius: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Insight: </span>
                          <span style={{ fontSize: 12, color: "#888" }}>{ad.stateSnapshot.insight}</span>
                        </div>
                      )}
                      {/* Why divergent */}
                      {ad.whyDivergent && (
                        <div style={{ marginTop: 16, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid #1a2040", borderRadius: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#888", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Why HEMLO Diverges</div>
                          <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.7 }}>{ad.whyDivergent}</div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {feedTab === "report" && (
                    <motion.div key="report" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ padding: "0 20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                        <div style={{ padding: "14px 16px", background: "#000", border: "1px solid #1a1a1a", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>If YES Happens</div>
                          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>{ad.scenarioIfYes || "—"}</div>
                        </div>
                        <div style={{ padding: "14px 16px", background: "#000", border: "1px solid #1a1a1a", borderRadius: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#ef4444", marginBottom: 6, letterSpacing: 0.8, textTransform: "uppercase" }}>If NO Happens</div>
                          <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>{ad.scenarioIfNo || "—"}</div>
                        </div>
                      </div>
                      <div style={{ background: "#000", border: "1px solid #1a1a1a", borderRadius: 8, padding: "14px 16px", fontFamily: "monospace", fontSize: 11, color: "#555", lineHeight: 1.8 }}>
{`HEMLO_Score: ${formulaTotal.toFixed(3)}
YES_Probability: ${hemloVerdict}%
Confidence: ${confidence}%
Polymarket_Delta: ${divergence >= 0 ? "+" : ""}${divergence.toFixed(1)}%
Signal: ${ad.divergenceSignal || ""}
Agents_Deployed: ${agentsDeployed.toLocaleString()}`}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Ontology */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" }}>
              <button onClick={() => setOpenOnt(!openOnt)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", background: "transparent", border: "none", cursor: "pointer", color: "#555", fontFamily: "'Space Grotesk', sans-serif" }}>
                {openOnt ? <ChevronDown size={14} color="#444" /> : <ChevronRight size={14} color="#444" />}
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: "#444" }}>Entity Graph</span>
              </button>
              {openOnt && (
                <div style={{ padding: "0 clamp(12px,3vw,24px) 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#FF6B00", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Entity Types</div>
                    {(ontology.entity_types || []).map((e: string, i: number) => (
                      <div key={i} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid #1a2040", borderRadius: 6, marginBottom: 6, fontSize: 12, color: "#bbb" }}>{e}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#3b82f6", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Relation Types</div>
                    {(ontology.relation_types || []).map((r: string, i: number) => (
                      <div key={i} style={{ padding: "6px 12px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, marginBottom: 6, fontSize: 12, color: "#93c5fd" }}>{r}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* HEMLO Verdict Box */}
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, padding: "24px 28px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#444", marginBottom: 16 }}>HEMLO Verdict</div>
              {verdictLoading ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#444", fontSize: 13 }}>
                  <Loader2 size={14} className="animate-spin" color="#555" /> Generating verdict...
                </div>
              ) : verdict ? (
                <div style={{ fontSize: 14, color: "#ddd", lineHeight: 1.8 }}>{verdict}</div>
              ) : (
                <div style={{ fontSize: 13, color: "#777", lineHeight: 1.7 }}>
                  <strong style={{ color: "#aaa" }}>{ad.divergenceSignal}</strong> · {confidence}% confidence · {agentsDeployed.toLocaleString()} agents
                  <br /><br />
                  {ad.whyDivergent}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Q&A SECTION */}
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden", marginBottom: 40 }}>
          <div style={{ padding: "20px 28px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>Ask HEMLO</span>
            <span style={{ fontSize: 11, color: "#333" }}>Ask any follow-up about this prediction</span>
          </div>
          {qaMessages.length === 0 && (
            <div style={{ padding: "16px 28px", borderBottom: "1px solid #111" }}>
              <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Suggested</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => askQuestion(q)} style={{
                    padding: "5px 12px", background: "#111", border: "1px solid #222",
                    color: "#888", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11,
                    borderRadius: 4, fontWeight: 600, transition: "all 0.2s",
                  }}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {qaMessages.length > 0 && (
            <div style={{ maxHeight: 380, overflowY: "auto", padding: "16px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {qaMessages.map((msg, mi) => (
                <div key={mi} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: msg.role === "user" ? "#1a1a1a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: msg.role === "user" ? "#fff" : "#000", flexShrink: 0 }}>
                    {msg.role === "user" ? "U" : "H"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: "#333", marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>{msg.role === "user" ? "You" : "HEMLO"}</div>
                    {msg.loading
                      ? <div style={{ display: "flex", gap: 8, color: "#444", fontSize: 13 }}><Loader2 size={13} className="animate-spin" color="#555" /> Analyzing...</div>
                      : <div style={{ fontSize: 13, color: msg.role === "user" ? "#ccc" : "#eee", lineHeight: 1.75 }}>{msg.text}</div>
                    }
                  </div>
                </div>
              ))}
              <div ref={qaEndRef} />
            </div>
          )}
          <div style={{ padding: "12px clamp(12px,3vw,28px)", borderTop: "1px solid #111", display: "flex", gap: 8 }}>
            <input
              value={qaInput}
              onChange={e => setQaInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
              placeholder="Ask a question about this prediction..."
              style={{ flex: 1, background: "#000", border: "1px solid #1a1a1a", color: "#ddd", padding: "10px 14px", fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, outline: "none", borderRadius: 6 }}
            />
            <button onClick={() => askQuestion()} disabled={!qaInput.trim() || qaLoading} style={{
              padding: "10px 18px", background: qaInput.trim() && !qaLoading ? "#fff" : "#111",
              border: "none", color: qaInput.trim() && !qaLoading ? "#000" : "#333",
              cursor: qaInput.trim() && !qaLoading ? "pointer" : "default",
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6, borderRadius: 6, transition: "all 0.15s",
            }}>
              Ask
            </button>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 24, borderTop: "1px solid #1a1a1a", flexWrap: "wrap" }}>
          <Link href="/polymarket" style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", border: "1px solid #1a1a1a", color: "#555", textDecoration: "none", fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
            <ArrowLeft size={13} /> Back to Markets
          </Link>
          <button onClick={() => router.push(`/simulate/mirofish?scenario=${encodeURIComponent(sim.topic)}&seedMode=auto`)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: "#fff", border: "none", color: "#000", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, borderRadius: 6 }}>
            Run Deep Simulation
          </button>
          {sim.analysis_data && (
            <button onClick={() => setOpenRaw(!openRaw)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "transparent", border: "1px solid #1a2040", color: "#555", cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, borderRadius: 8 }}>
              {"{ }"} {openRaw ? "Hide" : "View"} Raw JSON
            </button>
          )}
        </div>
        {openRaw && (
          <div style={{ marginTop: 16, background: "#080c18", border: "1px solid #1a2040", borderRadius: 10, padding: 20, maxHeight: 400, overflowY: "auto" }}>
            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "#888" }}>{JSON.stringify(sim, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
