'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './cadastro.module.css'

function pwdStrength(p: string): number {
  if (!p) return 0
  let s = 1
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(s, 4)
}

const LEVELS = [
  { l: '', c: '', p: 0 },
  { l: 'Fraca', c: '#E5484D', p: 25 },
  { l: 'Média', c: '#F76B15', p: 55 },
  { l: 'Boa', c: '#30A46C', p: 80 },
  { l: 'Forte', c: '#2D5A27', p: 100 },
]

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  )
}

function CadastroForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [fname, setFname] = useState('')
  const [lname, setLname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [refLink, setRefLink] = useState('')
  const [refReadonly, setRefReadonly] = useState(false)
  const [isCor, setIsCor] = useState(false)
  const [creci, setCreci] = useState('')
  const [imob, setImob] = useState('')
  const [password, setPassword] = useState('')
  const [p2, setP2] = useState('')
  const [terms, setTerms] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showP2, setShowP2] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'e' | 's' } | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const pwdLv = pwdStrength(password)
  const { l: pwdLabel, c: pwdColor, p: pwdPct } = LEVELS[pwdLv]

  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      setRefLink(ref)
      setRefReadonly(true)
    }
  }, [])

  async function cadastrar() {
    if (!fname || !lname) return setMsg({ text: 'Preencha seu nome completo.', type: 'e' })
    if (!email) return setMsg({ text: 'Preencha seu e-mail.', type: 'e' })
    if (!phone) return setMsg({ text: 'Preencha seu telefone.', type: 'e' })
    if (!password) return setMsg({ text: 'Crie uma senha.', type: 'e' })
    if (password.length < 8) return setMsg({ text: 'A senha precisa ter pelo menos 8 caracteres.', type: 'e' })
    if (password !== p2) return setMsg({ text: 'As senhas não coincidem.', type: 'e' })
    if (!terms) return setMsg({ text: 'Aceite os Termos de Uso para continuar.', type: 'e' })

    setLoading(true)
    setMsg(null)

    let refCode = refLink
    try {
      if (refLink && refLink.includes('?')) refCode = new URL(refLink).searchParams.get('ref') || refLink
    } catch (_) {}

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        data: {
          nome: fname,
          sobrenome: lname,
          telefone: phone,
          tipo: 'vendedor',
          eh_corretor: isCor,
          creci: creci || null,
          imobiliaria: imob || null,
          referido_por: refCode || null,
        },
      },
    })

    if (!error) {
      setConfirmedEmail(email)
      setConfirmed(true)
      return
    }

    if (error.message === 'User already registered') {
      await adicionarPerfilExistente(email, password, { fname, lname, phone, isCor, creci, imob, refCode })
      return
    }

    setLoading(false)
    setMsg({ text: error.message, type: 'e' })
  }

  async function adicionarPerfilExistente(
    em: string, pw: string,
    pd: { fname: string; lname: string; phone: string; isCor: boolean; creci: string; imob: string; refCode: string }
  ) {
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email: em, password: pw })

    if (signInErr) {
      setLoading(false)
      setMsg({ text: 'Este e-mail já está cadastrado. Verifique sua senha ou use "Esqueci minha senha" na tela de login.', type: 'e' })
      return
    }

    const { data: existing } = await supabase
      .from('usuarios')
      .select('id')
      .eq('user_id', signIn.user.id)
      .eq('tipo', 'vendedor')
      .maybeSingle()

    if (existing) {
      await supabase.auth.signOut()
      setLoading(false)
      setMsg({ text: 'Você já tem uma conta de vendedor. Faça login.', type: 'e' })
      return
    }

    const { error: insErr } = await supabase.from('usuarios').insert({
      user_id:     signIn.user.id,
      tipo:        'vendedor',
      nome:        pd.fname,
      sobrenome:   pd.lname,
      email:       em,
      telefone:    pd.phone,
      eh_corretor: pd.isCor,
      creci:       pd.creci || null,
      imobiliaria: pd.imob || null,
      categoria:   'bronze',
      referido_por: pd.refCode || null,
    })

    if (insErr) {
      setLoading(false)
      setMsg({ text: 'Erro ao criar perfil: ' + insErr.message, type: 'e' })
      return
    }

    router.replace('/dashboard')
  }

  async function reenviarEmail() {
    setResendLoading(true)
    setResendMsg('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: confirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    })
    setResendLoading(false)
    if (error) {
      setResendMsg('Erro ao reenviar: ' + error.message)
    } else {
      setResendMsg('E-mail reenviado! Verifique também o Spam.')
    }
  }

  if (confirmed) {
    return (
      <div className={styles.body}>
        <div className={styles.LP}>
          <div className={styles.FC}>
            <div className={styles.logoPill}>
              <img src="/images/Hart_Tipografico_04.png" alt="Hart" />
            </div>
            <h1 className={styles.h1}>Verifique seu e-mail</h1>
            <p className={styles.sub}>Enviamos um link de confirmação para:</p>
            <p className={styles.emailDest}>{confirmedEmail}</p>
            <div className={styles.confirmBox}>
              <p>
                <strong>Próximo passo:</strong> Abra seu e-mail, clique em{' '}
                <strong>&ldquo;Confirmar meu e-mail&rdquo;</strong> e volte para entrar no dashboard.
                <br /><br />
                Não encontrou? Verifique <strong>Spam</strong> ou <strong>Promoções</strong>.
              </p>
            </div>
            <a href="/login" className={styles.btn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
              Já confirmei — Entrar
            </a>
            {resendMsg && (
              <p style={{ fontSize: 13, textAlign: 'center', marginTop: 12, color: resendMsg.startsWith('Erro') ? '#c0392b' : '#1e7e50' }}>
                {resendMsg}
              </p>
            )}
            <p className={styles.retryNote}>
              Não recebeu?{' '}
              <button
                onClick={reenviarEmail}
                disabled={resendLoading}
                style={{ background: 'none', border: 'none', color: '#2D5A27', fontWeight: 700, cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                {resendLoading ? 'Enviando…' : 'Reenviar e-mail'}
              </button>
            </p>
          </div>
        </div>
        <div className={styles.RP}>
          <div className={styles.rpGlow1} />
          <div className={styles.rpGlow2} />
          <img src="/images/Hart_Tipografico_04.png" alt="Hart" className={styles.rpLogo} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.body}>
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

          <div className={styles.areaBadge}>
            <span className={styles.areaDot} />
            <span>Área do Vendedor</span>
          </div>

          <h1 className={styles.h1}>Comece a indicar</h1>
          <p className={styles.sub}>Crie sua conta de vendedor Hart e comece a receber comissões</p>

          {msg && (
            <div className={`${styles.msg} ${msg.type === 'e' ? styles.msgError : styles.msgSuccess}`}>
              {msg.text}
            </div>
          )}

          {refReadonly && (
            <div className={styles.refBanner}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L9.5 5.5H14.5L10.5 8.5L12 13L8 10.5L4 13L5.5 8.5L1.5 5.5H6.5L8 1Z" fill="rgba(45,90,39,.25)" stroke="#2D5A27" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              <span>Você foi convidado por um parceiro Hart. Código de indicação aplicado automaticamente.</span>
            </div>
          )}

          <div className={styles.ng}>
            <div className={styles.fg}>
              <label className={styles.flbl}>Nome</label>
              <input className={styles.inp} type="text" placeholder="João" value={fname} onChange={e => setFname(e.target.value)} autoComplete="given-name"/>
            </div>
            <div className={styles.fg}>
              <label className={styles.flbl}>Sobrenome</label>
              <input className={styles.inp} type="text" placeholder="Silva" value={lname} onChange={e => setLname(e.target.value)} autoComplete="family-name"/>
            </div>
          </div>

          <div className={styles.fg}>
            <label className={styles.flbl}>E-mail</label>
            <input className={styles.inp} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"/>
          </div>

          <div className={styles.fg}>
            <label className={styles.flbl}>Telefone / WhatsApp</label>
            <input className={styles.inp} type="tel" placeholder="(11) 9 0000-0000" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel"/>
          </div>

          {!refReadonly && (
            <div className={styles.fg}>
              <label className={styles.flbl}>
                Link de indicação <span className={styles.optional}>(opcional)</span>
              </label>
              <input className={styles.inp} type="text" placeholder="Cole aqui o link de quem te indicou" value={refLink} onChange={e => setRefLink(e.target.value)}/>
            </div>
          )}

          <label className={styles.corrToggle}>
            <input type="checkbox" checked={isCor} onChange={e => setIsCor(e.target.checked)} />
            <span>Sou corretor de imóveis</span>
          </label>

          {isCor && (
            <div className={styles.ng} style={{ marginBottom: 12 }}>
              <div className={styles.fg}>
                <label className={styles.flbl}>CRECI</label>
                <input className={styles.inp} type="text" placeholder="SP-000000" value={creci} onChange={e => setCreci(e.target.value)}/>
              </div>
              <div className={styles.fg}>
                <label className={styles.flbl}>Imobiliária</label>
                <input className={styles.inp} type="text" placeholder="Opcional" value={imob} onChange={e => setImob(e.target.value)}/>
              </div>
            </div>
          )}

          <div className={styles.fg}>
            <label className={styles.flbl}>Senha</label>
            <div className={styles.wrap}>
              <input className={styles.inp} type={showPwd ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
              <button className={styles.eye} type="button" onClick={() => setShowPwd(v => !v)} aria-label="Mostrar senha">
                <EyeIcon show={showPwd} />
              </button>
            </div>
            <div className={styles.ps}>
              <div className={styles.pst}><div className={styles.psf} style={{ width: pwdPct + '%', background: pwdColor }} /></div>
              <span className={styles.psl} style={{ color: pwdColor }}>{pwdLabel}</span>
            </div>
          </div>

          <div className={styles.fg}>
            <label className={styles.flbl}>Confirmar senha</label>
            <div className={styles.wrap}>
              <input
                className={styles.inp}
                type={showP2 ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={p2}
                onChange={e => setP2(e.target.value)}
                autoComplete="new-password"
                style={p2 ? { borderColor: p2 === password ? '#30A46C' : '#E5484D', boxShadow: p2 === password ? '0 0 0 3px rgba(48,164,108,.10)' : '0 0 0 3px rgba(229,72,77,.10)' } : {}}
              />
              <button className={styles.eye} type="button" onClick={() => setShowP2(v => !v)} aria-label="Mostrar senha">
                <EyeIcon show={showP2} />
              </button>
            </div>
          </div>

          <label className={styles.termsLabel}>
            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>Li e aceito os <a href="/termos">Termos de Uso</a> e a <a href="/privacidade">Política de Privacidade</a></span>
          </label>

          <button className={styles.btn} onClick={cadastrar} disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta de vendedor'}
          </button>

          <p className={styles.prm}>
            Já tem conta? <a href="/login">Entrar como vendedor</a>
          </p>
        </div>
      </div>

      <div className={styles.RP}>
        <div className={styles.rpGlow1} />
        <div className={styles.rpGlow2} />
        <img src="/images/Hart_Tipografico_04.png" alt="Hart" className={styles.rpLogo} />
      </div>
    </div>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  if (show) return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
