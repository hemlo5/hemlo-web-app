import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenId = searchParams.get("tokenId")

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 })
  }

  // Mock Kalshi Trades
  if (tokenId.startsWith("kalshi-")) {
    const parts = tokenId.split("-");
    const p = parseFloat(parts[parts.length - 1]) || 50;
    const price = p / 100;

    const trades = [];
    const now = Date.now();
    for (let i = 0; i < 15; i++) {
        trades.push({
            price: price + (Math.random() - 0.5) * 0.05,
            size: Math.floor(10 + Math.random() * 500),
            side: Math.random() > 0.5 ? "BUY" : "SELL",
            timestamp: new Date(now - Math.random() * 86400000).toISOString(),
            outcome: "Yes",
        });
    }
    // Sort descending by time
    trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ trades }, { status: 200 });
  }

  try {
    const res = await fetch(
      `https://clob.polymarket.com/trades?asset_id=${tokenId}&limit=15`,
      { headers: { "User-Agent": "hemlo/1.0" } }
    )
    if (!res.ok) throw new Error(`CLOB ${res.status}`)
    const data = await res.json()

    const trades = (data || []).slice(0, 15).map((t: any) => ({
      price: parseFloat(t.price || "0"),
      size: parseFloat(t.size || "0"),
      side: t.side || "BUY",
      timestamp: t.match_time || t.created_at || "",
      outcome: t.asset_id === tokenId ? "Yes" : "No",
    }))

    return NextResponse.json({ trades })
  } catch (err: any) {
    return NextResponse.json({ trades: [], error: err.message })
  }
}
