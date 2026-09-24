import 'server-only'
import type { Evento } from '@/core/crm'
import { eventoDoNegocio } from '@/core/negocios'
import { db, ehIdInvalido } from '../db'

/**
 * O histórico de um negócio (F2 do plano de 24/09).
 *
 * Os eventos moram no contato (`eventos_do_contato`, 0058), e não havia
 * `cartao_id` na tabela. Não foi preciso migration: desde a 0072 os eventos
 * que falam de um negócio levam `dados.cartaoId`, e mover, assumir, avaliar e
 * anotar pela página passaram a levar também. Ver `eventoDoNegocio`.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Do mais novo para o mais velho, só a partir de quando o negócio nasceu.
 *
 * A data corta o passado da pessoa (a conversa de um negócio de 2025 não é
 * deste), e o `cartaoId` corta os outros negócios dela no mesmo período.
 * Teto de 200: é a aba Histórico, não um arquivo morto.
 */
export async function historicoDoNegocio(
  clienteId: string,
  contatoId: string,
  cartaoId: string,
  desde: string | undefined,
  limite = 200,
): Promise<Evento[]> {
  // O id vai dentro de um filtro `or` em texto; só uuid entra ali.
  if (!UUID.test(cartaoId)) return []

  let consulta = db()
    .from('eventos_do_contato')
    .select('id, tipo, dados, autor, criado_em')
    .eq('client_id', clienteId)
    .eq('contato_id', contatoId)
    .or(`dados->>cartaoId.is.null,dados->>cartaoId.eq.${cartaoId}`)
    .order('criado_em', { ascending: false })
    .limit(limite)

  // Um minuto de folga: o "entrou no funil" é gravado junto do cartão, e o
  // relógio do evento pode sair um tique antes do `criado_em` dele.
  if (desde) consulta = consulta.gte('criado_em', new Date(Date.parse(desde) - 60_000).toISOString())

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler o histórico do negócio: ${error.message}`)

  return (
    data as {
      id: string
      tipo: string
      dados: Record<string, unknown> | null
      autor: string | null
      criado_em: string
    }[]
  )
    .map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      dados: linha.dados ?? {},
      autor: linha.autor,
      criadoEm: linha.criado_em,
    }))
    .filter((evento) => eventoDoNegocio(evento.dados, cartaoId))
}
