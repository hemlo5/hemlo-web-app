"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MousePointer2, Activity, BarChart2, Cpu } from "lucide-react"

export function HowItWorksAnimation() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Sequence
    // 0: Start (Dashboard view)
    // 1: Cursor moves to card (1s)
    // 2: Card clicked, Drawer opens (2.5s)
    // 3: Cursor moves to simulate button (4s)
    // 4: Simulate clicked, loading view (5.5s)
    // 5: Report loaded (7.5s)
    // 6: Restart (10s)
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 2500),
      setTimeout(() => setStep(3), 4000),
      setTimeout(() => setStep(4), 5500),
      setTimeout(() => setStep(5), 7500),
      setTimeout(() => setStep(0), 10500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [step === 0]) // Restart effect when step is 0

  return (
    <div style={{ width: "100%", height: "100%", background: "#000", position: "relative", overflow: "hidden", fontFamily: "sans-serif" }}>
      
      {/* ── STAGE 1 & 2: DASHBOARD & DRAWER ── */}
      <AnimatePresence>
        {step < 4 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, display: "flex", background: "#0c0f16" }}
          >
            {/* Fake Sidebar */}
            <div style={{ width: 60, borderRight: "1px solid #1f2330", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: 20 }}>
               <div style={{ width: 24, height: 24, background: "#1f2330", borderRadius: 6 }} />
               <div style={{ width: 24, height: 24, background: "rgba(34,197,94,0.2)", borderRadius: 6 }} />
               <div style={{ width: 24, height: 24, background: "#1f2330", borderRadius: 6 }} />
            </div>
            
            {/* Fake Content */}
            <div style={{ flex: 1, padding: 30 }}>
               <div style={{ width: 200, height: 24, background: "#1f2330", borderRadius: 4, marginBottom: 30 }} />
               
               <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                 {/* Target Card */}
                 <motion.div 
                   animate={{ scale: step >= 2 ? 0.95 : 1, borderColor: step >= 2 ? "#22c55e" : "#1f2330" }}
                   style={{ background: "#11141b", height: 140, borderRadius: 12, border: "2px solid #1f2330", padding: 16 }}
                 >
                    <div style={{ width: 40, height: 40, background: "#1f2330", borderRadius: 8, marginBottom: 12 }} />
                    <div style={{ width: "80%", height: 12, background: "#1f2330", borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ width: "50%", height: 12, background: "#1f2330", borderRadius: 4 }} />
                 </motion.div>

                 <div style={{ background: "#11141b", height: 140, borderRadius: 12, border: "2px solid #1f2330" }} />
                 <div style={{ background: "#11141b", height: 140, borderRadius: 12, border: "2px solid #1f2330" }} />
               </div>
            </div>

            {/* Fake Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: step >= 2 ? "0%" : "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{ width: 300, background: "#11141b", borderLeft: "1px solid #1f2330", position: "absolute", right: 0, top: 0, bottom: 0, padding: 24, display: "flex", flexDirection: "column" }}
            >
              <div style={{ width: "100%", height: 140, background: "#1f2330", borderRadius: 12, marginBottom: 24 }} />
              <div style={{ width: "90%", height: 16, background: "#1f2330", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ width: "70%", height: 16, background: "#1f2330", borderRadius: 4, marginBottom: 32 }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: "auto" }}>
                <div style={{ height: 36, background: "rgba(34,197,94,0.1)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }} />
                <div style={{ height: 36, background: "#1f2330", borderRadius: 8 }} />
              </div>

              {/* Simulate Button */}
              <motion.div 
                animate={{ scale: step >= 4 ? 0.95 : 1, background: step >= 4 ? "#16a34a" : "#22c55e" }}
                style={{ height: 48, background: "#22c55e", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#fff", fontWeight: 700 }}
              >
                <Cpu size={18} /> Simulate This
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STAGE 3: SIMULATING ── */}
      <AnimatePresence>
        {step >= 4 && step < 5 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
            style={{ position: "absolute", inset: 0, background: "#0c0f16", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}
          >
             <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
               <Activity size={48} color="#22c55e" />
             </motion.div>
             <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Running Simulation...</div>
             <div style={{ width: 200, height: 6, background: "#1f2330", borderRadius: 4, overflow: "hidden" }}>
                <motion.div 
                  initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.8, ease: "linear" }}
                  style={{ height: "100%", background: "#22c55e" }}
                />
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STAGE 4: REPORT ── */}
      <AnimatePresence>
        {step >= 5 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ position: "absolute", inset: 0, background: "#0c0f16", padding: 40, display: "flex", flexDirection: "column" }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Simulation Report</div>
            <div style={{ color: "#22c55e", fontSize: 16, fontWeight: 700, marginBottom: 40 }}>+12% Divergence Found</div>

            <div style={{ display: "flex", gap: 30, flex: 1 }}>
               <div style={{ flex: 2, background: "#11141b", borderRadius: 16, border: "1px solid #1f2330", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BarChart2 size={64} color="#1f2330" />
               </div>
               <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#11141b", borderRadius: 16, border: "1px solid #1f2330", flex: 1 }} />
                  <div style={{ background: "#11141b", borderRadius: 16, border: "1px solid #1f2330", flex: 1 }} />
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── THE CURSOR ── */}
      <motion.div
        animate={{
          x: step === 0 ? 600 : step === 1 ? 160 : step === 2 ? 160 : step === 3 ? 650 : step === 4 ? 650 : 800,
          y: step === 0 ? 400 : step === 1 ? 200 : step === 2 ? 200 : step === 3 ? 350 : step === 4 ? 350 : 500,
          opacity: step >= 4 ? 0 : 1
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        style={{ position: "absolute", zIndex: 50, top: 0, left: 0 }}
      >
        <MousePointer2 size={28} color="#ffffff" fill="#000000" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }} />
      </motion.div>
    </div>
  )
}
