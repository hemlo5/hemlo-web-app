import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 180;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=180, stale-while-revalidate=600",
};

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";
const PAGE_SIZE   = 24; // cards per page (same as Polymarket)

// ── CATEGORY MAPS ─────────────────────────────────────────────────────────────
// Maps Kalshi's native category string → our POLY_CATS key
const CAT_TO_KEY: Record<string, string> = {
  "World":                   "geopolitics",
  "Elections":               "politics",
  "Climate and Weather":     "weather",
  "Science and Technology":  "tech",
  "Politics":                "politics",
  "Financials":              "finance",
  "Entertainment":           "culture",
  "Social":                  "culture",
  "Economics":               "economy",
  "Health":                  "tech",
  "Companies":               "finance",
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

function unsplash(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;
}

const CURATED_IMAGE_POOLS: Record<string, string[]> = {
  geopolitics: [
    unsplash("photo-1526470608268-f674ce90ebd4"),
    unsplash("photo-1500530855697-b586d89ba3ee"),
    unsplash("photo-1521295121783-8a321d551ad2"),
  ],
  politics: [
    unsplash("photo-1541872703-74c5e44368f9"),
    unsplash("photo-1569163139599-0f4517e36f51"),
    unsplash("photo-1529107386315-e1a2ed48a620"),
  ],
  tech: [
    unsplash("photo-1451187580459-43490279c0fa"),
    unsplash("photo-1518770660439-4636190af475"),
    unsplash("photo-1516321318423-f06f85e504b3"),
  ],
  finance: [
    unsplash("photo-1611974789855-9c2a0a7236a3"),
    unsplash("photo-1526304640581-d334cdbbf45e"),
    unsplash("photo-1486406146926-c627a92ad1ab"),
  ],
  economy: [
    unsplash("photo-1526304640581-d334cdbbf45e"),
    unsplash("photo-1554224155-6726b3ff858f"),
    unsplash("photo-1486406146926-c627a92ad1ab"),
  ],
  culture: [
    unsplash("photo-1493225457124-a3eb161ffa5f"),
    unsplash("photo-1485846234645-a62644f84728"),
    unsplash("photo-1501386761578-eac5c94b800a"),
  ],
  sports: [
    unsplash("photo-1461896836934-ffe607ba8211"),
    unsplash("photo-1546519638-68e109498ffc"),
    unsplash("photo-1517649763962-0c623066013b"),
  ],
  crypto: [
    unsplash("photo-1621416894569-0f39ed31d247"),
    unsplash("photo-1518546305927-5a555bb7020d"),
    unsplash("photo-1640161704729-cbe966a08476"),
  ],
  weather: [
    unsplash("photo-1504608524841-42fe6f032b4b"),
    unsplash("photo-1534088568595-a066f410bcda"),
    unsplash("photo-1469474968028-56623f02e42e"),
  ],
  trending: [
    unsplash("photo-1611974789855-9c2a0a7236a3"),
    unsplash("photo-1526470608268-f674ce90ebd4"),
    unsplash("photo-1451187580459-43490279c0fa"),
    unsplash("photo-1461896836934-ffe607ba8211"),
  ],
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickSeeded<T>(items: T[], seed: string): T | null {
  if (!items.length) return null;
  return items[hashString(seed) % items.length];
}

function cleanQuery(text: string) {
  return text
    .replace(/\b(will|who|what|when|how|which|does|is|can|did|the|be|in|on|by|of|a|an|to|for|as|at|from|before|after|above|below|more|than|over|under|between|within|without|per|years|quarter|month|season|market|kalshi|contract|event)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 &.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KEYWORD_IMAGE_QUERIES: Array<{ test: RegExp; query: string }> = [
  { test: /\b(bitcoin|btc|ethereum|crypto|solana|doge|coinbase|binance)\b/i, query: "cryptocurrency" },
  { test: /\b(fed|federal reserve|interest rate|rates|inflation|cpi|recession|unemployment|gdp|treasury)\b/i, query: "Federal Reserve" },
  { test: /\b(nba|basketball|lakers|warriors|celtics|knicks|mavericks|thunder)\b/i, query: "basketball arena" },
  { test: /\b(nfl|super bowl|football|chiefs|eagles|cowboys|packers)\b/i, query: "American football stadium" },
  { test: /\b(mlb|baseball|world series|yankees|dodgers|mets)\b/i, query: "baseball stadium" },
  { test: /\b(nhl|hockey|stanley cup)\b/i, query: "ice hockey arena" },
  { test: /\b(election|president|senate|congress|governor|nominee|primary|democrat|republican)\b/i, query: "United States election" },
  { test: /\b(weather|hurricane|storm|rain|snow|temperature|heat|tornado|climate)\b/i, query: "weather satellite" },
  { test: /\b(ai|artificial intelligence|openai|nvidia|apple|tesla|spacex|microsoft|google|amazon|meta)\b/i, query: "technology" },
  { test: /\b(oil|gas|energy|opec|crude|electricity|power)\b/i, query: "oil refinery" },
  { test: /\b(movie|oscars|grammy|music|album|box office|celebrity|taylor swift|concert)\b/i, query: "entertainment" },
  { test: /\b(china|iran|russia|ukraine|israel|gaza|taiwan|nato|war|peace|tariff)\b/i, query: "international relations" },
];

function marketImageQueries(title: string, category: string, outcomes: { label: string }[]) {
  const queries: string[] = [];
  const add = (value: string | null | undefined) => {
    const q = cleanQuery(value || "");
    if (q.length >= 3 && !queries.some((existing) => existing.toLowerCase() === q.toLowerCase())) {
      queries.push(q);
    }
  };

  for (const rule of KEYWORD_IMAGE_QUERIES) {
    if (rule.test.test(title)) add(rule.query);
  }

  const firstSpecificOutcome = outcomes.find((o) => !/^(yes|no|other|leading)$/i.test(o.label));
  add(firstSpecificOutcome?.label);
  add(wikiQuery(title));
  add(title);
  add(category);

  return queries.slice(0, 3);
}

const wikiImageCache = new Map<string, Promise<string[]>>();
const commonsImageCache = new Map<string, Promise<string[]>>();

async function getWikiImages(query: string): Promise<string[]> {
  if (!query || query.trim().length < 3) return [];
  const key = query.toLowerCase();
  if (wikiImageCache.has(key)) return wikiImageCache.get(key)!;

  const request = (async () => {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "5");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("pithumbsize", "500");
    url.searchParams.set("format", "json");
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "HemloAI/1.0 (https://hemloai.com)" },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(2200),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages) return [];
      return Object.values(pages)
        .map((page: any) => page?.thumbnail?.source)
        .filter(Boolean);
    } catch {
      return [];
    }
  })();

  wikiImageCache.set(key, request);
  return request;
}

async function getCommonsImages(query: string): Promise<string[]> {
  if (!query || query.trim().length < 3) return [];
  const key = query.toLowerCase();
  if (commonsImageCache.has(key)) return commonsImageCache.get(key)!;

  const request = (async () => {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "6");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime");
    url.searchParams.set("iiurlwidth", "500");
    url.searchParams.set("format", "json");
    try {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": "HemloAI/1.0 (https://hemloai.com)" },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) return [];
      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages) return [];
      return Object.values(pages)
        .map((page: any) => {
          const info = page?.imageinfo?.[0];
          const mime = String(info?.mime || "");
          if (!mime.startsWith("image/")) return "";
          return info?.thumburl || info?.url || "";
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  })();

  commonsImageCache.set(key, request);
  return request;
}

function fallbackImage(catKey: string, seed: string) {
  const pool = CURATED_IMAGE_POOLS[catKey] || CURATED_IMAGE_POOLS.trending;
  return pickSeeded(pool, seed) || CURATED_IMAGE_POOLS.trending[0];
}

async function resolveMarketImage(card: MarketCard) {
  for (const query of card.imageQueries || []) {
    const wikiImages = await getWikiImages(query);
    const selected = pickSeeded(wikiImages, `${card.id}:${query}:wiki`);
    if (selected) return selected;
  }

  for (const query of (card.imageQueries || []).slice(0, 2)) {
    const commonsImages = await getCommonsImages(query);
    const selected = pickSeeded(commonsImages, `${card.id}:${query}:commons`);
    if (selected) return selected;
  }

  return fallbackImage(card.catKey, `${card.id}:${card.title}`);
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
  endDate?: string;
  imageQueries?: string[];
};

function buildCard(event: any, markets: any[]): MarketCard {
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

  const imageQueries = marketImageQueries(event.title, category, outcomes);

  return {
    id: event.event_ticker, catKey, category,
    title: event.title,
    yesPrice: outcomes[0]?.prob ?? 50,
    noPrice:  outcomes[1]?.prob ?? 50,
    outcomes,
    volume: formatVol(totalVol), volumeRaw: totalVol, volume24h: vol24h, openInterest: openInt,
    link: `https://kalshi.com/events/${event.event_ticker}`,
    image: fallbackImage(catKey, `${event.event_ticker}:${event.title}`),
    marketType: isBinary ? "binary" : "categorical",
    endDate: event.close_time ?? event.expiration_time ?? "",
    imageQueries,
  };
}

function cardMatchesSearch(card: MarketCard, searchQ: string) {
  if (!searchQ) return true;
  const outcomeText = card.outcomes.map((outcome) => outcome.label).join(" ");
  const haystack = `${card.title} ${card.category} ${card.catKey} ${outcomeText}`.toLowerCase();
  const terms = searchQ.split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

// We now use `with_nested_markets=true` to get markets inside the events payload.
// This completely removes the need for `fetchEventMarkets` N+1 calls.

// ── MAIN ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const category = searchParams.get("category") ?? "trending"; // catKey from frontend
    const cursor   = searchParams.get("cursor") ?? "";           // Kalshi pagination cursor
    const searchQ  = (searchParams.get("q") ?? "").toLowerCase().trim();
    const requestedLimit = Number(searchParams.get("limit") || PAGE_SIZE);
    const pageSize = Number.isFinite(requestedLimit) ? Math.max(3, Math.min(24, requestedLimit)) : PAGE_SIZE;

    // When a search query is present, fetch ALL events (trending mode = max coverage)
    const isTrending = category === "trending" || searchQ.length > 0;
    let trendingOffset = isTrending ? parseInt(cursor || "0", 10) : 0;

    // ── Page through Kalshi events ──
    let collected: MarketCard[] = [];
    let nextCursor = isTrending ? "" : cursor; // Trending starts from scratch, slice later
    let hasMore = false;
    
    // For trending, we pull 3 pages (600 events) for a deep volume pool. For search, we pull up to 15 to find obscure terms.
    const MAX_DISCOVERY_PAGES = searchQ ? 15 : (isTrending ? 3 : 5);

    for (let page = 0; page < MAX_DISCOVERY_PAGES; page++) {
      const url = new URL(`${KALSHI_BASE}/events`);
      url.searchParams.set("limit", "200");
      url.searchParams.set("status", "open");
      url.searchParams.set("with_nested_markets", "true"); // CRITICAL: Fetch markets inline!
      if (nextCursor) url.searchParams.set("cursor", nextCursor);

      const evRes = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store", // Prevent Next.js from caching >2MB Kalshi payloads
        signal: AbortSignal.timeout(10000),
      });
      if (!evRes.ok) break;

      const body = await evRes.json();
      const events: any[] = body.events ?? [];
      nextCursor = body.cursor ?? "";

      const matching = isTrending
        ? events
        : events.filter((ev) => (CAT_TO_KEY[ev.category ?? "World"] ?? "trending") === category);

      // Build cheap cards first; expensive image lookup happens only after pagination.
      const results = matching.map((ev) => {
        const mkts = ev.markets ?? []; // provided by with_nested_markets
        if (mkts.length === 0) return null;
        return buildCard(ev, mkts);
      });

      for (const card of results) {
        if (card) collected.push(card);
      }

      // If we are NOT trending, and we have enough items, we can stop early
      if (!isTrending && !searchQ && collected.length >= pageSize + 1) break;
      
      // If we are searching, we can stop early once we find enough matches
      if (searchQ) {
        const matches = collected.filter(c => cardMatchesSearch(c, searchQ));
        if (matches.length >= pageSize) break;
      }

      // If Kalshi has no more events, stop
      if (!nextCursor) break;
    }

    // Sort & Paginate
    // Apply search filter after collection
    if (searchQ) {
      collected = collected.filter(c => cardMatchesSearch(c, searchQ));
    }
    let returnCursor = nextCursor; // Native Kalshi cursor for standard categories

    if (isTrending) {
      // Sort the massive pool of events globally by volume
      collected.sort((a, b) => b.volumeRaw - a.volumeRaw);
      
      // Keep only the slice requested by the frontend
      const slice = collected.slice(trendingOffset, trendingOffset + pageSize + 1);
      hasMore = slice.length > pageSize;
      
      if (hasMore) {
        returnCursor = (trendingOffset + pageSize).toString();
      } else {
        returnCursor = "";
      }
      
      collected = slice.slice(0, pageSize);
    } else {
      // Standard category: we stop early, so just slice what we have
      hasMore = collected.length > pageSize;
      if (!hasMore) returnCursor = ""; // End reached
      collected = collected.slice(0, pageSize);
    }

    const markets = await Promise.all(
      collected.map(async (card) => {
        const image = await resolveMarketImage(card);
        const { imageQueries, ...publicCard } = { ...card, image };
        return publicCard;
      })
    );

    // Log for debugging
    console.log(`[kalshi-markets] category=${category} returned=${markets.length} hasMore=${hasMore}`);

    return NextResponse.json({
      markets,
      cursor: hasMore ? returnCursor : "",
      hasMore,
      count: markets.length,
      source: "live",
    }, { headers: CACHE_HEADERS });
  } catch (err: any) {
    console.error("[kalshi-markets] error:", err.message);
    return NextResponse.json({ markets: [], cursor: "", hasMore: false, error: err.message }, { headers: CACHE_HEADERS });
  }
}
