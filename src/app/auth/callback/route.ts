import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/home'

  // ── Determine the real origin ──────────────────────────────────────────────
  // Railway (and most reverse proxies) forward the real host via x-forwarded-host.
  // new URL(request.url).origin can return the internal container address (localhost:8080).
  // We prefer x-forwarded-host, falling back to the host header, then env var.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('host') ?? ''

  let origin: string
  if (forwardedHost) {
    // Strip any port from the forwarded host for production
    const cleanHost = forwardedHost.split(',')[0].trim()
    origin = `${forwardedProto}://${cleanHost}`
  } else if (host.startsWith('localhost') || host.startsWith('127.')) {
    // Local dev — use the raw request URL origin (correct for localhost)
    origin = new URL(request.url).origin
  } else {
    // Fallback: trust the env var set on Railway
    origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // Check if maybe they are already logged in (happens with rapid double-fires)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    // Redirect with the error so we can debug it
    return NextResponse.redirect(`${origin}${next}?auth_error=${encodeURIComponent(error.message)}`)
  }

  // If no code was provided
  return NextResponse.redirect(`${origin}${next}?auth_error=No_code_provided`)
}
