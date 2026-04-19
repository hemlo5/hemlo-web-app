import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Hemlo",
  description: "The terms and conditions governing your use of the Hemlo AI platform.",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#000000", color: "#ffffff", paddingTop: 80, paddingBottom: 80, paddingLeft: 24, paddingRight: 24 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Back link */}
        <Link href="/" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 48 }}>
          ← Back to Home
        </Link>

        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(36px, 6vw, 60px)", fontWeight: 800, letterSpacing: "-2px", marginBottom: 16 }}>
          Terms of Service
        </h1>
        <p style={{ color: "#8a94a6", fontSize: 15, marginBottom: 60 }}>Last updated: April 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          {[
            {
              title: "1. Acceptance of Terms",
              body: "By accessing or using the Hemlo platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you disagree with any part of these terms, you may not access the service.",
            },
            {
              title: "2. Use License",
              body: "Subject to your compliance with these Terms, Hemlo grants you a limited, non-exclusive, non-transferable license to access and use the platform for your personal or internal business purposes. You may not sublicense, sell, resell, or commercially exploit the service.",
            },
            {
              title: "3. User Accounts",
              body: "You are responsible for safeguarding your account credentials and for all activities that occur under your account. You agree to notify us immediately at support@hemloai.com of any unauthorized use of your account.",
            },
            {
              title: "4. Acceptable Use",
              body: "You agree not to use Hemlo to engage in any unlawful activities, to upload malicious content, to interfere with platform operations, or to violate the rights of other users. We reserve the right to terminate accounts that violate these policies.",
            },
            {
              title: "5. Disclaimer of Warranties",
              body: "The Hemlo platform is provided on an 'as is' and 'as available' basis. Hemlo makes no representations or warranties of any kind, express or implied, regarding the accuracy, reliability, or fitness of the service for any particular purpose. Simulation outputs are probabilistic models and do not constitute financial, legal, or professional advice.",
            },
            {
              title: "6. Limitation of Liability",
              body: "To the maximum extent permitted by law, Hemlo and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or in connection with your use of the service.",
            },
            {
              title: "7. Governing Law",
              body: "These Terms of Service shall be governed by and construed in accordance with applicable law. Any disputes arising under these terms shall be subject to the exclusive jurisdiction of the relevant courts.",
            },
            {
              title: "8. Changes to Terms",
              body: "We reserve the right to modify these Terms at any time. We will provide notice of significant changes by updating the date at the top of this page. Your continued use of the service after any changes constitutes acceptance of the new Terms.",
            },
            {
              title: "9. Contact",
              body: "If you have any questions about these Terms, please contact us at support@hemloai.com.",
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
          <Link href="/privacy-policy" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>← Home</Link>
        </div>
      </div>
    </div>
  );
}
