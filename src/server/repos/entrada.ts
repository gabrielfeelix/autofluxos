import 'server-only'
import { podeLigar, type EstadoDoDestino } from '@/core/entrada'
import { db, ehIdInvalido, pareceUuid } from '../db'

/**
 * As idas ao banco da regra de `core/entrada.ts`: nada liga apontando para
 * rascunho (A05).
 *
 * As três tabelas de entrada têm o mesmo par (`client_id`, `flow_id`), então uma
 * função só serve às três. O nome da tabela é um literal do tipo abaixo, nunca
 * texto vindo de formulário.
 */
export type TabelaDeEntrada = 'gatilhos' | 'gatilhos_de_evento' | 'campanhas'

/** O fluxo existe nesta conta, e tem versão publicada? */
export async function destinoPodeReceber(
  clienteId: string,
  fluxoId: string,
): Promise<EstadoDoDestino> {
  if (!pareceUuid(fluxoId)) return { existe: false, publicado: false }

  const { data, error } = await db()
    .from('flows')
    .select('versao_publicada_id')
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return { existe: false, publicado: false }
  if (error) throw new Error(`não deu para conferir o destino: ${error.message}`)
  if (!data) return { existe: false, publicado: false }
  return { existe: true, publicado: data.versao_publicada_id !== null }
}

/**
 * O motivo para **não** ligar a entrada, ou `null` quando pode.
 *
 * Entrada que não existe (ou é de outra conta) também devolve `null`: quem
 * responde "não existe mais" é a escrita, que já confere o par com o cliente.
 */
export async function recusaParaLigar(
  tabela: TabelaDeEntrada,
  clienteId: string,
  entradaId: string,
): Promise<string | null> {
  if (!pareceUuid(entradaId)) return null

  const { data, error } = await db()
    .from(tabela)
    .select('flow_id')
    .eq('id', entradaId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para conferir a entrada: ${error.message}`)
  if (!data) return null

  const r = podeLigar(await destinoPodeReceber(clienteId, data.flow_id as string))
  return r.ok ? null : r.texto
}
