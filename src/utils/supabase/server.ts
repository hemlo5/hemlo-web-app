import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const host = headerStore.get('host') ?? ''
  const isLocal = host.includes('localhost')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value,
              ...options,
              // Share cookies across .hemloai.com subdomains in production
              ...(isLocal ? {} : { domain: '.hemloai.com' }),
            })
          } catch {
            // Ignore - called from Server Component, middleware will handle it
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({
              name,
              value: '',
              ...options,
              ...(isLocal ? {} : { domain: '.hemloai.com' }),
            })
          } catch {
            // Ignore - called from Server Component, middleware will handle it
          }
        },
      },
    }
  )
}
