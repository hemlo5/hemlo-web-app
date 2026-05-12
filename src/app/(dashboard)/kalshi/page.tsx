import type { Metadata } from "next";
import KalshiClient from "./KalshiClient";
import type { MarketStats, TrendingTopic } from "@/lib/types";
import { serverJson } from "@/lib/server-prefetch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kalshi AI Analysis | Hemlo",
  description:
    "Browse live Kalshi markets with Hemlo AI simulation context, outcome odds, market cards, and one-click MiroFish analysis.",
  alternates: { canonical: "/kalshi" },
  openGraph: {
    title: "Kalshi AI Analysis | Hemlo",
    description: "Live Kalshi markets paired with Hemlo AI simulation and divergence analysis.",
    url: "/kalshi",
    type: "website",
  },
};

function mapKalshi(market: any): TrendingTopic {
  const outcomes =
    market.outcomes && market.outcomes.length > 0
      ? market.outcomes
      : [
          { label: "Yes", prob: market.yesPrice || 50 },
          { label: "No", prob: market.noPrice || 50 },
        ];

  return {
    ...market,
    type: "prediction",
    topic: market.title || market.question || "",
    category: market.category || "Kalshi",
    polymarketOdds: market.yesPrice?.toString() || "50",
    icon: market.image || "/kalshi.webp",
    image: market.image || "/kalshi.webp",
    moneyAtStake: market.volume || "",
    marketType: market.marketType === "categorical" || outcomes.length > 2 ? "categorical" : "binary",
    outcomes,
  };
}

export default async function KalshiPage() {
  const [marketData, stats] = await Promise.all([
    serverJson<{ markets?: any[] }>("/api/kalshi-markets?category=trending", 90),
    serverJson<MarketStats>("/api/market-stats", 600),
  ]);

  const initialMarkets = (marketData?.markets || []).map(mapKalshi).filter((m) => m.topic);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Hemlo Kalshi AI Analysis",
    description: metadata.description,
    url: "https://hemloai.com/kalshi",
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
      <KalshiClient initialMarkets={initialMarkets} initialStats={stats} />
    </>
  );
}
