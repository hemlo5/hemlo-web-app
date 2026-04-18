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

  // Handle mock Kalshi history
  if (tokenId.startsWith("kalshi-")) {
    const parts = tokenId.split("-");
    const currentPrice = parseFloat(parts[parts.length - 1]) || 50;
    
    // Generate realistic looking chart history leading up to the current price
    const history = [];
    const now = Math.floor(Date.now() / 1000);
    const numPoints = 100; // 100 data points
    // 1 week of data:
    const step = (7 * 24 * 60 * 60) / numPoints;
    let price = 50; // starts at 50% randomly in the past
    
    for (let i = 0; i < numPoints; i++) {
        // Simple random walk that eventually converges to target
        const progress = i / numPoints;
        const pullToTarget = (currentPrice - price) * progress * 0.15;
        const noise = (Math.random() - 0.5) * 8;
        
        price = Math.max(1, Math.min(99, price + pullToTarget + noise));
        
        // Pin final point exactly to current
        if (i === numPoints - 1) price = currentPrice;
        
        history.push({
            t: now - (numPoints - i) * step,
            p: price / 100
        });
    }
    
    return NextResponse.json({ history }, { status: 200 })
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
