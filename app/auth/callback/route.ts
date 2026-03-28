import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Use configured site URL so redirects always go to the right domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && sessionData?.user) {
      const user = sessionData.user
      const meta = user.user_metadata || {}

      // ── Create vendedor profile server-side (service_role bypasses RLS) ──
      // This runs after email confirmation and after Google OAuth login.
      // It's idempotent: if the profile already exists nothing happens.
      try {
        const admin = createAdminClient()

        const { data: existing } = await admin
          .from('usuarios')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', 'vendedor')
          .maybeSingle()

        if (!existing) {
          // Support both email/password (stores custom fields in metadata)
          // and Google OAuth (stores full_name, given_name, etc.)
          const fullName = meta.full_name || meta.name || ''
          const nome =
            meta.given_name || meta.nome || fullName.split(' ')[0] || ''
          const sobrenome =
            meta.family_name ||
            meta.sobrenome ||
            fullName.split(' ').slice(1).join(' ') ||
            ''

          // Only create if we have at least a name or it's a vendedor signup
          if (nome || meta.tipo === 'vendedor') {
            await admin.from('usuarios').insert({
              user_id:     user.id,
              tipo:        'vendedor',
              nome:        nome || user.email?.split('@')[0] || 'Usuário',
              sobrenome:   sobrenome || '',
              email:       user.email || '',
              telefone:    meta.telefone    || null,
              eh_corretor: meta.eh_corretor || false,
              creci:       meta.creci       || null,
              imobiliaria: meta.imobiliaria || null,
              categoria:   'bronze',
              referido_por: meta.referido_por || null,
            })
          }
        }
      } catch (_) {
        // Non-fatal: dashboard will try profile creation as a fallback
      }

      return NextResponse.redirect(`${siteUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth_callback_failed`)
}
