"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Lock, ArrowRight, ShieldCheck, ArrowUpRight, LogOut, Crown, User as UserIcon } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

// ── Inline Hemlo Header matching landing page aesthetic ──────────────────────
function PricingHeader({ user, tier, onSignOut }: { user: any; tier: string; onSignOut: () => void }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const initial = (user?.user_metadata?.full_name || user?.email || "U").charAt(0).toUpperCase()
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"
  const avatarUrl = user?.user_metadata?.avatar_url

  const tierLabel: Record<string, string> = {
    normal: "Free", free: "Free", premium: "Pro", pro: "Pro", founder: "Founder",
  }

  return (
    <header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>

        {/* Logo */}
        <Link href="/polymarket" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 900, color: "#000", letterSpacing: "-1px" }}>H</span>
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>hemlo</span>
        </Link>

        {/* Nav center */}
        <nav style={{ display: "flex", gap: 4 }}>
          {[{ label: "Home", href: "/polymarket" }, { label: "Pricing", href: "/pricing" }, { label: "Dashboard", href: "/simulate/mirofish" }].map(item => (
            <Link key={item.href} href={item.href} style={{
              padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 500,
              color: item.href === "/pricing" ? "#000" : "rgba(255,255,255,0.6)",
              background: item.href === "/pricing" ? "#fff" : "transparent",
              textDecoration: "none", transition: "all 0.2s",
            }}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", padding: "4px 4px 4px 12px", borderRadius: 999 }}
          >
            {user && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>{displayName}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.5 }}>{tierLabel[tier] ?? "Free"}</div>
              </div>
            )}
            <div style={{
              width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.05)", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {user && avatarUrl
                ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{user ? initial : "?"}</span>
              }
            </div>
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)",
                  width: 240, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 16, overflow: "hidden", padding: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                }}
              >
                {user ? (
                  <>
                    <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{displayName}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{user.email}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, margin: "0 0 8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Crown size={14} color="#f59e0b" />
                        <span style={{ fontSize: 13, color: "#fff" }}>Current Plan</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 }}>{tierLabel[tier] ?? "Free"}</span>
                    </div>
                    <Link href="/profile" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "none" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <UserIcon size={14} /> Account Settings
                    </Link>
                    <button onClick={onSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, color: "rgba(239,68,68,0.8)", fontSize: 13, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }} onMouseOver={e => e.currentTarget.style.background = "rgba(239,68,68,0.08)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      <LogOut size={14} /> Sign Out
                    </button>
                  </>
                ) : (
                  <Link href="/sign-in" style={{ display: "block", padding: "12px", textAlign: "center", color: "#fff", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                    Sign In →
                  </Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

// ── Main Pricing Page ─────────────────────────────────────────────────────────
export default function PricingPage() {
  const [user, setUser] = useState<any>(null)
  const [tier, setTier] = useState<string>("normal")
  const [hasStarterPack, setHasStarterPack] = useState<boolean>(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const router = useRouter()
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

            const params = new URLSearchParams(window.location.search)
            const autoCheckout = params.get("checkout")
            if (autoCheckout && ["starter", "pro", "founder"].includes(autoCheckout)) {
              const userTier = data?.tier || "normal"
              const owns =
                (autoCheckout === "pro" && (userTier === "pro" || userTier === "premium")) ||
                (autoCheckout === "founder" && userTier === "founder") ||
                (autoCheckout === "starter" && data?.has_starter_pack)
              if (!owns) {
                fetch("/api/checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ user_id: user.id, email: user.email, plan: autoCheckout }),
                })
                  .then(r => r.json())
                  .then(d => { if (d.checkoutUrl) window.location.href = d.checkoutUrl })
                  .catch(() => {})
              }
            }
          })
      }
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setTier("normal")
  }

  const handleCheckout = async (plan: any) => {
    if (plan.id === "free") { router.push("/sign-up"); return }
    if (plan.disabled) return
    setLoadingPlan(plan.id)
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
    } finally {
      setLoadingPlan(null)
    }
  }

  const isCurrent = (planId: string) => {
    if (planId === "free" && (tier === "normal" || tier === "free")) return true
    if (planId === "starter" && hasStarterPack) return false // one-time, no "current"
    if (planId === "pro" && (tier === "pro" || tier === "premium")) return true
    if (planId === "founder" && tier === "founder") return true
    return false
  }

  const PLANS = [
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
    { value: "4–7", label: "Agent debate rounds per sim" },
    { value: "< 2s", label: "News ingestion latency" },
    { value: "8,000+", label: "Sources monitored daily" },
    { value: "100%", label: "Simulation audit trail coverage" },
  ]

  return (
    <main style={{ minHeight: "100vh", background: "#000000", fontFamily: "'Inter', sans-serif", color: "#fff" }}>
      <PricingHeader user={user} tier={tier} onSignOut={handleSignOut} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "120px 24px 100px" }}>

        {/* Header */}
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
                {({ normal: "Free", free: "Free", premium: "Pro", pro: "Pro", founder: "Founder" } as any)[tier] ?? "Free"}
              </strong> plan.
            </span>
            {tier !== "founder" && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Upgrade below ↓
              </span>
            )}
          </motion.div>
        )}

        {/* Plan Grid — alternating black/white like ServicesSection */}
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
                      ✓ Active
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
                      <span style={{ color: isWhite ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)", fontSize: 9 }}>◆</span>
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
