import { createClient } from "@supabase/supabase-js";
import SimulationResultInteractive, { SimulationPayload } from "@/components/simulation/SimulationResultInteractive";
import { Metadata } from "next";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Force Next.js to dynamically render this route
export const dynamic = "force-dynamic";

async function fetchSimulation(simId: string): Promise<SimulationPayload | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase
    .from("custom_simulations")
    .select("*")
    .eq("id", simId)
    .single();

  if (error || !data) return null;
  return data;
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
