"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Zap, LogOut } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

export function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [tier, setTier] = useState("normal")
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (user) {
        setUser(user)
        supabase.from("profiles").select("tier").eq("id", user.id).single()
          .then(({ data }: any) => {
            if (data?.tier) setTier(data.tier)
          })
      }
    })
  }, [])

  const handleSignIn = async () => {
    // We use window.location.origin to ensure the redirect always matches the current domain
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const redirectTo = `${origin}/auth/callback`

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid transparent",
        background: "rgba(26,26,26,0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottomColor: "#000000",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Zap size={18} color="white" fill="white" />
        </div>
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700, fontSize: 20,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}>HEMLO</span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="hidden md:flex">
        {["Features", "Pricing", "Docs"].map((item) => (
          <Link key={item} href={item === "Pricing" ? "/pricing" : "#"}
            style={{
              color: "var(--text-secondary)",
              fontSize: 14, fontWeight: 500,
              textDecoration: "none",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            {item}
          </Link>
        ))}
      </div>

      {/* Auth buttons */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
             <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
               {user.user_metadata?.avatar_url && (
                 <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: 28, height: 28, borderRadius: "50%" }} />
               )}
               <div style={{ display: "flex", flexDirection: "column" }}>
                 <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                   {user.user_metadata?.full_name || "User"}
                 </span>
                 <span style={{ fontSize: 10, color: tier === "premium" ? "var(--accent)" : "var(--text-muted)", textTransform: "uppercase" }}>
                   {tier}
                 </span>
               </div>
             </div>
             
             <Link href="/home" style={{ color: "var(--bg-primary)", background: "var(--text-primary)", padding: "6px 16px", borderRadius: "20px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
               Dashboard
             </Link>

             <button onClick={handleSignOut} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: 6 }}>
               <LogOut size={16} />
             </button>
          </div>
        ) : (
          <>
            <button onClick={handleSignIn} style={{
              color: "var(--text-secondary)", fontSize: 14,
              fontWeight: 500, textDecoration: "none", background: "transparent", border: "none", cursor: "pointer",
              padding: "8px 16px",
              transition: "color 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Sign in
            </button>
            <button onClick={handleSignIn} style={{
              background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 14,
              padding: "10px 20px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", textDecoration: "none",
              transition: "background 0.2s, transform 0.15s", display: "inline-block",
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-hover)"
                e.currentTarget.style.transform = "translateY(-1px)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent)"
                e.currentTarget.style.transform = "translateY(0)"
              }}
            >
              Start Free →
            </button>
          </>
        )}
      </div>
    </motion.nav>
  )
}
