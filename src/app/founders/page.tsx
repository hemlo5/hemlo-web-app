import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Founders | Hemlo",
  description: "The founder story behind Hemlo and MiroFish-powered prediction market intelligence.",
  alternates: { canonical: "/founders" },
};

const story = [
  { chapter: "I.", text: `I'm 17, in Class 12, and I've never waited for permission to build things. While most people my age were figuring out entrance exams, I was building a backtesting engine from scratch for Indian equity markets. Fed it OHLC data, implemented Sharpe ratio tracking, win rate analysis, all of it. I thought I was building an edge. I wasn't. I was building a very sophisticated way to learn that strategy without structure is just noise.` },
  { chapter: "II.", text: `That lesson pushed me toward crypto and the places where real inefficiencies live. I built a flash loan arbitrage bot — not as a tutorial project, as an actual system I tried to run. Integrated with Aave, Uniswap V3, QuickSwap. Learned what MEV actually means in practice. Understood why latency isn't a footnote, it's the game. The idea was simple: stop predicting markets and start exploiting the gaps between them. The execution was brutal. But that's where you learn.` },
  { chapter: "III.", text: `Between those experiments I built Evercash — a budgeting app, my version of YNAB, because I was frustrated that good financial tooling was either expensive or ugly. So I made one that was free and simple enough to actually use. I used it myself. That matters. The best signal that something works is whether the builder lives in it.` },
  { chapter: "IV.", text: `Then came Broma — an AI agent that interacts with websites the way a human would. Clicks, reads the DOM, executes workflows. What I learned from that wasn't about AI — it was about interfaces. The real bottleneck isn't intelligence, it's the absence of standardization across the web. That realisation changed how I think. I stopped thinking in features and started thinking in systems.` },
  { chapter: "V.", text: `Everything I've built has come from the same belief: leverage is the point. Code, automation, systems that keep running without you — these are the only things that actually scale. I don't think most people are dumb. I think they overthink ideas and underestimate execution. They wait for conditions to be right. I've never found that useful.` },
  { chapter: "VI.", text: `Hemlo is the product all of that was pointing at. The question of "what will actually happen?" sits beneath every trade, every geopolitical bet, every strategic decision. And no one has a clean answer — not markets, not single-prompt AI, not punditry. So I built a machine to find it. This is just the opening move.` },
];

export default function FoundersPage() {
  return (
    <MarketingShell
      eyebrow="The Founder"
      title="Aniket Vaishu"
      description="Founder · Hemlo"
    >
      <section style={{ background: "#ffffff", color: "#050505", padding: "clamp(26px, 5vw, 48px)", marginBottom: 54 }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(0,0,0,0.35)", marginBottom: 22 }}>
          Why I built Hemlo
        </div>
        <h2 style={{ maxWidth: 760, margin: "0 0 24px", fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}>
          Every system I built kept running into the same wall: there was no reliable way to know what would actually happen next.
        </h2>
        <div style={{ display: "grid", gap: 16, maxWidth: 760, color: "rgba(0,0,0,0.62)", lineHeight: 1.75 }}>
          <p style={{ margin: 0 }}>
            In algo trading, my backtests looked great in simulation and broke apart in live markets. In DeFi arbitrage, I could see the opportunity but couldn't model the cascade — what happens when you execute, who else reacts, what changes.
          </p>
          <p style={{ margin: 0 }}>
            The tools that existed were either single-prompt AI — which hallucinates its way to confidence — or prediction markets, which just price the crowd's existing bias. Neither is actually telling you what's likely.
          </p>
          <p style={{ margin: 0 }}>
            The answer wasn't a smarter prompt or a better betting pool — it was a fundamentally different approach to how AI should reason about uncertainty. I built Hemlo around that.
          </p>
        </div>
      </section>

      <div style={{ display: "grid", gap: 34 }}>
        {story.map((item) => (
          <section key={item.chapter} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 20 }}>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "monospace", letterSpacing: "0.16em" }}>{item.chapter}</span>
            <p style={{ margin: 0, color: "#b7c2cf", fontSize: 17, lineHeight: 1.85 }}>{item.text}</p>
          </section>
        ))}
      </div>

      <section style={{ marginTop: 56, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Aniket Vaishu</div>
          <div style={{ color: "#768696", marginTop: 4 }}>17 · India · Builder</div>
        </div>
        {[
          ["First system built", "Age 15"],
          ["Products shipped", "4+"],
          ["Technologies broken into", "DeFi, AI, Automation, Finance"],
        ].map(([label, value]) => (
          <div key={label} style={{ borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: 16 }}>
            <div style={{ fontWeight: 900 }}>{value}</div>
            <div style={{ color: "#768696", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </section>
    </MarketingShell>
  );
}
