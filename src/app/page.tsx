import { redirect } from "next/navigation"
import DashboardLayout from "./(dashboard)/layout"
import MirofishPage from "./(dashboard)/simulate/mirofish/page"

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const sp = await searchParams

  // Handle OAuth callbacks
  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}&next=/simulate/mirofish`)
  }

  if (sp.error) {
    redirect(`/simulate/mirofish?auth_error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  // Main domain opens the app directly instead of paying a redirect round-trip.
  const appPage = await MirofishPage()
  return <DashboardLayout>{appPage}</DashboardLayout>
}
