import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { headline, symbol, summary } = await req.json()
    if (!headline || !symbol) return NextResponse.json({ error: "Missing required fields" }, { status: 400 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      // Fallback response if no API key is set
      return NextResponse.json({
        analysis: {
          causes: "Analyzing underlying market mechanics...",
          sectors: ["Technology", "Finance"],
          reaction: "Market participants are weighing the implications carefully.",
          expectedMove: "Volatility expected in the short term."
        }
      })
    }

    const prompt = `You are a top-tier institutional financial analyst. 
Analyze the market impact of the following breaking news regarding asset ${symbol}:

Headline: "${headline}"
Context: "${summary}"

Provide a concise, objective breakdown of the situation without filler words. Return ONLY a valid JSON object with the following keys and string values:
{
  "causes": "What is the root cause or catalyst behind this news? (2 sentences max)",
  "sectors": ["Sector 1", "Sector 2"], // Array of up to 3 directly impacted market sectors or sub-industries
  "reaction": "How are retail and institutional investors reacting to this? What covers the sentiment shift? (2 sentences max)",
  "expectedMove": "Short-term prediction on the asset's price action and volatility. (1 sentence)"
}`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2,
            maxOutputTokens: 1024,
            responseMimeType: "application/json"
          },
        }),
      }
    )

    if (!res.ok) {
      console.error("[analyze-news] Gemini API error:", res.statusText)
      return NextResponse.json({ error: "Upstream API error" }, { status: 502 })
    }

    const data = await res.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
    
    // Parse the JSON strictly
    let analysis
    try {
      analysis = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim())
    } catch {
      return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 })
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("[analyze-news] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
