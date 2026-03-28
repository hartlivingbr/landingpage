import { createClient } from '@supabase/supabase-js'

/**
 * Admin client using service_role key.
 * Bypasses RLS — use ONLY in server-side code (API routes, server components).
 * NEVER import this in client components.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
