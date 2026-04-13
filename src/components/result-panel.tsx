"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SimulationResult } from "@/lib/utils"
import { TrendingUp, Users, Brain, Zap, CheckCircle, Lock, ChevronRight } from "lucide-react"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts"

function StatCard({ label, value, icon: Icon, delay = 0 }: { label: string; value: string | number; icon: any; delay?: number }) {
  const [displayVal, setDisplayVal] = useState(0)
  const numVal = typeof value === "number" ? value : null

  useEffect(() => {
    if (numVal === null) return
    let start = 0
    const end = numVal
    const duration = 1200
    const step = Math.ceil(end / (duration / 16))
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        start = Math.min(start + step, end)
        setDisplayVal(start)
        if (start >= end) clearInterval(interval)
      }, 16)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [numVal, delay])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "#050505",
        border: "1px solid #000000",
        borderRadius: "var(--radius)",
        padding: "20px 24px",
        display: "flex", alignItems: "center", gap: 16,
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "var(--radius-sm)",
        background: "rgba(255, 255, 255,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={20} color="var(--accent)" />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
          {numVal !== null ? displayVal.toLocaleString() : value}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
      </div>
    </motion.div>
  )
}

function SentimentChart({ data }: { data: SimulationResult["sentimentBreakdown"] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      style={{
        background: "#050505", border: "1px solid #000000",
        borderRadius: "var(--radius)", padding: "24px",
      }}
    >
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>
        Agent Reaction Breakdown
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#000000", border: "1px solid #000000", borderRadius: 8, color: "var(--text-primary)" }}
              formatter={(v: any) => [`${v}%`, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((entry) => (
            <div key={entry.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{entry.label}</span>
              <span style={{ fontSize: 14, color: "var(--text-secondary)", marginLeft: "auto", fontWeight: 700 }}>{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function TimelineChart({ data }: { data: SimulationResult["timeline"] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      style={{
        background: "#050505", border: "1px solid #000000",
        borderRadius: "var(--radius)", padding: "24px",
      }}
    >
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 24 }}>
        Sentiment Timeline
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#000000" />
          <XAxis dataKey="time" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: "#000000", border: "1px solid #000000", borderRadius: 8, color: "var(--text-primary)" }} />
          <Legend wrapperStyle={{ paddingTop: 16, color: "var(--text-secondary)", fontSize: 12 }} />
          <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="neutral" stroke="var(--text-muted)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

function KeyInsights({ insights }: { insights: string[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      style={{
        background: "#050505", border: "1px solid #000000",
        borderRadius: "var(--radius)", padding: "24px",
      }}
    >
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
        Key Insights
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
            style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
          >
            <CheckCircle size={16} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>{insight}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export function ResultPanel({ result, isPro = false }: { result: SimulationResult; isPro?: boolean }) {
  const [activeTab, setActiveTab] = useState<"overview" | "deep">("overview")

  return (
    <div className="slide-in-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: "linear-gradient(135deg, rgba(255, 255, 255,0.1) 0%, #050505 100%)",
          border: "1px solid rgba(255, 255, 255,0.3)",
          borderRadius: "var(--radius)", padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
            HEMLO Prediction
          </div>
          <div style={{
            background: "rgba(255, 255, 255,0.15)", border: "1px solid rgba(255, 255, 255,0.3)",
            borderRadius: 999, padding: "4px 14px",
            fontSize: 13, fontWeight: 700, color: "var(--accent)",
          }}>
            {result.confidenceScore}% confidence
          </div>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-primary)" }}>{result.summary}</p>
      </motion.div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <StatCard label="Agents Simulated" value={result.agentCount} icon={Users} delay={0.05} />
        <StatCard label="Data Sources" value="12 live" icon={Zap} delay={0.1} />
        <StatCard label="Confidence Score" value={`${result.confidenceScore}%`} icon={Brain} delay={0.15} />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #000000" }}>
        {["overview", "deep"].map((tab) => (
          <button
            key={tab}
            onClick={() => isPro || tab === "overview" ? setActiveTab(tab as any) : null}
            style={{
              padding: "12px 20px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
              fontSize: 14, fontWeight: 600,
              cursor: isPro || tab === "overview" ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", gap: 6,
              transition: "color 0.2s",
            }}
          >
            {tab === "overview" ? "Overview" : "Deep Analysis"}
            {tab === "deep" && !isPro && <Lock size={13} />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <SentimentChart data={result.sentimentBreakdown} />
              <TimelineChart data={result.timeline} />
            </div>
            <KeyInsights insights={result.keyInsights} />
          </motion.div>
        )}
        {activeTab === "deep" && !isPro && (
          <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            background: "#050505", border: "1px solid #000000",
            borderRadius: "var(--radius)", padding: "48px 32px",
            textAlign: "center",
          }}>
            <Lock size={32} color="var(--accent)" style={{ marginBottom: 16 }} />
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Pro Feature
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
              Deep analysis includes full agent logs, cross-group comparisons, risk scoring, and strategic recommendations.
            </p>
            <a href="/pricing" style={{
              background: "var(--accent)", color: "white",
              fontWeight: 700, fontSize: 15,
              padding: "14px 28px", borderRadius: "var(--radius-sm)",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
            }}>
              Upgrade to Pro <ChevronRight size={16} />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
