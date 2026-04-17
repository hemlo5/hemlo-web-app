"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { PolyDetailModal, type PolyMarket } from "./poly-detail-modal";

const POLY_CATS = [
  { key: "trending", label: "Trending" },
  { key: "politics", label: "Elections" },
  { key: "politics-general", label: "Politics" },
  { key: "sports", label: "Sports" },
  { key: "entertainment", label: "Culture" },
  { key: "crypto", label: "Crypto" },
  { key: "finance", label: "Commodities" },
  { key: "world", label: "Climate" },
  { key: "economics", label: "Economics" },
  { key: "mentions", label: "Mentions" },
  { key: "companies", label: "Companies" },
  { key: "financials", label: "Financials" },
  { key: "tech", label: "Tech & Science" },
];

function MiniCard({ m, onClick }: { m: PolyMarket; onClick: () => void }) {
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        {m.icon ? (
          <img
            src={m.icon}
            alt=""
            style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 10, background: "#1f2330", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>📊</div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#8a94a6", textTransform: "uppercase", letterSpacing: 1.4 }}>
            {m.category || (m.tags && m.tags[0]) || ""}
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", lineHeight: 1.4, marginBottom: 20 }}>
        {m.question}
      </div>

      <div style={{ flex: 1 }} />

      {/* Outcomes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {topTwo.map((o, i) => {
          const color = colors[i % colors.length];
          const multiplier = Math.max(1.01, (100 / (o.prob || 1))).toFixed(2);
          
          return (
            <div key={o.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ color: "#d1d5db", fontSize: 13, fontWeight: 500 }}>{o.label}</span>
                <div style={{ height: 2, background: color, width: "100%", borderRadius: 2 }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "#8a94a6", fontSize: 12, fontWeight: 600 }}>{multiplier}x</span>
                <div style={{ border: `1px solid ${color}`, borderRadius: 20, padding: "3px 12px", minWidth: 54, textAlign: "center" }}>
                  <span style={{ color: "#ffffff", fontSize: 13, fontWeight: 700 }}>{Math.round(o.prob)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0px" }}>
        <span style={{ fontSize: 12, color: "#8a94a6", fontWeight: 500 }}>{m.volume} vol</span>
        <span style={{ fontSize: 12, color: "#8a94a6", fontWeight: 500 }}>9 markets</span>
      </div>
    </motion.div>
  );
}

export function ExploreMarkets() {
  const [activeCat, setActiveCat] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [markets, setMarkets] = useState<PolyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(24);
  const [selectedMarket, setSelectedMarket] = useState<PolyMarket | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ category: activeCat, limit: displayLimit.toString() });
    if (searchQuery) params.set("q", searchQuery);
    fetch(`/api/polymarket-browse?${params}`)
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets || []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, [activeCat, searchQuery, displayLimit]);

  // Reset limit when category changes
  useEffect(() => {
    setDisplayLimit(24);
  }, [activeCat, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
  };

  return (
    <div style={{ padding: "32px 24px 48px" }}>
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            Explore All Markets
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Live Polymarket predictions — click SIMULATE to model them with MiroFish
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: "flex", flex: "1 1 auto", justifyContent: "flex-end", maxWidth: 300 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <Search size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", zIndex: 2 }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search markets..."
              style={{ padding: "9px 80px 9px 36px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none", width: "100%", height: 40, transition: "border-color 0.2s" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            <button type="submit" style={{ position: "absolute", right: 4, top: 4, bottom: 4, padding: "0 14px", background: "var(--accent)", border: "none", borderRadius: 7, color: "#000", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>
              Go
            </button>
          </div>
        </form>
      </div>

      {/* Category Tabs */}
      <div style={{ 
        display: "flex", 
        gap: 24, 
        marginBottom: 24, 
        overflowX: "auto", 
        paddingBottom: 8, 
        scrollbarWidth: "none",
        borderBottom: "1px solid #1a1f2e"
      }}>
        {POLY_CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setActiveCat(c.key); setSearchQuery(""); setSearchInput(""); }}
            style={{
              padding: "4px 0",
              background: "transparent",
              border: "none",
              color: activeCat === c.key ? "#ffffff" : "#8a94a6",
              fontWeight: activeCat === c.key ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              position: "relative"
            }}
          >
            {c.label}
            {activeCat === c.key && (
              <motion.div 
                layoutId="activeTab"
                style={{ position: "absolute", bottom: -9, left: 0, right: 0, height: 2, background: "#ffffff" }} 
              />
            )}
          </button>
        ))}
      </div>

      {/* Clear search */}
      {searchQuery && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
            Results for &quot;{searchQuery}&quot;
          </span>
          <button
            onClick={() => { setSearchQuery(""); setSearchInput(""); }}
            style={{ fontSize: 10, color: "#ef4444", cursor: "pointer", background: "#ef444418", border: "1px solid #ef444430", borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 10 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Loader2 size={18} color="var(--accent)" />
          </motion.div>
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Loading markets...</span>
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 13 }}>
          No markets found. Try a different search or category.
        </div>
      ) : (
        <div style={{
          display: "grid", 
          gridTemplateColumns: "repeat(4, 1fr)", 
          gap: 16,
          width: "100%",
          padding: 0
        }}>
          {markets.map((m, i) => (
            <MiniCard
              key={m.id ?? i}
              m={m}
              onClick={() => setSelectedMarket(m)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedMarket && (
          <PolyDetailModal
            market={selectedMarket}
            onClose={() => setSelectedMarket(null)}
            onSimulate={() => {
              window.location.href = `/simulate/mirofish?domain=polymarket&scenario=${encodeURIComponent(selectedMarket.question)}&seedMode=auto`;
            }}
          />
        )}
      </AnimatePresence>

      {/* Load More Button */}
      {!loading && markets.length >= displayLimit && (
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => setDisplayLimit(prev => prev + 24)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "12px 32px", borderRadius: 12,
              border: "1px solid var(--border)", background: "#0c0f16", 
              color: "#ffffff",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              transition: "border-color 0.2s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            Load More Markets <ExternalLink size={16} />
          </motion.button>
        </div>
      )}
    </div>
  );
}
