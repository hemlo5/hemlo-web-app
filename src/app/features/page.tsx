import type { Metadata } from "next";
import { Activity, BarChart2, FileText, Globe, Network, ScanSearch } from "lucide-react";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Features | Hemlo",
  description:
    "Hemlo combines real-time data ingestion, massively parallel AI consensus modelling, and prediction market integration.",
  alternates: { canonical: "/features" },
};

const features = [
  {
    icon: Activity,
    tag: "Real-Time Ingestion",
    title: "Live Intelligence Feed",
    description:
      "Every signal, categorised instantly. Urgent, Breaking, and Hot news enriched with AI impact analysis the moment it lands — no lag, no noise.",
    stats: [
      ["Avg. latency", "< 2s"],
      ["Sources/day", "8,000+"],
      ["Categories", "3 tiers"],
    ],
    tone: "light",
  },
  {
    icon: Network,
    tag: "AI Architecture",
    title: "Mirofish Consensus Engine",
    description:
      "Generators propose, Critics challenge, Arbiters decide. Three layers of specialised AI agents debate every possible outcome simultaneously before a final probability is written.",
    roles: [
      ["Generator", "Proposes initial outcome hypothesis"],
      ["Critic", "Challenges data and logic of proposals"],
      ["Arbiter", "Weighs all positions, writes final verdict"],
    ],
    tone: "dark",
  },
  {
    icon: ScanSearch,
    tag: "Alpha Generation",
    title: "Discover Divergence",
    description:
      "The percentage spread between human betting odds and Hemlo's simulated AI probability. A high positive divergence is your signal that markets are mispriced — and where the edge lives.",
    examples: [
      ["Trump re-elected 2028", "Hemlo 71%", "Market 48%", "+23%"],
      ["BTC > $150k by Dec", "Hemlo 64%", "Market 52%", "+12%"],
      ["Recession by Q3 2026", "Hemlo 53%", "Market 31%", "+22%"],
      ["TSLA > $400 EOY", "Hemlo 29%", "Market 41%", "−12%"],
    ],
    tone: "light",
    wide: true,
  },
  {
    icon: BarChart2,
    tag: "Equities & Crypto",
    title: "Stock & Asset Sentiment",
    description:
      "Feed any ticker into the engine. Hemlo analyses macro data, earnings catalysts, and social velocity to simulate how market sentiment will shift before the move happens.",
    stats: [
      ["Tickers tracked", "5,000+"],
      ["Data sources", "News, X/Reddit, SEC"],
      ["Sim time", "~3 min avg"],
      ["Output", "Probability + Chart"],
    ],
    tone: "dark",
  },
  {
    icon: Globe,
    tag: "Strategic Analysis",
    title: "Geopolitical War-gaming",
    description:
      "Model cascading consequences across nation-states, alliances, supply chains, and commodity markets. Ask complex what-if questions and receive structured probability trees.",
    events: [
      ["Iranian regime collapse", "38%"],
      ["US-China Taiwan standoff", "27%"],
      ["EU energy crisis recurrence", "51%"],
    ],
    tone: "light",
  },
  {
    icon: FileText,
    tag: "Transparency",
    title: "Deep Simulation Reports",
    description:
      "Every simulation outputs a full audit trail — not just a probability. Hemlo documents every agent's position, every critic challenge, and the exact reasoning the Arbiter used. Explainability built-in.",
    stats: [
      ["Avg. agent rounds", "4–7"],
      ["Bias detection", "Built-in"],
      ["Export formats", "JSON / PDF"],
      ["Confidence score", "0–100%"],
      ["Dissenting views", "Logged"],
      ["Report structure", "Ranked verdicts"],
    ],
    tone: "dark",
    wide: true,
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      eyebrow="Platform Capabilities"
      title="Every edge you need. In one platform."
      description="Hemlo combines real-time data ingestion, massively parallel AI consensus modelling, and prediction market integration to give analysts, traders, and strategists a genuine informational edge."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 18,
        }}
      >
        {features.map((feature) => {
          const Icon = feature.icon;
          const isLight = feature.tone === "light";
          return (
            <article
              key={feature.title}
              style={{
                gridColumn: feature.wide ? "1 / -1" : undefined,
                background: isLight ? "#ffffff" : "#0b0f12",
                color: isLight ? "#050505" : "#ffffff",
                border: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 0,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <Icon size={16} color={isLight ? "rgba(0,0,0,0.5)" : "#34d399"} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)",
                  }}
                >
                  {feature.tag}
                </span>
              </div>
              <h2 style={{ margin: "0 0 12px", fontSize: 28, lineHeight: 1.1 }}>{feature.title}</h2>
              <p style={{ margin: 0, color: isLight ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.58)", lineHeight: 1.7 }}>
                {feature.description}
              </p>

              {"stats" in feature && feature.stats ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 10,
                    marginTop: 24,
                  }}
                >
                  {feature.stats.map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)"}`,
                        padding: 14,
                      }}
                    >
                      <div style={{ fontSize: 10, color: isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.35)" }}>{label}</div>
                      <div style={{ marginTop: 4, fontWeight: 900 }}>{value}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {"roles" in feature && feature.roles ? (
                <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
                  {feature.roles.map(([role, desc]) => (
                    <div key={role} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", padding: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: role === "Generator" ? "#34d399" : role === "Critic" ? "#f87171" : "#ffffff" }}>{role}</span>
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>{desc}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {"examples" in feature && feature.examples ? (
                <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
                  {feature.examples.map(([label, hemlo, market, divergence]) => (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>{label}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,0,0,0.45)" }}>
                          {hemlo} · {market}
                        </div>
                      </div>
                      <strong>{divergence}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {"events" in feature && feature.events ? (
                <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
                  {feature.events.map(([event, probability]) => (
                    <div key={event} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
                      <span style={{ color: "rgba(0,0,0,0.65)", fontSize: 13 }}>{event}</span>
                      <strong>{probability}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </MarketingShell>
  );
}
