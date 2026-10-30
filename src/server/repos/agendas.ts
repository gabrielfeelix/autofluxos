import 'server-only'
import type { AgendaComConector } from '@/core/sistemas-dos-ramos'
import { db, ehIdInvalido } from '../db'

/**
 * As agendas de fora ligadas à conta (0158, `agendas_conectadas`). Uma linha
 * por plataforma. A credencial mora em `connections` (cofre); o que não é
 * segredo fica em `ajustes`. Aqui é só a ida ao banco.
 */

export type AgendaConectada = {
  id: string
  clienteId: string
  plataforma: AgendaComConector
  conexaoId: string | null
  ajustes: Record<string, string | number>
  ativo: boolean
  conferidoEm: string | null
  criadoEm: string
}

type Linha = {
  id: string
  client_id: string
  plataforma: AgendaComConector
  conexao_id: string | null
  ajustes: Record<string, string | number> | null
  ativo: boolean
  conferido_em: string | null
  criado_em: string
}

const COLUNAS = 'id, client_id, plataforma, conexao_id, ajustes, ativo, conferido_em, criado_em'

const paraAgenda = (l: Linha): AgendaConectada => ({
  id: l.id,
  clienteId: l.client_id,
  plataforma: l.plataforma,
  conexaoId: l.conexao_id,
  ajustes: l.ajustes ?? {},
  ativo: l.ativo,
  conferidoEm: l.conferido_em,
  criadoEm: l.criado_em,
})

/** Código no ar antes da 0158 lê "nenhuma agenda". */
const tabelaAusente = (error: { code?: string } | null) => error?.code === '42P01' || error?.code === 'PGRST205'

export async function agendasDaConta(clienteId: string): Promise<AgendaConectada[]> {
  const { data, error } = await db()
    .from('agendas_conectadas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: false })
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler as agendas conectadas: ${error.message}`)
  return (data as Linha[]).map(paraAgenda)
}

/** A agenda que a IA usa: a ligada mais recente, com credencial. */
export async function agendaAtivaDaConta(clienteId: string): Promise<AgendaConectada | null> {
  return (await agendasDaConta(clienteId)).find((a) => a.ativo && a.conexaoId) ?? null
}

export async function salvarAgenda(entrada: {
  clienteId: string
  plataforma: AgendaComConector
  conexaoId: string | null
  ajustes: Record<string, string | number>
  ativo: boolean
  conferidoEm?: Date
}): Promise<AgendaConectada> {
  const { data, error } = await db()
    .from('agendas_conectadas')
    .upsert(
      {
        client_id: entrada.clienteId,
        plataforma: entrada.plataforma,
        conexao_id: entrada.conexaoId,
        ajustes: entrada.ajustes,
        ativo: entrada.ativo,
        ...(entrada.conferidoEm ? { conferido_em: entrada.conferidoEm.toISOString() } : {}),
      },
      { onConflict: 'client_id,plataforma' },
    )
    .select(COLUNAS)
    .single()
  if (error) throw new Error(`não foi possível salvar a agenda: ${error.message}`)
  return paraAgenda(data as Linha)
}
