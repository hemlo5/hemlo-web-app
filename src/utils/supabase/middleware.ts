import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'hemlo-auth-token',
        domain: '.hemloai.com',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: any[]) {
          const isLocal = request.headers.get('host')?.includes('localhost')
          cookiesToSet.forEach(({ name, value, options }: any) => {
            const finalOptions = { 
              ...options, 
              domain: isLocal ? undefined : '.hemloai.com',
              secure: isLocal ? false : options.secure
            }
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, finalOptions)
          })
        },
      },
    }
  )

  // This will refresh session if expired
  await supabase.auth.getUser()

  return supabaseResponse
}
