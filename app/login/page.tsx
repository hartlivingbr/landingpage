'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './login.module.css'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const initialType = searchParams.get('tipo') === 'proprietario' ? 'proprietario' : 'vendedor'
  const [userType, setUserType] = useState<'vendedor' | 'proprietario'>(initialType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'e' | 's' } | null>(null)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'auth_callback_failed') {
      setMsg({ text: 'Erro ao confirmar e-mail. Tente novamente.', type: 'e' })
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: perfil } = await supabase
        .from('usuarios')
        .select('id, tipo')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (perfil?.tipo === 'vendedor') router.replace('/dashboard')
      else if (perfil?.tipo === 'proprietario') router.replace('/dashboard-proprietario.html')
    })
  }, [])

  function switchType(type: 'vendedor' | 'proprietario') {
    setUserType(type)
    setMsg(null)
    router.replace(`/login?tipo=${type}`, { scroll: false })
  }

  async function entrar() {
    if (!email) return setMsg({ text: 'Preencha seu e-mail.', type: 'e' })
    if (!password) return setMsg({ text: 'Preencha sua senha.', type: 'e' })

    setLoading(true)
    setMsg(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setLoading(false)
      if (error.message === 'Email not confirmed' || error.message.includes('confirm'))
        return setMsg({ text: 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam.', type: 'e' })
      return setMsg({ text: 'E-mail ou senha incorretos. Verifique e tente novamente.', type: 'e' })
    }

    const { data: perfil } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', data.user.id)
      .eq('tipo', userType)
      .maybeSingle()

    if (perfil) {
      setMsg({ text: 'Login realizado! Redirecionando...', type: 's' })
      const dest = userType === 'vendedor' ? '/dashboard' : '/dashboard-proprietario.html'
      setTimeout(() => router.replace(dest), 800)
      return
    }

    // Tenta criar perfil a partir dos metadados do cadastro (apenas vendedor)
    if (userType === 'vendedor') {
      const meta = data.user.user_metadata || {}
      if (meta.tipo === 'vendedor' && meta.nome) {
        const { error: insErr } = await supabase.from('usuarios').insert({
          user_id:      data.user.id,
          tipo:         'vendedor',
          nome:         meta.nome,
          sobrenome:    meta.sobrenome   || '',
          email:        data.user.email,
          telefone:     meta.telefone    || null,
          eh_corretor:  meta.eh_corretor || false,
          creci:        meta.creci       || null,
          imobiliaria:  meta.imobiliaria || null,
          categoria:    'bronze',
          referido_por: meta.referido_por || null,
        })

        if (!insErr) {
          setMsg({ text: 'Conta ativada! Redirecionando...', type: 's' })
          setTimeout(() => router.replace('/dashboard'), 800)
          return
        }
      }
    }

    await supabase.auth.signOut()
    setLoading(false)
    const tipoLabel = userType === 'vendedor' ? 'vendedor' : 'proprietário'
    setMsg({ text: `Você não tem conta de ${tipoLabel}. Verifique o tipo selecionado ou crie uma conta.`, type: 'e' })
  }

  async function entrarGoogle() {
    const next = userType === 'vendedor' ? '/dashboard' : '/dashboard-proprietario.html'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${next}` },
    })
    if (error) setMsg({ text: 'Erro ao conectar com Google. Tente novamente.', type: 'e' })
  }

  async function esqueceuSenha() {
    if (!email) return setMsg({ text: 'Digite seu e-mail acima para recuperar a senha.', type: 'e' })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })
    if (error) return setMsg({ text: error.message, type: 'e' })
    setMsg({ text: 'E-mail de recuperação enviado! Verifique a caixa de entrada e o spam.', type: 's' })
  }

  const isVendedor = userType === 'vendedor'

  return (
    <div className={styles.body}>
      {/* Left panel */}
      <div className={styles.LP}>
        <a href="/" className={styles.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </a>

        <div className={styles.FC}>
          <div className={styles.logoPill}>
            <img src="/images/Hart_Tipografico_04.png" alt="Hart" />
          </div>

          {/* Role switcher */}
          <div className={styles.typeSwitch}>
            <button
              className={`${styles.typeBtn} ${userType === 'proprietario' ? styles.typeBtnActive : ''}`}
              onClick={() => switchType('proprietario')}
              type="button"
            >
              Proprietário
            </button>
            <button
              className={`${styles.typeBtn} ${userType === 'vendedor' ? styles.typeBtnActive : ''}`}
              onClick={() => switchType('vendedor')}
              type="button"
            >
              Vendedor
            </button>
          </div>

          <div className={styles.areaBadge}>
            <span className={styles.areaDot} />
            <span>{isVendedor ? 'Área do Vendedor' : 'Área do Proprietário'}</span>
          </div>

          <h1 className={styles.h1}>Bem-vindo de volta</h1>
          <p className={styles.sub}>
            {isVendedor
              ? 'Entre no dashboard para acompanhar suas indicações e comissões'
              : 'Entre no portal para acompanhar seus imóveis e propostas'}
          </p>

          {msg && (
            <div className={`${styles.msg} ${msg.type === 'e' ? styles.msgError : styles.msgSuccess}`}>
              {msg.text}
            </div>
          )}

          <label className={styles.flbl}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            E-mail
          </label>
          <div className={styles.fieldWrap}>
            <input
              className={styles.inp}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              onKeyDown={e => e.key === 'Enter' && entrar()}
            />
          </div>

          <label className={styles.flbl} style={{ marginTop: 16 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Senha
          </label>
          <div className={styles.wrap}>
            <input
              className={styles.inp}
              type={showPwd ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              onKeyDown={e => e.key === 'Enter' && entrar()}
            />
            <button className={styles.eye} type="button" onClick={() => setShowPwd(v => !v)} aria-label="Mostrar senha">
              {showPwd ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          <div className={styles.meta}>
            <label className={styles.rem}>
              <input type="checkbox" />
              <span>Lembrar de mim</span>
            </label>
            <button className={styles.fgt} onClick={esqueceuSenha} type="button">
              Esqueci minha senha
            </button>
          </div>

          <button className={styles.btn} onClick={entrar} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className={styles.or}>ou</div>
          <button className={styles.goog} onClick={entrarGoogle} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          <p className={styles.prm}>
            {isVendedor
              ? <><span>Não tem conta? </span><a href="/cadastro">Criar conta de vendedor</a></>
              : <><span>Não tem conta? </span><a href="/cadastro/proprietario">Criar conta de proprietário</a></>}
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className={styles.RP}>
        <div className={styles.rpGlow1} />
        <div className={styles.rpGlow2} />
        <img src="/images/Hart_Tipografico_04.png" alt="Hart" className={styles.rpLogo} />
      </div>
    </div>
  )
}
