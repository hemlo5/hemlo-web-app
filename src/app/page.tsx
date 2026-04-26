import { redirect } from "next/navigation"

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const sp = await searchParams

  // Handle OAuth callbacks
  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}&next=/polymarket`)
  }

  if (sp.error) {
    redirect(`/polymarket?auth_error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  // Always redirect to /polymarket
  redirect("/polymarket")
}
