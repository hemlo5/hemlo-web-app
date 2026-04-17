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

export interface MarketStats {
  fearGreedValue: number
  fearGreedLabel: string
  cryptoMarketCap: number
  btcDominance: number
}
