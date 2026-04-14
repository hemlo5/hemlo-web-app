"use client"

import { useState } from "react"
import { createClient } from "@/utils/supabase/client"

interface UpgradeButtonProps {
  className?: string
  children?: React.ReactNode
}

export default function UpgradeButton({ className, children }: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError("You must be signed in to upgrade.")
        setIsLoading(false)
        return
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.checkoutUrl) {
        setError(data.error ?? "Failed to start checkout.")
        setIsLoading(false)
        return
      }

      // Redirect to Dodo's hosted checkout page
      window.location.href = data.checkoutUrl
    } catch (err) {
      setError("An unexpected error occurred.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleUpgrade}
        disabled={isLoading}
        className={
          className ??
          "relative px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36l-2.12 2.12M8.76 15.24l-2.12 2.12M18.36 18.36l-2.12-2.12M8.76 8.76L6.64 6.64"
              />
            </svg>
            Redirecting...
          </span>
        ) : (
          children ?? "Upgrade to Premium"
        )}
      </button>

      {error && (
        <p className="text-red-400 text-sm mt-1">{error}</p>
      )}
    </div>
  )
}
