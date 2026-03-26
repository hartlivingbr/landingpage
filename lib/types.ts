export type Categoria = 'bronze' | 'prata' | 'ouro' | 'platina'
export type TipoUsuario = 'vendedor' | 'proprietario'
export type StatusIndicacao = 'pendente' | 'em_contato' | 'proposta' | 'fechado' | 'perdido'
export type StatusComissao = 'pendente' | 'pago' | 'cancelado'

export interface Usuario {
  id: string
  user_id: string
  tipo: TipoUsuario
  nome: string
  sobrenome: string
  email: string
  telefone: string | null
  eh_corretor: boolean
  creci: string | null
  imobiliaria: string | null
  categoria: Categoria
  referido_por: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Indicacao {
  id: string
  vendedor_id: string
  nome_lead: string
  email_lead: string | null
  telefone_lead: string
  endereco_imovel: string | null
  observacoes: string | null
  status: StatusIndicacao
  created_at: string
  updated_at: string
}

export interface Comissao {
  id: string
  vendedor_id: string
  indicacao_id: string | null
  valor: number
  status: StatusComissao
  pago_em: string | null
  created_at: string
}
