import 'server-only'
import type { EstadoDoMarketing, OrigemDoConsentimento } from '@/core/consentimento'
import { db, ehIdInvalido } from '../db'

/**
 * O registro de aceite e de saída (0059, `public.consentimentos`).
 *
 * **Só acrescenta, nunca altera.** A tabela é prova: quem aceitou pelo site em
 * agosto e pediu para sair em outubro tem as duas linhas, e o estado de hoje é
 * a mais recente. Atualizar a linha antiga apagaria justamente o que um dia
 * pode precisar ser mostrado.
 */

export type NovoConsentimento = {
  clienteId: string
  contatoId: string
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  aceito: boolean
  origem: OrigemDoConsentimento
  /** O texto exato que a pessoa leu, ou escreveu. `null` quando não houve texto. */
  textoExibido: string | null
}

export async function registrarConsentimento(novo: NovoConsentimento): Promise<void> {
  const { error } = await db()
    .from('consentimentos')
    .insert({
      cliente_id: novo.clienteId,
      contato_id: novo.contatoId,
      categoria: novo.categoria ?? 'MARKETING',
      aceito: novo.aceito,
      origem: novo.origem,
      texto_exibido: novo.textoExibido,
    })
  if (error) throw new Error(`não foi possível registrar o consentimento: ${error.message}`)
}

/**
 * O estado de MARKETING de cada contato: a linha mais recente de cada um.
 *
 * Contato sem linha nenhuma fica fora do mapa, e quem lê trata ausência como
 * "nunca houve registro" (ver `recebePromocoes`). Em lotes pelo mesmo motivo de
 * `acaoJanelaDoPublico`: os ids vão no endereço da consulta.
 */
export async function marketingDosContatos(
  clienteId: string,
  contatoIds: readonly string[],
): Promise<Map<string, NonNullable<EstadoDoMarketing>>> {
  const estados = new Map<string, NonNullable<EstadoDoMarketing>>()
  for (let i = 0; i < contatoIds.length; i += 300) {
    const lote = contatoIds.slice(i, i + 300)
    const { data, error } = await db()
      .from('consentimentos')
      .select('contato_id, aceito, origem, criado_em')
      .eq('cliente_id', clienteId)
      .eq('categoria', 'MARKETING')
      .in('contato_id', [...lote])
      .order('criado_em', { ascending: false })

    if (ehIdInvalido(error)) return estados
    if (error) throw new Error(`não foi possível ler os consentimentos: ${error.message}`)

    // Ordenado do mais novo para o mais velho: a primeira linha de cada
    // contato é a que vale.
    for (const linha of data as { contato_id: string; aceito: boolean; origem: string; criado_em: string }[]) {
      if (estados.has(linha.contato_id)) continue
      estados.set(linha.contato_id, { aceito: linha.aceito, origem: linha.origem, em: linha.criado_em })
    }
  }
  return estados
}

export async function marketingDoContato(clienteId: string, contatoId: string): Promise<EstadoDoMarketing> {
  const estados = await marketingDosContatos(clienteId, [contatoId])
  return estados.get(contatoId) ?? null
}
