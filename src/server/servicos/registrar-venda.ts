import 'server-only'
import { conferirVenda, type ItemDaVenda } from '@/core/vendas'
import { db } from '../db'

/**
 * Registrar a venda e concluir a oportunidade, **juntas** (T5.2).
 *
 * ---------------------------------------------------------------------------
 * Por que isto é serviço, e não mais uma função em `repos/vendas.ts`
 * ---------------------------------------------------------------------------
 *
 * `repos/vendas.ts` grava a venda, e faz isso bem. O que ele não pode fazer,
 * por definição, é garantir que a venda e o fechamento do cartão valham
 * juntos: são duas tabelas, o PostgREST não tem transação entre requisições, e
 * coordenar as duas em TypeScript seria fingir que tem.
 *
 * Os dois sentidos da falha, e nenhum é aceitável (RB-30, RB-31):
 *
 *   - conclui sem gravar a venda: oportunidade ganha **sem venda válida**;
 *   - grava a venda sem concluir: o índice de uma-válida-por-cartão passa a
 *     recusar a tentativa seguinte, e ninguém entende por quê.
 *
 * A transação é da `registrar_venda_e_concluir` da 0080. Este arquivo é a
 * porta: confere a régua de `core/vendas.ts` antes, traduz o que volta, e
 * transforma a recusa do índice em frase em vez de 500.
 *
 * ---------------------------------------------------------------------------
 * O que "registrada" quer dizer, e o que NÃO quer
 * ---------------------------------------------------------------------------
 *
 * Quer dizer que a empresa **confirmou a compra**. Não quer dizer que ela foi
 * paga (RB-29). Não há nada aqui sobre pagamento, e a ausência é deliberada:
 * pagamento tem origem própria e conciliação própria, e um campo `pago` neste
 * caminho viraria um número que o financeiro não reconhece.
 */

export type PedidoDeVendaComFechamento = {
  clienteId: string
  cartaoId: string
  dataDaVenda: string
  /** `null` é **não informado**, e nunca zero (RB-30). */
  valorTotal?: number | null
  itens?: readonly ItemDaVenda[]
  nota?: string | null
  autor?: string | null
  /**
   * A chave da operação. **Mande sempre** a partir da tela, uma por formulário
   * aberto. É ela que faz o botão "tente de novo" ser retry em vez de uma
   * segunda compra, no caso da resposta perdida.
   */
  chaveDaOperacao?: string | null
}

export type VendaRegistrada = {
  vendaId: string
  contatoId: string
  cartaoId: string
  dataDaVenda: string
  valorTotal: number | null
  situacao: 'valida' | 'cancelada'
}

export type ResultadoDoRegistro =
  | { ok: true; venda: VendaRegistrada; repetida: boolean }
  | { ok: false; motivo: string }

type LinhaDoRpc = {
  o_venda_id: string
  o_contact_id: string
  o_cartao_id: string
  o_data_da_venda: string
  o_valor_total: string | number | null
  o_situacao: string
  o_repetida: boolean
}

export async function registrarVendaEConcluir(
  pedido: PedidoDeVendaComFechamento,
): Promise<ResultadoDoRegistro> {
  // A régua antes da ida ao banco: data no futuro, valor negativo e total que
  // não bate com os itens viram frase aqui, e não erro de Postgres lá.
  const conferido = conferirVenda({
    dataDaVenda: pedido.dataDaVenda,
    valorTotal: pedido.valorTotal ?? null,
    itens: pedido.itens ?? [],
    nota: pedido.nota ?? null,
  })
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const { data, error } = await db().rpc('registrar_venda_e_concluir', {
    p_client_id: pedido.clienteId,
    p_cartao_id: pedido.cartaoId,
    p_data_da_venda: pedido.dataDaVenda.slice(0, 10),
    p_valor_total: pedido.valorTotal ?? null,
    p_nota: pedido.nota ?? null,
    p_autor: pedido.autor ?? null,
    p_chave: pedido.chaveDaOperacao ?? null,
    p_itens: (pedido.itens ?? []).map((item) => ({
      produtoId: item.produtoId ?? null,
      descricao: item.descricao.trim(),
      quantidade: item.quantidade ?? null,
      valorUnitario: item.valorUnitario ?? null,
    })),
  })

  if (error) {
    // 23505 aqui só pode ser o índice de uma válida por cartão: a chave da
    // operação já foi tratada dentro da função. É recusa de regra, e vira
    // frase (RB-31: não criar duas compras válidas para a mesma oportunidade).
    if (error.code === '23505') {
      return {
        ok: false,
        motivo:
          'esta oportunidade já tem uma venda registrada. Corrija a venda existente, ' +
          'ou abra outra oportunidade para uma nova compra.',
      }
    }
    return { ok: false, motivo: `não deu para registrar a venda: ${error.message}` }
  }

  // Conjunto vazio é recusa: cartão de outra conta, apagado, ou já fechado sem
  // venda válida. O último é o "ganhar de novo" que não pode virar segunda
  // compra, e a frase precisa dizer o que aconteceu.
  const linhas = (data ?? []) as unknown as LinhaDoRpc[]
  const primeira = linhas[0]
  if (!primeira) {
    return {
      ok: false,
      motivo: 'esta oportunidade não está aberta. Reabra antes de registrar a venda.',
    }
  }

  return {
    ok: true,
    venda: {
      vendaId: primeira.o_venda_id,
      contatoId: primeira.o_contact_id,
      cartaoId: primeira.o_cartao_id,
      dataDaVenda: primeira.o_data_da_venda,
      // `numeric` chega como string no supabase-js. Sem converter, somar
      // concatenaria "200" com "350.50".
      valorTotal: primeira.o_valor_total === null ? null : Number(primeira.o_valor_total),
      situacao: primeira.o_situacao === 'cancelada' ? 'cancelada' : 'valida',
    },
    repetida: primeira.o_repetida === true,
  }
}

export type DestinoDaOportunidade = 'reabrir' | 'perdida'

export type ResultadoDoCancelamento =
  | { ok: true; cartaoId: string; situacaoDoCartao: string }
  | { ok: false; motivo: string }

/**
 * Cancela a venda e resolve a oportunidade, **juntos** (RB-31).
 *
 * O destino é obrigatório e não tem default, porque não existe terceiro
 * caminho: ou a negociação volta a estar aberta, ou ela foi perdida. Deixar o
 * cartão ganho com a venda cancelada é o estado que esta função existe para
 * impedir.
 *
 * **Não apaga nada.** O registro fica com motivo e data, e sai dos
 * indicadores. Apagar tornaria impossível explicar por que o total do mês
 * mudou, e é por isso que `revisoes_de_venda` guarda o estado anterior
 * inteiro.
 *
 * Isto **não** é estorno financeiro, e quem chama precisa dizer isso na tela.
 */
export async function cancelarVendaEResolver(pedido: {
  clienteId: string
  vendaId: string
  motivo: string
  destino: DestinoDaOportunidade
  motivoDaPerda?: string | null
  autor?: string | null
}): Promise<ResultadoDoCancelamento> {
  const motivo = pedido.motivo.trim()
  if (motivo === '') return { ok: false, motivo: 'diga por que a venda está sendo cancelada' }

  // Perder exige motivo, pela mesma razão que o fechamento normal exige: um
  // relatório de perdas com 80% de "não informado" é o mesmo que não ter
  // registrado nada.
  if (pedido.destino === 'perdida' && (pedido.motivoDaPerda ?? '').trim() === '') {
    return { ok: false, motivo: 'escolha o motivo da perda' }
  }

  const { data, error } = await db().rpc('cancelar_venda_e_resolver', {
    p_client_id: pedido.clienteId,
    p_venda_id: pedido.vendaId,
    p_motivo: motivo,
    p_destino: pedido.destino,
    p_motivo_da_perda: pedido.motivoDaPerda ?? null,
    p_autor: pedido.autor ?? null,
  })

  if (error) return { ok: false, motivo: `não deu para cancelar: ${error.message}` }

  const linhas = (data ?? []) as unknown as {
    o_venda_id: string
    o_cartao_id: string
    o_situacao_do_cartao: string
  }[]
  const primeira = linhas[0]
  if (!primeira) return { ok: false, motivo: 'esta venda não existe mais' }

  return {
    ok: true,
    cartaoId: primeira.o_cartao_id,
    situacaoDoCartao: primeira.o_situacao_do_cartao,
  }
}
