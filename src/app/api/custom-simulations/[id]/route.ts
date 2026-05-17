import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function isPublicCronSimulation(row: any) {
  const result = row?.result || {};
  const marketInfo = result?.marketInfo || result?.market_info || {};
  const cronUserId = process.env.CRON_USER_ID;
  return (
    marketInfo?.simulatedBy === "modal_trending_cron" ||
    (Boolean(cronUserId) && row?.user_id === cronUserId) ||
    row?.user_id === "modal_trending_cron"
  );
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supa = getSupa();
  if (!supa) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const authClient = await createServerSupabase();
  const { data: { user } } = await authClient.auth.getUser();

  const { data, error } = await supa
    .from("custom_simulations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isPublicCronSimulation(data) && (!user || data.user_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ simulation: data });
}
