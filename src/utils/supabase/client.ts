import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── Singleton pattern ──────────────────────────────────────────────────────────
// Only ONE Supabase client instance is created per browser session. This prevents
// concurrent refresh-token races when multiple components (Navbar, Sidebar, etc.)
// each call createClient() simultaneously — which caused the 429/400 auth loops.
let _client: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // SSR: always create a fresh client (server context has no global state)
    return _buildClient()
  }

  // Browser: return the shared singleton
  if (!_client) {
    _client = _buildClient()

    // ── Stale token auto-recovery ──────────────────────────────────────────────
    // If Supabase fires a TOKEN_REFRESHED failure (400 "Refresh Token Not Found"),
    // it means the browser holds a dead token from a previous session that no
    // longer exists on the server. Rather than letting it loop infinitely, we:
    //   1. Wipe all Supabase-owned localStorage keys for this project
    //   2. Reset the singleton so the next component call gets a clean client
    //   3. Do NOT redirect — let the UI's auth state listener handle it gracefully
    _client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        _nukeStaleStorage()
        _client = null
      }

      // When the SDK removes the session due to a bad refresh token, the event
      // sequence is: failed refresh → _removeSession → SIGNED_OUT.
      // The nuking above handles that. But as an extra safety net, also clear
      // on initial session load failure (no session + not a fresh page load).
      if (event === 'INITIAL_SESSION' && !session) {
        _nukeStaleStorage()
      }
    })
  }

  return _client
}

// ── _nukeStaleStorage ──────────────────────────────────────────────────────────
// Surgically removes only Supabase auth keys from localStorage and cookies.
// Called automatically when a stale/invalid refresh token is detected.
// This stops the infinite retry loop without nuking unrelated app data.
function _nukeStaleStorage() {
  try {
    // Remove all keys that Supabase owns (prefixed with "sb-")
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))

    // Also expire Supabase's auth cookies (belt + suspenders)
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const projectRef = supaUrl.match(/https?:\/\/([^.]+)/)?.[1] ?? ''
    if (projectRef) {
      const past = 'expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      document.cookie = `sb-${projectRef}-auth-token=; ${past}`
      document.cookie = `sb-${projectRef}-auth-token-code-verifier=; ${past}`
    }
  } catch {
    // localStorage may be unavailable in certain secure contexts — safe to ignore
  }
}
function _buildClient(): SupabaseClient {
  const isProd =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('hemloai.com')

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Persist sessions to localStorage so tabs share the same token
        persistSession: true,
        // Let the SDK auto-refresh — but because we have a single instance,
        // only one refresh timer is ever running at a time.
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Exponential back-off is handled natively by the Supabase JS SDK;
        // the singleton ensures the back-off isn't reset by competing instances.
      },
      cookieOptions: {
        ...(isProd ? { domain: '.hemloai.com', secure: true } : {}),
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      },
    }
  )
}

