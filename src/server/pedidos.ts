import 'server-only'
import { dentroDaJanela } from '@/channels/janela'
import type { AutorDaSaida } from '@/core/autor-da-mensagem'
import type { ItemCobrado } from '@/core/cobrar-do-catalogo'
import { avisoDoStatus, podeMover, temPedidos, type StatusDePedido } from '@/core/pedidos'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { nomesDosCobrados, type CobrancaRegistrada } from './repos/cobrancas'
import { confirmarEntrega, contextoDeResposta, registrarSaida } from './repos/conversas'
import {
  acharPedido,
  apagarPedidoQueNaoSaiu,
  devolverEstoque,
  inserirPedido,
  ligarCobranca,
  listarPedidos,
  mudarStatusDoPedido,
  pedidoDaCobranca,
  reservarEstoque,
  type Baixa,
  type EntregaDoPedido,
  type ItemDoPedido,
  type Pedido,
} from './repos/pedidos'
import { listarProdutos } from './repos/produtos'
import { nichoDaConta } from './repos/recursos'

/**
 * O pedido feito pela conversa (cobrança camada 2, parte a).
 *
 * Nasce de duas portas: o Cobrar do Inbox com itens do catálogo, e o bloco
 * Cobrar do fluxo (sem itens; a descrição vira a observação). Só nos ramos
 * com Pedidos (`temPedidos`): conta de aulas cobra como sempre e nenhum pedido
 * aparece.
 *
 * Anda por três caminhos: a cobrança paga leva de `novo` a `pago`; a cobrança
 * vencida ou cancelada leva a `cancelado` e devolve o estoque; o resto é a
 * equipe, pela tela Pedidos, que avisa a pessoa na conversa quando dá.
 */

const baixasDe = (itens: readonly ItemDoPedido[]): Baixa[] =>
  itens.flatMap((i) => (i.produtoId ? [{ produtoId: i.produtoId, nome: i.nome, quantidade: i.quantidade }] : []))

export async function contaTemPedidos(clienteId: string): Promise<boolean> {
  return temPedidos(await nichoDaConta(clienteId))
}

/**
 * Os itens do Cobrar como itens de pedido. O id da busca do catálogo próprio
 * é o SKU quando há (`loja/catalogo.ts`), e o estoque mora na linha: aqui ele
 * volta a ser o id da linha. Item da loja on-line guarda só o id de lá.
 */
async function itensDoPedido(clienteId: string, itens: readonly ItemCobrado[]): Promise<ItemDoPedido[]> {
  const doCatalogo = itens.some((i) => i.fonte === 'catalogo')
  const produtos = doCatalogo ? await listarProdutos(clienteId) : []
  return itens.map((i) => {
    const chave = i.produtoId?.trim().toLowerCase() ?? ''
    const linha =
      i.fonte === 'catalogo' && chave
        ? produtos.find((p) => p.id === i.produtoId || p.sku?.trim().toLowerCase() === chave)
        : undefined
    return {
      produtoId: linha?.id ?? null,
      produtoExterno: linha ? null : (i.produtoId ?? null),
      nome: i.nome,
      quantidade: i.quantidade,
      valorCentavos: i.valorCentavos,
    }
  })
}

export type PedidoReservado = { ok: true; pedido: Pedido } | { ok: false; erro: string }

/**
 * O pedido do Cobrar do Inbox, **antes** da cobrança: baixa o estoque e
 * registra. Se a cobrança não sair, quem chamou desfaz com `desfazerPedido`.
 */
export async function reservarPedido(entrada: {
  clienteId: string
  contatoId: string
  itens: readonly ItemCobrado[]
  totalCentavos: number
  entrega: EntregaDoPedido
  endereco: string | null
  criadoPor: string | null
}): Promise<PedidoReservado> {
  const itens = await itensDoPedido(entrada.clienteId, entrada.itens)
  const baixas = baixasDe(itens)
  const reserva = await reservarEstoque(entrada.clienteId, baixas)
  if (!reserva.ok) return reserva
  try {
    const pedido = await inserirPedido({
      clienteId: entrada.clienteId,
      contatoId: entrada.contatoId,
      entrega: entrada.entrega,
      endereco: entrada.entrega === 'entrega' ? entrada.endereco : null,
      observacao: null,
      totalCentavos: entrada.totalCentavos,
      origem: 'inbox',
      criadoPor: entrada.criadoPor,
      itens,
    })
    return { ok: true, pedido }
  } catch (erro) {
    await devolverEstoque(entrada.clienteId, baixas)
    console.error('[pedidos] o pedido não foi gravado', erro)
    return { ok: false, erro: 'Não foi possível registrar o pedido. Tente de novo.' }
  }
}

/** A cobrança não saiu: o pedido some e o estoque volta. */
export async function desfazerPedido(pedido: Pedido): Promise<void> {
  await apagarPedidoQueNaoSaiu(pedido.clienteId, pedido.id)
  await devolverEstoque(pedido.clienteId, baixasDe(pedido.itens))
}

export async function ligarPedidoACobranca(pedido: Pedido, cobrancaId: string): Promise<void> {
  await ligarCobranca(pedido.clienteId, pedido.id, cobrancaId)
}

/**
 * O pedido do bloco Cobrar do fluxo: sem itens (o bloco cobra um valor), com
 * a descrição na observação. Falhar aqui não derruba a cobrança, que já saiu.
 */
export async function pedidoDoFluxo(cobranca: CobrancaRegistrada): Promise<void> {
  try {
    if (!(await contaTemPedidos(cobranca.clienteId))) return
    const pedido = await inserirPedido({
      clienteId: cobranca.clienteId,
      contatoId: cobranca.contatoId,
      entrega: 'retirada',
      endereco: null,
      observacao: cobranca.descricao.slice(0, 500),
      totalCentavos: cobranca.valorCentavos,
      origem: 'fluxo',
      criadoPor: null,
      itens: [],
    })
    await ligarCobranca(cobranca.clienteId, pedido.id, cobranca.id)
  } catch (erro) {
    console.error('[pedidos] o pedido do fluxo não foi gravado', erro)
  }
}

/** A cobrança foi paga: o pedido novo passa a pago. */
export async function pedidoPago(cobranca: CobrancaRegistrada, pagaEm: Date): Promise<void> {
  try {
    const pedido = await pedidoDaCobranca(cobranca.clienteId, cobranca.id)
    if (pedido) await mudarStatusDoPedido(cobranca.clienteId, pedido.id, ['novo'], 'pago', pagaEm)
  } catch (erro) {
    console.error('[pedidos] o pedido pago não andou', erro)
  }
}

/** A cobrança venceu ou foi cancelada antes de pagar: o pedido cai e o estoque volta. */
export async function pedidoCaiu(cobranca: CobrancaRegistrada): Promise<void> {
  try {
    const pedido = await pedidoDaCobranca(cobranca.clienteId, cobranca.id)
    if (!pedido) return
    const caiu = await mudarStatusDoPedido(cobranca.clienteId, pedido.id, ['novo'], 'cancelado')
    if (caiu) await devolverEstoque(cobranca.clienteId, baixasDe(caiu.itens))
  } catch (erro) {
    console.error('[pedidos] o pedido não caiu com a cobrança', erro)
  }
}

export type PedidoMovido =
  | { ok: true; pedido: Pedido; avisado: boolean }
  | { ok: false; erro: string }

/**
 * A equipe move o pedido pela tela. Cancelar devolve o estoque. Quando a etapa
 * tem aviso e a conversa está dentro da janela, a pessoa fica sabendo.
 */
export async function moverPedido(
  clienteId: string,
  pedidoId: string,
  para: StatusDePedido,
  autor: AutorDaSaida | null,
): Promise<PedidoMovido> {
  const atual = await acharPedido(clienteId, pedidoId)
  if (!atual) return { ok: false, erro: 'Pedido não encontrado.' }
  const nicho = await nichoDaConta(clienteId)
  if (!podeMover(atual.status, para, nicho)) return { ok: false, erro: 'Este pedido não pode ir para essa etapa.' }

  const movido = await mudarStatusDoPedido(clienteId, pedidoId, [atual.status], para)
  if (!movido) return { ok: false, erro: 'O pedido mudou enquanto isso. Atualize a página.' }
  if (para === 'cancelado') await devolverEstoque(clienteId, baixasDe(movido.itens))

  const aviso = avisoDoStatus(para, movido.numero, nicho, movido.entrega)
  const avisado = aviso && movido.contatoId ? await avisarNaConversa(clienteId, movido.contatoId, aviso, autor) : false
  return { ok: true, pedido: movido, avisado }
}

/** Só dentro da janela: fora dela, só modelo aprovado chega, e etapa de pedido não tem modelo. */
async function avisarNaConversa(clienteId: string, contatoId: string, texto: string, autor: AutorDaSaida | null): Promise<boolean> {
  try {
    const contexto = await contextoDeResposta(clienteId, contatoId)
    if (!contexto || !dentroDaJanela(contexto)) return false
    const canal = await adaptadorDoCanal(contexto.canal)
    const saida = await registrarSaida({ contatoId, sessaoId: contexto.sessaoId, texto, payload: { pedido_aviso: true }, autor })
    await confirmarEntrega(saida, await canal.enviarTexto(contexto.waId, texto))
    return true
  } catch (erro) {
    console.error('[pedidos] o aviso da etapa não saiu', erro)
    return false
  }
}

/** O pedido como a tela Pedidos desenha: o nome do contato junto, e o total só para quem vê valores. */
export type CartaoDePedido = {
  id: string
  numero: number
  contatoId: string | null
  contato: string
  status: StatusDePedido
  entrega: Pedido['entrega']
  endereco: string | null
  observacao: string | null
  /** `null` para quem não vê valores. */
  totalCentavos: number | null
  itens: { nome: string; quantidade: number }[]
  origem: Pedido['origem']
  aguardaPagamento: boolean
  criadoEm: string
}

export async function cartoesDosPedidos(clienteId: string, verValores: boolean): Promise<CartaoDePedido[]> {
  const pedidos = await listarPedidos(clienteId)
  const nomes = await nomesDosCobrados(
    clienteId,
    pedidos.flatMap((p) => (p.contatoId ? [p.contatoId] : [])),
  )
  return pedidos.map((p) => ({
    id: p.id,
    numero: p.numero,
    contatoId: p.contatoId,
    contato: p.contatoId ? nomes.get(p.contatoId) || 'Sem nome' : 'Contato apagado',
    status: p.status,
    entrega: p.entrega,
    endereco: p.endereco,
    observacao: p.observacao,
    totalCentavos: verValores ? p.totalCentavos : null,
    itens: p.itens.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
    origem: p.origem,
    aguardaPagamento: p.status === 'novo' && p.cobrancaId !== null,
    criadoEm: p.criadoEm,
  }))
}
