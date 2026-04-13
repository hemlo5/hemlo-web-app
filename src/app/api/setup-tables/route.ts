// @ts-nocheck
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "No Supabase creds" }, { status: 500 })

  const supa = createClient(url, key)

  // Create tables using raw SQL via Supabase RPC
  // If tables already exist, these will no-op
  const tables = [
    `CREATE TABLE IF NOT EXISTS asset_prices (
      symbol text PRIMARY KEY,
      name text,
      type text,
      coingecko_id text,
      price decimal,
      change_24h decimal,
      change_pct_24h decimal,
      market_cap decimal,
      volume_24h decimal,
      high_24h decimal,
      low_24h decimal,
      circulating_supply decimal,
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS asset_charts (
      symbol text,
      timerange text,
      data jsonb,
      expires_at timestamptz DEFAULT now() + interval '15 minutes',
      PRIMARY KEY (symbol, timerange)
    )`,
    `CREATE TABLE IF NOT EXISTS asset_news (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      symbol text,
      headline text,
      summary text,
      sentiment text,
      sentiment_score int,
      urgency text,
      price_impact text,
      price_direction text,
      fetched_at timestamptz DEFAULT now(),
      expires_at timestamptz DEFAULT now() + interval '30 minutes'
    )`,
    `CREATE TABLE IF NOT EXISTS custom_simulations (
      id uuid primary key default gen_random_uuid(),
      user_id text,
      scenario text,
      domain text,
      reality_seed text,
      agent_count int,
      rounds int,
      platforms text[],
      llm_model text,
      parallel_gen int,
      status text default 'pending',
      mirofish_project_id text,
      mirofish_sim_id text,
      mirofish_task_id text,
      result jsonb,
      report_text text,
      round_logs jsonb,
      agent_breakdown jsonb,
      confidence int,
      primary_probability int,
      consensus_round int,
      runtime_seconds int,
      created_at timestamptz default now(),
      completed_at timestamptz
    )`,
  ]

  const results: string[] = []
  for (const sql of tables) {
    const { error } = await supa.rpc("exec_sql", { sql_query: sql }).catch(() => ({ error: { message: "RPC not available" } }))
    if (error) {
      // Try direct REST - tables might already exist
      results.push(`Note: ${error.message ?? "unknown"} - table may already exist`)
    } else {
      results.push("OK")
    }
  }

  return NextResponse.json({ message: "Table setup attempted", results })
}
