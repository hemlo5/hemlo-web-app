import { NextRequest, NextResponse } from "next/server";
import { getSupaAdmin, isTradeScoutAuthorized, TRADE_PROPOSALS_TABLE_SQL } from "@/lib/trade-scout-db";
import { syncRecentSimulationProposals } from "@/lib/trade-scout-simulations";
import { getTradeScoutFilters } from "@/lib/trade-scout";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isTradeScoutAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = getSupaAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 30)));
  const status = searchParams.get("status");
  const shouldSync = searchParams.get("sync") !== "0";
  const includeAll = searchParams.get("includeAll") === "1";
  let syncSummary: Awaited<ReturnType<typeof syncRecentSimulationProposals>> | null = null;

  if (shouldSync) {
    try {
      syncSummary = await syncRecentSimulationProposals(supa);
    } catch (error: any) {
      const tableMissing = error?.code === "42P01" || String(error?.message || "").includes("trade_proposals");
      if (tableMissing) {
        return NextResponse.json({
          proposals: [],
          error: error.message,
          sql: TRADE_PROPOSALS_TABLE_SQL,
        }, { status: 409 });
      }
      console.error("[trade-scout/proposals] simulation sync failed:", error);
    }
  }

  let query = supa
    .from("trade_proposals")
    .select("*")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("scout_score", { ascending: false })
    .limit(limit);

  if (!includeAll) {
    const filters = getTradeScoutFilters();
    const minClose = new Date(Date.now() + filters.minHoursToClose * 60 * 60 * 1000).toISOString();
    const maxClose = new Date(Date.now() + filters.maxHoursToClose * 60 * 60 * 1000).toISOString();
    query = query
      .eq("source", "polymarket")
      .gte("end_date", minClose)
      .lte("end_date", maxClose)
      .gte("volume", filters.minVolume)
      .gte("liquidity", filters.minLiquidity);
  }

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    const tableMissing = error.code === "42P01" || String(error.message || "").includes("trade_proposals");
    return NextResponse.json({
      proposals: [],
      error: error.message,
      sql: tableMissing ? TRADE_PROPOSALS_TABLE_SQL : undefined,
    }, { status: tableMissing ? 409 : 500 });
  }

  return NextResponse.json({ proposals: data || [], synced: syncSummary });
}
