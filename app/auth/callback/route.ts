import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Only allow internal redirects — prevents open-redirect attacks */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard'
  // Must start with / and not be a protocol-relative URL (//evil.com)
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/dashboard'
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = safeNext(searchParams.get('next'))
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData?.user) {
      const user = sessionData.user
      const meta = user.user_metadata || {}

      // ── Create vendedor profile server-side after email confirmation / Google OAuth ──
      // Only creates a profile when the user is actually heading to the vendedor dashboard.
      // Proprietário users (next = /dashboard-proprietario.html) are excluded.
      const isVendedorFlow =
        next === '/dashboard' ||
        meta.tipo === 'vendedor' ||
        // Google OAuth users who logged in from the vendedor login page
        (meta.tipo === undefined && next.startsWith('/dashboard') && !next.includes('proprietario'))

      if (isVendedorFlow) {
        try {
          const admin = createAdminClient()

          const { data: existing } = await admin
            .from('usuarios')
            .select('id')
            .eq('user_id', user.id)
            .eq('tipo', 'vendedor')
            .maybeSingle()

          if (!existing) {
            const fullName  = meta.full_name || meta.name || ''
            const nome      = meta.given_name  || meta.nome      || fullName.split(' ')[0]              || ''
            const sobrenome = meta.family_name || meta.sobrenome || fullName.split(' ').slice(1).join(' ') || ''

            if (nome || meta.tipo === 'vendedor') {
              const { error: insErr } = await admin.from('usuarios').insert({
                user_id:      user.id,
                tipo:         'vendedor',
                nome:         nome || user.email?.split('@')[0] || 'Usuário',
                sobrenome:    sobrenome || '',
                email:        user.email || '',
                telefone:     meta.telefone     || null,
                eh_corretor:  meta.eh_corretor  || false,
                creci:        meta.creci        || null,
                imobiliaria:  meta.imobiliaria  || null,
                categoria:    'bronze',
                referido_por: meta.referido_por || null,
              })
              if (insErr) {
                console.error('[auth/callback] profile insert error:', insErr.message)
              }
            }
          }
        } catch (err) {
          // Non-fatal: dashboard has a fallback profile-creation path
          console.error('[auth/callback] admin error:', err)
        }
      }

      return NextResponse.redirect(`${siteUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)
}
