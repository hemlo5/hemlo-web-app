import type { Metadata } from "next";
import PolymarketClient from "./PolymarketClient";
import type { MarketStats, TrendingTopic } from "@/lib/types";
import { serverJson } from "@/lib/server-prefetch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Polymarket AI Analysis | Hemlo",
  description:
    "Browse live Polymarket markets with Hemlo AI simulation context, outcome odds, market charts, and one-click MiroFish analysis.",
  alternates: { canonical: "/polymarket" },
  openGraph: {
    title: "Polymarket AI Analysis | Hemlo",
    description:
      "Live Polymarket markets paired with Hemlo AI simulation and divergence analysis.",
    url: "/polymarket",
    type: "website",
  },
};

function mapPolymarket(market: any): TrendingTopic {
  return {
    ...market,
    type: "prediction",
    topic: market.question || market.title || "",
    category: market.category || "Polymarket",
    polymarketOdds: market.outcomes?.[0]?.prob?.toString() || market.polymarketOdds || "50",
    icon: market.image || market.icon || "",
    image: market.image || market.icon || "",
    moneyAtStake: market.volume || market.moneyAtStake || "",
    marketType: market.marketType || ((market.outcomes?.length || 0) > 2 ? "categorical" : "binary"),
    outcomes: market.outcomes || undefined,
  };
}

export default async function PolymarketPage() {
  const [marketData, stats] = await Promise.all([
    serverJson<{ markets?: any[] }>("/api/polymarket-browse?category=trending&limit=12", 90),
    serverJson<MarketStats>("/api/market-stats", 600),
  ]);

  const initialMarkets = (marketData?.markets || []).map(mapPolymarket).filter((m) => m.topic);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Hemlo Polymarket AI Analysis",
    description: metadata.description,
    url: "https://hemloai.com/polymarket",
    isPartOf: {
      "@type": "WebSite",
      name: "Hemlo",
      url: "https://hemloai.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PolymarketClient initialMarkets={initialMarkets} initialStats={stats} />
    </>
  );
}
