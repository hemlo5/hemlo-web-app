"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2, Cpu, CreditCard, History, Radar, Settings, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

const BOTTOM_NAV_MODES = [
  { icon: Cpu, label: "Simulate", href: "/simulate/mirofish", active: true, iconUrl: "/logo.svg" },
  { icon: BarChart2, label: "Polymarket", href: "/polymarket", active: true, iconUrl: "/polymarket.webp" },
  { icon: BarChart2, label: "Kalshi", href: "/kalshi", active: true, iconUrl: "/kalshi.webp" },
];

type AccountDrawerProps = {
  open: boolean;
  user: User | null;
  tier: string;
  onClose: () => void;
  onSignOut: () => void;
  onGoogle: () => void;
};

function AccountDrawer({ open, user, tier, onClose, onSignOut, onGoogle }: AccountDrawerProps) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Guest";
  const email = user?.email || "Sign in to save simulations";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initial = (displayName || "U").charAt(0).toUpperCase();
  const tierLabel = tier === "premium" || tier === "pro" ? "PRO" : tier === "founder" ? "FOUNDER" : "FREE";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="account-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99990,
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
            }}
          />
          <motion.aside
            key="account-drawer"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 34 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(420px, 38vw)",
              minWidth: 320,
              maxWidth: "calc(100vw - 24px)",
              zIndex: 99991,
              background: "#080a0f",
              borderRight: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "24px 0 80px rgba(0,0,0,0.55)",
              padding: 22,
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid rgba(255,255,255,0.22)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.16)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                    }}
                  >
                    {user ? initial : <Settings size={22} />}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 900,
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8d98a8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {email}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close account drawer"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(102,244,255,0.08)",
                border: "1px solid rgba(102,244,255,0.16)",
              }}
            >
              <span style={{ fontSize: 12, color: "#8d98a8", fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>
                Current Plan
              </span>
              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 950 }}>{tierLabel}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href="/profile" onClick={onClose} style={{ textDecoration: "none" }}>
                <div style={drawerLinkStyle}>
                  Profile
                  <Settings size={16} color="#8d98a8" />
                </div>
              </Link>
              <Link href="/pricing" onClick={onClose} style={{ textDecoration: "none" }}>
                <div style={drawerLinkStyle}>
                  Pricing
                  <CreditCard size={16} color="#8d98a8" />
                </div>
              </Link>
              <Link href="/history" onClick={onClose} style={{ textDecoration: "none" }}>
                <div style={drawerLinkStyle}>
                  My Sims
                  <History size={16} color="#8d98a8" />
                </div>
              </Link>
              <Link href="/trade-scout" onClick={onClose} style={{ textDecoration: "none" }}>
                <div style={drawerLinkStyle}>
                  Trade Scout
                  <Radar size={16} color="#8d98a8" />
                </div>
              </Link>
            </div>

            <div style={{ marginTop: "auto" }}>
              {user ? (
                <button
                  onClick={onSignOut}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: 14,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.24)",
                    color: "#ff8a8a",
                    fontSize: 13,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={onGoogle}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: 14,
                    background: "#ffffff",
                    border: "none",
                    color: "#000",
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Sign in with Google
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

const drawerLinkStyle = {
  padding: "14px 16px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 14,
  fontWeight: 850,
} as const;

export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [tier, setTier] = useState<string>("normal");
  const [showProfile, setShowProfile] = useState(false);
  const [supabase] = useState(() => createClient());
  const canUsePortal = typeof document !== "undefined";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;

      setUser(user);
      supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single()
        .then(({ data }) => setTier((data as { tier?: string } | null)?.tier || "normal"));
    });
  }, [supabase]);

  const doGoogleSignIn = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const redirectTo = `${origin}/auth/callback`;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account", access_type: "offline" },
      },
    });
  };

  const doSignOut = async () => {
    setShowProfile(false);
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <>
      {canUsePortal && (
        <AccountDrawer
          open={showProfile}
          user={user}
          tier={tier}
          onClose={() => setShowProfile(false)}
          onSignOut={doSignOut}
          onGoogle={doGoogleSignIn}
        />
      )}

      <nav className={`sidebar-top-nav ${['/simulate', '/polymarket', '/kalshi'].some(p => pathname.includes(p)) ? 'sim-nav-padding' : ''}`} aria-label="Primary navigation">
        {/* Left: Hemlo logo + text */}
        <Link href="/simulate/mirofish" className="hemlo-brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
          <img src="/logo.svg" alt="Hemlo" style={{ width: 26, height: 26, objectFit: "contain" }} />
          <span style={{ fontSize: 17, fontWeight: 800, color: "#ffffff", letterSpacing: -0.3 }}>Hemlo</span>
        </Link>

        {/* Center: Nav items */}
        <div className="nav-center-items" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {BOTTOM_NAV_MODES.map((mode) => {
            const isActive = pathname === mode.href || pathname.startsWith(mode.href + "/");
            return (
              <Link key={mode.label} href={mode.active ? mode.href : "#"} className={"bnav-item" + (isActive ? " active" : "")}>
                {mode.iconUrl ? (
                  <img src={mode.iconUrl} alt={mode.label} style={{ width: 20, height: 20, objectFit: "contain", filter: "none" }} />
                ) : (
                  <mode.icon size={20} color={isActive ? "var(--accent)" : "var(--text-muted)"} />
                )}
                <span>{mode.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right: Settings / hamburger */}
        <button
          onClick={() => setShowProfile(true)}
          title={user ? `${user.user_metadata?.full_name || user.email} - ${tier}` : "Account"}
          aria-label="Open account menu"
          className="nav-settings-btn"
        >
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            <Settings size={18} />
          )}
        </button>
      </nav>
    </>
  );
}
