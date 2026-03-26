-- ================================================================
-- HART — SUPABASE SECURITY SETUP v2
-- Execute no SQL Editor: Dashboard → SQL Editor → New Query
-- ================================================================
-- NOVIDADE v2: mesmo e-mail pode ter perfil de vendedor E proprietário
-- simultaneamente. A chave única é (user_id, tipo).
-- ================================================================

-- ⚠️  ATENÇÃO: este script recria as tabelas do zero.
--     Faça backup dos dados existentes antes de executar.

DROP TABLE IF EXISTS public.comissoes   CASCADE;
DROP TABLE IF EXISTS public.indicacoes  CASCADE;
DROP TABLE IF EXISTS public.usuarios    CASCADE;

-- ────────────────────────────────────────────────────────────────
-- 1. TABELA USUARIOS
-- ────────────────────────────────────────────────────────────────
-- id       → UUID gerado (PK independente do auth.users)
-- user_id  → referencia auth.users (o "dono" da conta)
-- tipo     → 'vendedor' | 'proprietario'
-- A mesma pessoa pode ter um registro de cada tipo.

CREATE TABLE public.usuarios (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL CHECK (tipo IN ('proprietario','vendedor')),
  nome        TEXT        NOT NULL,
  sobrenome   TEXT        NOT NULL DEFAULT '',
  email       TEXT        NOT NULL,
  telefone    TEXT,
  eh_corretor BOOLEAN     DEFAULT FALSE,
  creci       TEXT,
  imobiliaria TEXT,
  categoria   TEXT        DEFAULT 'bronze'
              CHECK (categoria IN ('bronze','prata','ouro','platina')),
  referido_por TEXT,
  ativo       BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, tipo)
);

-- ────────────────────────────────────────────────────────────────
-- 2. TABELA INDICACOES
-- ────────────────────────────────────────────────────────────────

CREATE TABLE public.indicacoes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  nome_lead       TEXT        NOT NULL,
  email_lead      TEXT,
  telefone_lead   TEXT        NOT NULL,
  endereco_imovel TEXT,
  observacoes     TEXT,
  status          TEXT        NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente','em_contato','proposta','fechado','perdido')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 3. TABELA COMISSOES
-- ────────────────────────────────────────────────────────────────

CREATE TABLE public.comissoes (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id  UUID          NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  indicacao_id UUID          REFERENCES public.indicacoes(id),
  valor        NUMERIC(12,2) NOT NULL,
  status       TEXT          NOT NULL DEFAULT 'pendente'
               CHECK (status IN ('pendente','pago','cancelado')),
  pago_em      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- 4. TRIGGER updated_at
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated_at   ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_indicacoes_updated_at ON public.indicacoes;
CREATE TRIGGER trg_indicacoes_updated_at
  BEFORE UPDATE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- 5. REMOVER TRIGGER OAuth antigo
--    O perfil agora é criado pelo dashboard/login, não por trigger.
-- ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_oauth_new_user ON auth.users;

-- ────────────────────────────────────────────────────────────────
-- 6. HABILITAR RLS
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes  ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 7. POLÍTICAS RLS — usuarios
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "usuarios_select_own"   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_own"   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"   ON public.usuarios;

-- Usuário vê todos os seus perfis (vendedor e/ou proprietário)
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT
  USING (user_id = auth.uid());

-- Só pode inserir perfil com seu próprio user_id
CREATE POLICY "usuarios_insert_own"
  ON public.usuarios FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Só pode editar seus próprios perfis
CREATE POLICY "usuarios_update_own"
  ON public.usuarios FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE bloqueado para o cliente (só service_role pode deletar)

-- ────────────────────────────────────────────────────────────────
-- 8. POLÍTICAS RLS — indicacoes
--    vendedor_id referencia usuarios.id (UUID gerado),
--    não auth.users.id — por isso usamos subquery para checar.
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "indicacoes_select_own" ON public.indicacoes;
DROP POLICY IF EXISTS "indicacoes_insert_own" ON public.indicacoes;
DROP POLICY IF EXISTS "indicacoes_update_own" ON public.indicacoes;

CREATE POLICY "indicacoes_select_own"
  ON public.indicacoes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = indicacoes.vendedor_id AND u.user_id = auth.uid()
  ));

CREATE POLICY "indicacoes_insert_own"
  ON public.indicacoes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = vendedor_id AND u.user_id = auth.uid()
  ));

CREATE POLICY "indicacoes_update_own"
  ON public.indicacoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = indicacoes.vendedor_id AND u.user_id = auth.uid()
    )
    AND status = 'pendente'
  )
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = indicacoes.vendedor_id AND u.user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────────
-- 9. POLÍTICAS RLS — comissoes
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "comissoes_select_own" ON public.comissoes;

CREATE POLICY "comissoes_select_own"
  ON public.comissoes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = comissoes.vendedor_id AND u.user_id = auth.uid()
  ));

-- INSERT/UPDATE/DELETE de comissões: somente via service_role (admin)

-- ────────────────────────────────────────────────────────────────
-- 10. ÍNDICES
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_usuarios_user_id   ON public.usuarios(user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo       ON public.usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email      ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_indicacoes_vendedor ON public.indicacoes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status   ON public.indicacoes(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor  ON public.comissoes(vendedor_id);

-- ────────────────────────────────────────────────────────────────
-- 11. PERMISSÕES
-- ────────────────────────────────────────────────────────────────

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM anon;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usuarios   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.indicacoes TO authenticated;
GRANT SELECT                  ON public.comissoes  TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 12. FUNÇÃO STATS DO VENDEDOR
-- ────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_stats_vendedor(UUID);

CREATE OR REPLACE FUNCTION public.get_stats_vendedor(p_profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID;
  v_ind  INT;
  v_vend INT;
  v_com  NUMERIC;
BEGIN
  -- Confirma que o perfil pertence ao usuário logado
  SELECT user_id INTO v_uid FROM usuarios WHERE id = p_profile_id;
  IF v_uid IS NULL OR v_uid != auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COUNT(*) INTO v_ind
    FROM indicacoes WHERE vendedor_id = p_profile_id;

  SELECT COUNT(*) INTO v_vend
    FROM indicacoes
    WHERE vendedor_id = p_profile_id
      AND status = 'fechado'
      AND created_at >= NOW() - INTERVAL '12 months';

  SELECT COALESCE(SUM(valor), 0) INTO v_com
    FROM comissoes WHERE vendedor_id = p_profile_id AND status = 'pago';

  RETURN json_build_object(
    'indicacoes',    v_ind,
    'vendas_12m',    v_vend,
    'comissao_total', v_com
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- CHECKLIST PÓS-EXECUÇÃO (fazer no dashboard do Supabase):
--
-- 1. Authentication → Settings:
--    - Site URL: https://seudominio.com.br
--    - Redirect URLs:
--        https://seudominio.com.br/dashboard-vendedor.html
--        https://seudominio.com.br/dashboard-proprietario.html
--
-- 2. Authentication → Settings → Email:
--    - Ativar "Confirm email"
--
-- 3. Authentication → Providers → Google:
--    - Client ID e Secret do Google Cloud Console
--
-- 4. API → Settings:
--    - ANON KEY → frontend (pública, ok no código)
--    - SERVICE_ROLE KEY → nunca no frontend
-- ────────────────────────────────────────────────────────────────
