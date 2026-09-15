import 'server-only'
import {
  DIAS_PARA_INATIVAR,
  estagioDepoisDe,
  resumoDoCliente,
  type Estagio,
  type FatoDoContato,
} from '@/core/crm'
import { db, ehIdInvalido } from '../db'
import { anotar } from './eventos'

/**
 * O estágio do contato (0058).
 *
 * O ponto deste arquivo é que **ninguém escreve `estagio` direto**. Toda mudança
 * entra por `aplicarFato`, que lê o estágio atual, pergunta à régua de
 * `core/crm.ts` o que aquele fato produz, e só escreve se houver mudança. Sem
 * esse funil, "cliente não regride" viraria uma regra que cada chamador precisa
 * lembrar — e um esquecimento rebaixaria para `perdido` alguém que já pagou.
 */

type LinhaDoContato = { estagio: string; id: string }

export async function aplicarFato(
  clienteId: string,
  contatoId: string,
  fato: FatoDoContato,
  autor: string | null = null,
): Promise<Estagio | null> {
  const { data, error } = await db()
    .from('contacts')
    .select('id, estagio')
    .eq('client_id', clienteId)
    .eq('id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o estágio: ${error.message}`)
  if (!data) return null

  const atual = (data as LinhaDoContato).estagio as Estagio

  // Os dois contextos que a régua pode pedir custam uma consulta cada, e só
  // fazem diferença em dois fatos. Perguntar sempre seria pagar duas idas ao
  // banco em toda mensagem recebida.
  const contexto =
    fato === 'perdeu'
      ? { temOutroAberto: await temCartaoAberto(clienteId, contatoId) }
      : fato === 'voltou-a-falar'
        ? { jaComprou: await jaComprou(clienteId, contatoId) }
        : {}

  const novo = estagioDepoisDe(atual, fato, contexto)
  if (!novo || novo === atual) return null

  const { error: erroDaEscrita } = await db()
    .from('contacts')
    .update({ estagio: novo, estagio_mudou_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', contatoId)

  if (erroDaEscrita) throw new Error(`não deu para mudar o estágio: ${erroDaEscrita.message}`)

  await anotar(clienteId, contatoId, 'mudou-de-estagio', { de: atual, para: novo }, autor)
  return novo
}

/**
 * O estágio de uma pessoa, e desde quando.
 *
 * **A data vem junto porque ela é metade da informação.** "Negociando" não diz
 * nada sozinho: negociando desde ontem é uma conversa viva, negociando desde
 * abril é uma venda que ninguém teve coragem de marcar como perdida. A coluna
 * `estagio_mudou_em` existe desde a 0058 e não estava sendo lida por ninguém.
 *
 * `desde` é nulo para quem nunca mudou de estágio — o contato nasce `novo`, e
 * nascer não é mudar.
 */
export async function estagioDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ estagio: Estagio; desde: string | null } | null> {
  const { data, error } = await db()
    .from('contacts')
    .select('estagio, estagio_mudou_em')
    .eq('client_id', clienteId)
    .eq('id', contatoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler o estágio: ${error.message}`)
  if (!data) return null

  const linha = data as { estagio: string; estagio_mudou_em: string | null }
  return { estagio: linha.estagio as Estagio, desde: linha.estagio_mudou_em }
}

/** O ajuste na mão. Existe, e é exceção — ver `docs/MODELO-CRM.md`. */
export async function definirEstagio(
  clienteId: string,
  contatoId: string,
  estagio: Estagio,
  autor: string | null = null,
): Promise<boolean> {
  const { data, error } = await db()
    .from('contacts')
    .update({ estagio, estagio_mudou_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', contatoId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para mudar o estágio: ${error.message}`)
  if (!data) return false

  await anotar(clienteId, contatoId, 'mudou-de-estagio', { para: estagio, manual: 'true' }, autor)
  return true
}

/**
 * Marca que essa pessoa acabou de falar.
 *
 * Chamado no caminho quente de toda mensagem recebida, então é um `update` seco
 * e nada mais: sem leitura antes, sem evento — a mensagem já é o evento, e
 * anotar cada uma na linha do tempo a transformaria numa segunda cópia da
 * conversa.
 */
export async function marcarUltimaMensagem(
  clienteId: string,
  contatoId: string,
  quando: string = new Date().toISOString(),
): Promise<void> {
  const { error } = await db()
    .from('contacts')
    .update({ ultima_mensagem_em: quando })
    .eq('client_id', clienteId)
    .eq('id', contatoId)

  if (error && !ehIdInvalido(error)) {
    console.error('[crm] não deu para marcar a última mensagem:', error.message)
  }
}

async function temCartaoAberto(clienteId: string, contatoId: string): Promise<boolean> {
  const { count, error } = await db()
    .from('quadro_cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .eq('situacao', 'aberta')

  if (error) return false
  return (count ?? 0) > 0
}

async function jaComprou(clienteId: string, contatoId: string): Promise<boolean> {
  const { count, error } = await db()
    .from('quadro_cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .eq('situacao', 'ganha')

  if (error) return false
  return (count ?? 0) > 0
}

/**
 * Quanto essa pessoa já rendeu, quantas vezes comprou e quando foi a última.
 *
 * As três perguntas do pós-venda, respondidas pelos cartões ganhos — sem
 * catálogo, sem pedido, sem estoque.
 */
export async function resumoDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ total: number; compras: number; ultimaEm: string | null }> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('valor, fechado_em')
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)
    .eq('situacao', 'ganha')

  if (ehIdInvalido(error)) return { total: 0, compras: 0, ultimaEm: null }
  if (error) throw new Error(`não deu para ler o resumo: ${error.message}`)

  return resumoDoCliente(
    (data as { valor: string | number | null; fechado_em: string | null }[]).map((linha) => ({
      // `numeric` chega como string no supabase-js — somar sem converter
      // concatenaria "200" com "350.50".
      valor: linha.valor === null ? null : Number(linha.valor),
      fechadoEm: linha.fechado_em,
    })),
  )
}

/**
 * Os clientes que sumiram, para o cron marcar como inativos.
 *
 * Devolve ids em vez de escrever direto porque quem escreve é `aplicarFato` — é
 * lá que mora a regra de que cliente vira `inativo` e nunca `perdido`, e
 * duplicá-la num `update ... where` seria criar um segundo lugar onde ela pode
 * divergir.
 */
export async function contatosQueSumiram(clienteId: string, limite = 200): Promise<string[]> {
  const corte = new Date(Date.now() - DIAS_PARA_INATIVAR * 86_400_000).toISOString()

  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('estagio', ['novo', 'qualificado', 'negociando', 'cliente'])
    .lt('ultima_mensagem_em', corte)
    .limit(limite)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para procurar quem sumiu: ${error.message}`)

  return (data as { id: string }[]).map((linha) => linha.id)
}

/**
 * Marca como inativo quem sumiu, em todas as contas.
 *
 * Pega carona na manutenção diária que já existe, pelo mesmo motivo que a
 * renovação do Instagram pegou: o plano Hobby da Vercel dá poucas tarefas
 * agendadas, e as que existem já estão em uso. A natureza do trabalho é a mesma
 * das outras — cuidar de prazo que corre sozinho.
 *
 * Passa por `aplicarFato` contato a contato em vez de um `update ... where`
 * porque é lá que mora a regra de que **cliente vira `inativo` e nunca
 * `perdido`**, e duplicá-la num `where` criaria um segundo lugar onde ela pode
 * divergir. O teto por conta existe para a rota não estourar o tempo dela.
 *
 * Nunca lança: falha de uma conta não pode impedir as outras de serem cuidadas.
 */
export async function marcarQuemSumiu(limitePorConta = 200): Promise<number> {
  const { data, error } = await db().from('clients').select('id')
  if (error) {
    console.error('[crm] não deu para listar as contas:', error.message)
    return 0
  }

  let marcados = 0
  for (const { id: clienteId } of (data as { id: string }[]) ?? []) {
    try {
      const sumidos = await contatosQueSumiram(clienteId, limitePorConta)
      for (const contatoId of sumidos) {
        const novo = await aplicarFato(clienteId, contatoId, 'sumiu')
        if (novo) marcados += 1
      }
    } catch (erro) {
      console.error('[crm] não deu para marcar inativos da conta', clienteId, erro)
    }
  }

  return marcados
}
