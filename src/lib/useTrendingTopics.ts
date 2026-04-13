"use client"

import { useState, useEffect, useCallback } from "react"
import type { TrendingTopic } from "./types"

const REFRESH_INTERVAL = 30 * 60 * 1000 // 30 minutes

export function useTrendingTopics() {
  const [topics, setTopics] = useState<TrendingTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch_ = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/trending", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
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
