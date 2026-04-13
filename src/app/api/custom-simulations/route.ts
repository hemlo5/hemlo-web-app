import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { checkSimulationLimit, incrementSimulationCount } from "@/lib/simulation-usage";

export const dynamic = "force-dynamic";

function getSupaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseAdmin(url, key);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ simulations: [] });

  const supaAdmin = getSupaAdmin();
  if (!supaAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  
  const { data, error } = await supaAdmin
    .from("custom_simulations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // Table doesn't exist yet — return empty list gracefully
    if (error.code === "42P01") {
      return NextResponse.json({ simulations: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ simulations: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce daily limit using shared utility
  const limitCheck = await checkSimulationLimit(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 429 });
  }

  const supaAdmin = getSupaAdmin();
  if (!supaAdmin) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const body = await req.json();
  const {
    id, // optional: if updating
    user_id = "default_user",
    scenario,
    domain,
    reality_seed,
    agent_count,
    rounds,
    platforms,
    llm_model,
    parallel_gen,
    status = "pending",
    result,
    report_text,
    round_logs,
    agent_breakdown,
    confidence,
    primary_probability,
    consensus_round,
    runtime_seconds,
    mirofish_project_id,
    mirofish_sim_id,
    mirofish_task_id,
    completed_at
  } = body;

  const payload: any = {
    user_id: user.id,
    scenario,
    domain,
    reality_seed,
    agent_count,
    rounds,
    platforms,
    llm_model,
    parallel_gen,
    status,
    mirofish_project_id,
    mirofish_sim_id,
    mirofish_task_id,
  };

  if (result) payload.result = result;
  if (report_text) payload.report_text = report_text;
  if (round_logs) payload.round_logs = round_logs;
  if (agent_breakdown) payload.agent_breakdown = agent_breakdown;
  if (confidence !== undefined) payload.confidence = confidence;
  if (primary_probability !== undefined) payload.primary_probability = primary_probability;
  if (consensus_round !== undefined) payload.consensus_round = consensus_round;
  if (runtime_seconds !== undefined) payload.runtime_seconds = runtime_seconds;
  if (completed_at) payload.completed_at = completed_at;

  let supaQuery;

  if (id) {
    supaQuery = supaAdmin.from("custom_simulations").update(payload).eq("id", id).eq("user_id", user.id).select().single();
  } else {
    supaQuery = supaAdmin.from("custom_simulations").insert(payload).select().single();
  }

  const { data, error } = await supaQuery;

  if (error) {
    console.error("[custom-simulations] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment lifetime counter only on new simulations (not updates)
  if (!id) {
    await incrementSimulationCount(user.id);
  }

  return NextResponse.json({ success: true, simulation: data });
}
