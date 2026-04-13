// @ts-nocheck
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Twitter,
  Lightbulb,
  TrendingUp,
  Globe2,
  Rocket,
  Brain,
  Lock,
  ArrowRight,
  Zap,
  Clock,
  Radio,
  Flame,
  Activity,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Signal,
  Users,
  AlertCircle,
  DollarSign,
  Globe,
  Cpu,
  ShieldAlert,
  MessageCircle,
  X,
  BarChart3,
  MapPin,
  Target,
  Layers,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTrendingTopics } from "@/lib/useTrendingTopics";
import type { TrendingTopic } from "@/lib/types";
import { WorldMap } from "@/components/world-map";
import { PredictionCard } from "@/components/PredictionCard";

// ── SIMULATION MODES (carousel) ───────────────────────────────────────────────
const MODES = [
  {
    icon: Target,
    label: "Prediction Simulator",
    desc: "Polymarket vs AI — simulate prediction market outcomes.",
    href: "/simulate/prediction",
    active: true,
    color: "var(--accent)",
    bg: "linear-gradient(160deg,#050505, var(--accent))",
  },
  {

    icon: TrendingUp,
    label: "Stock Simulator",
    desc: "Simulate trader sentiment on any ticker.",
    href: "#",
    active: false,
    color: "var(--accent)",
    bg: "linear-gradient(160deg,#003d1a,var(--accent))",
  },
  {
    icon: Globe2,
    label: "Geopolitics",
    desc: "Model reactions across nations and factions.",
    href: "#",
    active: false,
    color: "#b3e600",
    bg: "linear-gradient(160deg,#1e0a4a,#b3e600)",
  },
  {
    icon: Rocket,
    label: "Product Launch",
    desc: "See adoption + churn before you ship.",
    href: "#",
    active: false,
    color: "#06b6d4",
    bg: "linear-gradient(160deg,#003a4d,#06b6d4)",
  },
  {
    icon: Brain,
    label: "Custom",
    desc: "Any prompt. Any stakes. Open-ended.",
    href: "#",
    active: false,
    color: "#ffffff",
    bg: "linear-gradient(160deg,#3d2800,#ffffff)",
  },
];

// ── CATEGORY CONFIG ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<
  string,
  { icon: any; color: string; label: string }
> = {
  tech: { icon: Cpu, color: "#06b6d4", label: "Tech" },
  finance: { icon: DollarSign, color: "var(--accent)", label: "Finance" },
  policy: { icon: ShieldAlert, color: "#b3e600", label: "Policy" },
  geo: { icon: Globe, color: "#ffffff", label: "Geo" },
  social: { icon: MessageCircle, color: "#1DA1F2", label: "Social" },
};

// ── SECTORS affected by category ──────────────────────────────────────────────
const SECTOR_MAP: Record<string, string[]> = {
  tech: [
    "Semiconductors",
    "Cloud Computing",
    "AI/ML",
    "Cybersecurity",
    "Consumer Electronics",
  ],
  finance: [
    "Banking",
    "Crypto Assets",
    "Commodities",
    "FX Markets",
    "Private Equity",
  ],
  policy: [
    "Regulatory Bodies",
    "Healthcare",
    "Defense",
    "Climate Policy",
    "Trade",
  ],
  geo: ["Energy", "Supply Chain", "Defense", "Commodities", "Shipping"],
  social: ["Media", "Advertising", "Retail", "Mental Health", "Telecoms"],
};

function getSentimentColor(sentiment: TrendingTopic["sentiment"]): string {
  switch (sentiment) {
    case "bullish":
      return "var(--accent)";
    case "bearish":
      return "#ef4444";
    case "controversial":
      return "var(--accent)";
    default:
      return "#A0A0A0";
  }
}

// ── ANIMATED COUNTER ──────────────────────────────────────────────────────────
function Counter({
  target,
  duration = 1200,
  suffix = "",
}: {
  target: number;
  duration?: number;
  suffix?: string;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const steps = 60;
    const step = target / steps;
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.floor(start));
      if (start >= target) clearInterval(id);
    }, duration / steps);
    return () => clearInterval(id);
  }, [target, duration]);
  return (
    <>
      {val.toLocaleString()}
      {suffix}
    </>
  );
}

// ── SIGNAL BARS ───────────────────────────────────────────────────────────────
function SignalBars({ value }: { value: number }) {
  const bars = 4;
  const filled = Math.round((value / 100) * bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: 4 + i * 3,
            borderRadius: 2,
            background: i < filled ? "var(--accent)" : "#000000",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ── SKELETON CARD ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: "#050505",
        border: "1px solid #000000",
        borderRadius: "var(--radius)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          className="skeleton"
          style={{ width: 32, height: 32, borderRadius: 8 }}
        />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div
            className="skeleton"
            style={{ height: 10, width: "40%", borderRadius: 4 }}
          />
          <div
            className="skeleton"
            style={{ height: 14, width: "80%", borderRadius: 4 }}
          />
        </div>
      </div>
      <div
        className="skeleton"
        style={{ height: 10, width: "90%", borderRadius: 4 }}
      />
      <div
        className="skeleton"
        style={{ height: 10, width: "60%", borderRadius: 4 }}
      />
    </div>
  );
}

// ── THREAT METER ──────────────────────────────────────────────────────────────
function ThreatMeter({ score }: { score: number }) {
  const absScore = Math.abs(score);
  const threatLevel =
    absScore > 70
      ? "CRITICAL"
      : absScore > 40
        ? "HIGH"
        : absScore > 20
          ? "MODERATE"
          : "LOW";
  const threatColor =
    absScore > 70
      ? "#ef4444"
      : absScore > 40
        ? "var(--accent)"
        : absScore > 20
          ? "#ffffff"
          : "var(--accent)";

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Threat Level
        </span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: threatColor,
          }}
        >
          {threatLevel}
        </motion.span>
      </div>
      {/* Arc-style meter */}
      <div
        style={{
          height: 10,
          background: "#000000",
          borderRadius: 99,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${absScore}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          style={{
            height: "100%",
            borderRadius: 99,
            background: `linear-gradient(90deg, var(--accent) 0%, #ffffff 40%, var(--accent) 70%, #ef4444 100%)`,
            clipPath: `inset(0 ${100 - absScore}% 0 0)`,
          }}
        />
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(90deg, transparent 60%, rgba(255,255,255,0.1) 100%)",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 9,
          color: "var(--text-muted)",
          letterSpacing: 0.5,
        }}
      >
        <span>LOW</span>
        <span>MOD</span>
        <span>HIGH</span>
        <span>CRITICAL</span>
      </div>
    </div>
  );
}

// ── SECTOR IMPACT BARS ────────────────────────────────────────────────────────
function SectorImpact({
  category,
  sentimentScore,
}: {
  category: string;
  sentimentScore: number;
}) {
  const sectors = (SECTOR_MAP[category] ?? SECTOR_MAP.tech).slice(0, 4);
  const absScore = Math.abs(sentimentScore);
  const color =
    sentimentScore > 0
      ? "var(--accent)"
      : sentimentScore < -30
        ? "#ef4444"
        : "var(--accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sectors.map((sector, i) => {
        const impact = Math.round(absScore * (0.6 + Math.random() * 0.4));
        return (
          <div key={sector}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {sector}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color }}>
                {impact}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: "#000000",
                borderRadius: 99,
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${impact}%` }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                  delay: 0.1 + i * 0.1,
                }}
                style={{ height: "100%", borderRadius: 99, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── NEWS DETAIL PANEL ─────────────────────────────────────────────────────────
function NewsDetailPanel({
  topic,
  onClose,
}: {
  topic: TrendingTopic;
  onClose: () => void;
}) {
  const router = useRouter();
  const catConfig =
    CATEGORY_CONFIG[topic.category as keyof typeof CATEGORY_CONFIG] ??
    CATEGORY_CONFIG.tech;
  const CatIcon = catConfig.icon;
  const sentimentColor = getSentimentColor(topic.sentiment);

  const handleSimulate = () => {
    // Build a meaningful prompt from the news topic
    const scenarioText = `What happens to public opinion, policy responses, and social dynamics if: "${topic.topic}"? ${topic.impact ? `Context: ${topic.impact}` : ""}`;
    // Use the full topic details as the reality seed context
    const seedText = [
      topic.topic,
      topic.impact,
      topic.affectedGroups?.length ? `Affected groups: ${topic.affectedGroups.join(", ")}` : "",
    ].filter(Boolean).join("\n\n");

    router.push(
      `/simulate/mirofish?domain=${topic.category || "custom"}&scenario=${encodeURIComponent(scenarioText)}&seed=${encodeURIComponent(seedText)}&seedMode=write`,
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#000000",
          border: "1px solid #000000",
          borderRadius: 18,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 0 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── BIG SIMULATE BUTTON (top) ── */}
        <div style={{ padding: "20px 24px 0" }}>
          <motion.button
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 4px 24px rgba(255, 255, 255,0.3)",
            }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSimulate}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: "#ffffff",
              border: "none",
              borderRadius: 12,
              color: "#000000",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            SIMULATE
          </motion.button>
        </div>

        {/* ── HEADER ── */}
        <div
          style={{
            padding: "20px 24px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            {/* Category + Urgency */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: `${catConfig.color}18`,
                  border: `1px solid ${catConfig.color}33`,
                  borderRadius: 999,
                  padding: "3px 10px",
                }}
              >
                <CatIcon size={10} color={catConfig.color} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: catConfig.color,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {catConfig.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <motion.div
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: sentimentColor,
                    boxShadow: `0 0 8px ${sentimentColor}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: sentimentColor,
                    letterSpacing: 1,
                  }}
                >
                  {topic.urgency}
                </span>
              </div>
            </div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 20,
                fontWeight: 800,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                marginBottom: 10,
              }}
            >
              {topic.topic}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.7,
              }}
            >
              {topic.impact}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#050505",
              border: "1px solid #000000",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={15} color="var(--text-muted)" />
          </button>
        </div>

        {/* ── STATS ROW ── */}
        <div
          style={{
            padding: "16px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          {[
            {
              label: "Agents Modelled",
              value: topic.agentCount.toLocaleString(),
              icon: Users,
              color: "#06b6d4",
            },
            {
              label: "Confidence",
              value: `${topic.confidence}%`,
              icon: Signal,
              color: "#22c55e",
            },
            {
              label: "Sentiment",
              value: `${topic.sentimentScore > 0 ? "+" : ""}${topic.sentimentScore}`,
              icon: BarChart3,
              color: sentimentColor,
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: "#050505",
                border: "1px solid #000000",
                borderRadius: 10,
                padding: "12px 14px",
                textAlign: "center",
              }}
            >
              <stat.icon
                size={14}
                color={stat.color}
                style={{ marginBottom: 6 }}
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: stat.color,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 2,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── BODY CONTENT ── */}
        <div
          style={{
            padding: "0 24px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Threat Meter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <ThreatMeter score={topic.sentimentScore} />
          </motion.div>

          {/* Geographical Impact Map */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <MapPin size={13} color="#ef4444" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Geographical Impact
              </span>
            </div>
            <WorldMap topics={[topic]} size="small" />
          </motion.div>

          {/* Sector Impact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <Layers size={13} color={catConfig.color} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Sector Impact
              </span>
            </div>
            <SectorImpact
              category={topic.category}
              sentimentScore={topic.sentimentScore}
            />
          </motion.div>

          {/* Affected Groups */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <Users size={13} color="#b3e600" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Affected Groups
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(topic.affectedGroups ?? []).map((g, i) => (
                <motion.div
                  key={g}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  style={{
                    background: "#b3e60011",
                    border: "1px solid #b3e60033",
                    borderRadius: 999,
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#b3e600",
                  }}
                >
                  {g}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Predicted Trajectory */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <Activity size={13} color="#ccff00" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--text-muted)",
                }}
              >
                Predicted Trajectory
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              {[
                {
                  label: "Next 6h",
                  color: sentimentColor,
                  icon: topic.sentimentScore > 0 ? TrendingUp : TrendingDown,
                },
                { label: "Next 24h", color: "#ffffff", icon: Activity },
                { label: "Next 72h", color: "var(--text-muted)", icon: Globe2 },
              ].map((t) => (
                <div
                  key={t.label}
                  style={{
                    background: "#000000",
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "center",
                  }}
                >
                  <t.icon
                    size={14}
                    color={t.color}
                    style={{ margin: "0 auto 6px" }}
                  />
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                    }}
                  >
                    {t.label}
                  </div>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: Math.random(),
                    }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: t.color,
                      margin: "6px auto 0",
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* Market Impact */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              background: "#050505",
              border: "1px solid #000000",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Target size={13} color="#ccff00" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "var(--text-muted)",
                  }}
                >
                  Impact on Prediction Markets
                </span>
              </div>
              <Link
                href="/markets"
                style={{
                  fontSize: 10,
                  color: "#ccff00",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                View markets <ArrowRight size={9} />
              </Link>
            </div>
            {[
              {
                label: "Fed Policy Markets",
                delta: topic.sentimentScore > 0 ? "+8%" : "-12%",
                color: topic.sentimentScore > 0 ? "#22c55e" : "#ef4444",
              },
              {
                label: "Geopolitical Risk Mkts",
                delta: topic.sentimentScore < -50 ? "+15%" : "-4%",
                color: topic.sentimentScore < -50 ? "#ef4444" : "#22c55e",
              },
              {
                label: "Economic Activity",
                delta: topic.sentimentScore > 30 ? "+6%" : "-9%",
                color: topic.sentimentScore > 30 ? "#22c55e" : "#ef4444",
              },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < 2 ? "1px solid #000000" : "none",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {item.label}
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 800, color: item.color }}
                >
                  {item.delta}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* HEMLO Opinion */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 255, 255,0.06), rgba(255, 255, 255,0.02))",
              border: "1px solid rgba(255, 255, 255,0.2)",
              borderRadius: 12,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
              }}
            >
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "var(--accent)",
                }}
              >
                HEMLO Intelligence Opinion
              </span>
            </div>
            {[
              topic.sentimentScore > 50
                ? `High-confidence signal. ${topic.agentCount.toLocaleString()} agents converge on a ${getSentimentColor(topic.sentiment) === "#22c55e" ? "bullish" : "bearish"} near-term trajectory. Monitor for confirmation in first 6h.`
                : `Mixed signals across agent clusters. ${topic.agentCount.toLocaleString()} agents modelled — recommend caution and position sizing below normal thresholds.`,
              `Primary sector exposure: ${(SECTOR_MAP[topic.category] ?? SECTOR_MAP.tech).slice(0, 2).join(" and ")}. Geopolitical spillover risk: ${Math.abs(topic.sentimentScore) > 60 ? "HIGH" : "MODERATE"}.`,
              `Confidence level ${topic.confidence}% — ${topic.confidence > 80 ? "strong consensus" : topic.confidence > 60 ? "moderate consensus" : "divergent views"} across simulated agent population.`,
            ].map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 + i * 0.1 }}
                style={{ display: "flex", gap: 8, marginBottom: i < 2 ? 8 : 0 }}
              >
                <span
                  style={{
                    color: "var(--accent)",
                    fontWeight: 700,
                    flexShrink: 0,
                    fontSize: 12,
                  }}
                >
                  ·
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {line}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── INTELLIGENCE CARD ─────────────────────────────────────────────────────────
function IntelligenceCard({
  topic,
  index,
  onClick,
}: {
  topic: TrendingTopic;
  index: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const catConfig = CATEGORY_CONFIG[topic.category] ?? CATEGORY_CONFIG.tech;
  const CatIcon = catConfig.icon;
  const sentimentColor = getSentimentColor(topic.sentiment);
  const isBreaking = topic.urgency === "breaking";
  const isHot = topic.urgency === "hot";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: "#050505",
        border: `1px solid ${hovered ? "var(--accent)" : isBreaking ? "rgba(255, 255, 255,0.25)" : "#000000"}`,
        borderRadius: "var(--radius)",
        padding: "16px 18px",
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: hovered ? "0 0 24px rgba(255, 255, 255,0.18)" : "none",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
        flexShrink: 0,
      }}
    >
      {/* Left-edge sentiment bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: "#000000",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ height: "0%" }}
          animate={{ height: "100%" }}
          transition={{
            delay: 0.3 + index * 0.1,
            duration: 0.8,
            ease: "easeOut",
          }}
          style={{ background: sentimentColor, width: "100%" }}
        />
      </div>

      {isBreaking && (
        <motion.div
          animate={{ opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--accent)",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ marginLeft: 8 }}>
        {/* Top: category + urgency */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: `${catConfig.color}18`,
              border: `1px solid ${catConfig.color}33`,
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            <CatIcon size={10} color={catConfig.color} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
                color: catConfig.color,
                textTransform: "uppercase",
              }}
            >
              {catConfig.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {(isBreaking || isHot) && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{
                  duration: isBreaking ? 0.8 : 1.5,
                  repeat: Infinity,
                }}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: isBreaking ? "#ef4444" : "#ccff00",
                  boxShadow: isBreaking ? "0 0 8px #ef4444" : "0 0 8px #ccff00",
                }}
              />
            )}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: isBreaking
                  ? "#ef4444"
                  : isHot
                    ? "#ccff00"
                    : "var(--text-muted)",
              }}
            >
              {topic.urgency}
            </span>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 6,
            lineHeight: 1.4,
          }}
        >
          {topic.topic}
        </div>

        {/* Impact sentence */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          {topic.impact}
        </div>

        {/* Bottom stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <Users size={11} color="var(--text-muted)" />
            <Counter target={topic.agentCount} />
            <span style={{ marginLeft: 2 }}>agents</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <SignalBars value={topic.confidence} />
            <Counter target={topic.confidence} suffix="%" duration={600} />
          </div>
          {(topic.affectedGroups ?? []).slice(0, 2).map((g) => (
            <span
              key={g}
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
                background: "#000000",
                border: "1px solid #000000",
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {g}
            </span>
          ))}
        </div>

        {/* Hover hint */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "var(--accent)",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Click for full intelligence report <ArrowRight size={11} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── LIVE TICKER ────────────────────────────────────────────────────────────────
function LiveTicker({ topics }: { topics: TrendingTopic[] }) {
  const tickerItems =
    topics.length > 0
      ? topics.map((t) => {
          if (t.type === "prediction") {
            const div = t.divergence ?? 0;
            return `🎯 ${t.topic} → HEMLO ${t.hemloOdds ?? "?"}% · Polymarket ${t.polymarketOdds ?? "??"} · ${div >= 0 ? "⚡+" : ""}${div}%`;
          }
          return `${t.topic} → ${t.sentimentScore > 0 ? "+" : ""}${t.sentimentScore}% · ${t.agentCount.toLocaleString()} agents`;
        })
      : ["Loading live intelligence feed..."];
  const text = tickerItems.join("   ·   ");

  return (
    <div
      style={{
        borderBottom: "1px solid #000000",
        background: "#000000",
        padding: "8px 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingLeft: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
            color: "var(--accent)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            <Radio size={11} fill="var(--accent)" color="var(--accent)" />
          </motion.div>
          LIVE
        </div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: tickerItems.length * 8,
              ease: "linear",
              repeat: Infinity,
            }}
            style={{
              display: "flex",
              gap: 32,
              whiteSpace: "nowrap",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            {[...tickerItems, ...tickerItems].map((t, i) => (
              <span key={i} style={{ flexShrink: 0 }}>
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── TRENDING SIDEBAR (news only) ──────────────────────────────────────────────
function TrendSidebar({
  topics,
  loading,
  onSelect,
}: {
  topics: TrendingTopic[];
  loading: boolean;
  onSelect: (t: TrendingTopic) => void;
}) {
  return (
    <div
      style={{
        background: "#050505",
        border: "1px solid #000000",
        borderRadius: "var(--radius)",
        padding: "16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <TrendingUp size={11} /> Trending Now
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div
                  className="skeleton"
                  style={{ height: 12, width: "60%", borderRadius: 4 }}
                />
                <div
                  className="skeleton"
                  style={{ height: 4, borderRadius: 99, width: "70%" }}
                />
              </div>
            ))
          : topics.slice(0, 7).map((topic, i) => {
              const score = topic.sentimentScore;
              const isPositive = score >= 0;
              const absScore = Math.abs(score);
              const isHot = absScore > 70 || topic.urgency === "breaking";
              return (
                <motion.div
                  key={topic.id ?? i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelect(topic)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid transparent",
                    transition: "background 0.2s, border-color 0.2s",
                  }}
                  whileHover={{
                    borderColor: "rgba(255, 255, 255,0.3)",
                    backgroundColor: "rgba(255, 255, 255,0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {isHot && <span style={{ fontSize: 10 }}>🔥</span>}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {topic.topic}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginLeft: 8,
                        color: isPositive ? "#22c55e" : "#ef4444",
                      }}
                    >
                      {isPositive ? "+" : ""}
                      {score}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 3,
                      background: "#000000",
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${absScore}%` }}
                      transition={{
                        duration: 0.8,
                        delay: 0.2 + i * 0.06,
                        ease: "easeOut",
                      }}
                      style={{
                        height: "100%",
                        borderRadius: 99,
                        background: isPositive
                          ? "#22c55e"
                          : score < -30
                            ? "#ef4444"
                            : "#ccff00",
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}

// ── PREDICTION MINI-WIDGET ──────────────────────────────────────────────────────
function PredictionMiniWidget({
  predictions,
  loading,
}: {
  predictions: TrendingTopic[];
  loading: boolean;
}) {
  return (
    <div
      style={{
        background: "#050505",
        border: "1px solid #000000",
        borderRadius: "var(--radius)",
        padding: "16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Target size={11} color="#ccff00" /> Top Predictions
        </div>
        <Link
          href="/markets"
          style={{
            fontSize: 10,
            color: "#ccff00",
            textDecoration: "none",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          View all <ArrowRight size={9} />
        </Link>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: "8px 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <div
                  className="skeleton"
                  style={{ height: 10, width: "70%", borderRadius: 4 }}
                />
                <div
                  className="skeleton"
                  style={{ height: 6, borderRadius: 99 }}
                />
              </div>
            ))
          : predictions.slice(0, 4).map((t, i) => {
              const crowd = t.polymarketOdds ? parseInt(t.polymarketOdds) : 50;
              const hemlo = t.hemloOdds ?? 50;
              const div = t.divergence ?? hemlo - crowd;
              const divColor = div >= 0 ? "#22c55e" : "#ef4444";
              return (
                <Link
                  key={t.id ?? i}
                  href="/markets"
                  style={{ textDecoration: "none" }}
                >
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    whileHover={{ backgroundColor: "rgba(204,255,0,0.07)" }}
                    style={{
                      padding: "9px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginRight: 6,
                        }}
                      >
                        🎯 {t.topic}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: divColor,
                          flexShrink: 0,
                        }}
                      >
                        {div >= 0 ? "+" : ""}
                        {div}%
                      </span>
                    </div>
                    {/* Dual bar: polymarket vs HEMLO */}
                    <div
                      style={{ display: "flex", gap: 3, alignItems: "center" }}
                    >
                      <span
                        style={{ fontSize: 9, color: "#666666", flexShrink: 0 }}
                      >
                        {crowd}%
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: "#000000",
                          borderRadius: 99,
                          overflow: "hidden",
                          display: "flex",
                          gap: 1,
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${crowd}%` }}
                          transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }}
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            background: "#444444",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          flex: 1,
                          height: 4,
                          background: "#000000",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${hemlo}%` }}
                          transition={{ duration: 0.8, delay: 0.35 + i * 0.08 }}
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            background: "#ccff00",
                          }}
                        />
                      </div>
                      <span
                        style={{ fontSize: 9, color: "#ccff00", flexShrink: 0 }}
                      >
                        {hemlo}%
                      </span>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
        {predictions.length === 0 && !loading && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "10px 0",
            }}
          >
            Markets loading...
          </div>
        )}
      </div>
    </div>
  );
}

// ── UPDATED TIMESTAMP ──────────────────────────────────────────────────────────
function UpdatedAt({ lastUpdated }: { lastUpdated: Date | null }) {
  const [label, setLabel] = useState("just now");
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const diffMin = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
      setLabel(diffMin === 0 ? "just now" : `${diffMin}m ago`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Clock size={11} /> Updated {label}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(
    null,
  );
  const { topics, loading, lastUpdated } = useTrendingTopics();

  // Sort: BREAKING first → HOT → rest (news only in feed)
  const newsOnly = [...topics]
    .filter((t) => t.type !== "prediction")
    .sort((a, b) => {
      const score = (t: TrendingTopic) =>
        t.urgency === "breaking" ? 1000 : t.urgency === "hot" ? 500 : 0;
      const diff = score(b) - score(a);
      return diff !== 0 ? diff : (b.agentCount ?? 0) - (a.agentCount ?? 0);
    });
  const predictions = topics.filter((t) => t.type === "prediction");

  const scrollCarousel = (dir: number) => {
    const next = Math.max(0, Math.min(MODES.length - 1, activeIdx + dir));
    setActiveIdx(next);
    if (!carouselRef.current) return;
    const card = carouselRef.current.children[next] as HTMLElement;
    card?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* LIVE TICKER */}
      <LiveTicker topics={topics} />

      {/* ── INTELLIGENCE FEED ──────────────────────────────────────────── */}
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #000000" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Wifi size={14} color="var(--accent)" />
            </motion.div>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "var(--text-secondary)",
              }}
            >
              Live Intelligence Feed
            </span>
            {!loading && newsOnly.length > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  background: "#050505",
                  border: "1px solid #000000",
                  borderRadius: 999,
                  padding: "2px 10px",
                }}
              >
                {newsOnly.length} events
              </span>
            )}
          </div>
          <UpdatedAt lastUpdated={lastUpdated} />
        </div>

        {/* Two-column layout */}
        <div
          className="poly-layout" // repurposing the responsive 1fr auto class
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 270px",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Left: Scrollable intelligence cards — NEWS only */}
          <div
            className="mobile-scroll"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: "max(540px, calc(100vh - 200px))",
              overflowY: "auto",
              paddingRight: 4,
              scrollbarWidth: "thin",
              scrollbarColor: "#000000 transparent",
            }}
          >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : newsOnly.map((topic, i) => (
                  <IntelligenceCard
                    key={topic.id ?? i}
                    topic={topic}
                    index={i}
                    onClick={() => setSelectedTopic(topic)}
                  />
                ))}
          </div>

          {/* Right: Trending sidebar + prediction mini-widget */}
          <div className="hide-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TrendSidebar
              topics={newsOnly}
              loading={loading}
              onSelect={setSelectedTopic}
            />
            <PredictionMiniWidget predictions={predictions} loading={loading} />
          </div>
        </div>
      </div>


      {/* ── NEWS DETAIL PANEL (modal) ──────────────────────────────────── */}
      <AnimatePresence>
        {selectedTopic && (
          <NewsDetailPanel
            topic={selectedTopic}
            onClose={() => setSelectedTopic(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
