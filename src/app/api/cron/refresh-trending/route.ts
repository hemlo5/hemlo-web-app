import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization") ?? req.headers.get("x-cron-secret")
  if (auth !== `Bearer ${process.env.CRON_SECRET}` && auth !== process.env.CRON_SECRET) {
    if (process.env.NODE_ENV === "production") return new Response("Unauthorized", { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Fire off all cache-warming requests in parallel without waiting (fire and forget)
  // or await them if we want to ensure Vercel doesn't kill the lambda
  try {
    await Promise.all([
      fetch(`${baseUrl}/api/stocks-prices`),
      fetch(`${baseUrl}/api/stocks-news?symbol=BTC`),
      fetch(`${baseUrl}/api/stocks-chart?symbol=BTC&range=1D`),
    ])
    return NextResponse.json({ status: "ok", message: "Warmed stocks cache" })
  } catch (e) {
    return NextResponse.json({ status: "error", error: String(e) }, { status: 500 })
  }
}