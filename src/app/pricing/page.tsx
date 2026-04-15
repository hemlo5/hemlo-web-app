"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, Zap, Lock, ArrowRight, ShieldCheck } from "lucide-react"
import { Navbar } from "@/components/navbar"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"

export default function PricingPage() {
  const [user, setUser] = useState<any>(null)
  const [tier, setTier] = useState<string>("normal")
  const [hasStarterPack, setHasStarterPack] = useState<boolean>(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (user) {
        setUser(user)
        supabase
          .from("profiles")
          .select("tier, has_starter_pack")
          .eq("id", user.id)
          .single()
          .then(({ data }: any) => {
            if (data?.tier) setTier(data.tier)
            if (data?.has_starter_pack) setHasStarterPack(true)
          })
      }
    })
  }, [])

  const PLANS = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "",
      description: "Start exploring AI simulations.",
      cta: "Get Started",
      href: "/sign-up",
      highlight: false,
      isOneTime: false,
      features: ["2 simulations total", "Access basic modes", "Standard agent count"],
      locked: ["Deep analysis", "API Access", "Export options"],
    },
    {
      id: "starter",
      name: "Starter Pack",
      price: "$5",
      period: "",
      description: "A small boost to test the waters.",
      cta: hasStarterPack ? "Purchased" : "Buy Starter Pack",
      href: hasStarterPack ? "#" : "/checkout?plan=starter",
      disabled: hasStarterPack,
      highlight: false,
      isOneTime: true,
      features: ["5 simulations total", "One-time purchase", "No recurring fees"],
      locked: ["API Access", "Deep analysis exports"],
    },
    {
      id: "pro",
      name: "Pro",
      price: "$23.99",
      period: "/ mo",
      description: "Unlimited power for daily intelligence.",
      cta: tier === "pro" || tier === "founder" ? "Current Plan" : "Upgrade to Pro",
      href: tier === "pro" || tier === "founder" ? "/profile" : "/checkout?plan=pro",
      disabled: tier === "pro" || tier === "founder",
      highlight: true,
      isOneTime: false,
      features: ["50 simulations / month", "All simulation modes", "10,000 agents per run", "Deep analysis & export"],
      locked: ["API Access"],
    },
    {
      id: "founder",
      name: "Founder",
      price: "$79.00",
      period: "/ mo",
      description: "For heavy users building integrations.",
      cta: tier === "founder" ? "Current Plan" : "Become a Founder",
      href: tier === "founder" ? "/profile" : "/checkout?plan=founder",
      disabled: tier === "founder",
      highlight: false,
      isOneTime: false,
      features: ["200 simulations / month", "Full API Access", "Priority AI Compute", "Dedicated Support"],
      locked: [],
    },
  ]

  return (
    <main style={{ minHeight: "100vh", background: "#000000" }}>
      <Navbar />
      <div style={{ padding: "140px 24px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Pricing</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: 16 }}>
            Simple, honest pricing.
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Start for free. Scale up your intelligence arsenal when you need it.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -4 }}
              style={{
                background: plan.highlight ? "var(--bg-black)" : "#050505",
                border: `1px solid ${plan.highlight ? "var(--accent)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "var(--radius-lg)", 
                padding: "32px 24px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                ...(plan.highlight ? { boxShadow: "0 0 80px rgba(34, 197, 94, 0.15)" } : {}),
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent)", color: "var(--bg-black)",
                  fontSize: 11, fontWeight: 800, letterSpacing: 1.5,
                  padding: "6px 16px", borderRadius: 999, textTransform: "uppercase",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Zap size={13} fill="var(--bg-black)" stroke="var(--bg-black)" /> Most Popular
                </div>
              )}
              {plan.isOneTime && !plan.highlight && (
                <div style={{
                  position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
                  background: "#1a1a1a", color: "#ddd", border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  padding: "4px 12px", borderRadius: 999, textTransform: "uppercase"
                }}>
                  Tripwire
                </div>
              )}

              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: "-2px" }}>{plan.price}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 16, fontWeight: 500 }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 32, minHeight: 40 }}>{plan.description}</div>

              {plan.disabled ? (
                <button
                  disabled
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--text-muted)", fontSize: 14, fontWeight: 700,
                    marginBottom: 32, cursor: "not-allowed", display: "flex", justifyItems: "center", justifyContent: "center", gap: 6
                  }}
                >
                  <ShieldCheck size={16} /> {plan.cta}
                </button>
              ) : (
                <button 
                  onClick={async (e) => {
                    const btn = e.currentTarget
                    const origText = btn.innerHTML
                    if (plan.id === "free") {
                      window.location.href = plan.href
                      return
                    }
                    btn.innerHTML = "Redirecting..."
                    btn.style.opacity = "0.7"
                    try {
                      const res = await fetch("/api/checkout", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ user_id: user?.id, email: user?.email, plan: plan.id }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error)
                      window.location.href = data.checkoutUrl
                    } catch (err: any) {
                      alert("Checkout failed: " + err.message)
                      btn.innerHTML = origText
                      btn.style.opacity = "1"
                    }
                  }}
                  style={{
                  display: "flex", textAlign: "center", width: "100%",
                  background: plan.highlight ? "var(--accent)" : "transparent",
                  border: plan.highlight ? "none" : "1px solid rgba(255,255,255,0.2)",
                  color: plan.highlight ? "var(--bg-black)" : "var(--text-primary)",
                  fontWeight: 700, fontSize: 14, padding: "14px",
                  borderRadius: "12px", cursor: "pointer",
                  marginBottom: 32, alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
                  onMouseEnter={(e) => {
                    if (plan.highlight) e.currentTarget.style.transform = "translateY(-2px)"
                    else e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)"
                    e.currentTarget.style.background = plan.highlight ? "var(--accent)" : "transparent"
                  }}
                >
                  {plan.cta} {plan.id !== "free" && <ArrowRight size={15} />}
                </button>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", color: "var(--text-primary)" }}>
                    <Check size={14} color="var(--accent)" strokeWidth={3} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{f}</span>
                  </div>
                ))}
                {plan.locked.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", opacity: 0.5 }}>
                    <Lock size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ color: "var(--text-muted)", textDecoration: "line-through" }}>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ textAlign: "center", marginTop: 40, fontSize: 14, color: "var(--text-muted)" }}>
          Secure checkout handled via Dodo Payments.
        </motion.p>
      </div>
    </main>
  )
}
