// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { LogOut, ChevronRight, Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "",
    features: ["2 simulations / day", "Standard parameters", "Dashboard access"],
    cta: "Current Plan",
    tier: "free",
  },
  {
    id: "starter",
    name: "Starter Pack",
    price: "$5",
    period: "",
    features: ["5 extra simulations", "One-time purchase", "No recurring fees"],
    cta: "Buy Starter Pack",
    isTripwire: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$23.99",
    period: "/mo",
    features: ["50 simulations / month", "All parameters unlocked", "Deep analysis & export"],
    cta: "Upgrade to Pro",
    tier: "pro",
    highlight: true,
  },
  {
    id: "founder",
    name: "Founder",
    price: "$79.00",
    period: "/mo",
    features: ["200 simulations / month", "Full API Access", "Priority Support"],
    cta: "Become a Founder",
    tier: "founder",
  },
]

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [usageToday, setUsageToday] = useState(0)
  const [totalSims, setTotalSims] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }
      setUser(user)

      // Profile row
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*, simulations_run, has_starter_pack")
        .eq("id", user.id)
        .single()
      setProfile(profileData)

      // Today's usage from BOTH tables
      const startOfDay = new Date()
      startOfDay.setUTCHours(0, 0, 0, 0)
      const isoToday = startOfDay.toISOString()

      const [{ count: mktToday }, { count: customToday }] = await Promise.all([
        supabase.from("simulations").select("*", { count: "exact", head: true })
          .eq("user_id", user.id).gte("created_at", isoToday),
        supabase.from("custom_simulations").select("*", { count: "exact", head: true })
          .eq("user_id", user.id).gte("created_at", isoToday),
      ])
      setUsageToday((mktToday ?? 0) + (customToday ?? 0))
      setTotalSims(profileData?.simulations_run ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleUpgrade = async (planId: string) => {
    if (!user) return
    setIsUpgrading(planId as any)
    setUpgradeError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, email: user.email, plan: planId }),
      })
      const data = await res.json()
      if (!res.ok || !data.checkoutUrl) {
        setUpgradeError(data.error ?? "Failed to start checkout.")
        setIsUpgrading(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setUpgradeError("An unexpected error occurred.")
      setIsUpgrading(false)
    }
  }

  const isPremium = profile?.tier === "pro" || profile?.tier === "founder" || profile?.tier === "premium"
  const limit = profile?.tier === "founder" ? 200 : isPremium ? 50 : 2
  const hasStarterPack = profile?.has_starter_pack === true
  const usedPct = Math.min((usageToday / limit) * 100, 100)
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "—"
  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U"

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#000", color: "#555", fontSize: 14 }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 24px" }}>

        {/* ── PAGE HEADER ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800, margin: 0 }}>Account</h1>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 0" }}>Manage your profile and plan.</p>
          </div>
          <button
            onClick={handleSignOut}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "1px solid #222", color: "#666", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        {/* ── IDENTITY ROW ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ display: "flex", alignItems: "center", gap: 20, padding: "28px 32px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, marginBottom: 24 }}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid #222" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{user?.user_metadata?.full_name || "User"}</div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>{user?.email}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, padding: "3px 10px", borderRadius: 4, border: "1px solid #2a2a2a", color: isPremium ? "#fff" : "#555", background: isPremium ? "#1a1a1a" : "transparent" }}>
                {isPremium ? "Pro" : "Free plan"}
              </span>
              <span style={{ fontSize: 10, color: "#444", padding: "3px 10px", border: "1px solid #1a1a1a", borderRadius: 4 }}>
                Since {memberSince}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── STATS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>

          {/* Today's Usage */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444", marginBottom: 16 }}>Today's Usage</div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {usageToday}
              <span style={{ fontSize: 20, color: "#333", fontWeight: 400 }}> / {limit}</span>
            </div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 6, marginBottom: 16 }}>simulations run today</div>
            <div style={{ height: 4, background: "#111", borderRadius: 2, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usedPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                style={{ height: "100%", borderRadius: 2, background: usedPct >= 100 ? "#ef4444" : "#fff" }}
              />
            </div>
            <div style={{ fontSize: 11, color: usedPct >= 100 ? "#ef4444" : "#333", marginTop: 8 }}>
              {usedPct >= 100 ? "Daily limit reached" : `${limit - usageToday} remaining`}
            </div>
          </motion.div>

          {/* Lifetime Simulations */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444", marginBottom: 16 }}>All-time</div>
            <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {totalSims}
            </div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 6, marginBottom: 16 }}>total simulations run</div>
            <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{isPremium ? "10" : "2"}</div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>daily limit</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{isPremium ? "All" : "Standard"}</div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>parameters</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── PRICING SECTION ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444", marginBottom: 20 }}>Plans</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {PLANS.map((plan) => {
              const isCurrentPlan = (plan.tier === "premium" && isPremium) || (plan.tier === "free" && !isPremium)
              return (
                <div
                  key={plan.tier}
                  style={{
                    background: plan.highlight ? "#fff" : "#0a0a0a",
                    border: `1px solid ${plan.highlight ? "#fff" : "#1a1a1a"}`,
                    borderRadius: 14,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    position: "relative",
                    transform: plan.highlight ? "scale(1.02)" : "none",
                    boxShadow: plan.highlight ? "0 20px 60px rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  {plan.highlight && (
                    <span style={{ position: "absolute", top: 16, right: 16, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, background: "#000", color: "#fff", padding: "3px 8px", borderRadius: 4 }}>
                      POPULAR
                    </span>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 800, color: plan.highlight ? "#000" : "#fff", marginBottom: 8 }}>{plan.name}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", marginBottom: 24 }}>
                    <span style={{ fontSize: 42, fontWeight: 900, color: plan.highlight ? "#000" : "#fff", lineHeight: 1 }}>{plan.price}</span>
                    <span style={{ fontSize: 14, color: plan.highlight ? "#555" : "#444", fontWeight: 400 }}>{plan.period}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                    {plan.features.map((feat) => (
                      <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Check size={13} color={plan.highlight ? "#000" : "#555"} strokeWidth={2.5} />
                        <span style={{ fontSize: 13, color: plan.highlight ? "#222" : "#666" }}>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {(() => {
                    const currentTier = profile?.tier || "free"
                    let isCurrentPlan = false
                    if (plan.id === "free" && currentTier !== "pro" && currentTier !== "founder" && currentTier !== "premium") isCurrentPlan = true
                    if (plan.id === "pro" && (currentTier === "pro" || currentTier === "premium")) isCurrentPlan = true
                    if (plan.id === "founder" && currentTier === "founder") isCurrentPlan = true

                    const isBoughtStarter = plan.id === "starter" && hasStarterPack

                    if (isCurrentPlan || isBoughtStarter) {
                      return (
                        <div
                          style={{
                            marginTop: 28,
                            display: "block",
                            textAlign: "center",
                            padding: "12px",
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 700,
                            background: plan.highlight ? "#000" : "transparent",
                            color: plan.highlight ? "#fff" : "#555",
                            border: `1px solid ${plan.highlight ? "#000" : "rgba(255,255,255,0.1)"}`,
                            opacity: 0.5,
                            cursor: "default"
                          }}
                        >
                          {isBoughtStarter ? "Purchased" : "Current Plan"}
                        </div>
                      )
                    }

                    if (plan.id !== "free") {
                      return (
                        <>
                          <button
                            onClick={() => handleUpgrade(plan.id)}
                            disabled={isUpgrading === plan.id}
                            style={{
                              marginTop: 28,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              width: "100%",
                              padding: "12px",
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: isUpgrading === plan.id ? "not-allowed" : "pointer",
                              background: plan.highlight ? "#000" : "#1a1a1a",
                              color: plan.highlight ? "#fff" : "#fff",
                              border: `1px solid ${plan.highlight ? "#000" : "#333"}`,
                              opacity: isUpgrading === plan.id ? 0.7 : 1,
                              transition: "all 0.2s"
                            }}
                          >
                            {isUpgrading === plan.id ? (
                              <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Redirecting...</>
                            ) : (
                              plan.cta
                            )}
                          </button>
                        </>
                      )
                    }
                    return null
                  })()}
                  
                  {upgradeError && plan.id === isUpgrading && (
                    <p style={{ fontSize: 11, color: "#ef4444", marginTop: 8, textAlign: "center" }}>{upgradeError}</p>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── QUICK LINKS ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#444", marginBottom: 16 }}>Quick Access</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              { label: "Run a Simulation", href: "/simulate/mirofish" },
              { label: "Explore Markets", href: "/polymarket" },
              { label: "Simulation History", href: "/history" },
              { label: "Home Dashboard", href: "/home" },
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid #111", color: "#888", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.color = "#fff" }}
                onMouseLeave={e => { e.currentTarget.style.color = "#888" }}
              >
                {link.label}
                <ChevronRight size={14} />
              </Link>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
