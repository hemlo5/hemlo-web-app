export interface TrendingTopic {
  id?: string
  topic: string
  category?: string
  impact?: string
  sentiment?: "bullish" | "bearish" | "neutral" | "controversial"
  sentimentScore?: number
  agentCount?: number
  confidence?: number
  affectedGroups?: string[]
  urgency?: "breaking" | "hot" | "developing" | "trending"
  sourceTitle?: string
  sourceUrl?: string
  fetchedAt?: string

  // Prediction market specific
  type?: "news" | "prediction"
  polymarketOdds?: string
  moneyAtStake?: string
  hemloOdds?: number
  divergence?: number
  divergenceSignal?: string
  marketEndDate?: string
  marketType?: "binary" | "categorical"
  outcomes?: Array<{
    label: string
    prob: number
    hemloProb?: number
  }>
  icon?: string
  image?: string
}

// ── STOCKS & CRYPTO ──────────────────────────────────────────────────────────

export interface Asset {
  symbol: string
  name: string
  type: "crypto" | "stock"
  coingeckoId?: string       // for crypto only
  price: number
  change24h: number
  changePct24h: number
  marketCap: number
  volume24h: number
  high24h: number
  low24h: number
  circulatingSupply?: number
  updatedAt?: string
}

export interface AssetChartPoint {
  t: number   // timestamp ms
  p: number   // price
  v?: number  // volume
}

export interface AssetNews {
  id?: string
  symbol: string
  headline: string
  summary: string
  sentiment: "bullish" | "bearish" | "neutral"
  sentimentScore: number
  urgency: "breaking" | "hot" | "trending"
  priceImpact: "high" | "medium" | "low"
  priceDirection: "up" | "down" | "neutral"
  fetchedAt?: string
}

export interface MarketStats {
  nyseOpen: boolean
  fearGreedValue: number
  fearGreedLabel: string
  cryptoMarketCap: number
  btcDominance: number
}

export const TRACKED_ASSETS = [
  // Crypto
  { symbol: "BTC", name: "Bitcoin",    type: "crypto" as const, coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum",   type: "crypto" as const, coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana",     type: "crypto" as const, coingeckoId: "solana" },
  { symbol: "BNB", name: "BNB",        type: "crypto" as const, coingeckoId: "binancecoin" },
  { symbol: "XRP", name: "XRP",        type: "crypto" as const, coingeckoId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin",  type: "crypto" as const, coingeckoId: "dogecoin" },
  { symbol: "ADA", name: "Cardano",    type: "crypto" as const, coingeckoId: "cardano" },
  // Stocks
  { symbol: "AAPL", name: "Apple",     type: "stock" as const },
  { symbol: "NVDA", name: "NVIDIA",    type: "stock" as const },
  { symbol: "TSLA", name: "Tesla",     type: "stock" as const },
  { symbol: "MSFT", name: "Microsoft", type: "stock" as const },
  { symbol: "GOOGL", name: "Alphabet", type: "stock" as const },
  { symbol: "META", name: "Meta",      type: "stock" as const },
  { symbol: "AMZN", name: "Amazon",    type: "stock" as const },
]
