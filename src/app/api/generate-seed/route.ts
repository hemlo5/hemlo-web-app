import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
// Long pipeline: query gen + Tavily scrape + grounded seed gen
export const maxDuration = 120

// ── CONFIG ────────────────────────────────────────────────────────────────────
const SF_BASE  = () => process.env.LLM_BASE_URL || "https://api.siliconflow.com/v1"
const SF_KEY   = () => process.env.LLM_API_KEY!
const SF_MODEL = () => process.env.LLM_MODEL || "deepseek-ai/DeepSeek-V3"
const TAV_KEY  = () => process.env.TAVILY_API_KEY!

// ── STEP 1: QUERY GENERATOR ──────────────────────────────────────────────────
// Ask DeepSeek to convert the raw user prompt into a precision search query
async function generateSearchQuery(scenario: string): Promise<string> {
  const systemPrompt = `You are a search query optimization expert working for a financial and geopolitical intelligence firm.
Your job is to convert a user's simulation scenario into a single, highly-optimized search engine query.

Rules:
- Output ONLY the search query string — no explanation, no quotes, no punctuation at the end
- Make it specific: include key entities (companies, countries, people), event types, and timeframes
- Target recent, factual, data-rich news articles
- Keep it under 20 words
- Optimize for retrieving real statistics, market data, and official statements`

  const res = await fetch(`${SF_BASE()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SF_KEY()}` },
    body: JSON.stringify({
      model: SF_MODEL(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Simulation scenario: "${scenario}"\n\nGenerate the optimal search query:` }
      ],
      temperature: 0.3,
      max_tokens: 100,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) throw new Error(`Query gen failed: ${res.status}`)
  const data = await res.json()
  const query = (data?.choices?.[0]?.message?.content ?? "").trim()
  if (!query) throw new Error("Query generator returned empty result")
  return query
}

// ── STEP 2: TAVILY DEEP SEARCH ────────────────────────────────────────────────
// Retrieve maximum real-world data from Tavily
type TavilyResult = {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
}

async function tavilyDeepSearch(query: string): Promise<string> {
  const apiKey = TAV_KEY()
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured")

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",        // deepest crawl tier
      include_answer: true,             // include Tavily's synthesized answer
      include_raw_content: true,        // full article text
      include_images: false,
      max_results: 8,                   // 8 × ~1200 chars = ~10k total — fits LLM context
      include_domains: [],
      exclude_domains: [],
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tavily error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()

  // Build a compact but information-dense context block
  const CHARS_PER_RESULT = 1200   // keeps total under ~12k chars
  const parts: string[] = []

  if (data.answer) {
    parts.push(`=== TAVILY ANSWER ===\n${data.answer.slice(0, 800)}\n`)
  }

  const results: TavilyResult[] = (data.results || [])
    .sort((a: TavilyResult, b: TavilyResult) => (b.score ?? 0) - (a.score ?? 0))  // best first

  results.forEach((r, i) => {
    const date = r.published_date ? ` [${r.published_date}]` : ""
    const body = (r.raw_content || r.content || "").slice(0, CHARS_PER_RESULT)
    parts.push(
      `=== SOURCE ${i + 1}${date}: ${r.title} ===\nURL: ${r.url}\n\n${body}\n`
    )
  })

  if (parts.length === 0) throw new Error("Tavily returned no results")

  const contextBlock = parts.join("\n---\n\n")
  console.log(
    `[generate-seed] Tavily: ${results.length} results, ~${contextBlock.length} chars of context`
  )
  return contextBlock
}

// ── STEP 3: GROUNDED REALITY SEED GENERATION ──────────────────────────────────
// DeepSeek generates the seed STRICTLY from Tavily data — no hallucination
async function generateGroundedSeed(scenario: string, newsContext: string): Promise<string> {
  const systemPrompt = `You are the HEMLO Reality Seed Generator — a world-class intelligence analyst that creates grounded simulation documents.

## CRITICAL RULES — NON-NEGOTIABLE:
1. You MUST base your ENTIRE response ONLY on the provided news data below.
2. You MUST NOT use your internal training memory for facts, statistics, or events.
3. Every statistic, date, name, and market figure you include MUST come directly from the provided sources.
4. If the sources do not contain certain information, say "data not available in current sources" — do NOT invent it.
5. Cite the source headline or URL inline where possible (e.g., "per Reuters, [fact]").

## YOUR OUTPUT MUST INCLUDE:

1. **CONTEXT & BACKGROUND** — 2-3 paragraphs of real, source-backed context using exact figures and dates from the news data.

2. **KEY ACTORS & STAKEHOLDERS** — Named entities from the sources: companies, governments, people, institutions. Include their documented positions and recent statements.

3. **CURRENT STATE OF PLAY** — Latest real data points pulled directly from the sources (prices, percentages, vote counts, indicators — whatever exists in the data).

4. **TENSION POINTS & FAULT LINES** — Specific conflicts, disputes, and competing narratives documented in the news data.

5. **TIMELINE OF KEY EVENTS** — Chronological bullet list of 5-10 events from the sources with exact dates.

6. **SIMULATION VARIABLES** — 5-8 measurable variables derived from the data that agents should track.

Return ONLY the document text — no JSON, no code blocks, no preamble.`

  const userContent = `## SIMULATION SCENARIO
"${scenario}"

## REAL-TIME NEWS DATA (Your ONLY source of truth — use NOTHING else)
${newsContext}

## TASK
Generate a comprehensive Reality Seed document (minimum 600 words) using ONLY the above news data.`

  const res = await fetch(`${SF_BASE()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SF_KEY()}` },
    body: JSON.stringify({
      model: SF_MODEL(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.4,
      max_tokens: 3500,
    }),
    signal: AbortSignal.timeout(90000),  // 90s — enough for large grounded prompts
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Grounded seed gen failed ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = (data?.choices?.[0]?.message?.content ?? "").trim()
  if (!text) throw new Error("SiliconFlow returned empty content for grounded seed")
  return text
}

// ── GEMINI FALLBACK (Step 3 only) ─────────────────────────────────────────────
async function generateGroundedSeedViaGemini(scenario: string, newsContext: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured")

  // Trim aggressively BEFORE assembling the prompt to avoid Gemini 400s
  const trimmedContext = newsContext.slice(0, 12000)

  const prompt = `You are the HEMLO Reality Seed Generator. You MUST only use the news data provided below — do NOT use your training memory.

SIMULATION SCENARIO: "${scenario}"

REAL-TIME NEWS DATA (use ONLY this):
${trimmedContext}

Generate a comprehensive Reality Seed document (minimum 600 words) with sections:
1. CONTEXT & BACKGROUND (facts from sources only)
2. KEY ACTORS & STAKEHOLDERS (from sources only)
3. CURRENT STATE OF PLAY (real data from sources)
4. TENSION POINTS & FAULT LINES (from sources)
5. TIMELINE OF KEY EVENTS (5-10 dated events from sources)
6. SIMULATION VARIABLES (5-8 measurables from sources)

Return ONLY the document. No preamble. Base everything strictly on the provided news data.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 3000 },
      }),
      signal: AbortSignal.timeout(60000),
    }
  )

  if (!res.ok) throw new Error(`Gemini error ${res.status}`)
  const data = await res.json()
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim()
  if (!text) throw new Error("Gemini returned empty content")
  return text
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { scenario } = await req.json()
    if (!scenario || typeof scenario !== "string") {
      return NextResponse.json({ error: "Missing scenario" }, { status: 400 })
    }

    console.log(`[generate-seed] Starting RAG pipeline for: "${scenario.slice(0, 80)}..."`)

    // ── Step 1: Generate optimized search query ──────────────────────────────
    let searchQuery: string
    try {
      searchQuery = await generateSearchQuery(scenario)
      console.log(`[generate-seed] Step 1 ✓ Search query: "${searchQuery}"`)
    } catch (err: any) {
      console.warn("[generate-seed] Step 1 failed, using scenario as fallback:", err.message)
      searchQuery = scenario.slice(0, 200) // fallback: use raw scenario
    }

    // ── Step 2: Tavily deep web scrape ───────────────────────────────────────
    let newsContext: string
    let tavilySuccess = false
    try {
      newsContext = await tavilyDeepSearch(searchQuery)
      tavilySuccess = true
      console.log(`[generate-seed] Step 2 ✓ Tavily returned ${newsContext.length} chars`)
    } catch (err: any) {
      console.warn("[generate-seed] Step 2 Tavily failed:", err.message)
      newsContext = "" // will fall through to ungrounded generation
    }

    // ── Step 3: Grounded seed generation ────────────────────────────────────
    let seed = ""
    let usedProvider = ""

    if (tavilySuccess && newsContext) {
      // Grounded path: DeepSeek → Gemini fallback
      try {
        seed = await generateGroundedSeed(scenario, newsContext)
        usedProvider = "siliconflow+tavily"
        console.log(`[generate-seed] Step 3 ✓ Grounded seed via SiliconFlow, length: ${seed.length}`)
      } catch (sfErr: any) {
        console.warn("[generate-seed] SiliconFlow grounded gen failed, trying Gemini:", sfErr.message)
        try {
          seed = await generateGroundedSeedViaGemini(scenario, newsContext)
          usedProvider = "gemini+tavily"
          console.log(`[generate-seed] Step 3 ✓ Grounded seed via Gemini, length: ${seed.length}`)
        } catch (gemErr: any) {
          console.error("[generate-seed] Both grounded providers failed:", gemErr.message)
          return NextResponse.json(
            { error: "Seed generation failed — both LLM providers failed with Tavily data." },
            { status: 502 }
          )
        }
      }
    } else {
      // Fallback: no Tavily data — use old ungrounded approach but warn
      console.warn("[generate-seed] Falling back to ungrounded seed (no Tavily data)")
      const fallbackPrompt = `You are a world-class geopolitical and socioeconomic intelligence analyst. Generate a comprehensive Reality Seed document for the following simulation scenario:\n\n"${scenario}"\n\nInclude: Context & Background, Key Actors, Current State of Play, Tension Points, Timeline of Key Events, Simulation Variables. Minimum 500 words. Facts and specifics only.`
      try {
        const res = await fetch(`${SF_BASE()}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SF_KEY()}` },
          body: JSON.stringify({
            model: SF_MODEL(),
            messages: [{ role: "user", content: fallbackPrompt }],
            temperature: 0.7,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(60000),
        })
        const data = await res.json()
        seed = (data?.choices?.[0]?.message?.content ?? "").trim()
        usedProvider = "siliconflow-ungrounded"
      } catch {
        return NextResponse.json({ error: "Seed generation failed entirely." }, { status: 502 })
      }
    }

    if (!seed) {
      return NextResponse.json({ error: "Seed generation returned empty content." }, { status: 502 })
    }

    return NextResponse.json({
      seed,
      provider: usedProvider,
      searchQuery: searchQuery ?? scenario,
      tavilySuccess,
    })
  } catch (error: any) {
    console.error("[generate-seed] Unexpected error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
