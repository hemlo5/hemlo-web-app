import { NextRequest, NextResponse } from "next/server"
import { getMockResult } from "@/lib/utils"

// POST /api/simulate
// This endpoint is structured to match the exact shape MiroFish will eventually return.
// Replacing the mock with a real MiroFish call later requires zero frontend changes.

export async function POST(req: NextRequest) {
  try {
    const { mode, input } = await req.json()

    if (!mode || !input) {
      return NextResponse.json({ error: "mode and input are required" }, { status: 400 })
    }

    // ─── MOCKED SIMULATION ───────────────────────────────────────────────────
    // TODO: Replace this with a call to the MiroFish microservice:
    //
    //   const fuelPacket = await buildFuelPacket(mode, input) // data ingestion service
    //   const response = await fetch(`${process.env.MIROFISH_URL}/api/simulate`, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ seed: fuelPacket, prompt: input, max_rounds: 40 }),
    //   })
    //   const raw = await response.json()
    //   const result = formatMiroFishResult(raw)
    //
    // ─────────────────────────────────────────────────────────────────────────

    // Simulate some delay (as if we're actually running)
    await new Promise((resolve) => setTimeout(resolve, 3500))

    const result = getMockResult(mode, input)

    return NextResponse.json({ result }, { status: 200 })
  } catch (err) {
    console.error("[/api/simulate]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
