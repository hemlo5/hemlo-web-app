// @ts-nocheck
"use client"

import { motion } from "framer-motion"
import { Check, Zap, Lock, ArrowRight } from "lucide-react"
import { Navbar } from "@/components/navbar"
import Link from "next/link"

const PLANS = [
  {
    name: "Free",
    price: "$0", period: "",
    description: "Get started instantly.",
    cta: "Get Started", href: "/sign-up", highlight: false,
    features: ["3 simulations / month", "Tweet + Idea modes", "Overview output", "100 AI agents per run"],
    locked: ["Deep analysis", "PDF export", "10,000 agents", "All 6 modes"],
  },
  {
    name: "Pro",
    price: "$29", period: "/mo",
    description: "Unlimited power, all modes.",
    cta: "Upgrade Now", href: "#", highlight: true,
    features: ["Unlimited simulations", "All 6 simulation modes", "Deep analysis report", "10,000 agents per run", "Full internet data sweep", "PDF + JSON export", "Full simulation history"],
    locked: [],
  },
]

export default function PricingPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#000000" }}>
      <Navbar />
      <div style={{ padding: "140px 24px 100px", maxWidth: 800, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Pricing</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16 }}>
            Simple, honest pricing.
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Start free. Upgrade when the stakes get real.</p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -4 }}
              style={{
                background: plan.highlight ? "#000000" : "#050505",
                border: `1px solid ${plan.highlight ? "var(--accent)" : "#000000"}`,
                borderRadius: "var(--radius-lg)", padding: "40px 32px",
                position: "relative",
                ...(plan.highlight ? { boxShadow: "0 0 60px var(--accent-glow-sm)" } : {}),
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent)", color: "white",
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                  padding: "5px 20px", borderRadius: 999, textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Zap size={11} fill="white" /> Most Popular
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 6 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 52, fontWeight: 900, letterSpacing: "-2px" }}>{plan.price}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 18 }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>{plan.description}</div>

              <Link href={plan.href} style={{
                display: "block", textAlign: "center",
                background: plan.highlight ? "var(--accent)" : "transparent",
                border: plan.highlight ? "none" : "1px solid #000000",
                color: plan.highlight ? "white" : "var(--text-primary)",
                fontWeight: 700, fontSize: 15, padding: "15px",
                borderRadius: "var(--radius-sm)", textDecoration: "none",
                marginBottom: 32,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "background 0.2s, transform 0.15s",
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = plan.highlight ? "var(--accent-hover)" : "#000000"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = plan.highlight ? "var(--accent)" : "transparent"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                {plan.cta} <ArrowRight size={15} />
              </Link>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center" }}>
                    <Check size={15} color="var(--accent)" strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span>{f}</span>
                  </div>
                ))}
                {plan.locked.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, fontSize: 14, alignItems: "center", opacity: 0.4 }}>
                    <Lock size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ color: "var(--text-muted)", textDecoration: "line-through" }}>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ textAlign: "center", marginTop: 40, fontSize: 14, color: "var(--text-muted)" }}>
          No commitments. Cancel anytime. Simulations never expire.
        </motion.p>
      </div>
    </main>
  )
}
