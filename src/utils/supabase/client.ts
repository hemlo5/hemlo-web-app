import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'hemlo-auth-token',
        domain: isLocal ? undefined : '.hemloai.com',
        path: '/',
        sameSite: 'lax',
        secure: !isLocal,
      }
    }
  )
}
