import 'server-only'
import { diaEmSaoPaulo } from '@/channels/pagamento'
import type { Conjunto, Consulta, Linha } from '@/core/api/relatorios'
import { db } from '../db'
import { membrosDaConta } from '../repos/usuarios'

/**
 * As consultas do conector de BI (`core/api/relatorios.ts` tem as regras).
 *
 * Cada conjunto lê **só a conta da chave** (`client_id` em toda consulta, e
 * nas mensagens pela junção com o contato, que é onde a conta mora) e devolve
 * uma página ordenada por data e id: a mesma página pedida duas vezes devolve
 * as mesmas linhas, e é isso que deixa o Power BI juntar páginas sem
 * duplicar.
 *
 * Valor em reais com ponto (`109.8`), data em ISO: o formato que as
 * ferramentas de BI leem sem configurar nada. Formatar para gente é delas.
 */

export type Pagina = { linhas: Linha[]; temMais: boolean }

/** Pede uma linha a mais que o limite: se ela vier, existe próxima página. */
function intervalo(consulta: Consulta): [number, number] {
  const inicio = (consulta.pagina - 1) * consulta.limite
  return [inicio, inicio + consulta.limite]
}

function fatiar<T>(dados: T[] | null, consulta: Consulta): { itens: T[]; temMais: boolean } {
  const todos = dados ?? []
  return { itens: todos.slice(0, consulta.limite), temMais: todos.length > consulta.limite }
}

/** Antes da 0141 a tabela de cobranças não existe: o conjunto vem vazio, não quebra. */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

async function nomesDaEquipe(clienteId: string): Promise<Map<string, string>> {
  const membros = await membrosDaConta(clienteId).catch(() => [])
  return new Map(membros.map((m) => [m.id, m.nome]))
}

type LinhaDeContato = {
  id: string
  wa_id: string
  nome: string | null
  nome_real: string | null
  criado_em: string
  estado: string | null
  estagio: string | null
  temperatura: string | null
  atribuido_a: string | null
  ultima_mensagem_em: string | null
  contato_etiquetas: { etiquetas: { nome: string } | null }[] | null
}

async function contatos(clienteId: string, consulta: Consulta): Promise<Pagina> {
  let pedido = db()
    .from('contacts')
    .select(
      'id, wa_id, nome, nome_real, criado_em, estado, estagio, temperatura, atribuido_a, ultima_mensagem_em, contato_etiquetas(etiquetas(nome))',
    )
    .eq('client_id', clienteId)
  if (consulta.desde) pedido = pedido.gte('criado_em', consulta.desde.toISOString())
  if (consulta.ate) pedido = pedido.lt('criado_em', consulta.ate.toISOString())
  const { data, error } = await pedido.order('criado_em').order('id').range(...intervalo(consulta))
  if (error) throw new Error(`contatos: ${error.message}`)

  const equipe = await nomesDaEquipe(clienteId)
  const { itens, temMais } = fatiar(data as unknown as LinhaDeContato[] | null, consulta)
  return {
    temMais,
    linhas: itens.map((c) => ({
      id: c.id,
      nome: c.nome_real?.trim() || c.nome?.trim() || null,
      // Instagram e Telegram guardam outra coisa no `wa_id`.
      telefone: /^\d{10,15}$/.test(c.wa_id) ? c.wa_id : null,
      criado_em: c.criado_em,
      estado: c.estado,
      estagio: c.estagio,
      temperatura: c.temperatura,
      responsavel: c.atribuido_a ? (equipe.get(c.atribuido_a) ?? null) : null,
      etiquetas: (c.contato_etiquetas ?? []).flatMap((v) => (v.etiquetas ? [v.etiquetas.nome] : [])).join('; ') || null,
      ultima_mensagem_em: c.ultima_mensagem_em,
    })),
  }
}

async function mensagens(clienteId: string, consulta: Consulta): Promise<Pagina> {
  // Sem o texto, de propósito: conteúdo de conversa não vai para planilha
  // nenhuma por esta porta. Para contar volume, horário e resposta, basta isto.
  let pedido = db()
    .from('messages')
    .select('id, contact_id, direcao, ts, entregue, contacts!inner(client_id)')
    .eq('contacts.client_id', clienteId)
  if (consulta.desde) pedido = pedido.gte('ts', consulta.desde.toISOString())
  if (consulta.ate) pedido = pedido.lt('ts', consulta.ate.toISOString())
  const { data, error } = await pedido.order('ts').order('id').range(...intervalo(consulta))
  if (error) throw new Error(`mensagens: ${error.message}`)

  const { itens, temMais } = fatiar(
    data as { id: string; contact_id: string; direcao: string; ts: string; entregue: boolean | null }[] | null,
    consulta,
  )
  return {
    temMais,
    linhas: itens.map((m) => ({
      id: m.id,
      contato_id: m.contact_id,
      direcao: m.direcao,
      enviada_em: m.ts,
      entregue: m.entregue,
    })),
  }
}

async function vendas(clienteId: string, consulta: Consulta): Promise<Pagina> {
  let pedido = db()
    .from('vendas')
    .select('id, contact_id, data_da_venda, valor_total, moeda, situacao, autor, criado_em')
    .eq('client_id', clienteId)
  // `data_da_venda` é dia, sem hora: compara pelo dia de Brasília.
  if (consulta.desde) pedido = pedido.gte('data_da_venda', diaEmSaoPaulo(consulta.desde))
  if (consulta.ate) pedido = pedido.lt('data_da_venda', diaEmSaoPaulo(consulta.ate))
  const { data, error } = await pedido.order('data_da_venda').order('id').range(...intervalo(consulta))
  if (error) throw new Error(`vendas: ${error.message}`)

  const equipe = await nomesDaEquipe(clienteId)
  const { itens, temMais } = fatiar(
    data as {
      id: string
      contact_id: string | null
      data_da_venda: string
      valor_total: number | string | null
      moeda: string | null
      situacao: string
      autor: string | null
      criado_em: string
    }[] | null,
    consulta,
  )
  return {
    temMais,
    linhas: itens.map((v) => ({
      id: v.id,
      contato_id: v.contact_id,
      data_da_venda: v.data_da_venda,
      // `numeric` volta como texto do PostgREST; o BI quer número.
      valor: v.valor_total === null ? null : Number(v.valor_total),
      moeda: v.moeda,
      situacao: v.situacao,
      responsavel: v.autor ? (equipe.get(v.autor) ?? null) : null,
      criado_em: v.criado_em,
    })),
  }
}

async function cobrancas(clienteId: string, consulta: Consulta): Promise<Pagina> {
  let pedido = db()
    .from('cobrancas')
    .select('id, contato_id, descricao, valor_centavos, status, gateway, origem, criada_por, criado_em, vence_em, paga_em')
    .eq('cliente_id', clienteId)
  if (consulta.desde) pedido = pedido.gte('criado_em', consulta.desde.toISOString())
  if (consulta.ate) pedido = pedido.lt('criado_em', consulta.ate.toISOString())
  const { data, error } = await pedido.order('criado_em').order('id').range(...intervalo(consulta))
  if (tabelaAusente(error)) return { linhas: [], temMais: false }
  if (error) throw new Error(`cobrancas: ${error.message}`)

  const { itens, temMais } = fatiar(
    data as {
      id: string
      contato_id: string | null
      descricao: string
      valor_centavos: number
      status: string
      gateway: string
      origem: string
      criada_por: string | null
      criado_em: string
      vence_em: string
      paga_em: string | null
    }[] | null,
    consulta,
  )
  return {
    temMais,
    linhas: itens.map((c) => ({
      id: c.id,
      contato_id: c.contato_id,
      descricao: c.descricao,
      valor: c.valor_centavos / 100,
      status: c.status,
      gateway: c.gateway,
      origem: c.origem,
      criada_por: c.criada_por,
      criado_em: c.criado_em,
      vence_em: c.vence_em,
      paga_em: c.paga_em,
    })),
  }
}

const CONSULTAS: Record<Conjunto, (clienteId: string, consulta: Consulta) => Promise<Pagina>> = {
  contatos,
  mensagens,
  vendas,
  cobrancas,
}

export function lerConjunto(conjunto: Conjunto, clienteId: string, consulta: Consulta): Promise<Pagina> {
  return CONSULTAS[conjunto](clienteId, consulta)
}
