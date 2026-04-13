import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Mock simulation result schema
export interface SimulationResult {
  summary: string
  agentCount: number
  sentimentBreakdown: { label: string; value: number; color: string }[]
  timeline: { time: string; positive: number; negative: number; neutral: number }[]
  keyInsights: string[]
  confidenceScore: number
}

// Mock results per mode
export const getMockResult = (mode: string, input: string): SimulationResult => {
  if (mode === "tweet") {
    return {
      summary: `Your tweet is predicted to generate significant engagement, with a slight lean toward positive sentiment. The tech and finance communities will engage most. Expect moderate virality with a ratio risk of 12%.`,
      agentCount: 1247,
      confidenceScore: 78,
      sentimentBreakdown: [
        { label: "Positive", value: 42, color: "#22c55e" },
        { label: "Neutral", value: 31, color: "#A0A0A0" },
        { label: "Negative", value: 27, color: "#ef4444" },
      ],
      timeline: [
        { time: "0m", positive: 10, negative: 5, neutral: 8 },
        { time: "15m", positive: 38, negative: 22, neutral: 19 },
        { time: "1h", positive: 55, negative: 31, neutral: 28 },
        { time: "3h", positive: 62, negative: 40, neutral: 35 },
        { time: "6h", positive: 70, negative: 45, neutral: 40 },
        { time: "12h", positive: 74, negative: 48, neutral: 42 },
        { time: "24h", positive: 76, negative: 50, neutral: 44 },
      ],
      keyInsights: [
        "High engagement likely from developers and tech founders in the first hour",
        "12% ratio risk — the framing could attract contrarian replies",
        "Peak virality window: 15–90 minutes post-tweet",
        "Users aged 25–34 are the primary reactor group",
        "Suggested: adding a specific data point would increase positive sentiment by ~8%",
      ],
    }
  }

  return {
    summary: `The idea shows strong market timing with an emerging gap in the mid-market segment. Early adopters are likely to be indie developers and solopreneurs. Main risks involve distribution and incumbent response time.`,
    agentCount: 2048,
    confidenceScore: 71,
    sentimentBreakdown: [
      { label: "Excited", value: 38, color: "#ccff00" },
      { label: "Skeptical", value: 35, color: "#A0A0A0" },
      { label: "Opposed", value: 27, color: "#ef4444" },
    ],
    timeline: [
      { time: "Week 1", positive: 20, negative: 15, neutral: 30 },
      { time: "Month 1", positive: 45, negative: 28, neutral: 35 },
      { time: "Month 3", positive: 60, negative: 32, neutral: 38 },
      { time: "Month 6", positive: 70, negative: 35, neutral: 40 },
      { time: "Year 1", positive: 75, negative: 38, neutral: 42 },
    ],
    keyInsights: [
      "Market is ready — 3 well-funded competitors launched in 18 months",
      "Primary audience: indie hackers and small SaaS teams (< 10 employees)",
      "Top objection: pricing model uncertainty — consider transparent pricing early",
      "Integration with existing tools (Notion, Linear) would reduce churn risk by ~22%",
      "Viral loop potential is high if you implement a public output/sharing feature",
    ],
  }
}
