import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Fetch price history for a Polymarket CLOB token.
 * Usage: /api/polymarket-chart?token=<clobTokenId>&interval=1w&fidelity=60
 *
 * Returns: { history: Array<{ t: number; p: number }> }
 *   t = unix timestamp (seconds)
 *   p = price (0–1)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token") || ""
  const interval = searchParams.get("interval") || "1w"
  const fidelity = searchParams.get("fidelity") || "60"

  if (!token) {
    return NextResponse.json({ history: [] })
  }

  try {
    const url = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(token)}&interval=${interval}&fidelity=${fidelity}`
    const res = await fetch(url, {
      headers: { "User-Agent": "hemlo/1.0" },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error(`[polymarket-chart] CLOB API returned ${res.status}`)
      return NextResponse.json({ history: [] })
    }

    const data = await res.json()
    // CLOB API returns { history: [{ t, p }] } directly
    const history = Array.isArray(data?.history)
      ? data.history
          .map((pt: any) => ({
            t: Number(pt.t),
            p: Number(pt.p),
          }))
          .filter((pt: any) => Number.isFinite(pt.t) && Number.isFinite(pt.p))
      : []

    return NextResponse.json({ history })
  } catch (err: any) {
    console.error("[polymarket-chart]", err.message)
    return NextResponse.json({ history: [] })
  }
}
