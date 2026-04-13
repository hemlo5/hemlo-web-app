"use client";

import { useEffect, useRef } from "react";

export function AgentNetworkCanvas({ agentCount, isRunning }: { agentCount: number; isRunning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const nodeCount = Math.min(agentCount, 600);
    if (nodesRef.current.length !== nodeCount) {
      nodesRef.current = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
        r: 1.5 + Math.random() * 2, phase: Math.random() * Math.PI * 2,
        color: ["#FF6B00", "#FF6B00", "#ffffff", "#888888", "#444444"][Math.floor(Math.random() * 5)],
        active: Math.random() > 0.5,
      }));
    }

    const nodes = nodesRef.current;

    function draw(time: number) {
      if (!ctx) return; // TS guard
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (isRunning) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > W) n.vx *= -1;
          if (n.y < 0 || n.y > H) n.vy *= -1;
          n.active = Math.sin(time * 0.002 + n.phase) > 0;
        }
        const pulse = isRunning ? 0.5 + 0.5 * Math.sin(time * 0.003 + n.phase) : 0.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.active ? n.color : "#333";
        ctx.globalAlpha = pulse;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const connDist = 60;
      ctx.lineWidth = 0.3;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 20, nodes.length); j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connDist) {
            const alpha = (1 - dist / connDist) * 0.15;
            ctx.strokeStyle = nodes[i].active && nodes[j].active ? "#FF6B00" : "#222";
            ctx.globalAlpha = alpha;
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (isRunning && Math.random() > 0.92) {
        const src = nodes[Math.floor(Math.random() * nodes.length)];
        ctx.beginPath();
        ctx.arc(src.x, src.y, 8 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 107, 0, 0.15)";
        ctx.fill();
      }
      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [agentCount, isRunning]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: 160, background: "#0a0a0a", border: "1px solid #333" }} />;
}
