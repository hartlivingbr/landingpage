'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from '../login/login.module.css'

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
  { l: '',       c: '',        p: 0   },
  { l: 'Fraca',  c: '#E5484D', p: 25  },
  { l: 'Média',  c: '#F76B15', p: 55  },
  { l: 'Boa',    c: '#30A46C', p: 80  },
  { l: 'Forte',  c: '#2D5A27', p: 100 },
]

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router  = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [p2, setP2]             = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [msg, setMsg]           = useState<{ text: string; type: 'e' | 's' } | null>(null)
  const [ready, setReady]       = useState(false)

  const pwdLv = pwdStrength(password)
  const { l: pwdLabel, c: pwdColor, p: pwdPct } = LEVELS[pwdLv]

  useEffect(() => {
    // Use getUser() (server-validated) — getSession() reads only from local storage
    // and could be spoofed or stale after a password-reset link is clicked.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setReady(true)
      } else {
        setMsg({
          text: 'Link inválido ou expirado. Solicite um novo link de recuperação.',
          type: 'e',
        })
      }
    })
  }, [])

  async function salvarSenha() {
    if (!password)          return setMsg({ text: 'Digite a nova senha.', type: 'e' })
    if (password.length < 8) return setMsg({ text: 'A senha precisa ter pelo menos 8 caracteres.', type: 'e' })
    if (password !== p2)    return setMsg({ text: 'As senhas não coincidem.', type: 'e' })

    setLoading(true)
    setMsg(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setLoading(false)
      return setMsg({ text: 'Erro ao atualizar senha: ' + error.message, type: 'e' })
    }

    setMsg({ text: 'Senha atualizada com sucesso! Redirecionando...', type: 's' })
    setTimeout(() => router.replace('/dashboard'), 1500)
  }

  return (
    <div className={styles.body}>
      <div className={styles.LP}>
        <div className={styles.FC}>
          <div className={styles.logoPill}>
            <img src="/images/Hart_Tipografico_04.png" alt="Hart" />
          </div>

          <h1 className={styles.h1}>Nova senha</h1>
          <p className={styles.sub}>Escolha uma nova senha para sua conta Hart</p>

          {msg && (
            <div className={`${styles.msg} ${msg.type === 'e' ? styles.msgError : styles.msgSuccess}`}>
              {msg.text}
            </div>
          )}

          {ready && (
            <>
              <label className={styles.flbl} style={{ marginTop: 8 }}>Nova senha</label>
              <div className={styles.wrap}>
                <input
                  className={styles.inp}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={e => e.key === 'Enter' && salvarSenha()}
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

              {/* Password strength bar (same pattern as cadastro) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 999, background: '#e8e8e5', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pwdPct + '%', background: pwdColor, borderRadius: 999, transition: 'width .25s, background .25s' }} />
                </div>
                <span style={{ fontSize: 11, color: pwdColor, minWidth: 36 }}>{pwdLabel}</span>
              </div>

              <label className={styles.flbl} style={{ marginTop: 14 }}>Confirmar nova senha</label>
              <div className={styles.fieldWrap}>
                <input
                  className={styles.inp}
                  type="password"
                  placeholder="Repita a senha"
                  value={p2}
                  onChange={e => setP2(e.target.value)}
                  autoComplete="new-password"
                  onKeyDown={e => e.key === 'Enter' && salvarSenha()}
                  style={p2 ? { borderColor: p2 === password ? '#30A46C' : '#E5484D' } : {}}
                />
              </div>

              <button className={styles.btn} onClick={salvarSenha} disabled={loading} style={{ marginTop: 24 }}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </>
          )}

          {!ready && !msg && (
            <p style={{ textAlign: 'center', color: '#9a9a90', fontSize: 14, marginTop: 24 }}>
              Verificando link...
            </p>
          )}

          {!ready && msg?.type === 'e' && (
            <a href="/login" className={styles.btn} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>
              Solicitar novo link
            </a>
          )}

          <p className={styles.prm} style={{ marginTop: 20 }}>
            <a href="/login">← Voltar ao login</a>
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
