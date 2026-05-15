import { NextRequest, NextResponse } from "next/server";
import { getSupaAdmin, isTradeScoutAuthorized } from "@/lib/trade-scout-db";
import { executeApprovedTrade, getTradeExecutionReadiness, validateProposalTradeWindow } from "@/lib/trade-executor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!isTradeScoutAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = getSupaAdmin();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const step = Number(body.step || 1);
  if (step !== 1 && step !== 2) {
    return NextResponse.json({ error: "Approval step must be 1 or 2." }, { status: 400 });
  }

  const { data: proposal, error: fetchError } = await supa
    .from("trade_proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !proposal) {
    return NextResponse.json({ error: fetchError?.message || "Proposal not found" }, { status: 404 });
  }

  const currentStep = Number(proposal.approval_step || 0);
  if (step === 2 && currentStep < 1) {
    return NextResponse.json({ error: "Step 1 approval is required before step 2." }, { status: 409 });
  }
  if (step === 2 && currentStep >= 2) {
    return NextResponse.json({
      ok: true,
      proposal,
      executionEnabled: process.env.TRADE_EXECUTION_ENABLED === "true",
      note: "Proposal was already double-approved. No duplicate trade was submitted.",
    });
  }

  const tradeWindow = validateProposalTradeWindow(proposal);
  if (!tradeWindow.ok) {
    return NextResponse.json({
      error: `Blocked: this proposal no longer matches the trade filter (${tradeWindow.reason}).`,
      validation: tradeWindow,
    }, { status: 409 });
  }

  const executionEnabled = process.env.TRADE_EXECUTION_ENABLED === "true";
  const readiness = getTradeExecutionReadiness();
  if (step === 2 && executionEnabled && readiness.missing.length) {
    return NextResponse.json({
      error: `Execution is enabled, but required trading env vars are missing: ${readiness.missing.join(", ")}.`,
      readiness: { ...readiness, missing: readiness.missing },
    }, { status: 409 });
  }

  const update = step === 1
    ? {
        approval_step: Math.max(currentStep, 1),
        approval_1_at: new Date().toISOString(),
        status: "approval_1_complete",
        updated_at: new Date().toISOString(),
      }
    : executionEnabled
      ? {
          approval_step: 2,
          approval_2_at: new Date().toISOString(),
          status: "executing",
          execution_status: "executing",
          updated_at: new Date().toISOString(),
        }
    : {
        approval_step: 2,
        approval_2_at: new Date().toISOString(),
        status: "approved_execution_disabled",
        execution_status: "execution_disabled_by_env",
        updated_at: new Date().toISOString(),
      };

  const { data, error } = await supa
    .from("trade_proposals")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (step === 2 && executionEnabled) {
    try {
      const execution = await executeApprovedTrade(data);
      const finalUpdate = execution.ok
        ? {
            status: "executed",
            execution_status: execution.status,
            execution_result: execution,
            updated_at: new Date().toISOString(),
          }
        : {
            status: "execution_failed",
            execution_status: execution.status,
            execution_result: execution,
            updated_at: new Date().toISOString(),
          };
      const { data: finalProposal, error: finalError } = await supa
        .from("trade_proposals")
        .update(finalUpdate)
        .eq("id", id)
        .select("*")
        .single();

      if (finalError) return NextResponse.json({ error: finalError.message, execution }, { status: 500 });
      return NextResponse.json({
        ok: execution.ok,
        proposal: finalProposal,
        executionEnabled,
        execution,
        note: execution.ok
          ? "Double-approved and trade submitted to Polymarket."
          : `Double-approved, but execution failed: ${execution.reason || execution.status}.`,
      }, { status: execution.ok ? 200 : 502 });
    } catch (err: any) {
      const execution = {
        ok: false,
        status: "execution_failed",
        reason: err?.message || "Polymarket execution failed.",
      };
      await supa
        .from("trade_proposals")
        .update({
          status: "execution_failed",
          execution_status: "execution_failed",
          execution_result: execution,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      return NextResponse.json({ error: execution.reason, execution }, { status: 502 });
    }
  }

  return NextResponse.json({
    ok: true,
    proposal: data,
    executionEnabled,
    note: step === 1
      ? "Step 1 approved. Review once more before live execution."
      : executionEnabled
      ? "Proposal is ready for the execution worker."
      : "Double-approved, but order execution is disabled. Set TRADE_EXECUTION_ENABLED=true only after the executor is wired and tested.",
  });
}
