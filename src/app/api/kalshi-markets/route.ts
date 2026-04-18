import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

// ── CATEGORY MAPS ─────────────────────────────────────────────────────────────
// Maps Kalshi's category string → our POLY_CATS key (used by client-side filter)
const CAT_TO_KEY: Record<string, string> = {
  "World":                   "world",
  "Elections":               "politics",
  "Climate and Weather":     "world",
  "Science and Technology":  "tech",
  "Politics":                "politics-general",
  "Financials":              "financials",
  "Entertainment":           "entertainment",
  "Social":                  "mentions",
  "Economics":               "economics",
  "Health":                  "tech",
  "Companies":               "companies",
  "Sports":                  "sports",
  "Transportation":          "tech",
  "Crypto":                  "crypto",
};

// Human-readable labels for the card
const CAT_LABEL: Record<string, string> = {
  "World":                   "World",
  "Elections":               "Elections",
  "Climate and Weather":     "Climate",
  "Science and Technology":  "Tech & Science",
  "Politics":                "Politics",
  "Financials":              "Financials",
  "Entertainment":           "Culture",
  "Social":                  "Social",
  "Economics":               "Economics",
  "Health":                  "Health",
  "Companies":               "Companies",
  "Sports":                  "Sports",
  "Transportation":           "Transportation",
  "Crypto":                  "Crypto",
};

// Fallback images (used only when Wikipedia returns nothing)
const CAT_FALLBACK: Record<string, string> = {
  world:            "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=300&q=80",
  politics:         "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=300&q=80",
  "politics-general": "https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=300&q=80",
  tech:             "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80",
  financials:       "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80",
  entertainment:    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80",
  mentions:         "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&q=80",
  economics:        "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=300&q=80",
  companies:        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80",
  sports:           "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&q=80",
  crypto:           "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=300&q=80",
  trending:         "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80",
};

// ── WIKIPEDIA IMAGE LOOKUP ────────────────────────────────────────────────────
// Extract proper nouns for a smarter search query
function wikiQuery(title: string): string {
  // Grab sequences of capitalized words (proper nouns) — ignore sentence-opener verbs
  const starters = /^(Will|Who|What|When|Which|How|Does|Is|Can|Did|Has|Have|Should|Would|Could)$/;
  const properNouns = (title.match(/\b[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,3}/g) || [])
    .filter((p) => !starters.test(p.trim().split(" ")[0]));

  if (properNouns.length > 0) return properNouns.slice(0, 2).join(" ").trim();

  // Fallback: strip filler words, keep content
  return title
    .replace(/\b(will|who|what|when|how|which|does|is|can|did|the|be|in|on|by|of|a|an|to|for|as|at|from|before|after|above|below|more|than|over|under|between|within|without|per|years|quarter|month|season|become|named|hit|reach|win|lose|pass|close|stay|exceed|fall|rise|grow|launch|announce|release|declare|sign|end|start|begin|stop|join|leave|resign|retire|appoint|elect|beat|earn|invest|buy|sell|rate|rates|price|market|global|national|american|us|federal)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ");
}

async function getWikiImage(query: string): Promise<string | null> {
  if (!query || query.trim().length < 3) return null;
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "1");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("pithumbsize", "500");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "HemloAI/1.0 (https://hemloai.com)" },
      next: { revalidate: 86400 }, // cache 24h per query
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0] as any;
    return first?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

function formatVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${Math.round(v)}`;
  return "<$1K";
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    // ── Step 1: Fetch ALL events (no server-side category filter — Kalshi ignores it)
    const evRes = await fetch(`${KALSHI_BASE}/events?limit=200`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(10000),
    });
    if (!evRes.ok) throw new Error(`Events API ${evRes.status}`);

    const { events = [] }: { events: any[] } = await evRes.json();

    // ── Step 2: Fan-out market fetches in parallel batches (ONE card per event)
    const BATCH = 20;
    type EM = { event: any; markets: any[] };
    const all: EM[] = [];

    for (let i = 0; i < events.length; i += BATCH) {
      const chunk = events.slice(i, i + BATCH);
      const results = await Promise.all(
        chunk.map(async (ev): Promise<EM> => {
          try {
            const r = await fetch(
              `${KALSHI_BASE}/markets?event_ticker=${ev.event_ticker}&limit=100`,
              {
                headers: { Accept: "application/json" },
                next: { revalidate: 30 },
                signal: AbortSignal.timeout(4000),
              }
            );
            const d = await r.json();
            return { event: ev, markets: d.markets ?? [] };
          } catch {
            return { event: ev, markets: [] };
          }
        })
      );
      all.push(...results.filter((r) => r.markets.length > 0));
    }

    // ── Step 3: Build ONE card per event (deduplication) ──────────────────────
    type Draft = {
      id: string;
      catKey: string;
      category: string;
      title: string;
      yesPrice: number;
      noPrice: number;
      outcomes: { label: string; prob: number; volumeRaw: number; }[];
      volume: string;
      volumeRaw: number;
      volume24h: number;
      openInterest: number;
      link: string;
      wikiQuery: string;
      image: string | null;
      marketType: "binary" | "categorical";
    };

    const drafts: Draft[] = all.map(({ event, markets }) => {
      const rawCat = event.category ?? "World";
      const catKey = CAT_TO_KEY[rawCat] ?? "trending";
      const label = CAT_LABEL[rawCat] ?? rawCat;

      // Sort by volume so the most-active market drives the headline price
      const sorted = [...markets].sort(
        (a, b) => parseFloat(b.volume_fp ?? "0") - parseFloat(a.volume_fp ?? "0")
      );
      const primary = sorted[0];
      const yesBid = parseFloat(primary?.yes_bid_dollars ?? primary?.last_price_dollars ?? "0.5");
      const noBid = parseFloat(primary?.no_bid_dollars ?? "0");
      
      const totalVol = markets.reduce((s, m) => s + parseFloat(m.volume_fp ?? "0"), 0);
      const vol24h = markets.reduce((s, m) => s + parseFloat(m.volume_24h_fp ?? "0"), 0);
      const openInt = markets.reduce((s, m) => s + parseFloat(m.open_interest_fp ?? "0"), 0);

      const isBinary = markets.length === 1;
      let outcomes: { label: string; prob: number; volumeRaw: number; }[];

      if (isBinary) {
        outcomes = [
          { label: "Yes", prob: Math.round(yesBid * 100), volumeRaw: parseFloat(primary?.volume_fp ?? "0") },
          { label: "No",  prob: noBid > 0 ? Math.round(noBid * 100) : Math.round((1 - yesBid) * 100), volumeRaw: 0 }, // no distinct no-volume in binary kalshi
        ];
      } else {
        // Multi-outcome: each market = one candidate/option
        outcomes = sorted
          .map((m) => ({
            label: (m.yes_sub_title ?? m.ticker.split("-").pop() ?? "?")
              .split(",")[0]
              .trim()
              .substring(0, 40),
            prob: Math.round(parseFloat(m.yes_bid_dollars ?? "0") * 100),
            volumeRaw: parseFloat(m.volume_fp ?? "0"),
          }))
          .filter((o) => o.prob > 0)
          .slice(0, 6);

        // If all outcomes collapsed to zero, add a fallback
        if (outcomes.length === 0) {
          outcomes = [
            { label: "Leading", prob: Math.round(yesBid * 100), volumeRaw: totalVol },
            { label: "Other",   prob: Math.round((1 - yesBid) * 100), volumeRaw: 0 },
          ];
        }
      }

      return {
        id: event.event_ticker,
        catKey,
        category: label,
        title: event.title,
        yesPrice: outcomes[0]?.prob ?? 50,
        noPrice: outcomes[1]?.prob ?? 50,
        outcomes,
        volume: formatVol(totalVol),
        volumeRaw: totalVol,
        volume24h: vol24h,
        openInterest: openInt,
        link: `https://kalshi.com/events/${event.event_ticker}`,
        wikiQuery: wikiQuery(event.title),
        image: null,
        marketType: isBinary ? "binary" : "categorical",
      };
    });

    // ── Step 4: Wikipedia images in parallel (real, topic-specific) ───────────
    const markets = await Promise.all(
      drafts.map(async (d) => {
        const wikiImg = await getWikiImage(d.wikiQuery);
        const fallback = CAT_FALLBACK[d.catKey] ?? CAT_FALLBACK.trending;
        const { wikiQuery: _wq, ...rest } = d;
        return { ...rest, image: wikiImg ?? fallback };
      })
    );

    // Log category distribution so we can debug filtering
    const catDist: Record<string, number> = {};
    markets.forEach((m) => { catDist[m.catKey] = (catDist[m.catKey] ?? 0) + 1; });
    console.log("[kalshi] catKey distribution:", catDist);

    return NextResponse.json({ markets, source: "live", count: markets.length });
  } catch (err: any) {
    console.error("[kalshi-markets] error:", err.message);
    return NextResponse.json({ markets: [], source: "error", error: err.message });
  }
}
