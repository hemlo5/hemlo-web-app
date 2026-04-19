import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Hemlo",
  description: "How Hemlo AI collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Back link */}
        <Link href="/" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 48 }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 16 }}>
          Privacy Policy
        </h1>
        <p style={{ color: "#8a94a6", fontSize: 15, marginBottom: 60 }}>Last updated: April 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {[
            {
              title: "1. Information We Collect",
              body: "We collect information you provide directly to us when you create an account, use our services, or communicate with us. This may include your name, email address, and usage data such as simulation inputs and outputs.",
            },
            {
              title: "2. How We Use Your Information",
              body: "We use the information we collect to provide, maintain, and improve our services, to communicate with you about your account and new features, and to personalize your experience on the Hemlo platform.",
            },
            {
              title: "3. Information Sharing",
              body: "We do not sell, trade, or rent your personal information to third parties. We may share information with service providers who assist in delivering our platform (e.g., authentication, payments, hosting) under strict confidentiality agreements.",
            },
            {
              title: "4. Data Security",
              body: "We take reasonable technical and organizational measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction. All data is encrypted in transit and at rest.",
            },
            {
              title: "5. Cookies & Tracking",
              body: "We use cookies and similar tracking technologies to improve your experience on our platform, analyze site traffic, and understand how our services are used. You can control cookie settings through your browser preferences.",
            },
            {
              title: "6. Your Rights",
              body: "You have the right to access, correct, or delete your personal data held by us. To exercise these rights, please contact us at privacy@hemloai.com. We will respond to valid requests within 30 days.",
            },
            {
              title: "7. Changes to This Policy",
              body: "We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the 'Last updated' date above.",
            },
            {
              title: "8. Contact Us",
              body: "If you have any questions about this Privacy Policy, please contact us at privacy@hemloai.com or write to us at Hemlo AI, Inc.",
            },
          ].map((section) => (
            <div key={section.title}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
                {section.title}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1.75 }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div style={{ marginTop: 80, paddingTop: 32, borderTop: "1px solid #1a1f2e", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/terms" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>Terms of Service</Link>
          <Link href="/" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>← Home</Link>
        </div>
      </div>
    </div>
  );
}
