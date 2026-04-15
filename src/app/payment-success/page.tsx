"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { createClient } from "@/utils/supabase/client"

export default function PaymentSuccessPage() {
  const [countdown, setCountdown] = useState(4)

  useEffect(() => {
    // Fire upgrade in background
    async function confirmUpgrade() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await fetch("/api/confirm-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
          })
        }
      } catch (err) {
        console.error("[payment-success]", err)
      }
    }
    confirmUpgrade()

    // Countdown then hard redirect
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          window.location.href = "/profile"
          return 0
        }
        return c - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      fontFamily: "'Inter', sans-serif",
      padding: "24px",
      textAlign: "center",
    }}>

      {/* Animated checkmark ring */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          border: "2px solid #22c55e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 40px rgba(34, 197, 94, 0.25)",
        }}
      >
        <motion.svg
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          width="44" height="44" viewBox="0 0 44 44" fill="none"
        >
          <motion.path
            d="M8 22L18 32L36 12"
            stroke="#22c55e"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 36,
          fontWeight: 900,
          color: "#fff",
          margin: 0,
          letterSpacing: "-0.5px",
        }}>
          Welcome to Pro 🎉
        </h1>
        <p style={{ fontSize: 15, color: "#555", marginTop: 12, lineHeight: 1.6 }}>
          Your account has been upgraded. You now have access to all premium features.
        </p>
      </motion.div>

      {/* Features unlocked */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: "20px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: 360,
          width: "100%",
        }}
      >
        {[
          "10 simulations / day",
          "All parameters unlocked",
          "Priority AI compute",
          "Export & API access",
        ].map((feat, i) => (
          <motion.div
            key={feat}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 13, color: "#888" }}>{feat}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Progress bar + countdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
      >
        <div style={{ width: 240, height: 2, background: "#111", borderRadius: 99, overflow: "hidden" }}>
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            style={{ height: "100%", background: "#22c55e", borderRadius: 99 }}
          />
        </div>
        <p style={{ fontSize: 12, color: "#333", margin: 0 }}>
          Redirecting to your profile in {countdown}s
        </p>
      </motion.div>

    </div>
  )
}
