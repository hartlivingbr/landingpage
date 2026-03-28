'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from '../login/login.module.css'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [p2, setP2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'e' | 's' } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // After the user clicks the reset link, Supabase sets an active session.
    // We verify it exists before showing the form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        setMsg({ text: 'Link inválido ou expirado. Solicite um novo link de recuperação.', type: 'e' })
      }
    })
  }, [])

  async function salvarSenha() {
    if (!password) return setMsg({ text: 'Digite a nova senha.', type: 'e' })
    if (password.length < 8) return setMsg({ text: 'A senha precisa ter pelo menos 8 caracteres.', type: 'e' })
    if (password !== p2) return setMsg({ text: 'As senhas não coincidem.', type: 'e' })

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

              <label className={styles.flbl} style={{ marginTop: 16 }}>Confirmar nova senha</label>
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
            <p style={{ textAlign: 'center', color: 'var(--muted, #9a9a90)', fontSize: 14, marginTop: 24 }}>
              Verificando link...
            </p>
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
