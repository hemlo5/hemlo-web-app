import { redirect } from "next/navigation"

// This root page primarily redirects to /home.
// However, Supabase occasionally sends the OAuth `code` to the root URL (/)
// instead of /auth/callback — especially on localhost. We intercept it here
// and forward it to the proper handler so the session is actually created.
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const sp = await searchParams

  if (sp.code) {
    // OAuth code landed on the root — proxy it to the proper callback handler
    redirect(`/auth/callback?code=${encodeURIComponent(sp.code)}&next=/home`)
  }

  if (sp.error) {
    redirect(`/home?auth_error=${encodeURIComponent(sp.error_description ?? sp.error)}`)
  }

  redirect("/home")
}
