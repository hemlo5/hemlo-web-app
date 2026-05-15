import { NextRequest, NextResponse } from "next/server";
import { buildTradeProposal, fetchTradeScoutCandidates, getFundSnapshot, getTradeScoutFilters } from "@/lib/trade-scout";
import { getSupaAdmin, isTradeScoutAuthorized, TRADE_PROPOSALS_TABLE_SQL } from "@/lib/trade-scout-db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isTradeScoutAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = getSupaAdmin();
  if (!supa) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const fund = getFundSnapshot();
  if (!fund.canScout) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: fund.reason || `Available USDC (${fund.availableUsdc}) is below required minimum (${fund.minRequiredUsdc}).`,
      fund,
    });
  }

  const filters = getTradeScoutFilters();
  const candidates = await fetchTradeScoutCandidates(filters);
  const proposals = candidates.map((candidate) => buildTradeProposal(candidate, fund));

  if (proposals.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, candidates: [], fund, filters });
  }

  const { data, error } = await supa
    .from("trade_proposals")
    .upsert(proposals, { onConflict: "source,market_id" })
    .select("*");

  if (error) {
    const tableMissing = error.code === "42P01" || String(error.message || "").includes("trade_proposals");
    return NextResponse.json({
      error: error.message,
      hint: tableMissing ? "Create the trade_proposals table first. SQL included." : undefined,
      sql: tableMissing ? TRADE_PROPOSALS_TABLE_SQL : undefined,
    }, { status: tableMissing ? 409 : 500 });
  }

  return NextResponse.json({
    ok: true,
    inserted: data?.length || 0,
    fund,
    filters,
    proposals: data || [],
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
