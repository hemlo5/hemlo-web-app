"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PaymentSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    async function confirmAndRedirect() {
      try {
        await fetch("/api/confirm-payment", { method: "POST" })
      } catch (err) {
        // Silently fail and rely on the webhook in production
      } finally {
        // Instantly redirect back to profile so the user doesn't see this page
        router.replace("/profile")
      }
    }
    confirmAndRedirect()
  }, [router])

  return (
    <div style={{ minHeight: "100vh", background: "#000" }} />
  )
}
