import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json(
    { error: "Payment confirmation is handled by signed Dodo webhooks only." },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json(
    { error: "Payment confirmation is handled by signed Dodo webhooks only." },
    { status: 410 }
  )
}
