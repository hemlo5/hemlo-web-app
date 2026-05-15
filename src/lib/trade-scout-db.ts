import "server-only";

import { createClient } from "@supabase/supabase-js";

export const TRADE_PROPOSALS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS trade_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  market_id text NOT NULL,
  market_slug text,
  title text NOT NULL,
  category text,
  end_date timestamptz,
  volume numeric,
  volume_24h numeric,
  liquidity numeric,
  market_type text,
  outcomes jsonb,
  filter_snapshot jsonb,
  fund_snapshot jsonb,
  scout_score numeric,
  scout_reasons jsonb,
  simulation_question text,
  hemlo_simulation_id uuid,
  hemlo_verdict jsonb,
  proposed_outcome text,
  proposed_price numeric,
  proposed_stake numeric,
  status text DEFAULT 'needs_simulation',
  approval_step int DEFAULT 0,
  approval_1_at timestamptz,
  approval_2_at timestamptz,
  execution_status text DEFAULT 'disabled_until_double_approval',
  execution_result jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (source, market_id)
)`;

export function getSupaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isTradeScoutAuthorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const adminSecret = process.env.ADMIN_SECRET;
  const auth = req.headers.get("Authorization") || "";
  const headerSecret = req.headers.get("x-cron-secret") || req.headers.get("x-admin-secret") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return Boolean(
    (cronSecret && (token === cronSecret || headerSecret === cronSecret)) ||
      (adminSecret && (token === adminSecret || headerSecret === adminSecret)),
  );
}
