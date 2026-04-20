import { redirect } from "next/navigation"

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const sp = await searchParams

  // Handle OAuth callbacks
  if (sp.code) {
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}&next=/home`)
  }

  if (sp.error) {
    redirect(`/home?auth_error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  // Always redirect to /home
  redirect("/home")
}
