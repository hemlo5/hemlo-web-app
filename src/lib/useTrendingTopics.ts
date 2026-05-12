"use client"

import { useState, useEffect, useCallback } from "react"
import type { TrendingTopic } from "./types"
import { cachedJson, readClientCache } from "./client-cache"

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes

export function useTrendingTopics() {
  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      const cached = readClientCache<{ topics?: TrendingTopic[] }>("/api/trending")
      if (cached) {
        setTopics(cached.topics ?? [])
        setLastUpdated(new Date())
        setLoading(false)
      } else {
        setLoading(true)
      }
      setError(null)
      const data = await cachedJson<{ topics?: TrendingTopic[] }>("/api/trending", { ttlMs: REFRESH_INTERVAL })
      setTopics(data.topics ?? [])
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message ?? "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [fetch_])

  return { topics, loading, error, lastUpdated, refetch: fetch_ }
}
