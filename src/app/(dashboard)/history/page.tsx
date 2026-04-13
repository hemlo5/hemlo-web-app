"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { History, ArrowRight, Loader2, Calendar, FileText, Activity } from "lucide-react"
import Link from "next/link"

type CustomSimItem = {
  id: string;
  scenario: string;
  domain: string;
  status: string;
  created_at: string;
  agent_count: number;
  rounds: number;
  result?: any;
  report_text?: string;
  round_logs?: any;
}

function HistoryCard({ sim, index }: { sim: CustomSimItem; index: number }) {
  // Extract report text for the snippet
  const reportTextRaw = sim.result?.report_text || sim.report_text || sim.result?.report?.report_text || sim.result?.markdown_content || "Simulation completed. View full report for details.";
  
  // Try to calculate the Hemlo percentage
  let hemloPct = sim.result?.primary_probability ?? sim.result?.final_probability;
  if (hemloPct === undefined && sim.result?.bullish_pct) hemloPct = sim.result.bullish_pct;
  
  // If not in result root, manually tally logs if present
  if (hemloPct === undefined || hemloPct === null) {
    const roundLogsData = sim.result?.round_logs || sim.round_logs;
    const logEntries: any[] = Array.isArray(roundLogsData) ? roundLogsData : roundLogsData ? Object.values(roundLogsData) : [];
    const totalYes = logEntries.reduce((s: number, r: any) => s + (r?.yes || 0), 0);
    const totalNo  = logEntries.reduce((s: number, r: any) => s + (r?.no  || 0), 0);
    if (totalYes + totalNo > 0) {
      hemloPct = Math.round((totalYes / (totalYes + totalNo)) * 100);
    }
  } else if (typeof hemloPct === 'number' && hemloPct <= 1) {
    hemloPct = Math.round(hemloPct * 100); // convert 0.8 to 80%
  } else if (typeof hemloPct === 'number') {
    hemloPct = Math.round(hemloPct);
  }

  const isRun = sim.status === "running" || sim.status === "pending";
  const isFail = sim.status === "failed";

  return (
    <Link href={`/simulate/mirofish/${sim.id}`} style={{ textDecoration: "none" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ y: -4, borderColor: "var(--accent)", boxShadow: "0 12px 40px rgba(102,244,255,0.08)" }}
        style={{
          background: "#080c14", border: "1px solid var(--border)", borderRadius: 16,
          padding: "24px", cursor: "pointer", transition: "all 0.2s",
          display: "flex", flexDirection: "column", gap: 16,
          height: "100%",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {isRun && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }}>
            <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} style={{ width: "50%", height: "100%", background: "#fff" }} />
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1, background: "rgba(102,244,255,0.1)", padding: "2px 8px", borderRadius: 4 }}>
                {sim.domain}
              </span>
              <span style={{ fontSize: 10, color: isFail ? "#ef4444" : isRun ? "var(--accent)" : "#22c55e", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                {isRun && <Activity size={10} className="animate-pulse" />}
                {sim.status}
              </span>
            </div>
            <h3 style={{ 
              fontSize: 18, fontWeight: 700, color: "var(--text-primary)", 
              lineHeight: 1.4, margin: 0,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"
            }}>
              {sim.scenario}
            </h3>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 11, background: "#111", padding: "4px 8px", borderRadius: 6, width: "fit-content" }}>
          <Calendar size={12} />
          {new Date(sim.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Odds Probability Bar */}
        {!isFail && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 11, color: "var(--accent)", width: 65, fontWeight: 700 }}>HEMLO</span>
              <div style={{ flex: 1, height: 8, background: "#1a1a1a", borderRadius: 99, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${hemloPct ?? 0}%` }} transition={{ duration: 0.8, delay: 0.2 + index * 0.05 }}
                  style={{ height: "100%", background: isRun ? "#444" : "var(--accent)", borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: isRun ? "#888" : "var(--accent)", width: 36, textAlign: "right" }}>
                {hemloPct !== null && hemloPct !== undefined ? `${hemloPct}%` : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Preview Box */}
        <div style={{ 
          background: "#030408", 
          border: "1px solid #1a1a1a", 
          borderRadius: 8, 
          padding: "16px",
          marginTop: "auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "var(--text-secondary)" }}>
            <FileText size={12} />
            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Analysis Report</span>
          </div>
          <p style={{ 
            fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
          }}>
            {isRun ? "Simulation logic executing right now..." : reportTextRaw}
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{sim.agent_count} Agents &bull; {sim.rounds} Rounds</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
            {isRun ? "Watch Live" : "View Report"} <ArrowRight size={14} />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function HistoryPage() {
  const [sims, setSims] = useState<CustomSimItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/custom-simulations")
      .then(res => res.json())
      .then(d => {
        setSims(d.simulations || [])
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
        <div style={{ 
          width: 56, height: 56, borderRadius: 14, 
          background: "linear-gradient(135deg, rgba(102,244,255,0.1), transparent)",
          border: "1px solid rgba(102,244,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <History size={28} color="var(--accent)" />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 6px 0", fontFamily: "'Space Grotesk', sans-serif" }}>
            Simulation History
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Browse your past predictions and analysis breakdowns.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "100px", gap: 12, color: "var(--text-muted)" }}>
          <Loader2 size={20} className="animate-spin" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Loading history...</span>
        </div>
      ) : sims.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px", background: "#050505", border: "1px dashed #222", borderRadius: 16 }}>
          <History size={40} color="#333" style={{ margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: 16, color: "var(--text-primary)", marginBottom: 8 }}>No simulations yet</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            Head over to the Dashboard or Simulator to run your first simulation.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fill, minmax(450px, 1fr))", 
          gap: 24 
        }}>
          {sims.map((sim, i) => (
            <HistoryCard key={sim.id} sim={sim} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
