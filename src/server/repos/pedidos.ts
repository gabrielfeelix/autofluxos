import 'server-only'
import { COLUNA_DO_STATUS, type StatusDePedido } from '@/core/pedidos'
import { db, ehIdInvalido } from '../db'

/**
 * Os pedidos feitos pela conversa (0146, `pedidos` e `pedido_itens`).
 *
 * Aqui é só a ida ao banco. Quem decide quando um pedido nasce, anda ou cai é
 * `server/pedidos.ts`. Toda mudança de status passa por `mudarStatusDoPedido`,
 * que só muda **a partir** dos status pedidos: o mesmo aviso de pagamento
 * chegando duas vezes move uma vez só, e o estoque volta uma vez só.
 *
 * O estoque (`produtos.estoque`, nulo = não controla) baixa e volta por troca
 * condicional: lê o número, grava o novo só se ele ainda for o lido, e tenta
 * de novo se outra venda passou no meio. Sem função no banco e sem o pool do
 * SQL direto, que não enxerga `produtos`.
 */

export type EntregaDoPedido = 'entrega' | 'retirada' | 'local'
export type OrigemDoPedido = 'inbox' | 'fluxo' | 'ia'

export type ItemDoPedido = {
  /** O produto do catálogo próprio; nulo para item da loja on-line. */
  produtoId: string | null
  produtoExterno: string | null
  nome: string
  quantidade: number
  /** O preço de cada um, na hora do pedido. */
  valorCentavos: number
}

export type Pedido = {
  id: string
  clienteId: string
  numero: number
  contatoId: string | null
  cobrancaId: string | null
  entrega: EntregaDoPedido
  endereco: string | null
  observacao: string | null
  totalCentavos: number
  status: StatusDePedido
  origem: OrigemDoPedido
  criadoPor: string | null
  pagoEm: string | null
  emPreparoEm: string | null
  saiuEm: string | null
  entregueEm: string | null
  canceladoEm: string | null
  criadoEm: string
  itens: ItemDoPedido[]
}

type LinhaDoItem = {
  produto_id: string | null
  produto_externo: string | null
  nome: string
  quantidade: number
  valor_centavos: number
}

type Linha = {
  id: string
  cliente_id: string
  numero: number
  contato_id: string | null
  cobranca_id: string | null
  entrega: EntregaDoPedido
  endereco: string | null
  observacao: string | null
  total_centavos: number
  status: StatusDePedido
  origem: OrigemDoPedido
  criado_por: string | null
  pago_em: string | null
  em_preparo_em: string | null
  saiu_em: string | null
  entregue_em: string | null
  cancelado_em: string | null
  criado_em: string
  pedido_itens?: LinhaDoItem[]
}

const COLUNAS =
  'id, cliente_id, numero, contato_id, cobranca_id, entrega, endereco, observacao, total_centavos, status, origem, criado_por, pago_em, em_preparo_em, saiu_em, entregue_em, cancelado_em, criado_em, pedido_itens (produto_id, produto_externo, nome, quantidade, valor_centavos)'

function paraPedido(l: Linha): Pedido {
  return {
    id: l.id,
    clienteId: l.cliente_id,
    numero: l.numero,
    contatoId: l.contato_id,
    cobrancaId: l.cobranca_id,
    entrega: l.entrega,
    endereco: l.endereco,
    observacao: l.observacao,
    totalCentavos: l.total_centavos,
    status: l.status,
    origem: l.origem,
    criadoPor: l.criado_por,
    pagoEm: l.pago_em,
    emPreparoEm: l.em_preparo_em,
    saiuEm: l.saiu_em,
    entregueEm: l.entregue_em,
    canceladoEm: l.cancelado_em,
    criadoEm: l.criado_em,
    itens: (l.pedido_itens ?? []).map((i) => ({
      produtoId: i.produto_id,
      produtoExterno: i.produto_externo,
      nome: i.nome,
      quantidade: i.quantidade,
      valorCentavos: i.valor_centavos,
    })),
  }
}

/** Código no ar antes da 0146 lê "nenhum pedido". */
function tabelaAusente(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

/**
 * O pedido nasce com o próximo número da conta. Duas vendas no mesmo segundo
 * pegam o mesmo número; o `unique (cliente_id, numero)` recusa a segunda, e
 * ela tenta com o seguinte.
 */
export async function inserirPedido(entrada: {
  clienteId: string
  contatoId: string | null
  entrega: EntregaDoPedido
  endereco: string | null
  observacao: string | null
  totalCentavos: number
  origem: OrigemDoPedido
  criadoPor: string | null
  itens: ItemDoPedido[]
}): Promise<Pedido> {
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data: ultimo, error: erroDoNumero } = await db()
      .from('pedidos')
      .select('numero')
      .eq('cliente_id', entrada.clienteId)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (erroDoNumero) throw new Error(`não foi possível numerar o pedido: ${erroDoNumero.message}`)
    const numero = ((ultimo as { numero: number } | null)?.numero ?? 0) + 1

    const { data, error } = await db()
      .from('pedidos')
      .insert({
        cliente_id: entrada.clienteId,
        numero,
        contato_id: entrada.contatoId,
        entrega: entrada.entrega,
        endereco: entrada.endereco,
        observacao: entrada.observacao,
        total_centavos: entrada.totalCentavos,
        origem: entrada.origem,
        criado_por: entrada.criadoPor,
      })
      .select('id')
      .single()
    if (error?.code === '23505') continue
    if (error) throw new Error(`não foi possível registrar o pedido: ${error.message}`)
    const id = (data as { id: string }).id

    if (entrada.itens.length > 0) {
      const { error: erroDosItens } = await db()
        .from('pedido_itens')
        .insert(
          entrada.itens.map((i) => ({
            pedido_id: id,
            produto_id: i.produtoId,
            produto_externo: i.produtoExterno,
            nome: i.nome.slice(0, 200),
            quantidade: i.quantidade,
            valor_centavos: i.valorCentavos,
          })),
        )
      if (erroDosItens) {
        await db().from('pedidos').delete().eq('id', id)
        throw new Error(`não foi possível registrar os itens do pedido: ${erroDosItens.message}`)
      }
    }
    const pedido = await acharPedido(entrada.clienteId, id)
    if (!pedido) throw new Error('o pedido sumiu logo depois de criado')
    return pedido
  }
  throw new Error('não foi possível numerar o pedido: muitas vendas ao mesmo tempo')
}

/** Só o pedido que nunca virou cobrança: nada foi cobrado de ninguém. */
export async function apagarPedidoQueNaoSaiu(clienteId: string, id: string): Promise<void> {
  await db().from('pedidos').delete().eq('cliente_id', clienteId).eq('id', id).is('cobranca_id', null)
}

export async function ligarCobranca(clienteId: string, pedidoId: string, cobrancaId: string): Promise<void> {
  const { error } = await db()
    .from('pedidos')
    .update({ cobranca_id: cobrancaId })
    .eq('cliente_id', clienteId)
    .eq('id', pedidoId)
  if (error) throw new Error(`não foi possível ligar a cobrança ao pedido: ${error.message}`)
}

export async function acharPedido(clienteId: string, id: string): Promise<Pedido | null> {
  const { data, error } = await db().from('pedidos').select(COLUNAS).eq('cliente_id', clienteId).eq('id', id).maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler o pedido: ${error.message}`)
  return data ? paraPedido(data as unknown as Linha) : null
}

export async function pedidoDaCobranca(clienteId: string, cobrancaId: string): Promise<Pedido | null> {
  const { data, error } = await db()
    .from('pedidos')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .eq('cobranca_id', cobrancaId)
    .maybeSingle()
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível ler o pedido da cobrança: ${error.message}`)
  return data ? paraPedido(data as unknown as Linha) : null
}

/**
 * Os pedidos da tela: os abertos todos, e os fechados (entregue, cancelado)
 * das últimas 48 horas, para a equipe ver o que acabou de sair.
 */
export async function listarPedidos(clienteId: string): Promise<Pedido[]> {
  const desde = new Date(Date.now() - 48 * 3_600_000).toISOString()
  const { data, error } = await db()
    .from('pedidos')
    .select(COLUNAS)
    .eq('cliente_id', clienteId)
    .or(`status.in.(novo,pago,em_preparo,saiu),criado_em.gte.${desde}`)
    .order('criado_em', { ascending: false })
    .limit(300)
  if (ehIdInvalido(error) || tabelaAusente(error)) return []
  if (error) throw new Error(`não foi possível ler os pedidos: ${error.message}`)
  return (data as unknown as Linha[]).map(paraPedido)
}

/**
 * Muda o status só se ele ainda for um dos `de`, gravando a data da etapa.
 * Devolve o pedido quando mudou: é por ele que quem chamou sabe que é o
 * primeiro, e portanto quem devolve o estoque e avisa a conversa.
 */
export async function mudarStatusDoPedido(
  clienteId: string,
  id: string,
  de: readonly StatusDePedido[],
  para: StatusDePedido,
  quando: Date = new Date(),
): Promise<Pedido | null> {
  const coluna = COLUNA_DO_STATUS[para]
  const { data, error } = await db()
    .from('pedidos')
    .update({ status: para, ...(coluna ? { [coluna]: quando.toISOString() } : {}) })
    .eq('cliente_id', clienteId)
    .eq('id', id)
    .in('status', [...de])
    .select(COLUNAS)
  if (ehIdInvalido(error) || tabelaAusente(error)) return null
  if (error) throw new Error(`não foi possível mudar o pedido para ${para}: ${error.message}`)
  const linhas = (data ?? []) as unknown as Linha[]
  return linhas[0] ? paraPedido(linhas[0]) : null
}

// ---------------------------------------------------------------------------
// Estoque
// ---------------------------------------------------------------------------

export type Baixa = { produtoId: string; nome: string; quantidade: number }

/** Soma `delta` ao estoque do produto, se ele controla. Devolve o que ficou, ou `null` quando não controla. */
async function somarAoEstoque(
  clienteId: string,
  produtoId: string,
  delta: number,
): Promise<{ ok: true; ficou: number | null } | { ok: false; havia: number }> {
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const { data, error } = await db()
      .from('produtos')
      .select('estoque')
      .eq('client_id', clienteId)
      .eq('id', produtoId)
      .maybeSingle()
    if (error) throw new Error(`não foi possível ler o estoque: ${error.message}`)
    const havia = (data as { estoque: number | null } | null)?.estoque ?? null
    if (havia === null) return { ok: true, ficou: null }
    const novo = havia + delta
    if (novo < 0) return { ok: false, havia }

    const { data: gravado, error: erroAoGravar } = await db()
      .from('produtos')
      .update({ estoque: novo })
      .eq('client_id', clienteId)
      .eq('id', produtoId)
      .eq('estoque', havia)
      .select('id')
    if (erroAoGravar) throw new Error(`não foi possível gravar o estoque: ${erroAoGravar.message}`)
    if ((gravado ?? []).length > 0) return { ok: true, ficou: novo }
  }
  throw new Error('o estoque mudou demais enquanto a venda era gravada')
}

/**
 * Baixa o estoque de todos os itens, ou de nenhum: faltou um, devolve os que
 * já tinham baixado e recusa com "X tem só N".
 */
export async function reservarEstoque(
  clienteId: string,
  baixas: readonly Baixa[],
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const feitas: Baixa[] = []
  try {
    for (const b of baixas) {
      const r = await somarAoEstoque(clienteId, b.produtoId, -b.quantidade)
      if (!r.ok) {
        await devolverEstoque(clienteId, feitas)
        return {
          ok: false,
          erro: r.havia === 0 ? `${b.nome} está esgotado.` : `${b.nome} tem só ${r.havia} em estoque.`,
        }
      }
      feitas.push(b)
    }
  } catch (erro) {
    await devolverEstoque(clienteId, feitas)
    throw erro
  }
  return { ok: true }
}

/** Devolve ao estoque. Produto que deixou de controlar fica como está. */
export async function devolverEstoque(clienteId: string, baixas: readonly Baixa[]): Promise<void> {
  for (const b of baixas) {
    await somarAoEstoque(clienteId, b.produtoId, b.quantidade).catch((erro) =>
      console.error('[pedidos] o estoque não voltou', b.produtoId, erro),
    )
  }
}

/** O estoque do item do catálogo, à mão. `null` deixa de controlar. */
export async function definirEstoque(
  clienteId: string,
  produtoId: string,
  estoque: number | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (estoque !== null && (!Number.isInteger(estoque) || estoque < 0 || estoque > 1_000_000)) {
    return { ok: false, motivo: 'O estoque é um número inteiro, de 0 para cima.' }
  }
  const { data, error } = await db()
    .from('produtos')
    .update({ estoque, atualizado_em: new Date().toISOString() })
    .eq('client_id', clienteId)
    .eq('id', produtoId)
    .select('id')
  if (ehIdInvalido(error)) return { ok: false, motivo: 'Esse item do catálogo não existe.' }
  if (error) return { ok: false, motivo: `Não foi possível salvar o estoque: ${error.message}` }
  if ((data ?? []).length === 0) return { ok: false, motivo: 'Esse item do catálogo não existe.' }
  return { ok: true }
}
