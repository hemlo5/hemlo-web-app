import { redirect } from "next/navigation"

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

  // Main domain opens the MiroFish app experience.
  redirect("/simulate/mirofish")
}
