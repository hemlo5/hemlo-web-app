import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Use SiliconFlow/DeepSeek — same key MiroFish backend uses
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://api.siliconflow.com/v1";
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-ai/DeepSeek-V3";

export async function POST(req: NextRequest) {
  try {
    const { question, scenario, report_text, round_logs } = await req.json();

    if (!question || !report_text) {
      return NextResponse.json({ error: "Missing question or report_text" }, { status: 400 });
    }

    // Flatten round logs for context
    const logEntries: any[] = Array.isArray(round_logs)
      ? round_logs
      : round_logs ? Object.values(round_logs) : [];

    const samplePosts = logEntries
      .flatMap((r: any) => (Array.isArray(r?.sample_posts) ? r.sample_posts : []))
      .slice(0, 40)
      .map((p: any) => `[${p.agent}]: ${p.content || p.text || ""}`)
      .join("\n");

    const systemPrompt = `You are HEMLO, an advanced AI prediction engine that analyzes social simulation outputs to generate precise, direct answers.

You are given:
1. A simulation scenario/question
2. A full analysis report from a multi-agent social simulation
3. Sample social media posts from simulation agents

Your task:
- Answer the question DIRECTLY and SPECIFICALLY. Do not be vague.
- If the question is "who will win the Oscars?", your answer must name a specific person/candidate.
- Lead with the direct answer in the first sentence.
- Support with 2-3 key insights from the report.
- Be concise (max 150 words).
- Use confident, definitive language.`;

    const userPrompt = `SIMULATION SCENARIO: "${scenario}"

QUESTION TO ANSWER: "${question}"

ANALYSIS REPORT:
${report_text.slice(0, 3000)}

SAMPLE SIMULATION EVENTS:
${samplePosts.slice(0, 1500)}

Based on this simulation data, provide a direct, specific answer to the question.`;

    const response = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[sim-qa] LLM error:", err);
      return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "Unable to generate answer.";

    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error("[sim-qa] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
