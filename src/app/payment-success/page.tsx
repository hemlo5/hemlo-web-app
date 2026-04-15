"use client"

import { useEffect } from "react"
import { createClient } from "@/utils/supabase/client"

export default function PaymentSuccessPage() {
  useEffect(() => {
    async function confirmAndRedirect() {
      try {
        // Get user client-side — works reliably after external redirect
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
        console.error("[payment-success] error:", err)
      } finally {
        // Hard redirect so profile page fully reloads with latest DB data
        window.location.href = "/profile"
      }
    }

    confirmAndRedirect()
  }, [])

  // Invisible page — the user should never see this
  return <div style={{ minHeight: "100vh", background: "#000" }} />
}
