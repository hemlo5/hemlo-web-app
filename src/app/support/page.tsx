import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Support & FAQ | Hemlo",
  description: "Support and FAQ for Hemlo accounts, API access, enterprise deployment, and simulation limits.",
  alternates: { canonical: "/support" },
};

const faqs = [
  {
    q: "How is the probability score calculated?",
    a: "HEMLO uses the Mirofish engine to spawn distinct AI agents (Generators and Critics). They perform independent analysis and debate each other over multiple rounds. The final probability is derived from the weighted consensus of these agents after filtering out factual hallucinations.",
  },
  {
    q: "What data powers the Live Feed?",
    a: "We ingest high-frequency data streams including global news APIs, Polymarket live order books, and real-time social sentiment data to inform both our feed and our simulation context windows.",
  },
  {
    q: "What does 'Divergence' mean?",
    a: "Divergence is the percentage point difference between the current live betting market odds (e.g., Polymarket) and HEMLO's simulated AI probability. A high positive divergence indicates that the AI believes the event is much more likely to happen than the market currently prices it.",
  },
  {
    q: "What are the simulation limits?",
    a: "Because running parallel agent networks is highly compute-intensive, accounts on the Free plan are limited to 2 custom simulations per day. Pro users have priority compute access and a limit of 10 daily simulations with lengthier context rounds.",
  },
];

export default function SupportPage() {
  return (
    <MarketingShell
      eyebrow="Support"
      title="Support & FAQ"
      description="Need help with your account, API access, or enterprise deployment? Our technical team is here to assist."
    >
      <section style={{ background: "#1b2228", border: "1px solid #27333d", padding: 28, marginBottom: 32 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 28 }}>Contact Us</h2>
        <p style={{ margin: "0 0 22px", color: "#aab6c3", lineHeight: 1.65 }}>
          Need help with your account, API access, or enterprise deployment? Our technical team is here to assist.
        </p>
        <a
          href="mailto:hello@hemlo.ai"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ffffff",
            color: "#050505",
            textDecoration: "none",
            padding: "12px 18px",
            borderRadius: 999,
            fontWeight: 900,
          }}
        >
          Email Support
        </a>
      </section>

      <section>
        <h2 style={{ margin: "0 0 22px", fontSize: 28 }}>Frequently Asked Questions</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {faqs.map((faq) => (
            <article key={faq.q} style={{ background: "#1b2228", border: "1px solid #27333d", padding: 24 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 19 }}>{faq.q}</h3>
              <p style={{ margin: 0, color: "#aab6c3", lineHeight: 1.65 }}>{faq.a}</p>
            </article>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
