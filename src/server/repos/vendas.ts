import 'server-only'
import {
  conferirVenda,
  resumirVendas,
  type ItemDaVenda,
  type ResumoDeVendas,
  type SituacaoDaVenda,
} from '@/core/vendas'
import { db, ehIdInvalido } from '../db'

/**
 * A venda no banco (0071).
 *
 * Como todo `repos/`: só ida ao banco, sem regra. Quem decide o que é total
 * válido, o que conta e o que é desconhecido é `core/vendas.ts`.
 *
 * O que este arquivo garante, e que a tela não consegue garantir sozinha:
 *
 *  - **idempotência** — duplo clique e retry de rede devolvem a MESMA venda,
 *    pela `chave_da_operacao` (A13);
 *  - **uma venda válida por oportunidade** — o índice parcial recusa a segunda,
 *    e a recusa vira mensagem em vez de 500 (RB-05);
 *  - **cancelar não apaga** — o registro fica, com motivo e data (RB-31).
 */

type LinhaDaVenda = {
  id: string
  client_id: string
  contact_id: string
  cartao_id: string
  data_da_venda: string
  valor_total: string | number | null
  moeda: string
  situacao: string
  nota: string | null
  criado_em: string
}

const COLUNAS =
  'id, client_id, contact_id, cartao_id, data_da_venda, valor_total, moeda, situacao, nota, criado_em'

export type VendaGravada = {
  id: string
  contatoId: string
  cartaoId: string
  dataDaVenda: string
  /** `numeric` chega como string no supabase-js; convertido aqui, uma vez só. */
  valorTotal: number | null
  moeda: string
  situacao: SituacaoDaVenda
  nota: string | null
  criadoEm: string
}

function paraVenda(linha: LinhaDaVenda): VendaGravada {
  return {
    id: linha.id,
    contatoId: linha.contact_id,
    cartaoId: linha.cartao_id,
    dataDaVenda: linha.data_da_venda,
    // Somar sem converter concatenaria "200" com "350.50".
    valorTotal: linha.valor_total === null ? null : Number(linha.valor_total),
    moeda: linha.moeda,
    situacao: linha.situacao === 'cancelada' ? 'cancelada' : 'valida',
    nota: linha.nota,
    criadoEm: linha.criado_em,
  }
}

export type PedidoDeVenda = {
  clienteId: string
  contatoId: string
  /** A oportunidade ganha. Uma venda válida por cartão. */
  cartaoId: string
  dataDaVenda: string
  valorTotal?: number | null
  itens?: readonly ItemDaVenda[]
  nota?: string | null
  autor?: string | null
  /**
   * A chave da operação. **Mande sempre** a partir da tela: é ela que faz duplo
   * clique devolver a mesma venda em vez de duas.
   */
  chaveDaOperacao?: string | null
}

export type ResultadoDaVenda =
  | { ok: true; venda: VendaGravada; repetida: boolean }
  | { ok: false; motivo: string }

/**
 * Registra a venda.
 *
 * `repetida: true` quer dizer "esta operação já tinha sido feita, e devolvi o
 * que existe". É sucesso, não erro: é exatamente o que o segundo clique
 * precisa receber.
 */
export async function registrarVenda(pedido: PedidoDeVenda): Promise<ResultadoDaVenda> {
  const conferido = conferirVenda({
    dataDaVenda: pedido.dataDaVenda,
    valorTotal: pedido.valorTotal ?? null,
    itens: pedido.itens ?? [],
    nota: pedido.nota ?? null,
  })
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  // O caminho idempotente vem antes do insert: se a operação já passou por
  // aqui, nem tentamos escrever.
  if (pedido.chaveDaOperacao) {
    const jaFeita = await porChaveDaOperacao(pedido.clienteId, pedido.chaveDaOperacao)
    if (jaFeita) return { ok: true, venda: jaFeita, repetida: true }
  }

  const { data, error } = await db()
    .from('vendas')
    .insert({
      client_id: pedido.clienteId,
      contact_id: pedido.contatoId,
      cartao_id: pedido.cartaoId,
      data_da_venda: pedido.dataDaVenda.slice(0, 10),
      valor_total: pedido.valorTotal ?? null,
      nota: pedido.nota ?? null,
      autor: pedido.autor ?? null,
      chave_da_operacao: pedido.chaveDaOperacao ?? null,
    })
    .select(COLUNAS)
    .single()

  if (error) {
    /*
     * 23505 aqui tem duas causas, e elas pedem respostas diferentes:
     *
     *  - a chave da operação: duas requisições da mesma ação chegaram juntas e
     *    a outra ganhou a corrida. Ler de novo devolve a venda dela — sucesso;
     *  - o índice de uma válida por cartão: alguém está registrando a segunda
     *    compra da mesma oportunidade. É recusa de regra, e vira frase.
     */
    if (error.code === '23505') {
      if (pedido.chaveDaOperacao) {
        const daCorrida = await porChaveDaOperacao(pedido.clienteId, pedido.chaveDaOperacao)
        if (daCorrida) return { ok: true, venda: daCorrida, repetida: true }
      }
      return {
        ok: false,
        motivo:
          'esta oportunidade já tem uma venda registrada. Corrija a venda existente, ' +
          'ou abra outra oportunidade para uma nova compra.',
      }
    }
    return { ok: false, motivo: `não deu para registrar a venda: ${error.message}` }
  }

  const venda = paraVenda(data as LinhaDaVenda)

  if (pedido.itens && pedido.itens.length > 0) {
    const { error: erroDosItens } = await db()
      .from('venda_itens')
      .insert(
        pedido.itens.map((item) => ({
          venda_id: venda.id,
          produto_id: item.produtoId ?? null,
          descricao: item.descricao.trim(),
          quantidade: item.quantidade ?? null,
          valor_unitario: item.valorUnitario ?? null,
        })),
      )

    /*
     * Item que falha não pode deixar uma venda pela metade passando por
     * completa. Sem transação no PostgREST, o desfazer é explícito: apaga a
     * venda e devolve a recusa. `venda_itens` cai junto por cascade.
     */
    if (erroDosItens) {
      await db().from('vendas').delete().eq('id', venda.id)
      return { ok: false, motivo: `não deu para registrar os itens: ${erroDosItens.message}` }
    }
  }

  return { ok: true, venda, repetida: false }
}

/** A venda daquela operação, se ela já tiver sido feita. */
export async function porChaveDaOperacao(
  clienteId: string,
  chave: string,
): Promise<VendaGravada | null> {
  const { data, error } = await db()
    .from('vendas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('chave_da_operacao', chave)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para conferir a operação: ${error.message}`)
  return data ? paraVenda(data as LinhaDaVenda) : null
}

/** A venda válida de uma oportunidade. `null` = ganha sem venda, ou não ganha. */
export async function vendaDoCartao(
  clienteId: string,
  cartaoId: string,
): Promise<VendaGravada | null> {
  const { data, error } = await db()
    .from('vendas')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('situacao', 'valida')
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para ler a venda: ${error.message}`)
  return data ? paraVenda(data as LinhaDaVenda) : null
}

/**
 * Cancela o registro, com motivo.
 *
 * Não apaga (RB-31): o registro continua legível e sai dos indicadores. A
 * situação da oportunidade é resolvida por quem chama — a atomicidade das duas
 * coisas é da T5.2, e fica explícita lá em vez de escondida aqui.
 */
export async function cancelarVenda(
  clienteId: string,
  vendaId: string,
  motivo: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = motivo.trim()
  if (limpo === '') return { ok: false, motivo: 'diga por que a venda está sendo cancelada' }

  const { error } = await db()
    .from('vendas')
    .update({
      situacao: 'cancelada',
      cancelada_em: new Date().toISOString(),
      motivo_do_cancelamento: limpo,
      atualizado_em: new Date().toISOString(),
    })
    .eq('client_id', clienteId)
    .eq('id', vendaId)
    .eq('situacao', 'valida')

  if (error) return { ok: false, motivo: `não deu para cancelar: ${error.message}` }
  return { ok: true }
}

/**
 * O resumo comercial de um contato, **a partir das vendas**.
 *
 * É a substituição de `resumoDoContato` de `repos/crm.ts`, que contava cartão
 * ganho em qualquer quadro e por isso transformava atendimento em compra.
 */
export async function resumoDeVendas(
  clienteId: string,
  contatoId: string,
): Promise<ResumoDeVendas> {
  const { data, error } = await db()
    .from('vendas')
    .select('valor_total, situacao, data_da_venda')
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)

  if (ehIdInvalido(error)) return resumirVendas([])
  if (error) throw new Error(`não deu para ler as vendas: ${error.message}`)

  return resumirVendas(
    (data as { valor_total: string | number | null; situacao: string; data_da_venda: string }[]).map(
      (linha) => ({
        valorTotal: linha.valor_total === null ? null : Number(linha.valor_total),
        situacao: linha.situacao === 'cancelada' ? ('cancelada' as const) : ('valida' as const),
        dataDaVenda: linha.data_da_venda,
      }),
    ),
  )
}
