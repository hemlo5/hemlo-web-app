import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const isProd = process.env.NODE_ENV === 'production'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @supabase/ssr ≥0.5 requires getAll/setAll — NOT the old get/set/remove.
        // Using the old API meant getAll() was undefined, so the PKCE code
        // verifier cookie could never be found → "PKCE not found" on login.
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                // In prod: share session cookies across *.hemloai.com subdomains
                ...(isProd ? { domain: '.hemloai.com' } : {}),
              })
            })
          } catch {
            // setAll is called from a Server Component where the cookie store
            // is read-only. The middleware handles refreshing the session.
          }
        },
      },
    }
  )
}
