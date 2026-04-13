import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenId = searchParams.get("tokenId")
  const interval = searchParams.get("interval") || "1w"
  const fidelity = searchParams.get("fidelity") || "60" // minutes

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 })
  }

  try {
    const url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`
    const res = await fetch(url, {
      headers: { "User-Agent": "hemlo/1.0" },
      next: { revalidate: 120 },
    })

    if (!res.ok) throw new Error(`CLOB API ${res.status}`)
    const data = await res.json()

    // data.history is array of { t: unix_timestamp, p: price_decimal }
    const history = (data.history || []).map((pt: any) => ({
      t: pt.t,
      p: parseFloat(pt.p),
    }))

    return NextResponse.json({ history }, { status: 200 })
  } catch (err: any) {
    console.error("[polymarket-history]", err.message)
    return NextResponse.json({ history: [], error: err.message }, { status: 200 })
  }
}
