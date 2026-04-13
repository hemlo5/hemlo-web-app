import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !supaKey) return NextResponse.json({ data: [] })

  try {
    const supa = createClient(supaUrl, supaKey)
    // Fetch last 600 simulations (gets ~30 datapoints since we do 20 per 10min)
    const { data: sims, error } = await supa
      .from("simulations")
      .select("created_at, hemlo_odds, crowd_odds")
      .order("created_at", { ascending: false })
      .limit(600)

    if (error || !sims) return NextResponse.json({ data: [] })

    // Group by 10-minute buckets to match the gem.py interval
    const buckets: Record<string, { hemlo: number; crowd: number; count: number }> = {}

    sims.forEach(s => {
      const d = new Date(s.created_at)
      d.setMinutes(Math.floor(d.getMinutes() / 10) * 10)
      d.setSeconds(0)
      d.setMilliseconds(0)
      const key = d.toISOString()
      
      if (!buckets[key]) buckets[key] = { hemlo: 0, crowd: 0, count: 0 }
      buckets[key].hemlo += Number(s.hemlo_odds || 0)
      buckets[key].crowd += Number(s.crowd_odds || 0)
      buckets[key].count += 1
    })

    const result = Object.entries(buckets)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([ts, vals], i) => {
        const d = new Date(ts)
        const hours = d.getHours().toString().padStart(2, '0')
        const mins = d.getMinutes().toString().padStart(2, '0')
        return {
          i,
          time: `${hours}:${mins}`,
          timestamp: Math.floor(d.getTime() / 1000),
          hemlo: vals.hemlo / vals.count,
          crowd: vals.crowd / vals.count,
        }
      })

    return NextResponse.json({ data: result }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ data: [] }, { status: 500 })
  }
}
