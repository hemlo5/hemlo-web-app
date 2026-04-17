"use client"

import dynamic from "next/dynamic"
import { FadeIn, FadeInOnScroll, StaggerContainer, StaggerItem } from "@/components/ui/motion"
import { motion } from "framer-motion"
import { Twitter, Lightbulb, TrendingUp, Globe2, Rocket, Brain, Lock, ArrowRight, Check, Zap } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

const World = dynamic(() => import("@/components/ui/globe").then((m) => m.World), { ssr: false })

const GLOBE_CONFIG = {
  pointSize: 4,
  globeColor: "#1a1a2e",
  showAtmosphere: true,
  atmosphereColor: "#ccff00",
  atmosphereAltitude: 0.12,
  emissive: "#ccff00",
  emissiveIntensity: 0.08,
  shininess: 0.9,
  polygonColor: "rgba(255, 255, 255,0.4)",
  ambientLight: "#ccff00",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ccff00",
  arcTime: 1200,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 22.3193, lng: 114.1694 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
}

const ARC_COLORS = ["#ccff00", "#ff8533", "#ffaa66"]
const GLOBE_ARCS = [
  { order: 1, startLat: 28.6139, startLng: 77.209, endLat: 40.7128, endLng: -74.006, arcAlt: 0.3, color: ARC_COLORS[0] },
  { order: 1, startLat: 51.5072, startLng: -0.1276, endLat: 22.3193, endLng: 114.1694, arcAlt: 0.4, color: ARC_COLORS[1] },
  { order: 2, startLat: -33.8688, startLng: 151.2093, endLat: 40.7128, endLng: -74.006, arcAlt: 0.5, color: ARC_COLORS[2] },
  { order: 2, startLat: 34.0522, startLng: -118.2437, endLat: 51.5072, endLng: -0.1276, arcAlt: 0.3, color: ARC_COLORS[0] },
  { order: 3, startLat: 1.3521, startLng: 103.8198, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.4, color: ARC_COLORS[1] },
  { order: 3, startLat: 19.076, startLng: 72.8777, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.6, color: ARC_COLORS[2] },
  { order: 4, startLat: 37.7749, startLng: -122.4194, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.4, color: ARC_COLORS[0] },
  { order: 4, startLat: 52.52, startLng: 13.405, endLat: 28.6139, endLng: 77.209, arcAlt: 0.35, color: ARC_COLORS[1] },
  { order: 5, startLat: -22.9068, startLng: -43.1729, endLat: 51.5072, endLng: -0.1276, arcAlt: 0.5, color: ARC_COLORS[2] },
  { order: 5, startLat: 41.0082, startLng: 28.9784, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.3, color: ARC_COLORS[0] },
  { order: 6, startLat: 40.7128, startLng: -74.006, endLat: 22.3193, endLng: 114.1694, arcAlt: 0.45, color: ARC_COLORS[1] },
  { order: 6, startLat: -33.8688, startLng: 151.2093, endLat: 51.5072, endLng: -0.1276, arcAlt: 0.5, color: ARC_COLORS[2] },
]

const MODES = [
  { icon: Globe2, label: "Geopolitics", description: "Forecast how nations and factions will react to world events.", href: "#", active: false, color: "#b3e600" },
  { icon: Rocket, label: "Product Launch", description: "Simulate user adoption, objections, and feature feedback.", href: "#", active: false, color: "#06b6d4" },
  { icon: Brain, label: "Custom Simulation", description: "Fully open-ended simulation — any prompt, any stakes.", href: "/simulate/mirofish", active: true, color: "#ffffff" },
]

const HOW_IT_WORKS = [
  { step: "01", title: "Describe Your Scenario", description: "Type a tweet, trade idea, product feature, or geopolitical event. Natural language, no setup required." },
  { step: "02", title: "We Fuel the Simulation", description: "HEMLO pulls live news, social data, and market signals from around the internet to build context." },
  { step: "03", title: "Get Your Prediction", description: "Our AI runs thousands of agent simulations and returns a structured prediction report in seconds." },
]

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started. No credit card required.",
    cta: "Start for Free",
    href: "/sign-up",
    highlight: false,
    features: [
      "3 simulations / month",
      "Summary-level output",
      "100 AI agents per run",
      "Limited data sources",
    ],
    locked: ["Deep analysis report", "PDF + JSON export", "Full history", "10,000 agents"],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "Unlimited power. Zero compromises.",
    cta: "Upgrade to Pro",
    href: "/pricing",
    highlight: true,
    features: [
      "Unlimited simulations",
      "Custom simulation mode",
      "Deep analysis report",
      "10,000 agents per run",
      "Full internet sweep",
      "PDF + JSON export",
      "Full history",
    ],
    locked: [],
  },
]

function ModeCard({ mode, index }: { mode: typeof MODES[0]; index: number }) {
  const Icon = mode.icon
  return (
    <StaggerItem>
      <motion.div
        whileHover={mode.active ? { y: -6, scale: 1.02 } : {}}
        style={{
          background: "#050505",
          border: `1px solid ${mode.active ? "var(--border-hover)" : "#000000"}`,
          borderRadius: "var(--radius)",
          padding: "24px",
          cursor: mode.active ? "pointer" : "default",
          opacity: mode.active ? 1 : 0.55,
          transition: "border-color 0.2s, box-shadow 0.2s",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          if (mode.active) {
            (e.currentTarget as HTMLElement).style.borderColor = mode.color
            ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${mode.color}22`
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = mode.active ? "var(--border-hover)" : "#000000"
          ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
        }}
      >
        {!mode.active && (
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "#000000", color: "var(--text-muted)",
            fontSize: 10, fontWeight: 600, letterSpacing: 1,
            padding: "3px 8px", borderRadius: 999,
            textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Lock size={10} /> Soon
          </div>
        )}
        <div style={{
          width: 44, height: 44, borderRadius: "var(--radius-sm)",
          background: `${mode.color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 16,
        }}>
          <Icon size={22} color={mode.color} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 8, color: "var(--text-primary)" }}>
          {mode.label}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {mode.description}
        </div>
        {mode.active && (
          <div style={{ marginTop: 16, fontSize: 13, color: mode.color, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            Try it <ArrowRight size={13} />
          </div>
        )}
      </motion.div>
    </StaggerItem>
  )
}

export function HeroSection() {
  return (
    <section style={{
      position: "relative", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      textAlign: "center", overflow: "hidden",
      paddingTop: 80, paddingBottom: 80,
    }}>
      {/* Globe — fills hero background */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}>
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <World data={GLOBE_ARCS} globeConfig={GLOBE_CONFIG} />
        </div>
      </div>

      {/* Radial gradient overlay — fades globe edges into page bg */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, #000000 80%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 800, padding: "0 24px" }}>
        <FadeIn delay={0.1}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255, 255, 255,0.12)", border: "1px solid rgba(255, 255, 255,0.3)",
            borderRadius: 999, padding: "6px 14px", marginBottom: 32,
          }}>
            <Zap size={12} color="var(--accent)" fill="var(--accent)" />
            <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 0.5 }}>
              Powered by multi-agent AI simulation
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "clamp(42px, 7vw, 80px)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-2px",
            color: "var(--text-primary)",
            marginBottom: 24,
          }}>
            Simulate Reality.<br />
            <span style={{ color: "var(--accent)" }}>Before You Live It.</span>
          </h1>
        </FadeIn>

        <FadeIn delay={0.35}>
          <p style={{
            fontSize: "clamp(16px, 2.5vw, 20px)",
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 560,
            margin: "0 auto 40px",
          }}>
            HEMLO predicts how humans react to anything — trades, ideas, tweets, world events.
            Run the simulation before you commit.
          </p>
        </FadeIn>

        <FadeIn delay={0.5}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/sign-up" style={{
              background: "var(--accent)",
              color: "white", fontWeight: 700, fontSize: 16,
              padding: "16px 32px", borderRadius: "var(--radius-sm)",
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
              transition: "background 0.2s, transform 0.15s, box-shadow 0.2s",
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-hover)"
                e.currentTarget.style.transform = "translateY(-2px)"
                e.currentTarget.style.boxShadow = "0 8px 32px var(--accent-glow)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent)"
                e.currentTarget.style.transform = "translateY(0)"
                e.currentTarget.style.boxShadow = "none"
              }}
            >
              Start Simulating Free <ArrowRight size={18} />
            </Link>
            <Link href="#how-it-works" style={{
              color: "var(--text-secondary)", fontWeight: 600, fontSize: 16,
              padding: "16px 32px", borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              border: "1px solid #000000",
              transition: "color 0.2s, border-color 0.2s",
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)"
                e.currentTarget.style.borderColor = "var(--border-hover)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)"
                e.currentTarget.style.borderColor = "#000000"
              }}
            >
              See how it works
            </Link>
          </div>
        </FadeIn>

        {/* Social proof */}
        <FadeIn delay={0.7}>
          <div style={{ marginTop: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {["10,000+ simulations run", "2,847 users this week", "6 simulation modes"].map((text) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                {text}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

export function ModesSection() {
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeInOnScroll>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Simulation Modes
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 16 }}>
            Predict anything.
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Six specialized simulation engines. Each one powered by live internet data and thousands of AI agents.
          </p>
        </div>
      </FadeInOnScroll>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <StaggerContainer>
          {MODES.map((mode, i) => (
            <Link key={mode.label} href={mode.active ? mode.href : "#"} style={{ textDecoration: "none" }}>
              <ModeCard mode={mode} index={i} />
            </Link>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" style={{
      padding: "100px 24px",
      background: "linear-gradient(180deg, #000000 0%, #000000 50%, #000000 100%)",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <FadeInOnScroll>
          <div style={{ textAlign: "center", marginBottom: 80 }}>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
              How It Works
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1px" }}>
              Three steps to clarity.
            </h2>
          </div>
        </FadeInOnScroll>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {HOW_IT_WORKS.map((step, i) => (
            <FadeInOnScroll key={step.step} delay={i * 0.15}>
              <div style={{
                display: "flex", gap: 40, alignItems: "flex-start",
                padding: "40px 0",
                borderBottom: i < HOW_IT_WORKS.length - 1 ? "1px solid #000000" : "none",
                flexWrap: "wrap",
              }}>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 72, fontWeight: 900, lineHeight: 1,
                  color: "transparent",
                  WebkitTextStroke: "2px var(--accent)",
                  minWidth: 100, flexShrink: 0,
                }}>
                  {step.step}
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 12, letterSpacing: "-0.5px" }}>
                    {step.title}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.7 }}>
                    {step.description}
                  </p>
                </div>
              </div>
            </FadeInOnScroll>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PricingSection() {
  return (
    <section id="pricing" style={{ padding: "100px 24px", maxWidth: 900, margin: "0 auto" }}>
      <FadeInOnScroll>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Pricing
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 16 }}>
            Simple pricing.
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 16 }}>Start free. Upgrade when you need the power.</p>
        </div>
      </FadeInOnScroll>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        {PRICING.map((plan, i) => (
          <FadeInOnScroll key={plan.name} delay={i * 0.15}>
            <motion.div
              whileHover={{ y: -4 }}
              style={{
                background: plan.highlight ? "#000000" : "#050505",
                border: plan.highlight ? "1px solid var(--accent)" : "1px solid #000000",
                borderRadius: "var(--radius-lg)",
                padding: "40px 32px",
                position: "relative",
                ...(plan.highlight ? { boxShadow: "0 0 40px var(--accent-glow-sm)" } : {}),
              }}
            >
              {plan.highlight && (
                <div style={{
                  position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent)", color: "white",
                  fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  padding: "4px 16px", borderRadius: 999, textTransform: "uppercase",
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 1 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 800 }}>{plan.price}</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 16 }}>{plan.period}</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 32 }}>{plan.description}</div>

              <Link href={plan.href} style={{
                display: "block", textAlign: "center",
                background: plan.highlight ? "var(--accent)" : "transparent",
                border: plan.highlight ? "none" : "1px solid #000000",
                color: plan.highlight ? "white" : "var(--text-primary)",
                fontWeight: 700, fontSize: 15,
                padding: "14px", borderRadius: "var(--radius-sm)",
                textDecoration: "none", marginBottom: 32,
                transition: "background 0.2s, transform 0.15s",
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = plan.highlight ? "var(--accent-hover)" : "#000000"
                  e.currentTarget.style.transform = "translateY(-1px)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = plan.highlight ? "var(--accent)" : "transparent"
                  e.currentTarget.style.transform = "translateY(0)"
                }}
              >
                {plan.cta}
              </Link>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                    <Check size={15} color="var(--accent)" strokeWidth={2.5} />
                    <span style={{ color: "var(--text-primary)" }}>{f}</span>
                  </div>
                ))}
                {plan.locked.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, opacity: 0.4 }}>
                    <Lock size={13} color="var(--text-muted)" />
                    <span style={{ color: "var(--text-muted)", textDecoration: "line-through" }}>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </FadeInOnScroll>
        ))}
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid #000000",
      padding: "48px 32px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: 16,
      maxWidth: 1200, margin: "0 auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Zap size={15} color="white" fill="white" />
        </div>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>HEMLO</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        © 2025 HEMLO. Built to predict the future.
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {["Privacy", "Terms", "Contact"].map((item) => (
          <Link key={item} href="#" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            {item}
          </Link>
        ))}
      </div>
    </footer>
  )
}
