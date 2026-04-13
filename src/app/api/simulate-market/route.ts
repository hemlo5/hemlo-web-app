import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/server"
import { checkSimulationLimit, incrementSimulationCount } from "@/lib/simulation-usage"

const GEMINI_KEY = process.env.GEMINI_API_KEY || "AIzaSyDh7Bf_x_kwWsPkoCo7u_7rAGGGiF9K_LI"
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_KEY}`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to run simulations." }, { status: 401 })
    }

    // Check daily limit using shared utility
    const limitCheck = await checkSimulationLimit(user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 429 })
    }

    const { question, crowdOdds, volume, endDate, category, marketType = "binary", outcomes } = await req.json()
    if (!question) return NextResponse.json({ error: "question required" }, { status: 400 })

    const isCat = marketType === "categorical" && Array.isArray(outcomes) && outcomes.length > 0
    const outcomeLabels: string[] = isCat ? outcomes.map((o: any) => o.label) : ["YES", "NO"]

    // Build a concrete example JSON object for the probability model
    const exampleProbObj = outcomeLabels.reduce((acc: Record<string, string>, lbl, i) => {
      const exVal = isCat ? (0.5 - i * 0.1).toFixed(2) : (i === 0 ? "0.45" : "0.55")
      acc[lbl] = exVal
      return acc
    }, {})
    const exampleProbStr = JSON.stringify(exampleProbObj)

    const outcomesStr = isCat
      ? outcomes.map((o: any) => `${o.label}: ${o.prob}%`).join(", ")
      : `YES: ${crowdOdds}%, NO: ${100 - crowdOdds}%`

    const topOutcome = isCat ? outcomes[0] : { label: "YES", prob: crowdOdds }

    // Use responseMimeType to force valid JSON output
    const prompt = `You are HEMLO — an advanced AI that simulates prediction markets like MiroFish.

ANALYZE THIS POLYMARKET PREDICTION MARKET:
Question: "${question}"
Market type: ${isCat ? "CATEGORICAL (multi-outcome)" : "BINARY (YES/NO)"}
Outcomes with Polymarket probabilities: ${outcomesStr}
Volume: ${volume ?? "unknown"}
Closes: ${endDate ?? "unknown"}
Category: ${category ?? "general"}

${isCat ? `IMPORTANT: This is a CATEGORICAL market. The outcomes are NOT Yes/No. The possible outcomes are: ${outcomeLabels.map((l, i) => `"${l}"`).join(", ")}. 
You MUST use EXACTLY these outcome labels as keys in ALL probability objects. Do NOT use "YES" or "NO".` : ""}

Generate a comprehensive simulation report. Return JSON only, no other text.

The JSON must have exactly these fields:
- hemloVerdict: integer 0-100 (your independent probability for "${topOutcome.label}" — the top Polymarket favorite)
- confidence: integer 60-98
- verdictLabel: ${isCat
  ? `a short string naming the outcome you think is most likely, e.g. "${topOutcome.label} favored"`
  : `one of "Very Likely YES", "Likely YES", "Toss Up", "Likely NO", "Very Likely NO"`}
- divergenceSignal: short string like "HEMLO sees higher risk" or "HEMLO agrees with Polymarket"
- whyDivergent: 2-3 sentence explanation of why your odds differ from Polymarket
- stateSnapshot: object with keys: timestamp (today's date string), crowdOdds (number, the crowd's top-favorite probability), hemloOdds (same as hemloVerdict), sentiment (object with 2-3 stakeholder keys and string sentiment values), contextFactors (object with 2-3 key contextual data points), insight (1-2 sentence string)
- shockEvents: array of 3-4 objects each with: emoji (string), name (string), description (1-2 sentence string), impactYes (float like 0.15 or -0.10), impactNo (float), type (string)
- probabilityModel: object with:
    - predictionMarket: EXACTLY this structure using the real outcome labels: ${exampleProbStr} (use the actual crowd probabilities as decimals, keys MUST be the exact outcome labels listed above)
    - hemloModel: EXACTLY this structure using the real outcome labels: ${exampleProbStr} (use YOUR independent assessment as decimals, keys MUST be the exact outcome labels listed above)
    - insight: 1 sentence string
- simulationFormula: array of exactly 5 objects each with: factor (string name), weight (float, the 5 weights must sum to 1.0), score (integer 0-100), signal ("bullish" or "bearish" or "neutral")
- ontology: object with entityTypes (array of 6-8 strings) and relationTypes (array of 6-8 strings)
- agentFeed: array of exactly 6 objects each with: agentType (string), handle (string starting with @), post (string 80-120 chars), round (integer 0), time (string like "18:15:55")
- keySignals: array of exactly 3 strings describing insights the crowd is missing
- scenarioIfYes: 1 sentence string describing what happens if "${topOutcome.label}" wins
- scenarioIfNo: 1 sentence string describing what happens if "${topOutcome.label}" does NOT win  
- agentsDeployed: integer between 12000 and 55000

REMINDER: In probabilityModel.predictionMarket and probabilityModel.hemloModel, the keys MUST be ${outcomeLabels.map(l => `"${l}"`).join(", ")} — NEVER "YES" or "NO" unless those are literally the outcome labels.`

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",  // Force JSON output mode
        },
      }),
    })

    const gd = await geminiRes.json()

    // Log any Gemini API errors
    if (gd.error) {
      console.error("[simulate-market] Gemini API error:", gd.error)
      return NextResponse.json({ error: gd.error.message ?? "Gemini error" }, { status: 500 })
    }

    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    if (!raw) {
      console.error("[simulate-market] Empty Gemini response. Full response:", JSON.stringify(gd).slice(0, 500))
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 })
    }

    // responseMimeType=application/json should give us clean JSON, but clean up just in case
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let analysis: any
    try {
      analysis = JSON.parse(cleaned)
    } catch (parseErr) {
      // Fallback: extract first {...} block
      const m = cleaned.match(/\{[\s\S]*\}/)
      if (m) {
        try { analysis = JSON.parse(m[0]) }
        catch (e2) {
          console.error("[simulate-market] Both parse attempts failed. Raw:", cleaned.slice(0, 400))
          return NextResponse.json({ error: "JSON parse failed" }, { status: 500 })
        }
      } else {
        console.error("[simulate-market] No JSON object found in response. Raw:", cleaned.slice(0, 400))
        return NextResponse.json({ error: "No JSON in response" }, { status: 500 })
      }
    }
    // Save to Supabase — AWAITED so usage is always recorded
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supaUrl && supaKey) {
      const supaAdmin = createSupabaseAdmin(supaUrl, supaKey)
      const { error: saveErr } = await supaAdmin.from("simulations").insert({
        user_id: user.id,
        topic: question,
        crowd_odds: crowdOdds,
        hemlo_odds: analysis.hemloVerdict,
        divergence: analysis.hemloVerdict - crowdOdds,
        analysis_data: analysis,
        market_type: marketType,
        outcomes: outcomes,
        created_at: new Date().toISOString()
      })
      if (saveErr) console.error("[simulate-market] Supabase save error:", saveErr)
      else {
        console.log(`[simulate-market] Saved simulation for "${question}" — user ${user.id}`)
        // Increment lifetime counter on profiles
        await incrementSimulationCount(user.id)
      }
    }

    return NextResponse.json({ analysis }, { status: 200 })
  } catch (err) {
    console.error("[simulate-market] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
