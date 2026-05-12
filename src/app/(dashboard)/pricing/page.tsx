"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Lock, ArrowRight, ShieldCheck, ArrowUpRight, Crown } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
type PlanId = "free" | "starter" | "pro" | "founder"

type Plan = {
  id: PlanId
  tag: string
  name: string
  price: string
  period: string
  description: string
  cta: string
  disabled: boolean
  highlight: boolean
  isOneTime: boolean
  features: string[]
  locked: string[]
  href?: string
}

type ProfileBilling = {
  tier?: string | null
  has_starter_pack?: boolean | null
}

type CheckoutResponse = {
  checkoutUrl?: string
  error?: string
}

const CHECKOUT_PLANS = ["starter", "pro", "founder"] as const
const PLAN_LABELS: Record<string, string> = {
  normal: "Free",
  free: "Free",
  premium: "Pro",
  pro: "Pro",
  founder: "Founder",
}

function isCheckoutPlan(value: string | null): value is (typeof CHECKOUT_PLANS)[number] {
  return !!value && CHECKOUT_PLANS.includes(value as (typeof CHECKOUT_PLANS)[number])
}

export default function PricingPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tier, setTier] = useState("normal")
  const [hasStarterPack, setHasStarterPack] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function loadBillingState() {
      const { data: authData } = await supabase.auth.getUser()
      const currentUser = authData.user
      if (!currentUser || cancelled) return

      setUser(currentUser)

      const { data } = await supabase
        .from("profiles")
        .select("tier, has_starter_pack")
        .eq("id", currentUser.id)
        .single()

      if (cancelled) return

      const profile = data as ProfileBilling | null
      if (profile?.tier) setTier(profile.tier)
      if (profile?.has_starter_pack) setHasStarterPack(true)

      const params = new URLSearchParams(window.location.search)
      const autoCheckout = params.get("checkout")
      if (isCheckoutPlan(autoCheckout)) {
        const userTier = profile?.tier || "normal"
        const owns =
          (autoCheckout === "pro" && (userTier === "pro" || userTier === "premium")) ||
          (autoCheckout === "founder" && userTier === "founder") ||
          (autoCheckout === "starter" && profile?.has_starter_pack)
        if (!owns) {
          fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: currentUser.id, email: currentUser.email, plan: autoCheckout }),
          })
            .then(r => r.json() as Promise<CheckoutResponse>)
            .then(d => { if (d.checkoutUrl) window.location.href = d.checkoutUrl })
            .catch(() => {})
        }
      }
    }

    loadBillingState()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleCheckout = async (plan: Plan) => {
    if (plan.id === "free") { router.push("/sign-up"); return }
    if (plan.disabled) return
    setLoadingPlan(plan.id)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id, email: user?.email, plan: plan.id }),
      })
      const data = await res.json() as CheckoutResponse
      if (!res.ok) throw new Error(data.error ?? "Unknown checkout error")
      if (data.checkoutUrl) window.location.href = data.checkoutUrl
    } catch (err: unknown) {
      alert("Checkout failed: " + (err instanceof Error ? err.message : "Unknown error"))
    } finally {
      setLoadingPlan(null)
    }
  }

  const isCurrent = (planId: PlanId) => {
    if (planId === "free" && (tier === "normal" || tier === "free")) return true
    if (planId === "starter" && hasStarterPack) return false // one-time, no "current"
    if (planId === "pro" && (tier === "pro" || tier === "premium")) return true
    if (planId === "founder" && tier === "founder") return true
    return false
  }

  const PLANS: Plan[] = [
    {
      id: "free",
      tag: "STARTER",
      name: "Free",
      price: "$0",
      period: "",
      description: "Start exploring AI simulations with no commitment.",
      cta: isCurrent("free") ? "Current Plan" : "Get Started",
      disabled: isCurrent("free"),
      highlight: false,
      isOneTime: false,
      features: ["2 simulations / day", "Access to basic modes", "Standard agent count"],
      locked: ["Deep analysis", "API Access", "Export options"],
    },
    {
      id: "starter",
      tag: "ONE-TIME",
      name: "Starter Pack",
      price: "$5",
      period: "",
      description: "A small one-time top-up. No subscriptions.",
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
      tag: "MOST POPULAR",
      name: "Pro",
      price: "$23.99",
      period: "/ mo",
      description: "Unlimited intelligence for daily research.",
      cta: isCurrent("pro") ? "Current Plan" : "Upgrade to Pro",
      disabled: isCurrent("pro"),
      highlight: true, // white card
      isOneTime: false,
      features: ["50 simulations / month", "All simulation modes", "10,000 agents per run", "Deep analysis & export"],
      locked: ["API Access"],
    },
    {
      id: "founder",
      tag: "FOUNDER",
      name: "Founder",
      price: "$79",
      period: "/ mo",
      description: "For heavy users and those building integrations.",
      cta: isCurrent("founder") ? "Current Plan" : "Become a Founder",
      disabled: isCurrent("founder"),
      highlight: false,
      isOneTime: false,
      features: ["200 simulations / month", "Full API Access", "Priority AI Compute", "Dedicated Support"],
      locked: [],
    },
  ]

  const STATS = [
    { value: "4-7", label: "Agent debate rounds per sim" },
    { value: "< 2s", label: "News ingestion latency" },
    { value: "8,000+", label: "Sources monitored daily" },
    { value: "100%", label: "Simulation audit trail coverage" },
  ]

  return (
    <main style={{ height: "100vh", overflowY: "auto", background: "#15191d", fontFamily: "'Inter', sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 100px" }}>

        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ marginBottom: 72 }}
        >
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700, marginBottom: 20 }}>
            Pricing
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.1, maxWidth: 480, margin: 0 }}>
              Simple, honest<br />
              <span style={{ color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>pricing.</span>
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: 0 }}>
              Start for free. Scale up your intelligence arsenal when you need it. No hidden fees.
            </p>
          </div>
        </motion.div>

        {/* Current plan callout if logged in */}
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, padding: "14px 20px", marginBottom: 40,
            }}
          >
            <Crown size={16} color="#f59e0b" />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              You are currently on the <strong style={{ color: "#fff" }}>
                {PLAN_LABELS[tier] ?? "Free"}
              </strong> plan.
            </span>
            {tier !== "founder" && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Upgrade below
              </span>
            )}
          </motion.div>
        )}

        {/* Plan grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
          {PLANS.map((plan, i) => {
            const isWhite = plan.highlight
            const current = isCurrent(plan.id)
            const isLoading = loadingPlan === plan.id

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                style={{
                  position: "relative",
                  background: isWhite ? "#fff" : "#050505",
                  border: `1px solid ${isWhite ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 0,
                  padding: "36px 28px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Corner decorators like ServicesSection */}
                <span style={{ position: "absolute", left: -1, top: -1, width: 8, height: 8, borderLeft: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`, borderTop: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}` }} />
                <span style={{ position: "absolute", right: -1, top: -1, width: 8, height: 8, borderRight: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`, borderTop: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}` }} />
                <span style={{ position: "absolute", left: -1, bottom: -1, width: 8, height: 8, borderLeft: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`, borderBottom: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}` }} />
                <span style={{ position: "absolute", right: -1, bottom: -1, width: 8, height: 8, borderRight: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}`, borderBottom: `2px solid ${isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)"}` }} />

                {/* Tag + Arrow row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: isWhite ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)" }}>
                    {plan.tag}
                  </span>
                  {current ? (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: isWhite ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)", background: isWhite ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)", padding: "4px 10px", borderRadius: 999 }}>
                      Active
                    </span>
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${isWhite ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: isWhite ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)" }}>
                      <ArrowUpRight size={13} />
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <h3 style={{ fontSize: 22, fontWeight: 700, color: isWhite ? "#000" : "#fff", marginBottom: 4 }}>{plan.name}</h3>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 12 }}>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 800, letterSpacing: "-2px", color: isWhite ? "#000" : "#fff" }}>{plan.price}</span>
                    <span style={{ fontSize: 14, color: isWhite ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.4)" }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: 13, color: isWhite ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.45)", lineHeight: 1.5, marginBottom: 28 }}>{plan.description}</p>
                </div>

                {/* CTA Button */}
                {current || plan.disabled ? (
                  <button disabled style={{
                    width: "100%", padding: "13px", borderRadius: 8,
                    background: isWhite ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${isWhite ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.1)"}`,
                    color: isWhite ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)",
                    fontSize: 13, fontWeight: 700, cursor: "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    marginBottom: 28,
                  }}>
                    <ShieldCheck size={14} /> {plan.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={!!isLoading}
                    style={{
                      width: "100%", padding: "13px", borderRadius: 8,
                      background: isWhite ? "#000" : "#fff",
                      border: "none",
                      color: isWhite ? "#fff" : "#000",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      marginBottom: 28, transition: "opacity 0.2s",
                      opacity: isLoading ? 0.6 : 1,
                    }}
                    onMouseOver={e => { if (!isLoading) e.currentTarget.style.opacity = "0.85" }}
                    onMouseOut={e => { e.currentTarget.style.opacity = "1" }}
                  >
                    {isLoading ? "Redirecting..." : plan.cta}
                    {!isLoading && <ArrowRight size={14} />}
                  </button>
                )}

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${isWhite ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)"}` }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <span style={{ color: isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)", fontSize: 9 }}>+</span>
                      <span style={{ color: isWhite ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)" }}>{f}</span>
                    </div>
                  ))}
                  {plan.locked.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, opacity: 0.4 }}>
                      <Lock size={11} color={isWhite ? "#666" : "#aaa"} />
                      <span style={{ color: isWhite ? "#666" : "#aaa", textDecoration: "line-through" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 56 }}
        >
          {STATS.map((s, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px" }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 6 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.25)" }}
        >
          Secure checkout handled via Dodo Payments. Cancel anytime. No hidden fees.
        </motion.p>
      </div>
    </main>
  )
}
