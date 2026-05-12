import Link from "next/link";

const footerGroups = [
  {
    title: "Product",
    links: [
      { href: "/simulate/mirofish", label: "Simulate" },
      { href: "/polymarket", label: "Polymarket" },
      { href: "/kalshi", label: "Kalshi" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/features", label: "Features" },
      { href: "/vision", label: "Vision" },
      { href: "/founders", label: "Founders" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy-policy", label: "Privacy" },
    ],
  },
];

export function AppFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "#11161a",
        padding: "34px clamp(18px, 5vw, 72px)",
        color: "#ffffff",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1.4fr) repeat(3, minmax(120px, 1fr))",
          gap: 28,
        }}
        className="app-footer-grid"
      >
        <div>
          <Link href="/simulate/mirofish" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#ffffff" }}>
            <img src="/hemlo-icon.svg" alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
            <span style={{ fontSize: 20, fontWeight: 900 }}>Hemlo</span>
          </Link>
          <p style={{ margin: "12px 0 0", color: "#8a96a3", fontSize: 13, lineHeight: 1.55, maxWidth: 380 }}>
            AI simulation intelligence for prediction markets, world events, and high-uncertainty decisions.
          </p>
        </div>

        {footerGroups.map((group) => (
          <div key={group.title}>
            <div style={{ color: "#607080", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
              {group.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} style={{ color: "#d8e0ea", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ maxWidth: 1280, margin: "26px auto 0", color: "#5f6f80", fontSize: 12 }}>
        © 2026 Hemlo AI. Probabilities are informational and are not financial advice.
      </div>
    </footer>
  );
}
