import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const isLocal = request.headers.get('host')?.includes('localhost') ?? false

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: any) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // On production: share cookies across .hemloai.com subdomains
              ...(isLocal ? {} : { domain: '.hemloai.com' }),
            })
          })
        },
      },
    }
  )

  // Refresh session if expired — suppress noisy token-not-found errors
  // (expected after OAuth credential rotation; clears itself when users re-sign-in)
  try {
    await supabase.auth.getUser()
  } catch {
    // refresh_token_not_found — harmless, old cookies will expire naturally
  }

  return supabaseResponse
}
