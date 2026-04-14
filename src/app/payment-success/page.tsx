"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle, XCircle } from "lucide-react"

export default function PaymentSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    async function confirmUpgrade() {
      try {
        const res = await fetch("/api/confirm-payment", { method: "POST" })
        const data = await res.json()
        if (res.ok && data.success) {
          setStatus("success")
          // Redirect to profile after 3s so the user sees the confirmation
          setTimeout(() => router.push("/profile"), 3000)
        } else {
          console.error("Upgrade confirmation failed:", data.error)
          setStatus("error")
          setTimeout(() => router.push("/profile"), 4000)
        }
      } catch {
        setStatus("error")
        setTimeout(() => router.push("/profile"), 4000)
      }
    }
    confirmUpgrade()
  }, [router])

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 24,
      textAlign: "center",
      padding: 24,
    }}>
      {status === "loading" && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ width: 48, height: 48, border: "3px solid #222", borderTopColor: "#fff", borderRadius: "50%" }}
        />
      )}

      {status === "success" && (
        <>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <CheckCircle size={72} color="#22c55e" strokeWidth={1.5} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 900, color: "#fff", margin: 0 }}>
              You&apos;re on Pro! 🎉
            </h1>
            <p style={{ fontSize: 15, color: "#555", marginTop: 10 }}>
              Your account has been upgraded. Taking you to your profile...
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
            <div style={{ width: 200, height: 3, background: "#1a1a1a", borderRadius: 99, overflow: "hidden" }}>
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
                style={{ height: "100%", background: "#22c55e", borderRadius: 99 }}
              />
            </div>
          </motion.div>
        </>
      )}

      {status === "error" && (
        <>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <XCircle size={72} color="#ef4444" strokeWidth={1.5} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 900, color: "#fff", margin: 0 }}>
              Payment received, but sync failed
            </h1>
            <p style={{ fontSize: 14, color: "#555", marginTop: 10, maxWidth: 400 }}>
              Don&apos;t worry — your payment went through. Please refresh your profile in a minute, or contact support.
            </p>
          </motion.div>
        </>
      )}
    </div>
  )
}
