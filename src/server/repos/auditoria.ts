import 'server-only'
import { db, ehIdInvalido } from '../db'

/**
 * Quem fez o quê.
 *
 * A tabela é **append-only no banco** (migration 0021): `service_role` só tem
 * `insert` e `select`. Não existe função de apagar aqui porque não existe
 * permissão para apagar lá — um log que a aplicação consegue editar não prova
 * nada.
 */

export type AtoAuditado = {
  /** Verbo: `publicou_fluxo`, `apagou_contato`, `entrou_como`, `convidou_membro`. */
  acao: string
  autorId?: string | null
  /** Guardado como texto porque o usuário pode ser apagado depois do ato. */
  autorEmail?: string
  contaId?: string | null
  contaNome?: string
  alvoTipo?: string
  alvoId?: string
  /** O nome legível do alvo **no momento do ato**. */
  alvoNome?: string
  detalhes?: Record<string, unknown>
  /** Administrador dentro de um "entrar como". Nulo = foi a própria pessoa. */
  impersonadoPor?: string | null
  ip?: string
  agente?: string
}

export type LinhaDeAuditoria = AtoAuditado & { id: string; quando: string }

/**
 * Registra um ato. **Nunca estoura.**
 *
 * Auditoria que derruba a ação auditada é pior do que auditoria nenhuma: o
 * cliente perderia a publicação por causa do registro dela. Falhar aqui vira
 * log de erro, e o ato acontece. É a mesma escolha de `alertar()`.
 *
 * O outro lado dessa moeda: um `insert` que falha em silêncio é um buraco na
 * prova. Por isso o `console.error` é barulhento e nomeia a ação — quem for
 * investigar uma linha faltando encontra o motivo no log da função.
 */
export async function registrar(ato: AtoAuditado): Promise<void> {
  try {
    const { error } = await db()
      .from('af_auditoria')
      .insert({
        acao: ato.acao,
        autor_id: ato.autorId ?? null,
        autor_email: ato.autorEmail ?? '',
        conta_id: ato.contaId ?? null,
        conta_nome: ato.contaNome ?? '',
        alvo_tipo: ato.alvoTipo ?? '',
        alvo_id: ato.alvoId ?? '',
        alvo_nome: ato.alvoNome ?? '',
        detalhes: ato.detalhes ?? {},
        impersonado_por: ato.impersonadoPor ?? null,
        ip: ato.ip ?? '',
        agente: ato.agente ?? '',
      })

    if (error) throw new Error(error.message)
  } catch (erro) {
    console.error(
      `[auditoria] não deu para registrar "${ato.acao}"`,
      erro instanceof Error ? erro.message : erro,
    )
  }
}

type Linha = {
  id: string
  quando: string
  acao: string
  autor_id: string | null
  autor_email: string
  conta_id: string | null
  conta_nome: string
  alvo_tipo: string
  alvo_id: string
  alvo_nome: string
  detalhes: Record<string, unknown>
  impersonado_por: string | null
  ip: string
  agente: string
}

const COLUNAS =
  'id, quando, acao, autor_id, autor_email, conta_id, conta_nome, alvo_tipo, alvo_id, alvo_nome, detalhes, impersonado_por, ip, agente'

function paraAto(linha: Linha): LinhaDeAuditoria {
  return {
    id: linha.id,
    quando: linha.quando,
    acao: linha.acao,
    autorId: linha.autor_id,
    autorEmail: linha.autor_email,
    contaId: linha.conta_id,
    contaNome: linha.conta_nome,
    alvoTipo: linha.alvo_tipo,
    alvoId: linha.alvo_id,
    alvoNome: linha.alvo_nome,
    detalhes: linha.detalhes,
    impersonadoPor: linha.impersonado_por,
    ip: linha.ip,
    agente: linha.agente,
  }
}

/** Teto por página. Auditoria cresce para sempre; ninguém lê mil linhas. */
export const ATOS_POR_PAGINA = 100

/**
 * O que aconteceu numa conta, do mais novo para o mais velho.
 *
 * `contaId` ausente traz a plataforma inteira — é a tela do administrador.
 */
export async function listarAtos(
  opcoes: { contaId?: string; limite?: number } = {},
): Promise<LinhaDeAuditoria[]> {
  let consulta = db()
    .from('af_auditoria')
    .select(COLUNAS)
    .order('quando', { ascending: false })
    .limit(opcoes.limite ?? ATOS_POR_PAGINA)

  if (opcoes.contaId) consulta = consulta.eq('conta_id', opcoes.contaId)

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler a auditoria: ${error.message}`)
  return (data as Linha[]).map(paraAto)
}

/**
 * Só os atos feitos de dentro de um "entrar como".
 *
 * É a consulta que alguém vai fazer com pressa, e por isso ela tem índice
 * parcial próprio na 0021.
 */
export async function listarImpersonacoes(limite = ATOS_POR_PAGINA): Promise<LinhaDeAuditoria[]> {
  const { data, error } = await db()
    .from('af_auditoria')
    .select(COLUNAS)
    .not('impersonado_por', 'is', null)
    .order('quando', { ascending: false })
    .limit(limite)

  if (error) throw new Error(`não deu para ler as impersonações: ${error.message}`)
  return (data as Linha[]).map(paraAto)
}
