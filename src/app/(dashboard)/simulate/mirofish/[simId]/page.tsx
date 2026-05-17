import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/utils/supabase/server";
import SimulationResultInteractive, { SimulationPayload } from "@/components/simulation/SimulationResultInteractive";
import { Metadata } from "next";
import Link from "next/link";

// Force Next.js to dynamically render this route
export const dynamic = "force-dynamic";

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

async function fetchSimulation(simId: string): Promise<SimulationPayload | null> {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const admin = createClient(url, serviceKey);
  const { data } = await admin
    .from("custom_simulations")
    .select("*")
    .eq("id", simId)
    .maybeSingle();

  if (!data) return null;
  if (isPublicCronSimulation(data) || (user && data.user_id === user.id)) {
    return data as SimulationPayload;
  }

  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ simId: string }> }): Promise<Metadata> {
  const p = await params;
  const sim = await fetchSimulation(p.simId);
  if (!sim) {
    return { title: "Simulation Not Found - HEMLO AI" };
  }
  
  return {
    title: `Simulation: ${sim.scenario} | HEMLO AI`,
    description: `A multi-agent AI simulation analyzing: ${sim.scenario}.`,
    openGraph: {
      title: `HEMLO AI Simulation: ${sim.scenario}`,
      description: `We ran an AI simulation with ${sim.agent_count} agents to analyze: ${sim.scenario}. View the verdict and results.`,
      type: "website",
    },
  };
}

export default async function SimulationResultPage({ params }: { params: Promise<{ simId: string }> }) {
  const p = await params;
  const simData = await fetchSimulation(p.simId);

  if (!simData) {
    return (
      <div style={{ backgroundColor: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif", padding: 40 }}>
        <h2 className="text-xl font-semibold mb-4">Simulation not found</h2>
        <Link href="/simulate/mirofish" style={{ color: "#aaa", textDecoration: "underline" }}>← Back to simulation engine</Link>
      </div>
    );
  }

  return <SimulationResultInteractive initialData={simData} />;
}
