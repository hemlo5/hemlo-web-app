"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Lock, Play, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

type Proposal = {
  id: string;
  source: string;
  market_slug?: string;
  title: string;
  category?: string;
  end_date?: string;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  market_type?: string;
  outcomes?: Array<{ label: string; prob?: number; image?: string; icon?: string }>;
  fund_snapshot?: { availableUsdc?: number; perTradeStakeUsdc?: number; mode?: string };
  scout_score?: number;
  scout_reasons?: string[];
  proposed_outcome?: string;
  proposed_price?: number;
  proposed_stake?: number;
  hemlo_simulation_id?: string;
  hemlo_verdict?: {
    resultHref?: string;
    topOutcome?: string;
    topProbability?: number;
    marketProbability?: number;
    divergence?: number;
    confidence?: string | number;
    completedAt?: string;
  };
  status?: string;
  approval_step?: number;
  execution_status?: string;
  created_at?: string;
};

function money(value?: number) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function formatDate(value?: string) {
  if (!value) return "No end date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusColor(status?: string) {
  if (status === "executed" || status === "ready_to_execute" || status === "approved_execution_disabled") return "#22c55e";
  if (status === "executing") return "#38bdf8";
  if (status === "execution_failed") return "#fb7185";
  if (status === "approval_1_complete") return "#facc15";
  if (status === "simulation_complete") return "#38e88d";
  if (status === "needs_simulation") return "#60a5fa";
  return "#94a3b8";
}

export default function TradeScoutPage() {
  const [secret, setSecret] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sql, setSql] = useState("");

  useEffect(() => {
    setSecret(window.localStorage.getItem("hemlo:trade-scout-secret") || "");
  }, []);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  }), [secret]);

  const saveSecret = (value: string) => {
    setSecret(value);
    window.localStorage.setItem("hemlo:trade-scout-secret", value);
  };

  async function refreshProposals() {
    if (!secret) {
      setError("Paste your ADMIN_SECRET or CRON_SECRET first.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/trade-scout/proposals?limit=40", { headers });
      const data = await res.json();
      if (!res.ok) {
        setSql(data.sql || "");
        throw new Error(data.error || "Failed to load proposals");
      }
      setProposals(data.proposals || []);
      const synced = data.synced?.upserted ? ` Synced ${data.synced.upserted} recent simulations.` : "";
      setMessage(`Loaded ${data.proposals?.length || 0} proposals.${synced}`);
    } catch (err: any) {
      setError(err.message || "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }

  async function runScout() {
    if (!secret) {
      setError("Paste your ADMIN_SECRET or CRON_SECRET first.");
      return;
    }
    setRunning(true);
    setError("");
    setMessage("");
    setSql("");
    try {
      const res = await fetch("/api/trade-scout/run", { method: "POST", headers });
      const data = await res.json();
      if (!res.ok) {
        setSql(data.sql || "");
        throw new Error(data.error || "Scout run failed");
      }
      if (data.skipped) {
        setMessage(data.reason || "Scout skipped.");
      } else {
        setMessage(`Scout finished. ${data.inserted || 0} proposals saved.`);
      }
      await refreshProposals();
    } catch (err: any) {
      setError(err.message || "Scout run failed");
    } finally {
      setRunning(false);
    }
  }

  async function approve(id: string, step: 1 | 2) {
    if (!secret) {
      setError("Paste your ADMIN_SECRET or CRON_SECRET first.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/trade-scout/proposals/${id}/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ step }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setMessage(step === 1 ? "Step 1 approved." : data.note || "Step 2 approved.");
      await refreshProposals();
    } catch (err: any) {
      setError(err.message || "Approval failed");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#15191d", color: "#ffffff", padding: "clamp(22px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#7da1c4", fontSize: 12, fontWeight: 900, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 8 }}>
              Private Tool
            </div>
            <h1 style={{ fontSize: "clamp(30px, 5vw, 56px)", lineHeight: 0.95, fontWeight: 950, margin: 0 }}>
              Trade Scout
            </h1>
            <p style={{ color: "#9aa8b8", maxWidth: 680, marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>
              Finds near-expiry, non-sports prediction markets, creates proposals, and blocks execution until two manual approvals are complete.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={runScout} disabled={running} style={primaryButton}>
              {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
              Run Scout
            </button>
            <button onClick={refreshProposals} disabled={loading} style={secondaryButton}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <section style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Lock size={17} color="#a5b4fc" />
            <div style={{ fontWeight: 900 }}>Admin access</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
            <input
              value={secret}
              onChange={(event) => saveSecret(event.target.value)}
              type="password"
              placeholder="Paste ADMIN_SECRET or CRON_SECRET"
              style={inputStyle}
            />
            <button onClick={refreshProposals} style={secondaryButton}>Load</button>
          </div>
          <div style={{ color: "#748399", fontSize: 12, marginTop: 10 }}>
            Secret is stored only in this browser's local storage. Do not use this page on a shared device.
          </div>
        </section>

        {(message || error) && (
          <div style={{ ...panelStyle, borderColor: error ? "rgba(248,113,113,0.35)" : "rgba(34,197,94,0.28)", color: error ? "#fca5a5" : "#86efac" }}>
            {error || message}
          </div>
        )}

        {sql && (
          <section style={panelStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#facc15", marginBottom: 10, fontWeight: 900 }}>
              <AlertTriangle size={18} />
              Table missing
            </div>
            <p style={{ color: "#9aa8b8", fontSize: 13 }}>
              Create the `trade_proposals` table in Supabase SQL editor, then refresh.
            </p>
            <pre style={{ overflow: "auto", background: "#050505", borderRadius: 10, padding: 14, fontSize: 11, color: "#cbd5e1" }}>{sql}</pre>
          </section>
        )}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          <div style={metricCard}><Wallet size={18} /><span>Funds checked by env/manual balance</span></div>
          <div style={metricCard}><ShieldCheck size={18} /><span>2 approvals required</span></div>
          <div style={metricCard}><AlertTriangle size={18} /><span>Live execution disabled by default</span></div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 16 }}>
          {proposals.length === 0 ? (
            <div style={{ ...panelStyle, gridColumn: "1 / -1", textAlign: "center", padding: 48, color: "#8a94a6", fontWeight: 800 }}>
              No proposals loaded yet. Run scout or refresh.
            </div>
          ) : proposals.map((proposal) => {
            const topOutcomes = (proposal.outcomes || []).slice(0, 4);
            const marketHref = proposal.market_slug ? `https://polymarket.com/event/${proposal.market_slug}` : "";
            const resultHref = proposal.hemlo_verdict?.resultHref || (proposal.hemlo_simulation_id ? `/simulate/mirofish/${proposal.hemlo_simulation_id}` : "");
            const edge = Number(proposal.hemlo_verdict?.divergence);
            return (
              <article key={proposal.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#7da1c4", fontSize: 11, fontWeight: 900, textTransform: "uppercase", marginBottom: 7 }}>
                      {proposal.category || proposal.source}
                    </div>
                    <h2 style={{ margin: 0, fontSize: 20, lineHeight: 1.08, fontWeight: 950 }}>
                      {proposal.title}
                    </h2>
                  </div>
                  <div style={{ color: statusColor(proposal.status), fontSize: 12, fontWeight: 950, whiteSpace: "nowrap" }}>
                    {proposal.status || "new"}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16 }}>
                  <div style={miniStat}><span>Vol</span><strong>{money(proposal.volume)}</strong></div>
                  <div style={miniStat}><span>24h</span><strong>{money(proposal.volume_24h)}</strong></div>
                  <div style={miniStat}><span>Ends</span><strong>{formatDate(proposal.end_date)}</strong></div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                  {topOutcomes.map((outcome) => (
                    <div key={outcome.label} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 850 }}>{outcome.label}</span>
                      <strong>{outcome.prob ?? "--"}%</strong>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {(proposal.scout_reasons || []).slice(0, 4).map((reason) => (
                    <span key={reason} style={pillStyle}>{reason}</span>
                  ))}
                </div>

                <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.16)" }}>
                  <div style={{ fontSize: 11, color: "#86efac", fontWeight: 900, textTransform: "uppercase", marginBottom: 5 }}>
                    Hemlo proposal
                  </div>
                  <div style={{ fontWeight: 950 }}>
                    {proposal.proposed_outcome || "No outcome yet"} at {proposal.proposed_price ?? "--"}% · ${proposal.proposed_stake ?? proposal.fund_snapshot?.perTradeStakeUsdc ?? "--"} max
                  </div>
                  {proposal.hemlo_verdict && (
                    <div style={{ marginTop: 8, color: "#a7f3d0", fontSize: 12, lineHeight: 1.35, fontWeight: 800 }}>
                      Hemlo: {proposal.hemlo_verdict.topProbability ?? "--"}%
                      {Number.isFinite(edge) ? ` (${edge > 0 ? "+" : ""}${edge}% edge)` : ""}
                      {proposal.hemlo_verdict.completedAt ? ` · ${formatDate(proposal.hemlo_verdict.completedAt)}` : ""}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 16, flexWrap: "wrap" }}>
                  <button onClick={() => approve(proposal.id, 1)} disabled={(proposal.approval_step || 0) >= 1} style={approveButton}>
                    <CheckCircle2 size={15} /> Step 1
                  </button>
                  <button onClick={() => approve(proposal.id, 2)} disabled={(proposal.approval_step || 0) >= 2} style={approveButton}>
                    <ShieldCheck size={15} /> Step 2
                  </button>
                  {marketHref && (
                    <Link href={marketHref} target="_blank" style={linkButton}>
                      <ExternalLink size={15} /> Market
                    </Link>
                  )}
                  {resultHref && (
                    <Link href={resultHref} style={linkButton}>
                      <ExternalLink size={15} /> Hemlo
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

const panelStyle = {
  border: "1px solid #26313d",
  background: "#111820",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 16px 42px rgba(0,0,0,0.2)",
} as const;

const cardStyle = {
  ...panelStyle,
  minHeight: 430,
  display: "flex",
  flexDirection: "column",
  gap: 0,
} as const;

const inputStyle = {
  height: 44,
  borderRadius: 10,
  border: "1px solid #2b3845",
  background: "#070b10",
  color: "#fff",
  padding: "0 13px",
  outline: "none",
  fontWeight: 750,
} as const;

const primaryButton = {
  height: 42,
  borderRadius: 10,
  border: "none",
  background: "#ffffff",
  color: "#050505",
  padding: "0 16px",
  fontWeight: 950,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
} as const;

const secondaryButton = {
  height: 42,
  borderRadius: 10,
  border: "1px solid #2d3a45",
  background: "#0a1017",
  color: "#ffffff",
  padding: "0 14px",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
} as const;

const approveButton = {
  ...secondaryButton,
  height: 38,
  fontSize: 12,
} as const;

const linkButton = {
  ...approveButton,
  textDecoration: "none",
} as const;

const metricCard = {
  ...panelStyle,
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#c8d4e2",
  fontSize: 13,
  fontWeight: 850,
} as const;

const miniStat = {
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.04)",
  padding: 10,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
} as const;

const pillStyle = {
  borderRadius: 999,
  background: "rgba(96,165,250,0.12)",
  color: "#93c5fd",
  border: "1px solid rgba(96,165,250,0.2)",
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 850,
} as const;
