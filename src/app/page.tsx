import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { HeroSection, ModesSection, HowItWorksSection, PricingSection, Footer } from "@/components/landing"
import { Navbar } from "@/components/navbar"
import Link from "next/link"

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const sp = await searchParams

  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}&next=/home`)
  }

  if (sp.error) {
    redirect(`/home?auth_error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  // Check if user is authenticated — if so, skip the landing page and go straight to dashboard
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      redirect("/home")
    }
  } catch {
    // If Supabase is unavailable, fall through and show landing page
  }

  // Show the full landing page for unauthenticated visitors (and crawlers like Google OAuth bot)
  return (
    <main>
      <Navbar />
      <HeroSection />
      <ModesSection />
      <HowItWorksSection />
      <PricingSection />

      {/* Legal footer — required for Google OAuth verification */}
      <div style={{ textAlign: "center", padding: "24px 24px 0", display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
        <Link href="/privacy-policy" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>
          Terms of Service
        </Link>
        <a href="mailto:support@hemloai.com" style={{ fontSize: 13, color: "#8a94a6", textDecoration: "none" }}>
          Contact
        </a>
      </div>

      <Footer />
    </main>
  )
}
