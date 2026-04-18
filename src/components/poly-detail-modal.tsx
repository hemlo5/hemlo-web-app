"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Brain,
  RefreshCw,
  Activity,
  ChevronRight,
  BarChart2,
  Network,
  MessageSquare,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  createChart,
  ColorType,
  Time,
  AreaSeries,
} from "lightweight-charts";
import type { TrendingTopic } from "@/lib/types";

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type PolyMarket = {
  id: string;
  slug: string;
  question: string;
  outcomes: Array<{ label: string; prob: number; volumeRaw?: number; hemloProb?: number }>;
  marketType: "binary" | "categorical";
  volume: string;
  volumeRaw: number;
  volume24h: number;
  endDate: string;
  image: string;
  icon: string;
  category: string;
  active: boolean;
  closed?: boolean;
  tags: string[];
  clobTokenIds: string[];
  description?: string;
  resolutionSource?: string;
  conditionId?: string;
  liquidityClob?: number;
  lastTradePrice?: number;
  spreadPercent?: number;
  bestAsk?: number;
  bestBid?: number;
  bestBidSize?: number;
  bestAskSize?: number;
};

export type SimResult = {
  hemloVerdict: number;
  confidence: number;
  verdictLabel: string;
  divergenceSignal: string;
  whyDivergent: string;
  stateSnapshot: {
    timestamp: string;
    crowdOdds: number;
    hemloOdds: number;
    sentiment: Record<string, string>;
    contextFactors: Record<string, string>;
    insight: string;
  };
  shockEvents: Array<{
    emoji: string;
    name: string;
    description: string;
    impactYes: number;
    impactNo: number;
    type: string;
  }>;
  probabilityModel: {
    predictionMarket: Record<string, number>;
    hemloModel: Record<string, number>;
    insight: string;
  };
  simulationFormula: Array<{
    factor: string;
    weight: number;
    score: number;
    signal: string;
  }>;
  ontology: { entityTypes: string[]; relationTypes: string[] };
  agentFeed: Array<{
    agentType: string;
    handle: string;
    post: string;
    round: number;
    time: string;
  }>;
  keySignals: string[];
  scenarioIfYes: string;
  scenarioIfNo: string;
  agentsDeployed: number;
};

// ── HELPERS ───────────────────────────────────────────────────────────────────

function daysUntil(d?: string) {
  if (!d) return "?";
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff <= 0 ? "Closing" : `${diff}d`;
}

function SectionHeader({
  icon,
  label,
  tag,
}: {
  icon: React.ReactNode;
  label: string;
  tag?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ color: "var(--accent)" }}>{icon}</div>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </div>
      {tag && (
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            color: "var(--accent)",
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            borderRadius: 999,
            padding: "2px 7px",
            textTransform: "uppercase",
          }}
        >
          {tag}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "#080d1a",
        border: "1px solid #222222",
        borderRadius: 10,
        padding: "12px 14px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#7dd3fc",
        lineHeight: 1.65,
        overflow: "auto",
        margin: 0,
      }}
    >
      {children}
    </pre>
  );
}

// ── SUB-COMPONENTS ────────────────────────────────────────────────────────────

export function MiroReport({
  result,
  crowd,
  market,
}: {
  result: SimResult;
  crowd: number;
  market: TrendingTopic;
}) {
  const verdict = result.hemloVerdict;
  const diff = verdict - crowd;
  const diffColor =
    diff > 0 ? "var(--accent)" : diff < 0 ? "#ef4444" : "#999999";

  const formulaTotal =
    result.simulationFormula?.reduce(
      (s, f) => s + f.weight * (f.score / 100),
      0,
    ) ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── STATE SNAPSHOT ─── */}
      <div>
        <SectionHeader
          icon={<BarChart2 size={13} />}
          label="📊 State Snapshot"
          tag="Pre-Simulation"
        />
        <CodeBlock>{`{
  "timestamp": "${result.stateSnapshot?.timestamp ?? new Date().toISOString().split("T")[0]}",
  "market_odds": ${market.marketType === "categorical"
            ? JSON.stringify(
              Object.fromEntries(
                (market.outcomes || []).map((o) => [
                  o.label,
                  { Crowd: o.prob / 100, HEMLO: (o.hemloProb || o.prob) / 100 },
                ]),
              ),
              null,
              4,
            )
              .split("\n")
              .join("\n  ")
            : `{ "Polymarket_YES": ${(crowd / 100).toFixed(2)}, "HEMLO_YES": ${(verdict / 100).toFixed(2)} }`
          },
  "sentiment": ${JSON.stringify(result.stateSnapshot?.sentiment ?? {}, null, 4)
            .split("\n")
            .join("\n  ")},
  "context": ${JSON.stringify(
              result.stateSnapshot?.contextFactors ?? {},
              null,
              4,
            )
            .split("\n")
            .join("\n  ")}
}`}</CodeBlock>
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            borderRadius: 8,
          }}
        >
          <span
            style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}
          >
            📌 Insight:{" "}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {result.stateSnapshot?.insight}
          </span>
        </div>
      </div>

      {/* ─── SHOCK EVENTS ─── */}
      <div>
        <SectionHeader
          icon={<AlertTriangle size={13} />}
          label="⚡ Shock Events"
          tag="High-Impact Variables"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {result.shockEvents?.map((ev, i) => {
            const posImpact = ev.impactYes >= 0;
            const impColor = posImpact ? "var(--accent)" : "#ef4444";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  background: "rgba(15,20,35,0.7)",
                  border: `1px solid ${impColor}20`,
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                    {ev.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--text-primary)",
                        marginBottom: 3,
                      }}
                    >
                      {ev.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        lineHeight: 1.55,
                        marginBottom: 8,
                      }}
                    >
                      {ev.description}
                    </div>
                    <CodeBlock>{`{
  "event": "${ev.name}",
  "impact": {
    "YES": ${ev.impactYes >= 0 ? "+" : ""}${ev.impactYes.toFixed(2)},
    "NO": ${ev.impactNo >= 0 ? "+" : ""}${ev.impactNo.toFixed(2)}
  },
  "type": "${ev.type}"
}`}</CodeBlock>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── PROBABILITY MODEL ─── */}
      <div>
        <SectionHeader
          icon={<TrendingUp size={13} />}
          label="📉 Final Probability Model"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {[
            {
              label: "Polymarket",
              data: result.probabilityModel?.predictionMarket ?? {},
              color: "var(--accent)",
            },
            {
              label: "HEMLO Model",
              data: result.probabilityModel?.hemloModel ?? {},
              color: "var(--accent)",
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: "rgba(15,20,35,0.7)",
                border: `1px solid ${m.color}20`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: m.color,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {m.label}
              </div>
              {(market.marketType === "categorical" && market.outcomes
                ? market.outcomes.map((o) => o.label)
                : ["YES", "NO"]
              ).map((s, i) => {
                const isCat = market.marketType === "categorical";
                const color = isCat
                  ? `hsl(${(i * 137.5) % 360}, 70%, 65%)`
                  : s === "YES"
                    ? "var(--accent)"
                    : "#ef4444";
                const dataVal = (m.data as any)?.[s];
                const fallbackVal = 1 / (market.outcomes?.length || 2);
                const val =
                  dataVal !== undefined
                    ? Number(dataVal) <= 1
                      ? Number(dataVal) * 100
                      : Number(dataVal)
                    : fallbackVal * 100;
                return (
                  <div key={s} style={{ marginBottom: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{ color: "var(--text-muted)", fontWeight: 600 }}
                      >
                        {s}
                      </span>
                      <span style={{ color: color, fontWeight: 800 }}>
                        {val.toFixed(0)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "#222222",
                        borderRadius: 99,
                        overflow: "hidden",
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={{ duration: 1 }}
                        style={{
                          height: "100%",
                          background: color,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "8px 12px",
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            borderRadius: 8,
          }}
        >
          <span
            style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)" }}
          >
            📌 Insight:{" "}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
            {result.probabilityModel?.insight}
          </span>
        </div>
      </div>

      {/* ─── SIMULATION FORMULA ─── */}
      <div>
        <SectionHeader
          icon={<Brain size={13} />}
          label="🧬 HEMLO Simulation Formula"
        />
        <div
          style={{
            background: "rgba(15,20,35,0.6)",
            border: "1px solid #222222",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Weighted Score Breakdown
          </div>
          {result.simulationFormula?.map((f, i) => {
            const fc =
              f.signal === "bullish"
                ? "var(--accent)"
                : f.signal === "bearish"
                  ? "#ef4444"
                  : "#999999";
            const contribution = f.weight * (f.score / 100);
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        color: "var(--accent)",
                        background: "var(--accent-soft)",
                        border: "1px solid var(--accent-border)",
                        borderRadius: 4,
                        padding: "1px 5px",
                      }}
                    >
                      ×{f.weight.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {f.factor}
                    </span>
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: fc }}>
                      {f.score}
                    </span>
                    <span style={{ fontSize: 10, color: "#444444" }}>
                      → +{contribution.toFixed(3)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    height: 4,
                    background: "#222222",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${f.score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    style={{ height: "100%", background: fc, borderRadius: 99 }}
                  />
                </div>
              </div>
            );
          })}
          <div
            style={{
              borderTop: "1px solid #222222",
              paddingTop: 8,
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              HEMLO WIN SCORE
            </span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 16,
                fontWeight: 900,
                color: diffColor,
              }}
            >
              {formulaTotal.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Final output box */}
        <CodeBlock>{`🧮 FINAL SIMULATION OUTPUT
{
  "HEMLO_Score": ${formulaTotal.toFixed(3)},
  "YES_Probability": "${verdict}%",
  "Verdict": "${result.verdictLabel}",
  "Confidence": "${result.confidence}%",
  "Polymarket_Delta": "${diff >= 0 ? "+" : ""}${diff}%",
  "Signal": "${result.divergenceSignal}",
  "Agents_Deployed": ${result.agentsDeployed?.toLocaleString()}
}`}</CodeBlock>
      </div>

      {/* ─── ONTOLOGY ─── */}
      <div>
        <SectionHeader
          icon={<Network size={13} />}
          label="🔗 Generated Ontology"
          tag="Entity Graph"
        />
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
        >
          <div
            style={{
              background: "rgba(15,20,35,0.6)",
              border: "1px solid #222222",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Entity Types
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {result.ontology?.entityTypes?.map((e) => (
                <span
                  key={e}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    color: "var(--accent)",
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              background: "rgba(15,20,35,0.6)",
              border: "1px solid #222222",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--accent)",
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Relation Types
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {result.ontology?.relationTypes?.map((r) => (
                <span
                  key={r}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: "rgba(255, 255, 255,0.08)",
                    border: "1px solid rgba(255, 255, 255,0.2)",
                    borderRadius: 6,
                    padding: "3px 8px",
                    color: "#fb923c",
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── AGENT FEED ─── */}
      <div>
        <SectionHeader
          icon={<MessageSquare size={13} />}
          label="🤖 Initial Agent Activation"
          tag="Round 0"
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            background: "rgba(8,13,26,0.8)",
            border: "1px solid #222222",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {result.agentFeed?.map((ag, i) => {
            const typeMap: Record<string, { color: string; bg: string }> = {
              Organization: {
                color: "var(--accent)",
                bg: "var(--accent-soft)",
              },
              Person: { color: "var(--accent)", bg: "var(--accent-soft)" },
              Government: { color: "#ef4444", bg: "#ef444415" },
              Institution: { color: "#ffffff", bg: "#ffffff15" },
              Market: { color: "#06b6d4", bg: "#06b6d415" },
            };
            const tc = typeMap[ag.agentType] ?? {
              color: "#999999",
              bg: "#99999910",
            };
            const initials = ag.agentType?.slice(0, 2)?.toUpperCase() ?? "AG";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                style={{
                  padding: "12px 14px",
                  borderBottom:
                    i < result.agentFeed.length - 1
                      ? "1px solid #222222"
                      : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: tc.bg,
                      border: `1px solid ${tc.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: tc.color,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {ag.agentType}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          background: tc.bg,
                          border: `1px solid ${tc.color}25`,
                          borderRadius: 999,
                          padding: "1px 6px",
                          color: tc.color,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        POST
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                          marginLeft: "auto",
                        }}
                      >
                        R{ag.round} · {ag.time}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "#666666",
                        marginBottom: 4,
                      }}
                    >
                      {ag.handle}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      {ag.post}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── KEY SIGNALS + SCENARIOS ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div
          style={{
            background: "rgba(15,20,35,0.6)",
            border: "1px solid #222222",
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            📡 Key Signals Polymarket Missed
          </div>
          {result.keySignals?.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
                marginBottom: 5,
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: diffColor,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                }}
              >
                {s}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            {
              label:
                market.marketType === "categorical"
                  ? "Favorite Wins"
                  : "If YES",
              color: "var(--accent)",
              bg: "rgba(5,46,22,0.5)",
              icon: "✅",
              desc: result.scenarioIfYes,
            },
            {
              label:
                market.marketType === "categorical"
                  ? "Favorite Loses"
                  : "If NO",
              color: "#ef4444",
              bg: "rgba(45,10,10,0.5)",
              icon: "❌",
              desc: result.scenarioIfNo,
            },
          ].map((x) => (
            <div
              key={x.label}
              style={{
                background: x.bg,
                border: `1px solid ${x.color}18`,
                borderRadius: 10,
                padding: "10px 12px",
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: x.color,
                  marginBottom: 4,
                }}
              >
                {x.icon} {x.label}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                {x.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── REAL WORLD VERDICT ─── */}
      <div
        style={{
          background: `linear-gradient(135deg, ${diffColor}18, ${diffColor}06)`,
          border: `1px solid ${diffColor}30`,
          borderRadius: 12,
          padding: "16px 18px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: diffColor,
              marginBottom: 4,
            }}
          >
            🏁 HEMLO Simulation Verdict
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 900,
              color: diffColor,
              marginBottom: 4,
            }}
          >
            {result.verdictLabel}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {result.divergenceSignal} · {result.confidence}% confidence ·{" "}
            {result.agentsDeployed?.toLocaleString()} agents deployed
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginTop: 6,
              lineHeight: 1.6,
            }}
          >
            {result.whyDivergent}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 52,
              fontWeight: 900,
              color: diffColor,
              lineHeight: 1,
            }}
          >
            {result.hemloVerdict}%
          </div>
          <div style={{ fontSize: 10, color: diffColor, opacity: 0.7 }}>
            YES probability
          </div>
        </div>
      </div>
    </div>
  );
}

export function SimPanel({ market }: { market: TrendingTopic }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<SimResult | null>(null);
  const [progress, setProgress] = useState(0);
  const crowd = parseInt(market.polymarketOdds ?? "50");
  const sent = market.sentiment ?? "neutral";
  const accentColor =
    sent === "bullish"
      ? "var(--accent)"
      : sent === "bearish"
        ? "#ef4444"
        : "#ffffff";
  const verdict = result?.hemloVerdict ?? market.hemloOdds ?? 50;
  const diff = verdict - crowd;
  const diffColor =
    diff > 0 ? "var(--accent)" : diff < 0 ? "#ef4444" : "#999999";

  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (prevId.current !== market.id) {
      prevId.current = market.id ?? null;
      setPhase("idle");
      setResult(null);
      setProgress(0);

      if (market.topic) {
        setPhase("loading");
        fetch(`/api/simulation-cache?topic=${encodeURIComponent(market.topic)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d.cached) {
              setResult(d.cached);
              setPhase("done");
              setProgress(100);
            } else {
              setPhase("idle");
            }
          })
          .catch(() => setPhase("idle"));
      }
    }
  }, [market.id, market.topic]);

  const simulate = async () => {
    setPhase("loading");
    setResult(null);
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 3, 92);
      setProgress(p);
    }, 200);
    try {
      const res = await fetch("/api/simulate-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: market.topic,
          crowdOdds: crowd,
          volume: market.moneyAtStake,
          endDate: market.marketEndDate,
          category: market.category,
          marketType: market.marketType,
          outcomes: market.outcomes,
        }),
      });
      const json = await res.json();
      clearInterval(iv);
      setProgress(100);
      await new Promise((r) => setTimeout(r, 400));
      setResult(json.analysis ?? null);
      setPhase("done");
    } catch {
      clearInterval(iv);
      setPhase("idle");
    }
  };

  const stages = [
    "Generating reality seed...",
    "Building entity ontology...",
    "Activating agent network...",
    "Running shock event simulation...",
    "Calibrating weighted formula...",
    "Computing probability model...",
    "Validating against global data...",
    "Finalising HEMLO verdict...",
  ];
  const stageIdx = Math.floor((progress / 100) * stages.length);

  return (
    <div style={{ padding: "16px 24px 28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 14,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)", borderRadius: 999, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: "var(--accent)", letterSpacing: 1, textTransform: "uppercase" }}>🎯 Polymarket</span>
            <span style={{ background: `${accentColor}15`, border: `1px solid ${accentColor}25`, borderRadius: 999, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {sent === "bullish" ? "📈 Bullish" : sent === "bearish" ? "📉 Bearish" : "⚖️ Controversial"}
            </span>
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px", lineHeight: 1.3 }}>{market.topic}</h2>
          {market.impact && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.55 }}>{market.impact}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <div style={{ textAlign: "center", background: "rgba(71,85,105,0.08)", border: "1px solid #44444418", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#666666", marginBottom: 2 }}>Polymarket</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 900, color: "#999999", lineHeight: 1 }}>{crowd}%</div>
          </div>
          <div style={{ textAlign: "center", background: "linear-gradient(135deg, #111111, #0a0a0a)", border: "1px solid var(--accent-border)", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--accent)", marginBottom: 2 }}>HEMLO</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 900, color: "var(--accent)", lineHeight: 1 }}>{verdict}%</div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[
                  { icon: "💰", label: "At Stake", val: market.moneyAtStake ?? "—", color: "var(--accent)" },
                  { icon: "⏳", label: "Closes", val: daysUntil(market.marketEndDate), color: "var(--text-primary)" },
                ].map((x) => (
                  <div key={x.label} style={{ background: "rgba(15,20,35,0.5)", border: "1px solid #222222", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{x.icon} {x.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: x.color, fontFamily: "'Space Grotesk', sans-serif" }}>{x.val}</div>
                  </div>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: "0 6px 28px var(--accent-glow)" }}
                whileTap={{ scale: 0.97 }}
                onClick={simulate}
                style={{ padding: "12px 22px", background: "var(--accent)", border: "none", borderRadius: 12, color: "var(--bg-primary)", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
              >
                <Brain size={15} /> Run HEMLO Simulation
              </motion.button>
            </div>
          </motion.div>
        )}

        {phase === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ background: "#080d1a", border: "1px solid #222222", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Activity size={14} color="#ccff00" /></motion.div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ccff00", letterSpacing: 1, textTransform: "uppercase" }}>HEMLO Engine Running</span>
                <span style={{ fontSize: 11, color: "#ccff00", marginLeft: "auto" }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 3, background: "#222222", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
                <motion.div animate={{ width: `${progress}%` }} style={{ height: "100%", background: "linear-gradient(90deg, #ccff00, #b3e600, #99cc00)", borderRadius: 99 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                {stages.slice(0, stageIdx + 1).map((s, i) => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: i < stageIdx ? 9 : 10, color: i < stageIdx ? "#22c55e" : "#ccff00", fontFamily: "monospace" }}>
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: i < stageIdx ? "#22c55e" : "#ccff00" }} /> {s}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {phase === "done" && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={simulate} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "rgba(204,255,0,0.1)", border: "1px solid rgba(204,255,0,0.25)", borderRadius: 8, color: "#ccff00", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                <RefreshCw size={10} /> Re-run
              </motion.button>
            </div>
            <MiroReport result={result} crowd={crowd} market={market} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PolyDetailModal({
  market,
  onClose,
  onSimulate,
}: {
  market: PolyMarket;
  onClose: () => void;
  onSimulate: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [interval, setInterval_] = useState<string>("1w");
  const [historyData, setHistoryData] = useState<Record<string, Array<{ t: number; p: number }>>>({});
  const [loadingChart, setLoadingChart] = useState(true);
  const [orderBook, setOrderBook] = useState<{ bids: any[]; asks: any[] }>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<any[]>([]);
  const [loadingOB, setLoadingOB] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);
  const [relatedMarkets, setRelatedMarkets] = useState<PolyMarket[]>([]);
  const [showRules, setShowRules] = useState(false);

  const isBinary = market.marketType === "binary";
  const tokenIds = market.clobTokenIds || [];
  const colors = ["#ccff00", "#ffffff", "#22c55e", "#ef4444", "#06b6d4", "#b3e600", "#ec4899"];

  // Status
  const isLive = market.active && !market.closed;
  const endDate = market.endDate ? new Date(market.endDate) : null;
  const now = new Date();
  const timeRemaining = endDate ? Math.max(0, endDate.getTime() - now.getTime()) : 0;
  const daysLeft = Math.floor(timeRemaining / 86400000);
  const hoursLeft = Math.floor((timeRemaining % 86400000) / 3600000);
  const minsLeft = Math.floor((timeRemaining % 3600000) / 60000);
  const closesIn = daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h` : hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : minsLeft > 0 ? `${minsLeft}m` : "Expired";

  const fmtVol = (v: number) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${Math.round(v)}`;
  const fmtSize = (s: number) => s >= 1000 ? `${(s / 1000).toFixed(1)}K` : s.toFixed(0);

  useEffect(() => {
    if (tokenIds.length === 0) { setLoadingChart(false); return; }
    setLoadingChart(true);
    const fidelity = interval === "1h" ? "1" : interval === "6h" ? "5" : interval === "1d" ? "15" : interval === "1w" ? "60" : "360";
    Promise.all(tokenIds.map(tid => fetch(`/api/polymarket-history?tokenId=${tid}&interval=${interval}&fidelity=${fidelity}`).then(r => r.json()).then(d => ({ tid, history: d.history || [] })).catch(() => ({ tid, history: [] }))))
      .then(results => {
        const map: Record<string, any[]> = {};
        results.forEach(r => { map[r.tid] = r.history; });
        setHistoryData(map);
        setLoadingChart(false);
      });
  }, [interval, tokenIds.join(",")]);

  useEffect(() => {
    if (tokenIds.length === 0) { setLoadingOB(false); return; }
    setLoadingOB(true);
    fetch(`/api/polymarket-orderbook?tokenId=${tokenIds[0]}`).then(r => r.json()).then(d => { setOrderBook({ bids: d.bids || [], asks: d.asks || [] }); setLoadingOB(false); }).catch(() => setLoadingOB(false));
  }, [tokenIds[0]]);

  useEffect(() => {
    if (tokenIds.length === 0) { setLoadingTrades(false); return; }
    const fetchTrades = () => { fetch(`/api/polymarket-trades?tokenId=${tokenIds[0]}`).then(r => r.json()).then(d => { setTrades(d.trades || []); setLoadingTrades(false); }).catch(() => setLoadingTrades(false)); };
    fetchTrades();
    const iv = window.setInterval(fetchTrades, 30000);
    return () => clearInterval(iv);
  }, [tokenIds[0]]);

  useEffect(() => {
    const tag = (market.tags && market.tags[0]) || market.category || "";
    if (!tag) return;
    fetch(`/api/polymarket-browse?category=${encodeURIComponent(tag)}&limit=8`).then(r => r.json()).then(d => { setRelatedMarkets((d.markets || []).filter((m: PolyMarket) => m.id !== market.id).slice(0, 6)); }).catch(() => { });
  }, [market.id]);

  useEffect(() => {
    if (!chartRef.current || loadingChart) return;
    const container = chartRef.current;
    container.innerHTML = "";
    const chart = createChart(container, { width: container.clientWidth, height: 300, layout: { background: { type: ColorType.Solid, color: "#000000" }, textColor: "#999999" }, grid: { vertLines: { color: "#222222" }, horzLines: { color: "#222222" } }, timeScale: { timeVisible: true, borderColor: "#222222" }, rightPriceScale: { borderColor: "#222222", scaleMargins: { top: 0.05, bottom: 0.05 } }, crosshair: { mode: 0, vertLine: { labelBackgroundColor: "#ccff00" }, horzLine: { labelBackgroundColor: "#ccff00" } } });
    tokenIds.forEach((tid, i) => {
      const pts = (historyData[tid] || []).map(pt => ({ time: pt.t as Time, value: pt.p * 100 }));
      if (pts.length === 0) return;
      const series = chart.addSeries(AreaSeries, { lineColor: colors[i % colors.length], topColor: colors[i % colors.length] + "30", bottomColor: colors[i % colors.length] + "05", lineWidth: 2, priceFormat: { type: "custom", formatter: (p: any) => `${p.toFixed(1)}%` }, crosshairMarkerRadius: 5 });
      series.setData(pts);
    });
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { chart.applyOptions({ width: container.clientWidth }); });
    ro.observe(container);
    return () => { ro.disconnect(); chart.remove(); };
  }, [historyData, loadingChart]);

  const intervals = [{ key: "1h", label: "1H" }, { key: "6h", label: "6H" }, { key: "1d", label: "1D" }, { key: "1w", label: "1W" }, { key: "1m", label: "1M" }, { key: "all", label: "ALL" }];

  const timeAgo = (ts: string) => { if (!ts) return ""; const diff = Date.now() - new Date(ts).getTime(); if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return `${Math.floor(diff / 86400000)}d ago`; };

  const sectionTitle = (text: string, extra?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 24px" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#999999", letterSpacing: 1.2, textTransform: "uppercase" }}>{text}</span>
      {extra}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 20 }} onClick={e => e.stopPropagation()} style={{ background: "#000000", border: "1px solid #222222", borderRadius: 16, width: "min(840px, 94vw)", maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid #222222" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
            {market.icon && <img src={market.icon} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, color: "#ffffff", lineHeight: 1.3 }}>{market.question}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                {isLive ? <span style={{ display: "flex", alignItems: "center", gap: 4, background: "#22c55e15", border: "1px solid #22c55e30", borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 800, color: "#22c55e" }}><motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />LIVE</span> : <span style={{ background: "#66666618", border: "1px solid #66666630", borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 800, color: "#666666" }}>CLOSED</span>}
                {endDate && timeRemaining > 0 && <span style={{ fontSize: 10, color: daysLeft < 1 ? "#ffffff" : "#666666", fontWeight: 700 }}>Closes in {closesIn}</span>}
                {(() => {
                  const isKalshi = market.resolutionSource?.includes("kalshi.com");
                  const link = isKalshi ? market.resolutionSource : `https://polymarket.com/event/${market.slug}`;
                  const label = isKalshi ? "Kalshi" : "Polymarket";
                  const color = isKalshi ? "#22c55e" : "#ccff00";
                  return (
                    <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color, textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                      <ExternalLink size={10} /> {label}
                    </a>
                  );
                })()}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#666666", cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #222222", overflowX: "auto" }}>
          {[ { label: "Volume", val: market.volume }, { label: "24hr Vol", val: fmtVol(market.volume24h) }, { label: "Liquidity", val: fmtVol(market.liquidityClob || 0) }, { label: "Last Trade", val: market.lastTradePrice ? `$${market.lastTradePrice.toFixed(2)}` : "—" }, { label: "Spread", val: market.spreadPercent ? `${market.spreadPercent.toFixed(2)}%` : "—" }].map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: "10px 16px", textAlign: "center", borderRight: i < 4 ? "1px solid #222222" : "none", minWidth: 100 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 800, color: "#ffffff" }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "#666666", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#999999", letterSpacing: 1.2, textTransform: "uppercase" }}>Price History</span>
            <div style={{ display: "flex", gap: 2 }}>
              {intervals.map(iv => <button key={iv.key} onClick={() => setInterval_(iv.key)} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, background: interval === iv.key ? "#ccff00" : "transparent", color: interval === iv.key ? "#fff" : "#666666" }}>{iv.label}</button>)}
            </div>
          </div>
          {loadingChart ? <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Loader2 size={16} color="#ccff00" /></motion.div><span style={{ fontSize: 12, color: "#666666" }}>Loading chart...</span></div> : <div ref={chartRef} style={{ width: "100%", height: 300, borderRadius: 8, overflow: "hidden" }} />}
        </div>
        <div style={{ padding: "0 24px 16px" }}>
          {sectionTitle("Outcomes")}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {market.outcomes.map((o, i) => {
              const barColor = isBinary ? (o.label.toLowerCase() === "yes" ? "#22c55e" : "#ef4444") : colors[i % 7];
              return (
                <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#0f1729", border: "1px solid #222222", borderRadius: 10 }}>
                  {market.icon && <img src={market.icon} alt="" style={{ width: 28, height: 28, borderRadius: 7 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>{o.label}</div>
                    <div style={{ fontSize: 10, color: "#666666" }}>
                      {typeof o.volumeRaw === "number" ? fmtVol(o.volumeRaw) : market.volume} Vol.
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 900, color: barColor, minWidth: 60, textAlign: "right" }}>{o.prob}%</div>
                  <div style={{ width: 80, height: 6, borderRadius: 3, background: "#222222", overflow: "hidden" }}><div style={{ width: `${o.prob}%`, height: "100%", background: barColor, borderRadius: 3 }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: "0 24px 16px" }}>
          <motion.button whileHover={{ scale: 1.02, boxShadow: "0 4px 24px rgba(255, 255, 255,0.3)" }} whileTap={{ scale: 0.98 }} onClick={onSimulate} style={{ width: "100%", padding: "14px 20px", background: "#ffffff", border: "none", borderRadius: 12, color: "#000000", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>SIMULATE</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function PolyCard({
  m,
  onSimulate,
  onClick,
}: {
  m: PolyMarket;
  onSimulate: () => void;
  onClick: () => void;
}) {
  const topTwo = m.outcomes.slice(0, 2);
  const isBinary = m.marketType === "binary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "#0c0f1a",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s, box-shadow 0.2s",
        cursor: "pointer",
        minHeight: 220,
      }}
      whileHover={{
        borderColor: "var(--accent)",
        boxShadow: "0 4px 24px rgba(102,244,255,0.08)",
      }}
      onClick={onClick}
    >
      {/* Card Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 22px 0px" }}>
        {m.icon && (
          <img
            src={m.icon}
            alt=""
            style={{
              width: 44,
              height: 44,
              objectFit: "cover",
              flexShrink: 0,
              borderRadius: 8,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.45,
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {m.question}
        </div>
      </div>

      <div
        style={{
          padding: "16px 22px 16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 12,
            flex: 1,
          }}
        >
          {topTwo.map((o, i) => {
            const barColor = isBinary
              ? o.label.toLowerCase() === "yes"
                ? "var(--accent)"
                : "#ef4444"
              : `hsl(${(i * 137.5 + 200) % 360}, 65%, 60%)`;
            return (
              <div key={o.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{ color: "var(--text-secondary)", fontWeight: 600 }}
                  >
                    {o.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 800,
                      color: barColor,
                    }}
                  >
                    {o.prob}%
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    background: "#222222",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${o.prob}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    style={{
                      height: "100%",
                      background: barColor,
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {m.outcomes.length > 2 && (
            <div
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                fontStyle: "italic",
              }}
            >
              +{m.outcomes.length - 2} more outcomes
            </div>
          )}
        </div>

        {!isBinary && (
          <div style={{ marginBottom: 8 }}>
            <span
              style={{
                background: "#06b6d418",
                border: "1px solid #06b6d430",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 9,
                fontWeight: 800,
                color: "#06b6d4",
                letterSpacing: 0.5,
              }}
            >
              MULTI-OUTCOME
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {m.volume} Vol.
          </span>
          <a
            href={`https://polymarket.com/event/${m.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              color: "var(--text-muted)",
              textDecoration: "none",
              opacity: 0.7,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={9} />
          </a>
        </div>
        <motion.button
          whileHover={{
            scale: 1.04,
            boxShadow: "0 4px 16px var(--accent-glow)",
          }}
          whileTap={{ scale: 0.96 }}
          onClick={(e) => {
            e.stopPropagation();
            onSimulate();
          }}
          style={{
            padding: "5px 12px",
            background: "var(--accent)",
            border: "none",
            borderRadius: 8,
            color: "var(--bg-primary)",
            fontWeight: 900,
            fontSize: 10,
            textTransform: "uppercase",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            letterSpacing: 1,
          }}
        >
          SIMULATE
        </motion.button>
      </div>
    </motion.div>
  );
}
