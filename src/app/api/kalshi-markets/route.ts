import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const PAGE_SIZE   = 24; // cards per page (same as Polymarket)

// ── CATEGORY MAPS ─────────────────────────────────────────────────────────────
// Maps Kalshi's native category string → our POLY_CATS key
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
  "Energy":                  "finance",
  "Commodities":             "finance",
};

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
  "Transportation":          "Transportation",
  "Crypto":                  "Crypto",
  "Energy":                  "Commodities",
  "Commodities":             "Commodities",
};

// Fallback images per catKey
const CAT_FALLBACK: Record<string, string> = {
  world:              "https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=300&q=80",
  politics:           "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=300&q=80",
  "politics-general": "https://images.unsplash.com/photo-1569163139599-0f4517e36f51?w=300&q=80",
  tech:               "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80",
  financials:         "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80",
  finance:            "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80",
  entertainment:      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80",
  mentions:           "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&q=80",
  economics:          "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=300&q=80",
  companies:          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80",
  sports:             "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&q=80",
  crypto:             "https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=300&q=80",
  trending:           "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=300&q=80",
};

// ── WIKIPEDIA IMAGE ───────────────────────────────────────────────────────────
function wikiQuery(title: string): string {
  const starters = /^(Will|Who|What|When|Which|How|Does|Is|Can|Did|Has|Have|Should|Would|Could)$/;
  const properNouns = (title.match(/\b[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,3}/g) || [])
    .filter((p) => !starters.test(p.trim().split(" ")[0]));
  if (properNouns.length > 0) return properNouns.slice(0, 2).join(" ").trim();
  return title
    .replace(/\b(will|who|what|when|how|which|does|is|can|did|the|be|in|on|by|of|a|an|to|for|as|at|from|before|after|above|below|more|than|over|under|between|within|without|per|years|quarter|month|season|become|named|hit|reach|win|lose|pass|close|stay|exceed|fall|rise|grow|launch|announce|release|declare|sign|end|start|begin|stop|join|leave|resign|retire|appoint|elect|beat|earn|invest|buy|sell|rate|rates|price|market|global|national|american|us|federal)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").filter((w) => w.length > 2).slice(0, 5).join(" ");
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
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const first = Object.values(pages)[0] as any;
    return first?.thumbnail?.source ?? null;
  } catch { return null; }
}

function formatVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  if (v > 0) return `$${Math.round(v)}`;
  return "<$1K";
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
// Build one market card from an event + its markets
type MarketCard = {
  id: string; catKey: string; category: string; title: string;
  yesPrice: number; noPrice: number;
  outcomes: { label: string; prob: number; volumeRaw: number }[];
  volume: string; volumeRaw: number; volume24h: number; openInterest: number;
  link: string; image: string;
  marketType: "binary" | "categorical";
};

async function buildCard(event: any, markets: any[]): Promise<MarketCard> {
  const rawCat = event.category ?? "World";
  const catKey = CAT_TO_KEY[rawCat] ?? "trending";
  const category = CAT_LABEL[rawCat] ?? rawCat;

  const sorted = [...markets].sort((a, b) => parseFloat(b.volume_fp ?? "0") - parseFloat(a.volume_fp ?? "0"));
  const primary = sorted[0];
  const yesBid = parseFloat(primary?.yes_bid_dollars ?? primary?.last_price_dollars ?? "0.5");
  const noBid  = parseFloat(primary?.no_bid_dollars ?? "0");

  const totalVol  = markets.reduce((s, m) => s + parseFloat(m.volume_fp ?? "0"), 0);
  const vol24h    = markets.reduce((s, m) => s + parseFloat(m.volume_24h_fp ?? "0"), 0);
  const openInt   = markets.reduce((s, m) => s + parseFloat(m.open_interest_fp ?? "0"), 0);
  const isBinary  = markets.length === 1;

  let outcomes: { label: string; prob: number; volumeRaw: number }[];
  if (isBinary) {
    outcomes = [
      { label: "Yes", prob: Math.round(yesBid * 100), volumeRaw: parseFloat(primary?.volume_fp ?? "0") },
      { label: "No",  prob: noBid > 0 ? Math.round(noBid * 100) : Math.round((1 - yesBid) * 100), volumeRaw: 0 },
    ];
  } else {
    outcomes = sorted
      .map((m) => ({
        label: (m.yes_sub_title ?? m.ticker.split("-").pop() ?? "?").split(",")[0].trim().substring(0, 40),
        prob:  Math.round(parseFloat(m.yes_bid_dollars ?? "0") * 100),
        volumeRaw: parseFloat(m.volume_fp ?? "0"),
      }))
      .filter((o) => o.prob > 0)
      .slice(0, 6);
    if (outcomes.length === 0) {
      outcomes = [
        { label: "Leading", prob: Math.round(yesBid * 100), volumeRaw: totalVol },
        { label: "Other",   prob: Math.round((1 - yesBid) * 100), volumeRaw: 0 },
      ];
    }
  }

  const wq = wikiQuery(event.title);
  const wikiImg = await getWikiImage(wq);
  const fallback = CAT_FALLBACK[catKey] ?? CAT_FALLBACK.trending;

  return {
    id: event.event_ticker, catKey, category,
    title: event.title,
    yesPrice: outcomes[0]?.prob ?? 50,
    noPrice:  outcomes[1]?.prob ?? 50,
    outcomes,
    volume: formatVol(totalVol), volumeRaw: totalVol, volume24h: vol24h, openInterest: openInt,
    link: `https://kalshi.com/events/${event.event_ticker}`,
    image: wikiImg ?? fallback,
    marketType: isBinary ? "binary" : "categorical",
  };
}

// Fetch markets for one event
async function fetchEventMarkets(ticker: string): Promise<any[]> {
  try {
    const r = await fetch(`${KALSHI_BASE}/markets?event_ticker=${ticker}&limit=100`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    return d.markets ?? [];
  } catch { return []; }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category") ?? "trending"; // catKey from frontend
    const cursor   = searchParams.get("cursor") ?? "";           // Kalshi pagination cursor

    // ── Page through Kalshi events until we have PAGE_SIZE matching this category ──
    const collected: MarketCard[] = [];
    let nextCursor = cursor;
    let hasMore    = false;
    const MAX_DISCOVERY_PAGES = 5; // safety cap: 5 × 200 = 1000 events max

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
      const url = new URL(`${KALSHI_BASE}/events`);
      url.searchParams.set("limit", "200");
      url.searchParams.set("status", "open");
      if (nextCursor) url.searchParams.set("cursor", nextCursor);

      const evRes = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(10000),
      });
      if (!evRes.ok) break;

      const body = await evRes.json();
      const events: any[] = body.events ?? [];
      nextCursor = body.cursor ?? "";

      // Filter events for the requested category (client-side since Kalshi has no server filter)
      const matching = category === "trending"
        ? events // trending = all; volume sort later
        : events.filter((ev) => (CAT_TO_KEY[ev.category ?? "World"] ?? "trending") === category);

      // Fetch market details for matching events in parallel batches of 10
      const BATCH = 10;
      for (let i = 0; i < matching.length; i += BATCH) {
        const chunk = matching.slice(i, i + BATCH);
        const results = await Promise.all(
          chunk.map(async (ev) => {
            const mkts = await fetchEventMarkets(ev.event_ticker);
            if (mkts.length === 0) return null;
            return buildCard(ev, mkts);
          })
        );
        for (const card of results) {
          if (card) collected.push(card);
          if (collected.length >= PAGE_SIZE + 1) break; // +1 to detect hasMore
        }
        if (collected.length >= PAGE_SIZE + 1) break;
      }

      // If we have enough OR Kalshi has no more pages, stop
      if (collected.length >= PAGE_SIZE + 1 || !nextCursor) break;
    }

    // Sort trending by volume
    if (category === "trending") {
      collected.sort((a, b) => b.volumeRaw - a.volumeRaw);
    }

    hasMore = collected.length > PAGE_SIZE;
    const markets = collected.slice(0, PAGE_SIZE);

    // Log for debugging
    console.log(`[kalshi-markets] category=${category} returned=${markets.length} hasMore=${hasMore}`);

    return NextResponse.json({
      markets,
      cursor: hasMore ? nextCursor : "",
      hasMore,
      count: markets.length,
      source: "live",
    });
  } catch (err: any) {
    console.error("[kalshi-markets] error:", err.message);
    return NextResponse.json({ markets: [], cursor: "", hasMore: false, error: err.message });
  }
}
