import type { Metadata } from "next";
import Link from "next/link";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "Privacy Policy | Hemlo",
  description: "How Hemlo AI collects, uses, and protects your personal information.",
  alternates: { canonical: "/privacy-policy" },
};

const sections = [
  {
    title: "1. Information We Collect",
    body: "We collect information you provide directly to us when you create an account, use our services, or communicate with us. This may include your name, email address, and usage data.",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use the information we collect to provide, maintain, and improve our services, to communicate with you, and to personalize your experience.",
  },
  {
    title: "3. Information Sharing",
    body: "We do not share your personal information with third parties except as described in this privacy policy or with your consent.",
  },
  {
    title: "4. Data Security",
    body: "We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.",
  },
  {
    title: "5. Contact Us",
    body: "If you have any questions about this Privacy Policy, please contact us at privacy@hemlo.ai.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#15191d", color: "#ffffff" }}>
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "88px 20px 72px" }}>
        <Link href="/simulate/mirofish" style={{ color: "#8a94a6", textDecoration: "none", fontSize: 13, fontWeight: 800 }}>
          Back to Hemlo
        </Link>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 72px)", lineHeight: 0.95, margin: "42px 0 18px", fontWeight: 950 }}>
          Privacy Policy
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
