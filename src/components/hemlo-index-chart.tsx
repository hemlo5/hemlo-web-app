"use client";

import { useRef, useEffect } from "react";
import { createChart, ColorType, AreaSeries, Time } from "lightweight-charts";

// ── DATA GENERATOR ───────────────────────────────────────────────────────────
export function genIndexData(pts: number, hemloAvg: number, crowdAvg: number) {
  const now = Date.now();
  const step = (24 * 60 * 60 * 1000) / pts;
  return Array.from({ length: pts }, (_, i) => {
    const t = i / pts;
    const ts = new Date(now - (pts - 1 - i) * step);
    return {
      i,
      time: `${ts.getHours().toString().padStart(2, "0")}:${ts.getMinutes().toString().padStart(2, "0")}`,
      timestamp: Math.floor(ts.getTime() / 1000),
      hemlo: Math.max(
        0,
        Math.min(
          100,
          hemloAvg +
            Math.sin(t * Math.PI * 3.2) * 7 +
            Math.cos(t * Math.PI * 1.4 + 2) * 4 +
            Math.sin(i * 7.3) * 2 +
            t * 8 -
            4,
        ),
      ),
      crowd: Math.max(
        0,
        Math.min(
          100,
          crowdAvg +
            Math.sin(t * Math.PI * 2.8 + 0.5) * 5 +
            Math.cos(t * Math.PI * 1.8) * 3 +
            Math.sin(i * 5.7) * 1.8 +
            t * 3,
        ),
      ),
    };
  });
}

// ── HEMLO INDEX CHART ────────────────────────────────────────────────────────
export function HemloIndexChart({
  data,
  idxColor,
}: {
  data: ReturnType<typeof genIndexData>;
  idxColor: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current?.clientWidth ?? 0,
        height: chartContainerRef.current?.clientHeight ?? 0,
      });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#888888",
        fontFamily: "Inter, sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time) => {
          const date = new Date((time as number) * 1000);
          return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
        },
      },
      crosshair: {
        vertLine: { labelBackgroundColor: "#00C9DB" },
        horzLine: { labelBackgroundColor: "#030712" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const crowdSeries = chart.addSeries(AreaSeries, {
      lineColor: "#87CEEB", // Sky Blue
      topColor: "rgba(135, 206, 235, 0.45)", // stronger underglow
      bottomColor: "rgba(135, 206, 235, 0.0)",
      lineWidth: 2,
      priceFormat: { type: "percent" },
    });
    const hemloSeries = chart.addSeries(AreaSeries, {
      lineColor: "#ffffff", // White
      topColor: "rgba(255, 255, 255, 0.4)", // strong underglow
      bottomColor: "rgba(255, 255, 255, 0.0)",
      lineWidth: 3,
      priceFormat: { type: "percent" },
    });

    crowdSeries.setData(
      data.map((d) => ({ time: d.timestamp as Time, value: d.crowd })),
    );
    hemloSeries.setData(
      data.map((d) => ({ time: d.timestamp as Time, value: d.hemlo })),
    );

    chart.timeScale().fitContent();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, idxColor]);

  return (
    <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
  );
}
