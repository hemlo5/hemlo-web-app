"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { PolyDetailModal, type PolyMarket } from "./poly-detail-modal";

// ── CATEGORIES ────────────────────────────────────────────────────────────────
const POLY_CATS = [
  { key: "trending",          label: "Trending" },
  { key: "politics",          label: "Elections" },
  { key: "politics-general",  label: "Politics" },
  { key: "sports",            label: "Sports" },
  { key: "entertainment",     label: "Culture" },
  { key: "crypto",            label: "Crypto" },
  { key: "finance",           label: "Commodities" },
  { key: "world",             label: "Climate" },
  { key: "economics",         label: "Economics" },
  { key: "mentions",          label: "Mentions" },
  { key: "companies",         label: "Companies" },
  { key: "financials",        label: "Financials" },
  { key: "tech",              label: "Tech & Science" },
];

// ── TOP-LEVEL TABS ────────────────────────────────────────────────────────────
const TOP_TABS = [
  { key: "polymarket", label: "Polymarket" },
  { key: "kalshi",     label: "Kalshi TradFi" },
];

// ── KALSHI TYPE ───────────────────────────────────────────────────────────────
type KalshiMarket = {
  id: string;
  catKey: string;
  title: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  volumeRaw: number;
  volume24h: number;
  openInterest: number;
  image: string;      // Wikipedia or category-fallback image
  category: string;
  link: string;
  // Multi-outcome support (e.g. "Who will be next Pope?")
  marketType?: "binary" | "categorical";
  outcomes?: { label: string; prob: number; volumeRaw: number }[];
};

// (No static KALSHI_IMG map needed — each market carries its own image from the API)

// ── CONVERT KALSHI → POLYMARKET SHAPE FOR MODAL ───────────────────────────────
function kalshiToPolyMarket(k: KalshiMarket): PolyMarket {
  // Use rich outcomes if available (multi-outcome markets), otherwise binary yes/no
  const outcomes =
    k.outcomes && k.outcomes.length > 0
      ? k.outcomes.map((o) => ({ label: o.label, prob: o.prob, volumeRaw: o.volumeRaw }))
      : [
          { label: "Yes", prob: k.yesPrice, volumeRaw: k.volumeRaw || 0 },
          { label: "No",  prob: k.noPrice, volumeRaw: 0  },
        ];

  // We assign a special fake tokenId per-outcome so the history simulator charts multiple lines!
  const clobTokenIds = outcomes.map((o, i) => `kalshi-${k.id}-${i}-${o.prob}`);

  return {
    id: k.id,
    slug: k.id,
    question: k.title,
    marketType: k.marketType === "categorical" ? "categorical" : "binary",
    outcomes,
    volume:    k.volume,
    volumeRaw: k.volumeRaw || 0,
    volume24h: k.volume24h || 0,
    endDate:   "",
    image:     k.image,
    icon:      k.image,
    category:  k.category,
    active:    true,
    closed:    false,
    tags:      [k.catKey],
    clobTokenIds: clobTokenIds,
    description:      `CFTC-regulated prediction market on Kalshi.`,
    resolutionSource: k.link,
    lastTradePrice:   k.yesPrice / 100,
    liquidityClob:    k.openInterest || 0,
  };
}

// Outcome row colors — first 2 are green/red for binary, rest for multi-choice
const OUTCOME_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899"];

// ── KALSHI CARD ───────────────────────────────────────────────────────────────
function KalshiCard({ m, onClick }: { m: KalshiMarket; onClick: () => void }) {
  // Prefer the rich outcomes array from the API; fall back to binary yes/no
  const displayOutcomes: { label: string; prob: number }[] =
    m.outcomes && m.outcomes.length > 0
      ? m.outcomes.slice(0, 2)
      : [
          { label: "Yes", prob: m.yesPrice },
          { label: "No",  prob: m.noPrice  },
        ];

  const isCategorical = m.marketType === "categorical" || displayOutcomes.length > 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ borderColor: "#2d3748", backgroundColor: "#11141b" }}
      onClick={onClick}
      style={{
        background: "#0c0f16",
        border: "1px solid #1f2330",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "all 0.2s",
        minHeight: 220,
      }}
    >
      {/* Header: Wikipedia image + category badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <img
          src={m.image}
          alt={m.title}
          style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: "#22c55e",
            background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 6, padding: "2px 8px", textTransform: "uppercase", width: "fit-content",
          }}>Kalshi</span>
          <span style={{ fontSize: 10, color: "#8a94a6", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
            {m.category}
          </span>
        </div>
        {isCategorical && (
          <span style={{
            marginLeft: "auto", fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
            color: "#3b82f6", background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.25)", borderRadius: 5, padding: "2px 6px",
            textTransform: "uppercase",
          }}>Multi</span>
        )}
      </div>

      {/* Event title */}
      <div style={{
        fontSize: 14, fontWeight: 700, color: "#ffffff", lineHeight: 1.45, flex: 1,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        marginBottom: 16,
      }}>
        {m.title}
      </div>

      {/* Outcome bars (works for both binary and multi-outcome) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {displayOutcomes.map(({ label, prob }, i) => {
          const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
          return (
            <div key={`${label}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{
                    color: "#d1d5db", fontSize: 11, fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140,
                  }}>{label}</span>
                </div>
                <div style={{ height: 3, background: "#1f2330", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(prob, 1)}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ border: `1px solid ${color}`, borderRadius: 20, padding: "3px 10px", minWidth: 46, textAlign: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{prob}¢</span>
              </div>
            </div>
          );
        })}
        {m.outcomes && m.outcomes.length > 2 && (
          <span style={{ fontSize: 10, color: "#8a94a6", fontStyle: "italic", paddingLeft: 2 }}>
            +{m.outcomes.length - 2} more markets
          </span>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#8a94a6" }}>{m.volume} vol</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>Analyse →</span>
      </div>
    </motion.div>
  );
}

// ── POLYMARKET MINI CARD ──────────────────────────────────────────────────────
function PolyCard({ m, onClick }: { m: PolyMarket; onClick: () => void }) {
  const topTwo = m.outcomes.slice(0, 2);
  const colors = ["#00c46a", "#3b82f6", "#f59e0b", "#a855f7"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ borderColor: "#333", backgroundColor: "#11141b" }}
      style={{
        background: "#0c0f16",
        border: "1px solid #1f2330",
        borderRadius: 14,
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "all 0.2s",
        minHeight: 220,
      }}
      onClick={onClick}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        {m.icon ? (
          <img src={m.icon} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 10, background: "#1f2330", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📊</div>
        )}
        <span style={{ fontSize: 10, fontWeight: 800, color: "#8a94a6", textTransform: "uppercase", letterSpacing: 1.4 }}>
          {m.category || (m.tags && m.tags[0]) || ""}
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", lineHeight: 1.4, flex: 1,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        marginBottom: 14 }}>
        {m.question}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {topTwo.map((o, i) => {
          const color = colors[i % colors.length];
          return (
            <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#d1d5db", fontSize: 11, fontWeight: 600 }}>{o.label}</span>
                </div>
                <div style={{ height: 3, background: "#1f2330", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${o.prob}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ border: `1px solid ${color}`, borderRadius: 20, padding: "3px 10px", minWidth: 50, textAlign: "center" }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{Math.round(o.prob)}%</span>
              </div>
            </div>
          );
        })}
        {m.outcomes.length > 2 && (
          <span style={{ fontSize: 10, color: "#8a94a6", fontStyle: "italic" }}>+{m.outcomes.length - 2} more outcomes</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#8a94a6" }}>{m.volume} vol</span>
        {!m.active && <span style={{ fontSize: 9, color: "#666", fontWeight: 700, textTransform: "uppercase" }}>Closed</span>}
      </div>
    </motion.div>
  );
}

// ── CAT TAB BAR ───────────────────────────────────────────────────────────────
function CatTabs({
  active, onSelect, accentColor = "#ffffff", layoutId,
}: {
  active: string;
  onSelect: (key: string) => void;
  accentColor?: string;
  layoutId: string;
}) {
  return (
    <div style={{ display: "flex", gap: 24, overflowX: "auto", paddingBottom: 8,
      scrollbarWidth: "none", borderBottom: "1px solid #1a1f2e", marginBottom: 20 }}>
      {POLY_CATS.map((c) => (
        <button
          key={c.key}
          onClick={() => onSelect(c.key)}
          style={{
            padding: "4px 0", background: "transparent", border: "none",
            color: active === c.key ? accentColor : "#8a94a6",
            fontWeight: active === c.key ? 700 : 500,
            fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", position: "relative",
          }}
        >
          {c.label}
          {active === c.key && (
            <motion.div
              layoutId={layoutId}
              style={{ position: "absolute", bottom: -9, left: 0, right: 0, height: 2, background: accentColor }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function ExploreMarkets() {
  const [topTab, setTopTab]     = useState<"polymarket" | "kalshi">("polymarket");
  const [activeCat, setActiveCat] = useState("trending");

  // Polymarket
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchInput, setSearchInput]   = useState("");
  const [markets, setMarkets]           = useState<PolyMarket[]>([]);
  const [loading, setLoading]           = useState(true);
  const [polyLimit, setPolyLimit]       = useState(24);

  // Kalshi
  const [kalshiActiveCat, setKalshiActiveCat] = useState("trending"); // INDEPENDENT of Polymarket's activeCat
  const [kalshiAll, setKalshiAll]             = useState<KalshiMarket[]>([]);
  const [kalshiLoading, setKalshiLoading]     = useState(false);
  const [kalshiFetched, setKalshiFetched]     = useState(false);
  const [kalshiLimit, setKalshiLimit]         = useState(24);

  // Selected market for modal (shared)
  const [selected, setSelected] = useState<PolyMarket | null>(null);

  // Fetch Polymarket whenever category / search / limit changes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ category: activeCat, limit: String(polyLimit) });
    if (searchQuery) params.set("q", searchQuery);
    fetch(`/api/polymarket-browse?${params}`)
      .then(r => r.json())
      .then(d => setMarkets(d.markets || []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, [activeCat, searchQuery, polyLimit]);

  // Reset limits on cat/search change
  useEffect(() => { setPolyLimit(24); }, [activeCat]);
  useEffect(() => { setPolyLimit(24); }, [searchQuery]);
  useEffect(() => { setKalshiLimit(24); }, [kalshiActiveCat]);

  // Fetch ALL Kalshi markets ONCE on component mount — stored in kalshiAll for client-side filtering
  // We fetch eagerly (not waiting for tab click) so it's ready when user switches to Kalshi
  useEffect(() => {
    if (kalshiFetched) return;
    setKalshiLoading(true);
    fetch("/api/kalshi-markets")
      .then(r => r.json())
      .then(d => {
        const loaded = d.markets || [];
        setKalshiAll(loaded);
        setKalshiFetched(true);
        // Debug: log catKey distribution so we can verify filtering works
        const dist: Record<string, number> = {};
        loaded.forEach((m: any) => { dist[m.catKey] = (dist[m.catKey] ?? 0) + 1; });
        console.log("[Kalshi] catKey dist:", dist);
      })
      .catch(() => { setKalshiAll([]); setKalshiFetched(true); })
      .finally(() => setKalshiLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  // Client-side filter Kalshi markets by their own catKey state (independent from Polymarket)
  const kalshiFiltered = Array.from(kalshiActiveCat === "trending" 
    ? kalshiAll 
    : kalshiAll.filter(m => m.catKey === kalshiActiveCat))
    .filter(m => !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.volumeRaw - a.volumeRaw);

  const kalshiVisible = kalshiFiltered.slice(0, kalshiLimit);
  const kalshiHasMore = kalshiFiltered.length > kalshiLimit;

  return (
    <>
      <style>{`
        .markets-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 1200px) { .markets-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 900px)  { .markets-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .markets-grid { grid-template-columns: 1fr; gap: 12px; } }
        .cat-tabs-scroll { scrollbar-width: none; }
        .cat-tabs-scroll::-webkit-scrollbar { display: none; }
        .source-tabs-container { display: flex; gap: 4; margin-bottom: 0; }
        @media (max-width: 640px) {
          .source-tabs-container { display: flex; width: 100%; }
          .source-tabs-container button { flex: 1; justify-content: center; }
          .explore-header-text { display: none !important; }
          .explore-header-controls { margin-top: 10px; width: 100% !important; max-width: none !important; }
        }
      `}</style>

      <div style={{ padding: "clamp(12px, 4vw, 32px) 24px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div className="explore-header-text">
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800,
              color: "var(--text-primary)", marginBottom: 4 }}>
              Explore All Markets
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {topTab === "polymarket"
                ? "Live Polymarket predictions — click SIMULATE to model with MiroFish"
                : "Kalshi CFTC-regulated prediction markets — click any card to deep-dive"}
            </div>
          </div>

          <form className="explore-header-controls" onSubmit={handleSearch} style={{ display: "flex", flex: "1 1 auto", justifyContent: "flex-end", maxWidth: 300 }}>
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", zIndex: 2 }} />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder={topTab === "polymarket" ? "Search Polymarket..." : "Search Kalshi..."}
                style={{ padding: "9px 74px 9px 34px", fontSize: 13, border: "1px solid var(--border)",
                  borderRadius: 10, background: "var(--bg-secondary)", color: "var(--text-primary)",
                  outline: "none", width: "100%", height: 36 }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={e  => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button type="submit" style={{ position: "absolute", right: 3, top: 3, bottom: 3,
                padding: "0 14px", background: "var(--accent)", border: "none", borderRadius: 7,
                color: "#000", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>Go</button>
            </div>
          </form>
        </div>

        {/* Source tabs */}
        <div className="source-tabs-container">
          {TOP_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTopTab(t.key as any)}
              style={{
                padding: "8px 20px", borderRadius: "10px 10px 0 0",
                border: "1px solid #1a1f2e",
                borderBottom: topTab === t.key ? "1px solid #0c0f16" : "1px solid #1a1f2e",
                background: topTab === t.key ? "#0c0f16" : "transparent",
                color: topTab === t.key ? "#ffffff" : "#8a94a6",
                fontWeight: topTab === t.key ? 700 : 500,
                fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                position: "relative", zIndex: topTab === t.key ? 2 : 1,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              {t.key === "kalshi" && (
                <span className="hide-mobile" style={{
                  marginRight: 6, fontSize: 9, fontWeight: 800, letterSpacing: 1,
                  color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 4, padding: "1px 5px", textTransform: "uppercase", verticalAlign: "middle",
                }}>TradFi</span>
              )}
              {t.key === "kalshi" ? (
                <>
                  Kalshi <span className="hide-mobile" style={{ marginLeft: 4 }}>TradFi</span>
                </>
              ) : t.label}
            </button>
          ))}
        </div>

        {/* ── POLYMARKET PANEL ─────────────────────────────────────────────── */}
        {topTab === "polymarket" && (
          <div style={{ background: "#0c0f16", border: "1px solid #1a1f2e", borderRadius: "0 12px 12px 12px", padding: "20px 20px 24px" }}>
            <CatTabs
              active={activeCat}
              onSelect={k => { setActiveCat(k); setSearchQuery(""); setSearchInput(""); }}
              accentColor="#ffffff"
              layoutId="poly-active-tab"
            />

            {searchQuery && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                  Results for &quot;{searchQuery}&quot;
                </span>
                <button
                  onClick={() => { setSearchQuery(""); setSearchInput(""); }}
                  style={{ fontSize: 10, color: "#ef4444", cursor: "pointer", background: "#ef444418",
                    border: "1px solid #ef444430", borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>
                  Clear
                </button>
              </div>
            )}

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader2 size={18} color="var(--accent)" />
                </motion.div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Loading markets…</span>
              </div>
            ) : markets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>No markets found.</div>
            ) : (
              <div className="markets-grid">
                {markets.map((m, i) => (
                  <PolyCard key={m.id ?? i} m={m} onClick={() => setSelected(m)} />
                ))}
              </div>
            )}

            {!loading && markets.length >= polyLimit && (
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <motion.button
                  whileHover={{ scale: 1.02, borderColor: "var(--accent)" }} whileTap={{ scale: 0.98 }}
                  onClick={() => setPolyLimit(p => p + 24)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 28px",
                    borderRadius: 12, border: "1px solid var(--border)", background: "#0c0f16",
                    color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Load More <ExternalLink size={14} />
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* ── KALSHI PANEL ─────────────────────────────────────────────────── */}
        {topTab === "kalshi" && (
          <div style={{ background: "#0c0f16", border: "1px solid #1a1f2e", borderRadius: "0 12px 12px 12px", padding: "20px 20px 24px" }}>
            <CatTabs
              active={kalshiActiveCat}
              onSelect={k => { setKalshiActiveCat(k); setKalshiLimit(24); }}
              accentColor="#22c55e"
              layoutId="kalshi-active-tab"
            />

            <div className="hide-mobile" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>
                ◉ Kalshi — CFTC-regulated exchange · Click any card to analyse
              </div>
              <a href="https://kalshi.com" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#8a94a6", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                kalshi.com <ExternalLink size={11} />
              </a>
            </div>

            {kalshiLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Loader2 size={18} color="#22c55e" />
                </motion.div>
                <span style={{ fontSize: 13, color: "#8a94a6", fontWeight: 600 }}>Loading Kalshi markets…</span>
              </div>
            ) : kalshiVisible.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#8a94a6", fontSize: 13 }}>
                <div style={{ marginBottom: 10 }}>
                  {kalshiAll.length === 0
                    ? "Could not load Kalshi markets. Try refreshing."
                    : `No markets in this category (${kalshiAll.length} total loaded — try Trending or another tab)`}
                </div>
                {kalshiAll.length > 0 && (
                  <button
                    onClick={() => setKalshiActiveCat("trending")}
                    style={{ fontSize: 12, color: "#22c55e", background: "transparent", border: "1px solid #22c55e",
                      borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontWeight: 700 }}>
                    Show all {kalshiAll.length} markets →
                  </button>
                )}
              </div>
            ) : (
              <div className="markets-grid">
                {kalshiVisible.map(m => (
                  <KalshiCard key={m.id} m={m} onClick={() => setSelected(kalshiToPolyMarket(m))} />
                ))}
              </div>
            )}

            {kalshiHasMore && !kalshiLoading && (
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <motion.button
                  whileHover={{ scale: 1.02, borderColor: "#22c55e" }} whileTap={{ scale: 0.98 }}
                  onClick={() => setKalshiLimit(p => p + 24)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 28px",
                    borderRadius: 12, border: "1px solid #1f2330", background: "#0c0f16",
                    color: "#22c55e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Load More <ExternalLink size={14} />
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* Shared Detail Modal */}
        <AnimatePresence>
          {selected && (
            <PolyDetailModal
              market={selected}
              onClose={() => setSelected(null)}
              onSimulate={() => {
                window.location.href = `/simulate/mirofish?scenario=${encodeURIComponent(selected.question)}&seedMode=auto`;
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
