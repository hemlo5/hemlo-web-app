"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import { motion } from "framer-motion";
import {
  TrendingUp, MapPin, Zap, Settings, History,
  BarChart2, Home, Newspaper, Cpu, X,
} from "lucide-react";

const MODES = [
  { icon: Home,      label: "Panel",      href: "/home",             active: true },
  { icon: Cpu,       label: "Simulate",   href: "/simulate/mirofish",active: true, iconUrl: "/logo.svg" },
  { icon: BarChart2, label: "Polymarket", href: "/polymarket",       active: true, iconUrl: "/polymarket.webp" },
  { icon: TrendingUp,label: "Stocks",     href: "/stocks",           active: true },
  { icon: Newspaper, label: "Hot",        href: "/hot",              active: true },
  { icon: MapPin,    label: "Geo Map",    href: "/geo",              active: true },
];

// ── PORTALLED SIGN-IN MODAL ─────────────────────────────────────────────────
function SignInModal({ onClose, onGoogle }: { onClose: () => void; onGoogle: () => void }) {
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16, padding: "36px 32px", width: "min(340px, 90vw)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.9)", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 14,
          background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4
        }}>
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.svg" alt="Hemlo Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, color: "var(--text-primary)" }}>HEMLO</span>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", marginBottom: 6 }}>Sign in to Hemlo AI</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Run simulations, track predictions,<br />and access your personal dashboard.
          </div>
        </div>

        <button onClick={onGoogle} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          background: "#fff", color: "#111", fontWeight: 700, fontSize: 14,
          padding: "12px 20px", borderRadius: 10, border: "none", cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)", transition: "transform 0.15s, box-shadow 0.15s"
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.9 34.6 27.1 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.5 35.7 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.6 5.6C42 36.7 44 30.8 44 24c0-1.3-.1-2.6-.4-3.9z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          Free tier: 2 simulations/day · Premium: 10/day
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── PORTALLED PROFILE POPUP ──────────────────────────────────────────────────
function ProfilePopup({ user, tier, onClose, onSignOut }: { user: any; tier: string; onClose: () => void; onSignOut: () => void }) {
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 99997 }} />
      <div style={{
        position: "fixed", left: 80, bottom: 16,
        background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 12, padding: 14, width: 220, zIndex: 99998,
        boxShadow: "0 8px 40px rgba(0,0,0,0.9)",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}</span>
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>{user.user_metadata?.full_name || "User"}</div>
            <div style={{ fontSize: 10, color: tier === "premium" ? "#facc15" : "var(--text-muted)", fontWeight: 600 }}>{tier === "premium" ? "⭐ PREMIUM" : "FREE PLAN"}</div>
          </div>
        </div>
        <a href="/profile" onClick={onClose} style={{
          display: "block", textAlign: "center",
          background: "rgba(255,255,255,0.07)", color: "var(--text-primary)",
          padding: "9px 12px", borderRadius: 8, fontSize: 13,
          fontWeight: 600, textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)"
        }}>View Profile</a>
        <button onClick={onSignOut} style={{
          background: "rgba(255,50,50,0.1)", color: "#ff6b6b",
          border: "1px solid rgba(255,50,50,0.2)",
          padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%"
        }}>Sign Out</button>
      </div>
    </>,
    document.body
  );
}

// ── MAIN SIDEBAR ─────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [tier, setTier] = useState<string>("normal");
  const [showProfile, setShowProfile] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getUser().then(({ data: { user } }: any) => {
      if (user) {
        setUser(user);
        supabase.from("profiles").select("tier").eq("id", user.id).single()
          .then(({ data }: any) => setTier(data?.tier || "normal"));
      }
    });
  }, []);

  const doGoogleSignIn = async () => {
    setShowSignIn(false);
    const redirectTo = (typeof window !== "undefined" && process.env.NEXT_PUBLIC_APP_URL)
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/home`
      : `${window.location.origin}/auth/callback?next=/home`;

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

  const handleUserClick = () => {
    if (user) setShowProfile(v => !v);
    else setShowSignIn(true);
  };

  const NavIcon = ({ mode }: { mode: typeof MODES[0] }) => {
    const Icon = mode.icon;
    const isActive = pathname === mode.href || pathname.startsWith(mode.href + "/");
    return (
      <Link key={mode.label} href={mode.active ? mode.href : "#"}
        title={mode.label + (!mode.active ? " — Coming Soon" : "")}
        style={{ textDecoration: "none" }}>
        <motion.div
          whileHover={{ scale: mode.active ? 1.05 : 1 }}
          whileTap={{ scale: mode.active ? 0.95 : 1 }}
          style={{
            width: "100%", padding: "10px", borderRadius: 6,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
            border: isActive ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
            cursor: mode.active ? "pointer" : "not-allowed",
            opacity: mode.active ? 1 : 0.4,
            transition: "background 0.2s, border-color 0.2s",
          }}
        >
          {mode.iconUrl ? (
            <img src={mode.iconUrl} alt={mode.label} style={{ width: 20, height: 20, objectFit: "contain", filter: "none" }} />
          ) : (
            <Icon size={20} color={isActive ? "var(--accent)" : "var(--text-secondary)"} />
          )}
          <span style={{ fontSize: 10, color: isActive ? "var(--accent)" : "var(--text-muted)", fontWeight: 500 }}>{mode.label}</span>
        </motion.div>
      </Link>
    );
  };

  return (
    <>
      {/* Portalled overlays */}
      {mounted && showSignIn && <SignInModal onClose={() => setShowSignIn(false)} onGoogle={doGoogleSignIn} />}
      {mounted && showProfile && user && <ProfilePopup user={user} tier={tier} onClose={() => setShowProfile(false)} onSignOut={doSignOut} />}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="sidebar-desktop" style={{
        width: 72, flexShrink: 0,
        background: "#000000", borderRight: "1px solid #000000",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "16px 0", height: "100vh", position: "sticky", top: 0,
        zIndex: 40,
      }}>
        <Link href="/" style={{ marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <img src="/logo.svg" alt="Hemlo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        </Link>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, width: "100%", padding: "0 8px", flex: 1 }}>
          {MODES.map(mode => <NavIcon key={mode.label} mode={mode} />)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 8px", width: "100%" }}>
          <Link href="/history" title="History" style={{ textDecoration: "none" }}>
            <div style={{ padding: "10px", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <History size={18} color="var(--text-muted)" />
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>History</span>
            </div>
          </Link>
          <div onClick={handleUserClick} title={user ? `${user.user_metadata?.full_name || user.email} · ${tier}` : "Sign In"}
            style={{ padding: "10px", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", background: user ? "rgba(255,255,255,0.06)" : "transparent", transition: "background 0.2s" }}>
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.2)" }} />
            ) : (
              <Settings size={18} color="var(--text-muted)" />
            )}
            <span style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", width: "100%", whiteSpace: "nowrap" }}>
              {user ? (tier === "premium" ? "PRO" : "USER") : "Sign In"}
            </span>
          </div>
        </div>
      </aside>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="sidebar-bottom-nav">
        {MODES.slice(0, 5).map((mode) => {
          const Icon = mode.icon;
          const isActive = pathname === mode.href || pathname.startsWith(mode.href + "/");
          return (
            <Link key={mode.label} href={mode.active ? mode.href : "#"}
              className={"bnav-item" + (isActive ? " active" : "")}>
              {mode.iconUrl ? (
                <img src={mode.iconUrl} alt={mode.label} style={{ width: 18, height: 18, objectFit: "contain", filter: "none" }} />
              ) : (
                <Icon size={18} color={isActive ? "var(--accent)" : "var(--text-muted)"} />
              )}
              <span>{mode.label}</span>
            </Link>
          );
        })}
        <button className="bnav-item" onClick={handleUserClick}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="me" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <Settings size={18} color="var(--text-muted)" />
          )}
          <span>{user ? (tier === "premium" ? "PRO" : "ME") : "Login"}</span>
        </button>
      </nav>
    </>
  );
}
