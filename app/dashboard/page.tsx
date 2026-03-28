'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Usuario, Indicacao, Comissao } from '@/lib/types'
import styles from './dashboard.module.css'

type View = 'dashboard' | 'indicacoes' | 'comissoes' | 'ranking' | 'rede' | 'materiais' | 'perfil' | 'missoes'

const RANK_CONFIG: Record<string, { emoji: string; label: string; mult: string; layers: string }> = {
  bronze:  { emoji: '◈', label: 'Bronze',  mult: '0.75×', layers: '2 layers' },
  prata:   { emoji: '◇', label: 'Prata',   mult: '1×',    layers: '3 layers' },
  ouro:    { emoji: '◆', label: 'Ouro',    mult: '1.10×', layers: '4 layers' },
  platina: { emoji: '✦', label: 'Platina', mult: '1.25×', layers: '5 layers' },
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function statusPill(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    pendente:   { cls: styles.sPendente,  label: 'Recebida' },
    em_contato: { cls: styles.sContato,   label: 'Em contato' },
    proposta:   { cls: styles.sProposta,  label: 'Proposta' },
    fechado:    { cls: styles.sFechado,   label: 'Fechado' },
    perdido:    { cls: styles.sPerdido,   label: 'Não fechado' },
  }
  const { cls, label } = map[status] || { cls: '', label: status }
  return <span className={`${styles.statusPill} ${cls}`}><span className={styles.dot} />{label}</span>
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [view, setView] = useState<View>('dashboard')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Usuario | null>(null)
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([])
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [rede, setRede] = useState<Usuario[]>([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [toast, setToast] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  // Indicação form
  const [inNome, setInNome] = useState('')
  const [inTel, setInTel] = useState('')
  const [inEmail, setInEmail] = useState('')
  const [inEndereco, setInEndereco] = useState('')
  const [inObs, setInObs] = useState('')
  const [inServico, setInServico] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  // Perfil form
  const [pfNome, setPfNome] = useState('')
  const [pfSobrenome, setPfSobrenome] = useState('')
  const [pfTel, setPfTel] = useState('')
  const [pfImob, setPfImob] = useState('')
  const [pfSaved, setPfSaved] = useState(false)
  const [pfLoading, setPfLoading] = useState(false)

  function showToast(msg: string) {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2800)
  }

  const loadProfile = useCallback(async (currentUser: any) => {
    let { data: perfil } = await supabase
      .from('usuarios')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('tipo', 'vendedor')
      .maybeSingle()

    if (!perfil) {
      const meta = currentUser.user_metadata || {}
      // Google OAuth stores full_name; email/password stores nome
      const fullName = meta.full_name || meta.name || ''
      const nome = meta.given_name || meta.nome || fullName.split(' ')[0] || ''
      const sobrenome = meta.family_name || meta.sobrenome || fullName.split(' ').slice(1).join(' ') || ''

      const { data: inserted, error: insertError } = await supabase.from('usuarios').insert({
        user_id: currentUser.id,
        tipo: 'vendedor',
        nome: nome || currentUser.email?.split('@')[0] || 'Usuário',
        sobrenome: sobrenome || '',
        email: currentUser.email || '',
        telefone:     meta.telefone     || null,
        eh_corretor:  meta.eh_corretor  || false,
        creci:        meta.creci        || null,
        imobiliaria:  meta.imobiliaria  || null,
        categoria:    'bronze',
        referido_por: meta.referido_por || null,
      }).select().single()

      if (insertError || !inserted) {
        // Profile may already exist with a race condition — try fetching again
        const { data: retry } = await supabase
          .from('usuarios').select('*')
          .eq('user_id', currentUser.id).eq('tipo', 'vendedor').maybeSingle()
        if (!retry) {
          await supabase.auth.signOut()
          router.replace('/login')
          return null
        }
        perfil = retry
      } else {
        perfil = inserted
      }
    }

    setProfile(perfil)
    setPfNome(perfil.nome)
    setPfSobrenome(perfil.sobrenome)
    setPfTel(perfil.telefone || '')
    setPfImob(perfil.imobiliaria || '')
    return perfil
  }, [])

  const loadIndicacoes = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('indicacoes')
      .select('*')
      .eq('vendedor_id', profileId)
      .order('created_at', { ascending: false })
    setIndicacoes(data || [])
  }, [])

  const loadComissoes = useCallback(async (profileId: string) => {
    const { data } = await supabase
      .from('comissoes')
      .select('*')
      .eq('vendedor_id', profileId)
      .order('created_at', { ascending: false })
    setComissoes(data || [])
  }, [])

  const loadRede = useCallback(async (profileId: string) => {
    // referido_por stores the 10-char ref code derived from the profile UUID
    const code = profileId.replace(/-/g, '').slice(0, 10)
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('referido_por', code)
      .eq('tipo', 'vendedor')
      .order('created_at', { ascending: false })
    setRede(data || [])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) { router.replace('/login'); return }
      setUser(u)
      const perfil = await loadProfile(u)
      if (perfil) {
        await Promise.all([loadIndicacoes(perfil.id), loadComissoes(perfil.id), loadRede(perfil.id)])
      }
      setLoadingProfile(false)
    })
  }, [])

  // Real-time subscriptions — refresh data when Supabase pushes updates
  useEffect(() => {
    if (!profile?.id) return
    const chInd = supabase.channel(`ind-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'indicacoes', filter: `vendedor_id=eq.${profile.id}` },
        () => loadIndicacoes(profile.id))
      .subscribe()
    const chCom = supabase.channel(`com-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comissoes', filter: `vendedor_id=eq.${profile.id}` },
        () => loadComissoes(profile.id))
      .subscribe()
    return () => {
      supabase.removeChannel(chInd)
      supabase.removeChannel(chCom)
    }
  }, [profile?.id])

  async function doLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function submitIndicacao() {
    if (!profile) return
    const trimNome     = inNome.trim()
    const trimTel      = inTel.trim()
    const trimEmail    = inEmail.trim().toLowerCase()
    const trimEndereco = inEndereco.trim()
    const trimObs      = inObs.trim()

    if (!trimNome || !trimTel || !trimEndereco) {
      showToast('Preencha os campos obrigatórios.')
      return
    }
    setSubmitLoading(true)
    const obs = [trimObs, inServico ? `Serviço: ${inServico}` : ''].filter(Boolean).join('\n')
    const { error } = await supabase.from('indicacoes').insert({
      vendedor_id:     profile.id,
      nome_lead:       trimNome,
      email_lead:      trimEmail || null,
      telefone_lead:   trimTel,
      endereco_imovel: trimEndereco,
      observacoes:     obs || null,
    })
    setSubmitLoading(false)
    if (error) { showToast('Erro ao enviar: ' + error.message); return }
    setInNome(''); setInTel(''); setInEmail(''); setInEndereco(''); setInObs(''); setInServico('')
    showToast('Indicação enviada com sucesso!')
    await loadIndicacoes(profile.id)
  }

  async function savePerfil() {
    if (!profile) return
    if (!pfNome.trim()) { showToast('O nome não pode estar vazio.'); return }
    setPfLoading(true)
    const { error } = await supabase.from('usuarios').update({
      nome: pfNome,
      sobrenome: pfSobrenome,
      telefone: pfTel || null,
      imobiliaria: pfImob || null,
    }).eq('id', profile.id)
    setPfLoading(false)
    if (error) { showToast('Erro ao salvar: ' + error.message); return }
    setProfile(p => p ? { ...p, nome: pfNome, sobrenome: pfSobrenome, telefone: pfTel, imobiliaria: pfImob } : p)
    setPfSaved(true)
    setTimeout(() => setPfSaved(false), 3000)
  }

  function copyLink() {
    if (!profile) return
    const code   = profile.id.replace(/-/g, '').slice(0, 10)
    const base   = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const link   = `${base}/cadastro?ref=${code}`
    navigator.clipboard.writeText(link)
    showToast('Link copiado!')
  }

  async function uploadAvatar(file: File) {
    if (!user) return
    const MAX_SIZE_MB = 2
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showToast(`A imagem deve ter no máximo ${MAX_SIZE_MB} MB.`)
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      showToast('Formato inválido. Use JPG, PNG, WebP ou GIF.')
      return
    }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${user.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) { showToast('Erro no upload: ' + upErr.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: updateErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    if (updateErr) { showToast('Erro ao salvar foto.'); setUploadingAvatar(false); return }
    setUser((u: any) => u ? { ...u, user_metadata: { ...u.user_metadata, avatar_url: publicUrl } } : u)
    setUploadingAvatar(false)
    showToast('Foto de perfil atualizada!')
  }

  const meta = user?.user_metadata || {}
  const avatarUrl = meta.avatar_url || meta.picture || null
  const displayName = profile ? `${profile.nome} ${profile.sobrenome}`.trim() : '…'
  const initials = profile ? (profile.nome[0] || '') + (profile.sobrenome[0] || '') : '…'
  const rank = RANK_CONFIG[profile?.categoria || 'bronze'] || RANK_CONFIG.bronze
  const refCode = profile ? profile.id.replace(/-/g, '').slice(0, 10) : ''
  const refBase = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) || (typeof window !== 'undefined' ? window.location.origin : '')
  const refLink = profile ? `${refBase}/cadastro?ref=${refCode}` : ''

  // Comissão stats
  const commPending = comissoes.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.valor), 0)
  const commPaid    = comissoes.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor), 0)
  const activeIndic = indicacoes.filter(i => i.status !== 'fechado' && i.status !== 'perdido').length

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const notifCount = indicacoes.filter(i => ['em_contato', 'proposta'].includes(i.status)).length

  function navItem(v: View, label: string, icon: React.ReactNode, badge?: React.ReactNode) {
    return (
      <button
        key={v}
        className={`${styles.sbItem} ${view === v ? styles.active : ''}`}
        onClick={() => setView(v)}
      >
        <span className={styles.sbIcon}>{icon}</span>
        {label}
        {badge}
      </button>
    )
  }

  if (loadingProfile) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#7a8470', fontSize: 14 }}>
        Carregando…
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      {/* Toast */}
      <div className={`${styles.toast} ${toastVisible ? styles.toastShow : ''}`}>{toast}</div>

      {/* Sidebar */}
      <nav className={styles.sidebar}>
        <div className={styles.sbLogo}>
          <img src="/images/Hart_Tipografico_04.png" alt="HART" />
        </div>
        {/* Mobile: section title + bell + avatar shown in top bar */}
        <span className={styles.mobileNavTitle}>{view.charAt(0).toUpperCase() + view.slice(1)}</span>
        <button className={styles.mobileNotifBtn} onClick={() => setView('dashboard')} aria-label="Notificações">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 0 0 8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.5 10.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          {notifCount > 0 && <span className={styles.notifDot}>{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>
        <div className={styles.mobileNavAvatar}>
          {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : initials}
        </div>

        <div className={styles.sbUser}>
          <div className={styles.sbUserRow}>
            <div className={styles.sbAvatar}>
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : initials}
            </div>
            <div>
              <div className={styles.sbName}>{displayName}</div>
            </div>
          </div>
          <div>
            <span className={styles.sbRankPill}>{rank.emoji} {rank.label}</span>
          </div>
        </div>

        <div className={styles.sbNav}>
          <div className={styles.sbSectionLabel}>Principal</div>
          {navItem('dashboard', 'Dashboard',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>
          )}
          {navItem('indicacoes', 'Indicações',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 13L13 2M13 2H6M13 2V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
            <span className={styles.sbBadge}>{indicacoes.length}</span>
          )}
          {navItem('comissoes', 'Comissões',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 4.5V7.5L9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          )}
          <div className={styles.sbSectionLabel}>Crescimento</div>
          {navItem('missoes', 'Missões',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L9.5 5.5H14L10.5 8.5L12 13L7.5 10.5L3 13L4.5 8.5L1 5.5H5.5L7.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
          )}
          {navItem('ranking', 'Ranking',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 13V8M7.5 13V3M12 13V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          )}
          {navItem('rede', 'Minha Rede',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="2.5" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.3"/><circle cx="12.5" cy="11.5" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 5.5V8.5M7.5 8.5L2.5 9.5M7.5 8.5L12.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          )}
          <div className={styles.sbSectionLabel}>Recursos</div>
          {navItem('materiais', 'Materiais',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6H10M5 8.5H10M5 11H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          )}
        </div>

        <div className={styles.sbFooter}>
          {navItem('perfil', 'Meu Perfil',
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          )}
          <button className={styles.sbItem} onClick={doLogout}>
            <span className={styles.sbIcon}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M9 2H12.5C13 2 13.5 2.5 13.5 3V12C13.5 12.5 13 13 12.5 13H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5.5 10L2 7.5L5.5 5M2 7.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            Sair
          </button>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className={styles.mobileNav}>
        <button className={`${styles.mobileNavItem} ${view === 'dashboard' ? styles.active : ''}`} onClick={() => setView('dashboard')}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/></svg>
          <span>Início</span>
        </button>
        <button className={`${styles.mobileNavItem} ${view === 'indicacoes' ? styles.active : ''}`} onClick={() => setView('indicacoes')}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none"><path d="M2 13L13 2M13 2H6M13 2V9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span>Indicar</span>
        </button>
        <button className={`${styles.mobileNavItem} ${view === 'comissoes' ? styles.active : ''}`} onClick={() => setView('comissoes')}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 4v3l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>Comissões</span>
        </button>
        <button className={`${styles.mobileNavItem} ${view === 'ranking' ? styles.active : ''}`} onClick={() => setView('ranking')}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none"><path d="M3 13V8M7.5 13V3M12 13V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>Ranking</span>
        </button>
        <button className={`${styles.mobileNavItem} ${view === 'perfil' ? styles.active : ''}`} onClick={() => setView('perfil')}>
          <svg width="20" height="20" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>Perfil</span>
        </button>
      </nav>

      {/* Main */}
      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.topbarBreadcrumb}>
            HART Parceiros <span style={{ opacity: .4 }}>›</span> <strong>{view.charAt(0).toUpperCase() + view.slice(1)}</strong>
          </div>
          <div className={styles.topbarRight}>
            <button className={styles.notifBtn} onClick={() => setView('dashboard')} aria-label="Notificações">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5A4.5 4.5 0 0 0 3.5 6v2.5L2 10.5h12L12.5 8.5V6A4.5 4.5 0 0 0 8 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6.5 10.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              {notifCount > 0 && <span className={styles.notifDot}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>
            <div className={styles.topbarAvatar}>
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : initials}
            </div>
          </div>
        </div>

        <div className={styles.content}>

          {/* ═══ DASHBOARD ═══ */}
          {view === 'dashboard' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Painel de Parceiro</p>
                  <h1 className={styles.pageTitle}>Bem-vindo, <strong>{profile?.nome || '…'}</strong></h1>
                </div>
                <p className={styles.textMuted} style={{ fontSize: 12 }}>{today}</p>
              </div>

              {/* Link de indicação */}
              <div className={styles.linkHighlight}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.linkHighlightLabel}>Seu link de indicação</p>
                  <p className={styles.linkHighlightUrl}>{refLink || 'carregando…'}</p>
                </div>
                <button className={styles.copyBtn} onClick={copyLink}>Copiar link</button>
              </div>

              {/* KPIs */}
              <div className={`${styles.grid4} ${styles.mb20}`}>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Ganho direto</p>
                  <p className={styles.kpiValue}>{fmtBRL(commPaid)}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Total recebido</p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>A receber</p>
                  <p className={styles.kpiValue}>{fmtBRL(commPending)}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Pendente</p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Indicações ativas</p>
                  <p className={styles.kpiValue}>{activeIndic}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Em andamento</p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Total indicações</p>
                  <p className={styles.kpiValue}>{indicacoes.length}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Histórico</p>
                </div>
              </div>

              {/* Rank + Recentes */}
              <div className={`${styles.grid12} ${styles.mb20}`}>
                <div className={styles.rankCard}>
                  <div className={styles.rankHeader}>
                    <div className={styles.rankBadgeLg}>{rank.emoji}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{rank.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{rank.mult} · {rank.layers}</p>
                    </div>
                  </div>
                  <div className={styles.divider} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div><p className={styles.textXs} style={{ color: 'var(--muted)' }}>Comissões</p><p className={styles.statNum}>{comissoes.length}</p></div>
                    <div style={{ textAlign: 'center' }}><p className={styles.textXs} style={{ color: 'var(--muted)' }}>Indicações</p><p className={styles.statNum}>{indicacoes.length}</p></div>
                    <div style={{ textAlign: 'right' }}><p className={styles.textXs} style={{ color: 'var(--muted)' }}>Ativas</p><p className={styles.statNum}>{activeIndic}</p></div>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb16}`}>
                    <p className={styles.sectionTitle} style={{ margin: 0 }}>Indicações recentes</p>
                    <span className={styles.linkText} onClick={() => setView('indicacoes')}>Ver todas →</span>
                  </div>
                  <div className={styles.indicList}>
                    {indicacoes.length === 0 ? (
                      <div className={styles.empty}>
                        <p className={styles.emptyIcon}>📋</p>
                        <p>Nenhuma indicação ainda</p>
                      </div>
                    ) : indicacoes.slice(0, 5).map(i => (
                      <div key={i.id} className={styles.indicRow}>
                        <div className={styles.indicAvatar}>{i.nome_lead[0]}</div>
                        <div className={styles.indicInfo}>
                          <p className={styles.indicName}>{i.nome_lead}</p>
                          <p className={styles.indicAddr}>{i.endereco_imovel || '—'}</p>
                        </div>
                        {statusPill(i.status)}
                        <p className={styles.indicDate}>{fmtDate(i.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Comissões pendentes */}
              <div className={styles.grid2}>
                <div className={styles.card}>
                  <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb16}`}>
                    <p className={styles.sectionTitle} style={{ margin: 0 }}>Próximo pagamento</p>
                    <span className={`${styles.commStatusTag} ${styles.tagPending}`}>Pendente</span>
                  </div>
                  <p className={styles.textXs} style={{ color: 'var(--muted)', marginBottom: 4 }}>Valor a receber</p>
                  <p style={{ fontFamily: 'var(--font-d)', fontSize: 34, fontWeight: 500, fontStyle: 'italic', color: 'var(--text)' }}>{fmtBRL(commPending)}</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Previsão: <strong style={{ color: 'var(--text)' }}>Até dia 20</strong></p>
                  <div className={styles.divider} />
                  {comissoes.filter(c => c.status === 'pendente').length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Nenhuma comissão pendente.</p>
                  ) : comissoes.filter(c => c.status === 'pendente').map(c => (
                    <div key={c.id} className={styles.extratoRow}>
                      <div className={styles.extratoIcon}>💰</div>
                      <div className={styles.extratoInfo}>
                        <p className={styles.extratoLabel}>Comissão</p>
                        <p className={styles.extratoSub}>{fmtDate(c.created_at)}</p>
                      </div>
                      <div className={styles.extratoValue}>
                        <p className={`${styles.extratoAmount}`}>{fmtBRL(Number(c.valor))}</p>
                        <span className={`${styles.commStatusTag} ${styles.tagPending}`}>Pendente</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.card}>
                  <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb16}`}>
                    <p className={styles.sectionTitle} style={{ margin: 0 }}>Notificações</p>
                  </div>
                  <div className={styles.notifList}>
                    <div className={`${styles.notifItem} ${styles.unread}`}>
                      <div className={`${styles.notifIcon} ${styles.niGreen}`}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3" stroke="#3B6D11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p className={styles.notifTitle}>Conta ativa</p>
                        <p className={styles.notifSub}>Compartilhe seu link para começar a indicar.</p>
                      </div>
                    </div>
                    <div className={styles.notifItem}>
                      <div className={`${styles.notifIcon} ${styles.niRose}`}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.5L8.5 5H12.5L9.5 7.5L10.5 11L7 9L3.5 11L4.5 7.5L1.5 5H5.5L7 1.5Z" stroke="#A88690" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p className={styles.notifTitle}>Complete seu perfil</p>
                        <p className={styles.notifSub}>Atualize seus dados para maximizar suas comissões.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ INDICAÇÕES ═══ */}
          {view === 'indicacoes' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Gestão</p>
                  <h1 className={styles.pageTitle}>Indicações</h1>
                </div>
              </div>

              <div className={`${styles.card} ${styles.mb20}`}>
                <p className={`${styles.sectionTitle} ${styles.mb16}`}>Nova indicação de proprietário</p>
                <div className={styles.formRow2}>
                  <div className={styles.formField}><label>Nome do proprietário *</label><input type="text" value={inNome} onChange={e => setInNome(e.target.value)} placeholder="Nome completo" maxLength={100}/></div>
                  <div className={styles.formField}><label>Telefone / WhatsApp *</label><input type="tel" value={inTel} onChange={e => setInTel(e.target.value)} placeholder="(11) 99999-9999" maxLength={20}/></div>
                </div>
                <div className={styles.formRow2}>
                  <div className={styles.formField}><label>E-mail</label><input type="email" value={inEmail} onChange={e => setInEmail(e.target.value)} placeholder="email@exemplo.com" maxLength={100}/></div>
                  <div className={styles.formField}>
                    <label>Tipo de serviço</label>
                    <select value={inServico} onChange={e => setInServico(e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="mobilia">Mobília (Ready-to-Live)</option>
                      <option value="administracao">Gestão (Administração)</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>
                <div className={styles.formField}><label>Endereço do imóvel *</label><input type="text" value={inEndereco} onChange={e => setInEndereco(e.target.value)} placeholder="Rua, número, bairro — São Paulo, SP" maxLength={200}/></div>
                <div className={styles.formField}><label>Observações</label><textarea value={inObs} onChange={e => setInObs(e.target.value)} placeholder="Contexto adicional…" maxLength={500}/></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button className={styles.btnSubmit} onClick={submitIndicacao} disabled={submitLoading}>
                    {submitLoading ? 'Enviando…' : '↗ Enviar indicação'}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>A Hart entra em contato em até 24h úteis.</p>
                </div>
              </div>

              <div className={styles.card}>
                <p className={`${styles.sectionTitle} ${styles.mb16}`}>Histórico de indicações</p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr><th>Proprietário</th><th>Imóvel</th><th>Status</th><th>Data</th></tr>
                    </thead>
                    <tbody>
                      {indicacoes.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Nenhuma indicação ainda.</td></tr>
                      ) : indicacoes.map(i => (
                        <tr key={i.id}>
                          <td>
                            <div>{i.nome_lead}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{i.email_lead || i.telefone_lead}</div>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--muted)' }}>{i.endereco_imovel || '—'}</td>
                          <td>{statusPill(i.status)}</td>
                          <td style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(i.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ COMISSÕES ═══ */}
          {view === 'comissoes' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Financeiro</p>
                  <h1 className={styles.pageTitle}>Comissões</h1>
                </div>
              </div>
              <div className={`${styles.grid3} ${styles.mb20}`}>
                <div className={styles.kpiCard} style={{ borderColor: 'rgba(59,109,17,.25)', background: 'rgba(59,109,17,.03)' }}>
                  <p className={styles.kpiLabel}>Total a receber</p>
                  <p className={styles.kpiValue} style={{ color: 'var(--success)' }}>{fmtBRL(commPending)}</p>
                  <p className={styles.kpiChange}>Aguardando pagamento</p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Já recebido</p>
                  <p className={styles.kpiValue}>{fmtBRL(commPaid)}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Histórico total</p>
                </div>
                <div className={styles.kpiCard}>
                  <p className={styles.kpiLabel}>Total de comissões</p>
                  <p className={styles.kpiValue}>{comissoes.length}</p>
                  <p className={`${styles.kpiChange} ${styles.neutral}`}>Registros</p>
                </div>
              </div>
              <div className={styles.card}>
                <p className={`${styles.sectionTitle} ${styles.mb16}`}>Extrato de comissões</p>
                {comissoes.length === 0 ? (
                  <div className={styles.empty}><p className={styles.emptyIcon}>💳</p><p>Nenhuma comissão registrada ainda.</p></div>
                ) : comissoes.map(c => (
                  <div key={c.id} className={styles.extratoRow}>
                    <div className={styles.extratoIcon}>💰</div>
                    <div className={styles.extratoInfo}>
                      <p className={styles.extratoLabel}>Comissão</p>
                      <p className={styles.extratoSub}>{fmtDate(c.created_at)}</p>
                    </div>
                    <div className={styles.extratoValue}>
                      <p className={`${styles.extratoAmount} ${c.status === 'pago' ? styles.green : ''}`}>{fmtBRL(Number(c.valor))}</p>
                      <span className={`${styles.commStatusTag} ${c.status === 'pago' ? styles.tagPaid : styles.tagPending}`}>
                        {c.status === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>Pagamentos via PIX ou TED até o 20º dia útil após o fechamento do contrato.</p>
            </div>
          )}

          {/* ═══ RANKING ═══ */}
          {view === 'ranking' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Crescimento</p>
                  <h1 className={styles.pageTitle}>Ranking</h1>
                </div>
              </div>
              <div className={styles.card}>
                <p className={`${styles.sectionTitle} ${styles.mb16}`}>Hierarquia de níveis</p>
                {[
                  { key: 'bronze',  emoji: '◈', label: 'Bronze',  desc: 'Perfil completo · 2 layers',              mult: '0.75×' },
                  { key: 'prata',   emoji: '◇', label: 'Prata',   desc: '1 venda ou 3 indicações · 3 layers',     mult: '1×'    },
                  { key: 'ouro',    emoji: '◆', label: 'Ouro',    desc: '5 vendas ou 10 indicações · 4 layers',   mult: '1.10×' },
                  { key: 'platina', emoji: '✦', label: 'Platina', desc: '10 vendas de mobília · 5 layers',        mult: '1.25×' },
                ].map(tier => (
                  <div key={tier.key} className={`${styles.rankTier} ${profile?.categoria === tier.key ? styles.current : ''}`}>
                    <div className={styles.rankTierBadge}>{tier.emoji}</div>
                    <div className={styles.rankTierInfo}>
                      <p className={styles.rankTierName}>{tier.label}</p>
                      <p className={styles.rankTierDesc}>{tier.desc}</p>
                    </div>
                    <div className={styles.rankTierMult}>{tier.mult}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ REDE ═══ */}
          {view === 'rede' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Crescimento</p>
                  <h1 className={styles.pageTitle}>Minha Rede</h1>
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{rede.length} parceiro{rede.length !== 1 ? 's' : ''}</span>
              </div>

              <div className={`${styles.card} ${styles.mb20}`} style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Seu link de indicação</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refLink || '—'}</p>
                </div>
                <button className={styles.btnSubmit} onClick={copyLink}>Copiar link</button>
              </div>

              <div className={styles.card}>
                <p className={`${styles.sectionTitle} ${styles.mb16}`}>Parceiros cadastrados com seu link</p>
                {rede.length === 0 ? (
                  <div className={styles.empty}>
                    <p className={styles.emptyIcon}>🌐</p>
                    <p>Nenhum parceiro na sua rede ainda.<br/>Compartilhe seu link para começar a crescer!</p>
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table>
                      <thead>
                        <tr><th>Parceiro</th><th>E-mail</th><th>Nível</th><th>Cadastro</th></tr>
                      </thead>
                      <tbody>
                        {rede.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className={styles.indicAvatar} style={{ fontSize: 11 }}>{r.nome[0]}</div>
                                <span>{r.nome} {r.sobrenome}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.email}</td>
                            <td>
                              <span className={styles.sbRankPill}>{RANK_CONFIG[r.categoria]?.emoji} {RANK_CONFIG[r.categoria]?.label}</span>
                            </td>
                            <td style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(r.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ MISSÕES ═══ */}
          {view === 'missoes' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Crescimento</p>
                  <h1 className={styles.pageTitle}>Missões</h1>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.empty}>
                  <p className={styles.emptyIcon}>🎯</p>
                  <p>Novas missões em breve! Fique atento ao seu painel.</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ MATERIAIS ═══ */}
          {view === 'materiais' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Recursos</p>
                  <h1 className={styles.pageTitle}>Materiais</h1>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.empty}>
                  <p className={styles.emptyIcon}>📄</p>
                  <p>Materiais de marketing em breve!</p>
                </div>
              </div>
            </div>
          )}

          {/* ═══ PERFIL ═══ */}
          {view === 'perfil' && (
            <div>
              <div className={styles.pageHeader}>
                <div>
                  <p className={styles.eyebrow}>Conta</p>
                  <h1 className={styles.pageTitle}>Meu Perfil</h1>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.perfilAvatarZone}>
                  <label style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }} title="Alterar foto">
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f) }} />
                    <div className={styles.perfilAvatarLg} style={{ opacity: uploadingAvatar ? 0.5 : 1 }}>
                      {avatarUrl ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 7.5L3 5.5L5.5 8L7 6.5L9 8.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="3" cy="3" r="1.5" stroke="white" strokeWidth="1.2"/></svg>
                    </div>
                  </label>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600 }}>{displayName}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{profile?.email}</p>
                    <span className={styles.sbRankPill} style={{ marginTop: 6, display: 'inline-flex' }}>{rank.emoji} {rank.label}</span>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Clique na foto para alterar</p>
                  </div>
                </div>

                <div className={styles.perfilSectionTitle}>Informações pessoais</div>
                <div className={styles.pfRow}>
                  <div className={styles.pfField}>
                    <label>Nome</label>
                    <input type="text" value={pfNome} onChange={e => setPfNome(e.target.value)} maxLength={60} />
                  </div>
                  <div className={styles.pfField}>
                    <label>Sobrenome</label>
                    <input type="text" value={pfSobrenome} onChange={e => setPfSobrenome(e.target.value)} maxLength={60} />
                  </div>
                </div>
                <div className={styles.pfField}>
                  <label>E-mail</label>
                  <input type="email" value={profile?.email || ''} disabled />
                  <p className={styles.pfHint}>O e-mail não pode ser alterado aqui.</p>
                </div>
                <div className={styles.pfField}>
                  <label>Telefone / WhatsApp</label>
                  <input type="tel" value={pfTel} onChange={e => setPfTel(e.target.value)} placeholder="(11) 9 0000-0000" maxLength={20}/>
                </div>
                <div className={styles.pfField}>
                  <label>Imobiliária</label>
                  <input type="text" value={pfImob} onChange={e => setPfImob(e.target.value)} placeholder="Opcional" maxLength={100}/>
                </div>

                <div className={styles.perfilSectionTitle} style={{ marginTop: 20 }}>Seu código de indicação</div>
                <div className={styles.linkHighlight} style={{ marginBottom: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.linkHighlightLabel}>Link de indicação</p>
                    <p className={styles.linkHighlightUrl}>{refLink || '—'}</p>
                  </div>
                  <button className={styles.copyBtn} onClick={copyLink}>Copiar</button>
                </div>

                <div className={styles.saveBar}>
                  <button className={styles.btnSubmit} onClick={savePerfil} disabled={pfLoading}>
                    {pfLoading ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  {pfSaved && <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Salvo com sucesso</span>}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
