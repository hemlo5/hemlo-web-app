import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const PROMPT = (scenario: string) => `You are a world-class geopolitical and socioeconomic intelligence analyst. A simulation engine needs a richly detailed "Reality Seed" document to ground its AI agent simulation in real-world facts.

SIMULATION SCENARIO: "${scenario}"

Generate a comprehensive Reality Seed document of at least 500 words. The document MUST include:

1. **CONTEXT & BACKGROUND** — 2-3 paragraphs of real, factual geopolitical/economic/social background. Include real dates, verified statistics, names of real organisations, governments, or institutions involved.

2. **KEY ACTORS & STAKEHOLDERS** — Named entities: real governments, companies, political figures, advocacy groups, media outlets. Include their known positions, motivations, and power dynamics.

3. **CURRENT STATE OF PLAY** — Latest real-world data points (polling numbers, economic indicators, military positions, market prices, vote counts — whatever is relevant). Reference actual events from the last 1-2 years.

4. **TENSION POINTS & FAULT LINES** — Specific flashpoints, unresolved disputes, competing narratives, and ideological divisions that agents in the simulation would reflect.

5. **TIMELINE OF KEY EVENTS** — Bullet-point chronology of the 5-10 most relevant real events leading to this scenario, with approximate dates.

6. **SIMULATION VARIABLES** — List 5-8 specific measurable variables (e.g., approval ratings, trade volumes, troop numbers, social media sentiment) that should influence agent behaviour.

Be precise, factual, and dense with real-world detail. Do NOT generate vague generalities. Use actual names, real figures, and verified facts. The seed will be used by an AI agent simulator to generate realistic social media posts, policy responses, and public reactions.

Return ONLY the document text, no JSON, no code blocks, no preamble.`

async function generateViaSiliconFlow(scenario: string): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL || "https://api.siliconflow.cn/v1"
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || "deepseek-ai/DeepSeek-V3"

  if (!apiKey) throw new Error("LLM_API_KEY not configured")

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: PROMPT(scenario) }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`SiliconFlow error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content ?? ""
  if (!text) throw new Error("SiliconFlow returned empty content")
  return text.trim()
}

async function generateViaGemini(scenario: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(scenario) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${res.statusText}`)

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  if (!text) throw new Error("Gemini returned empty content")
  return text.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json()
    if (!scenario || typeof scenario !== "string") {
      return NextResponse.json({ error: "Missing scenario" }, { status: 400 })
    }

    let seed = ""
    let usedProvider = ""

    // Try SiliconFlow first (same as Modal — reliable)
    try {
      seed = await generateViaSiliconFlow(scenario)
      usedProvider = "siliconflow"
      console.log("[generate-seed] ✓ SiliconFlow success, length:", seed.length)
    } catch (sfErr) {
      console.warn("[generate-seed] SiliconFlow failed, trying Gemini:", sfErr)
      try {
        seed = await generateViaGemini(scenario)
        usedProvider = "gemini"
        console.log("[generate-seed] ✓ Gemini success, length:", seed.length)
      } catch (gemErr) {
        console.error("[generate-seed] Both providers failed:", gemErr)
        return NextResponse.json(
          { error: `Seed generation failed — both LLM providers returned errors. Check LLM_API_KEY and GEMINI_API_KEY.` },
          { status: 502 }
        )
      }
    }

    return NextResponse.json({ seed, provider: usedProvider })
  } catch (error) {
    console.error("[generate-seed] Unexpected error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
