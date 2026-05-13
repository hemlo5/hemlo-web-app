import type { Metadata } from "next";
import MirofishPageClient from "./MirofishPageClient";
import { getSimulateHomeData } from "@/lib/simulate-home-data";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Run MiroFish AI Simulations | Hemlo",
  description:
    "Run MiroFish multi-agent simulations on prediction markets, world events, and custom questions with live source grounding and probability verdicts.",
  alternates: { canonical: "/simulate/mirofish" },
  openGraph: {
    title: "Run MiroFish AI Simulations | Hemlo",
    description:
      "Launch AI simulations on Polymarket, Kalshi, and custom scenarios with Hemlo.",
    url: "/simulate/mirofish",
    type: "website",
  },
};

export default async function MirofishPage() {
  const initialHomeData = await getSimulateHomeData();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Hemlo MiroFish",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description: metadata.description,
    url: "https://hemloai.com/simulate/mirofish",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MirofishPageClient initialHomeData={initialHomeData} />
    </>
  );
}
