import sys

with open('src/app/(dashboard)/simulate/mirofish/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

head = lines[:508]
tail = lines[936:]

new_ui = """
  return (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Grainient
            color1="#1c1c1c"
            color2="#3b3b3b"
            color3="#0a0a0a"
            timeSpeed={0.1}
            colorBalance={0.0}
            warpStrength={1.0}
            warpFrequency={3.0}
            warpSpeed={1.0}
            warpAmplitude={40.0}
            blendAngle={0.0}
            blendSoftness={0.1}
            rotationAmount={200.0}
            noiseScale={1.5}
            grainAmount={0.2}
            grainScale={1.5}
            grainAnimated={true}
            contrast={1.1}
            gamma={1.0}
            saturation={0.5}
            centerX={0.0}
            centerY={0.0}
            zoom={1.0}
        />
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column" }}>
        {phase === "idle" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ fontSize: "32px", fontWeight: 500, color: "rgba(255,255,255,0.9)", marginBottom: "32px", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              What are you thinking about today?
            </div>
            <div style={{ 
              width: "100%", maxWidth: "640px", background: "rgba(30, 30, 30, 0.6)", backdropFilter: "blur(40px)",
              borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "16px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: "16px"
            }}>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); startSimulation(); } }}
                placeholder="How can I help you today?"
                style={{ width: "100%", background: "transparent", border: "none", color: "#fff", fontSize: "16px", outline: "none", resize: "none", height: "40px", lineHeight: "20px" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                 <div style={{ display: "flex", gap: "8px" }}>
                   <button style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>+</button>
                   <button style={{ padding: "0 16px", height: 32, borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <span style={{ fontSize: 14 }}>✧</span> Thinking
                   </button>
                   <button style={{ padding: "0 16px", height: 32, borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <span style={{ fontSize: 14 }}>🔍</span> Search
                   </button>
                 </div>
                 <button style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>🎤</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "40px", flex: 1, position: "relative" }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(20px)", padding: 32, borderRadius: 24, border: "1px solid rgba(255,255,255,0.1)" }}>
               <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ width: 10, height: 10, borderRadius: "50%", background: engineStatus === "queued" ? "#f59e0b" : "#22c55e" }}
                    />
                    {engineStatus === "queued" ? "Engine in Queue..." : "Simulation Running"}
                    <span style={{ fontSize: 14, color: "#aaa", fontWeight: 500 }}>— {formatSecs(elapsed)}</span>
                  </div>
                  <button onClick={() => { sessionStorage.removeItem('hemlo_running_sim'); window.location.reload(); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#ccc", padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, borderRadius: 8 }}>
                    Cancel
                  </button>
                </div>
                <MirofishGraphPanel projectId={miroProjectId} isSimulating={true} liveData={sseGraphData} liveEvent={liveGraphEvent} />
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 16 }}>Live Output</div>
                    <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, height: 250, overflowY: "auto", padding: "14px 18px", fontFamily: "'Fira Code', monospace", fontSize: 12 }}>
                      {liveLogs.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)" }}>Waiting...</div>}
                      {liveLogs.map((log, i) => (<div key={i} style={{ color: log.includes("✓") ? "#22c55e" : log.includes("✗") ? "#ef4444" : "#ccc", lineHeight: 1.8 }}>{log}</div>))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"""

with open('src/app/(dashboard)/simulate/mirofish/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(head)
    f.write(new_ui)
    f.writelines(tail)

print("done")
