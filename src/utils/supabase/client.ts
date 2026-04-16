import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const isProd = typeof window !== 'undefined' && window.location.hostname.includes('hemloai.com')

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        ...(isProd
          ? { domain: '.hemloai.com', secure: true }
          : {}),
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      },
    }
  )
}
