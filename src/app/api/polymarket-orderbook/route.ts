import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenId = searchParams.get("tokenId")

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 })
  }

  // Mock Kalshi Orderbook
  if (tokenId.startsWith("kalshi-")) {
    const parts = tokenId.split("-");
    const p = parseFloat(parts[parts.length - 1]) || 50;
    const price = p / 100;

    const bids = [];
    const asks = [];
    for (let i = 1; i <= 8; i++) {
        const bidPrice = Math.max(0.01, price - (0.01 * i));
        const askPrice = Math.min(0.99, price + (0.01 * i));
        bids.push({ price: bidPrice, size: 50 + Math.random() * 2000 });
        asks.push({ price: askPrice, size: 50 + Math.random() * 2000 });
    }
    return NextResponse.json({ bids, asks }, { status: 200 });
  }

  try {
    const res = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`, {
      headers: { "User-Agent": "hemlo/1.0" },
    })
    if (!res.ok) throw new Error(`CLOB ${res.status}`)
    const data = await res.json()

    // data has { bids: [{price, size}], asks: [{price, size}] }
    const bids = (data.bids || []).slice(0, 8).map((b: any) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }))
    const asks = (data.asks || []).slice(0, 8).map((a: any) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }))

    return NextResponse.json({ bids, asks })
  } catch (err: any) {
    return NextResponse.json({ bids: [], asks: [], error: err.message })
  }
}
