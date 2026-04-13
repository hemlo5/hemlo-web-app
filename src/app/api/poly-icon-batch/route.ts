import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Accepts ?slugs=slug1,slug2,...
// Returns { iconMap: { [slug]: { icon, image } } }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slugsParam = searchParams.get("slugs") || ""
  const slugs = slugsParam.split(",").map(s => s.trim()).filter(Boolean)

  if (slugs.length === 0) {
    return NextResponse.json({ iconMap: {} })
  }

  const iconMap: Record<string, { icon: string; image: string }> = {}

  // Fetch events for each slug in parallel, using Polymarket Gamma API
  await Promise.all(
    slugs.map(async (slug) => {
      try {
        const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`
        const res = await fetch(url, {
          headers: { "User-Agent": "hemlo/1.0" },
          next: { revalidate: 300 },
        })
        if (!res.ok) return
        const data = await res.json()
        const ev = Array.isArray(data) ? data[0] : data
        if (ev) {
          iconMap[slug] = {
            icon: ev.icon || ev.image || "",
            image: ev.image || ev.icon || "",
          }
        }
      } catch {
        // silent – just no icon for this slug
      }
    })
  )

  return NextResponse.json({ iconMap })
}
