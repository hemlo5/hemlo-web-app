import { NextResponse } from "next/server";
import { getSimulateHomeData } from "@/lib/simulate-home-data";

export const dynamic = "force-dynamic";
export const revalidate = 60;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    const data = await getSimulateHomeData();
    return NextResponse.json(data, { headers: CACHE_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      {
        carouselMarkets: [],
        tickerItems: [],
        questions: [],
        generatedAt: new Date().toISOString(),
        error: err?.message || "Failed to load simulate home data",
      },
      { status: 200, headers: CACHE_HEADERS },
    );
  }
}
