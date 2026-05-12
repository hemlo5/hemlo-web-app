import Link from "next/link";
import { AppFooter } from "./app-footer";

export function MarketingShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: "100vh", background: "#15191d", color: "#ffffff" }}>
      <header style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/simulate/mirofish" style={{ color: "#ffffff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 900 }}>
          <img src="/hemlo-icon.svg" alt="" style={{ width: 30, height: 30 }} />
          Hemlo
        </Link>
        <Link href="/simulate/mirofish" style={{ color: "#111", background: "#fff", textDecoration: "none", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 900 }}>
          Open App
        </Link>
      </header>
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "88px 20px 48px" }}>
        <div style={{ color: "#7db7ff", fontSize: 12, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 16 }}>
          {eyebrow}
        </div>
        <h1 style={{ fontSize: "clamp(38px, 7vw, 78px)", lineHeight: 0.95, maxWidth: 820, margin: 0, fontWeight: 950 }}>
          {title}
        </h1>
        <p style={{ color: "#aab6c3", fontSize: "clamp(16px, 2vw, 21px)", lineHeight: 1.55, maxWidth: 760, marginTop: 24 }}>
          {description}
        </p>
        <div style={{ marginTop: 52 }}>{children}</div>
      </section>
      <AppFooter />
    </main>
  );
}

export function InfoGrid({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
      {items.map((item) => (
        <article key={item.title} style={{ background: "#1b2228", border: "1px solid #27333d", borderRadius: 12, padding: 22 }}>
          <h2 style={{ fontSize: 20, margin: "0 0 10px", color: "#ffffff" }}>{item.title}</h2>
          <p style={{ margin: 0, color: "#93a1af", lineHeight: 1.6, fontSize: 14 }}>{item.body}</p>
        </article>
      ))}
    </div>
  );
}
