import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Vision | Hemlo",
  description:
    "Hemlo's vision for turning noisy world events into clear, actionable probability through massively parallel LLM simulation.",
  alternates: { canonical: "/vision" },
};

export default function VisionPage() {
  return (
    <MarketingShell
      eyebrow="Vision"
      title="Our Vision"
      description="We believe the future shouldn't be a guessing game. By leveraging the power of massively parallel LLMs, we are building a cognitive engine that synthesizes the noise of the world into clear, actionable probability."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 28 }}>
        <section>
          <h2 style={{ margin: "0 0 14px", fontSize: 28 }}>The Problem</h2>
          <p style={{ margin: 0, color: "#aab6c3", lineHeight: 1.75 }}>
            Human consensus is fundamentally flawed. In traditional prediction markets and intelligence gathering, the loudest voices or highest capital dictate the supposed "truth". Single-prompt AI outputs are equally prone to hallucination and inherent bias.
          </p>
        </section>
        <section>
          <h2 style={{ margin: "0 0 14px", fontSize: 28 }}>The Ethics &amp; Solution</h2>
          <p style={{ margin: 0, color: "#aab6c3", lineHeight: 1.75 }}>
            We are committed to transparent, unbiased data processing. Our models are deliberately separated into Generators and Critics, forcing a rigorous battle-testing of every outcome specifically to combat inherent model bias and provide the most objective truth possible.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
