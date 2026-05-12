import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "Terms of Service | Hemlo",
  description: "The terms and conditions governing your use of the Hemlo AI platform.",
  alternates: { canonical: "/terms" },
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    body: "By accessing or using our services, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.",
  },
  {
    title: "2. Use License",
    body: "Permission is granted to temporarily download one copy of the materials on Hemlo's website for personal, non-commercial transitory viewing only.",
  },
  {
    title: "3. Disclaimer",
    body: "The materials on Hemlo's website are provided on an 'as is' basis. Hemlo makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including implied warranties of merchantability or fitness for a particular purpose.",
  },
  {
    title: "4. Limitations",
    body: "In no event shall Hemlo or its suppliers be liable for any damages (including loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Hemlo's website.",
  },
  {
    title: "5. Governing Law",
    body: "These terms and conditions are governed by and construed in accordance with applicable laws, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.",
  },
];

export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#15191d", color: "#ffffff" }}>
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "88px 20px 72px" }}>
        <Link href="/simulate/mirofish" style={{ color: "#8a94a6", textDecoration: "none", fontSize: 13, fontWeight: 800 }}>
          Back to Hemlo
        </Link>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 0.95, margin: "42px 0 18px", fontWeight: 950 }}>
          Terms of Service
        </h1>
        <p style={{ color: "#8a94a6", fontSize: 18, margin: "0 0 52px" }}>Last updated: April 2026</p>

        <div style={{ display: "grid", gap: 34 }}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>{section.title}</h2>
              <p style={{ margin: 0, color: "#aab6c3", lineHeight: 1.75 }}>{section.body}</p>
            </section>
          ))}
        </div>
      </section>
      <AppFooter />
    </main>
  );
}
