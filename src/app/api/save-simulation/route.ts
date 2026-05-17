import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js"
import { createClient } from "@/utils/supabase/server"
import { checkSimulationLimit, incrementSimulationCount, sanitizeSimulationParameters } from "@/lib/simulation-usage"

export const dynamic = "force-dynamic"

function getSupa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseAdmin(url, key)
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { scenario, domain, agent_count, rounds, result } = body

    const supa = getSupa()
    if (!supa) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const limitCheck = await checkSimulationLimit(user.id)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 429 })
    }
    const safeParams = sanitizeSimulationParameters(
      {
        maxAgents: limitCheck.maxAgents ?? 15,
        maxRounds: limitCheck.maxRounds ?? 5,
        advancedParams: limitCheck.advancedParams ?? false,
      },
      agent_count,
      rounds,
    )

    // Insert WITH user_id so usage is counted
    const { error } = await supa.from("custom_simulations").insert({
      user_id: user.id,
      scenario,
      domain,
      agent_count: safeParams.agentCount,
      rounds: safeParams.rounds,
      result,
    })

    if (error) {
      console.error("[save-simulation] Supabase error:", error)
      if (error.code === "42P01") {
        return NextResponse.json({ error: "Table not found." }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await incrementSimulationCount(user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[save-simulation] Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
