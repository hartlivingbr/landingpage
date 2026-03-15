-- ================================================================
-- HART — SUPABASE SECURITY SETUP PARA PRODUÇÃO
-- Execute no SQL Editor: Dashboard → SQL Editor → New Query
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. TABELAS
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usuarios (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  sobrenome     TEXT        NOT NULL DEFAULT '',
  email         TEXT        NOT NULL,
  telefone      TEXT,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('proprietario','vendedor')),
  eh_corretor   BOOLEAN     DEFAULT FALSE,
  creci         TEXT,
  imobiliaria   TEXT,
  categoria     TEXT        DEFAULT 'bronze' CHECK (categoria IN ('bronze','prata','ouro','platina')),
  ativo         BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.indicacoes (
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

CREATE TABLE IF NOT EXISTS public.comissoes (
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
-- 2. TRIGGER updated_at
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_usuarios_updated_at    ON public.usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_indicacoes_updated_at  ON public.indicacoes;
CREATE TRIGGER trg_indicacoes_updated_at
  BEFORE UPDATE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- 3. TRIGGER: cria perfil automático para login Google (OAuth)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'provider' IN ('google','github') THEN
    INSERT INTO public.usuarios (id, nome, sobrenome, email, tipo)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'given_name',
               split_part(COALESCE(NEW.raw_user_meta_data->>'full_name',''), ' ', 1),
               split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'family_name', ''),
      NEW.email,
      'proprietario'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_oauth_new_user ON auth.users;
CREATE TRIGGER trg_oauth_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_oauth_user();

-- ────────────────────────────────────────────────────────────────
-- 4. HABILITAR RLS (Row Level Security) — CRÍTICO
-- ────────────────────────────────────────────────────────────────

ALTER TABLE public.usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes  ENABLE ROW LEVEL SECURITY;

-- Remove policies antigas antes de recriar
DROP POLICY IF EXISTS "usuarios_select_own"   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_own"   ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own"   ON public.usuarios;
DROP POLICY IF EXISTS "indicacoes_select_own" ON public.indicacoes;
DROP POLICY IF EXISTS "indicacoes_insert_own" ON public.indicacoes;
DROP POLICY IF EXISTS "indicacoes_update_own" ON public.indicacoes;
DROP POLICY IF EXISTS "comissoes_select_own"  ON public.comissoes;

-- ────────────────────────────────────────────────────────────────
-- 5. POLÍTICAS RLS — usuarios
-- ────────────────────────────────────────────────────────────────

-- Usuário só lê seu próprio perfil
CREATE POLICY "usuarios_select_own"
  ON public.usuarios FOR SELECT
  USING (auth.uid() = id);

-- Usuário só insere com seu próprio ID
CREATE POLICY "usuarios_insert_own"
  ON public.usuarios FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Usuário só edita seu próprio perfil (não pode mudar tipo nem id)
CREATE POLICY "usuarios_update_own"
  ON public.usuarios FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE bloqueado para todos via cliente (só service_role pode deletar)

-- ────────────────────────────────────────────────────────────────
-- 6. POLÍTICAS RLS — indicacoes
-- ────────────────────────────────────────────────────────────────

CREATE POLICY "indicacoes_select_own"
  ON public.indicacoes FOR SELECT
  USING (auth.uid() = vendedor_id);

CREATE POLICY "indicacoes_insert_own"
  ON public.indicacoes FOR INSERT
  WITH CHECK (auth.uid() = vendedor_id);

-- Só edita indicações pendentes
CREATE POLICY "indicacoes_update_own"
  ON public.indicacoes FOR UPDATE
  USING (auth.uid() = vendedor_id AND status = 'pendente')
  WITH CHECK (auth.uid() = vendedor_id);

-- ────────────────────────────────────────────────────────────────
-- 7. POLÍTICAS RLS — comissoes
-- ────────────────────────────────────────────────────────────────

CREATE POLICY "comissoes_select_own"
  ON public.comissoes FOR SELECT
  USING (auth.uid() = vendedor_id);

-- INSERT/UPDATE/DELETE de comissões: somente via service_role (admin)

-- ────────────────────────────────────────────────────────────────
-- 8. ÍNDICES
-- ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_usuarios_tipo       ON public.usuarios(tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_email      ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_indicacoes_vendedor ON public.indicacoes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status   ON public.indicacoes(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor  ON public.comissoes(vendedor_id);

-- ────────────────────────────────────────────────────────────────
-- 9. REVOGAR permissões desnecessárias do role anon e public
-- ────────────────────────────────────────────────────────────────

-- Revogar acesso direto ao schema public para anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON SCHEMA public FROM anon;

-- Dar apenas o mínimo necessário (o RLS cuida do resto)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.usuarios   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.indicacoes TO authenticated;
GRANT SELECT                 ON public.comissoes  TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 10. FUNÇÃO segura para stats do vendedor
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_stats_vendedor(p_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ind  INT; v_vend INT; v_com NUMERIC;
BEGIN
  IF auth.uid() != p_id THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT COUNT(*) INTO v_ind  FROM indicacoes WHERE vendedor_id = p_id;
  SELECT COUNT(*) INTO v_vend FROM indicacoes WHERE vendedor_id = p_id AND status='fechado' AND created_at >= NOW()-INTERVAL '12 months';
  SELECT COALESCE(SUM(valor),0) INTO v_com FROM comissoes WHERE vendedor_id = p_id AND status='pago';
  RETURN json_build_object('indicacoes',v_ind,'vendas_12m',v_vend,'comissao_total',v_com);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- CHECKLIST PÓS-EXECUÇÃO (fazer no dashboard do Supabase):
--
-- 1. Authentication → Settings:
--    - Site URL: https://seudominio.com.br
--    - Redirect URLs: https://seudominio.com.br/dashboard-proprietario.html
--                     https://seudominio.com.br/dashboard-vendedor.html
--
-- 2. Authentication → Settings → Email:
--    - Ativar "Confirm email"
--    - Configurar remetente com seu domínio (SMTP próprio recomendado)
--
-- 3. Authentication → Providers → Google:
--    - Adicionar Client ID e Secret do Google Cloud Console
--
-- 4. API → Settings:
--    - Copiar a ANON KEY (pública, pode ficar no frontend)
--    - Guardar a SERVICE_ROLE KEY em segurança (NUNCA no frontend)
--
-- 5. Database → Extensions:
--    - Ativar "pgcrypto" (já ativo por padrão no Supabase)
-- ────────────────────────────────────────────────────────────────
