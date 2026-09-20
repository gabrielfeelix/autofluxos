/**
 * A venda: o registro explícito de uma compra confirmada (0071).
 *
 * ---------------------------------------------------------------------------
 * Por que a venda existe separada do cartão
 * ---------------------------------------------------------------------------
 *
 * Antes, "ganhou o cartão" **era** a venda: o valor morava em
 * `quadro_cartoes.valor` e a data era `fechado_em`. Isso confunde três coisas
 * que a proposta separa (RB-05, RB-29, RB-31):
 *
 *   - a **oportunidade** foi ganha (estado da negociação);
 *   - houve uma **compra** (fato comercial, com data própria, que pode ser
 *     diferente do dia em que alguém arrastou o cartão);
 *   - a compra foi **paga** (fato financeiro, que não acompanhamos).
 *
 * Separar permite o que o produto precisa: corrigir o valor sem reabrir a
 * negociação, cancelar a venda sem apagar o histórico, e dizer "comprou, não
 * sei quanto" sem que isso vire R$ 0,00 numa soma.
 *
 * Puro e sem rede. Quem grava é `repos/vendas.ts`.
 */

/**
 * Situação de um registro de venda.
 *
 * `cancelada` não apaga: o registro continua legível, com motivo e autor, e
 * sai dos indicadores (RB-31). Apagar tornaria impossível explicar por que o
 * total do mês mudou.
 */
export const SITUACOES_DA_VENDA = ['valida', 'cancelada'] as const

export type SituacaoDaVenda = (typeof SITUACOES_DA_VENDA)[number]

export function ehSituacaoDaVenda(valor: unknown): valor is SituacaoDaVenda {
  return typeof valor === 'string' && (SITUACOES_DA_VENDA as readonly string[]).includes(valor)
}

/** A primeira versão opera em BRL. Ver RB "não somar moedas diferentes". */
export const MOEDA_PADRAO = 'BRL'

export type ItemDaVenda = {
  /** O produto do catálogo, quando houver. Venda descrita só em texto não tem. */
  produtoId?: string | null
  /**
   * O nome **da época**. Guardado junto, e não buscado no catálogo na leitura:
   * renomear o produto não pode reescrever o histórico (RB "itens de venda
   * preservam nome e valor da época").
   */
  descricao: string
  /** `null` é "não informado", e nunca 1 por conveniência. */
  quantidade?: number | null
  /** Valor unitário conhecido, em BRL. `null` é desconhecido. */
  valorUnitario?: number | null
}

export type Venda = {
  id: string
  oportunidadeId: string
  /** A data da compra, informada por quem registrou. Não é `criado_em`. */
  dataDaVenda: string
  /** O total conhecido. `null` quer dizer **não informado**, não zero. */
  valorTotal: number | null
  moeda: string
  situacao: SituacaoDaVenda
  itens: ItemDaVenda[]
  nota?: string | null
}

// ---------------------------------------------------------------------------
// Valor: o desconhecido não pode virar zero
// ---------------------------------------------------------------------------

/**
 * O total dos itens, **quando todos forem conhecidos**.
 *
 * Devolve `null` se faltar qualquer quantidade ou valor unitário. É a regra do
 * RB-06 aplicada à aritmética: somar tratando ausente como zero produziria um
 * total menor que a verdade e com cara de exato.
 *
 * Lista vazia também é `null`, e não 0: venda sem item detalhado não afirma
 * que custou nada.
 */
export function totalDosItens(itens: readonly ItemDaVenda[]): number | null {
  if (itens.length === 0) return null

  let soma = 0
  for (const item of itens) {
    if (item.quantidade == null || item.valorUnitario == null) return null
    soma += item.quantidade * item.valorUnitario
  }
  return arredondar(soma)
}

/** Centavos, sem o ruído de ponto flutuante que faria 1.1*3 virar 3.3000000000000003. */
function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100
}

export type ConferenciaDoTotal =
  | { ok: true }
  | { ok: false; motivo: string; totalDosItens: number }

/**
 * O total informado bate com os itens?
 *
 * Só dá para conferir quando **todos** os itens são conhecidos (RB-30, "valor
 * total informado precisa ser consistente com os itens quando todos forem
 * conhecidos"). Item incompleto não autoriza recusar o total que a pessoa
 * digitou: ela pode saber o total sem saber a composição.
 *
 * A tolerância de um centavo existe porque desconto e arredondamento de
 * unitário produzem diferença legítima; acima disso é contradição, e a
 * proposta pede representação explícita em vez de soma silenciosa.
 */
export function conferirTotal(
  valorTotal: number | null,
  itens: readonly ItemDaVenda[],
): ConferenciaDoTotal {
  if (valorTotal == null) return { ok: true }

  const dosItens = totalDosItens(itens)
  if (dosItens === null) return { ok: true }

  if (Math.abs(dosItens - valorTotal) <= 0.01) return { ok: true }

  return {
    ok: false,
    motivo:
      `o total informado (${valorTotal.toFixed(2)}) não bate com a soma dos itens ` +
      `(${dosItens.toFixed(2)}). Ajuste os itens, o total, ou registre o desconto como item.`,
    totalDosItens: dosItens,
  }
}

// ---------------------------------------------------------------------------
// Régua de um registro novo
// ---------------------------------------------------------------------------

export type Rascunho = {
  dataDaVenda: string
  valorTotal?: number | null
  itens?: readonly ItemDaVenda[]
  nota?: string | null
}

export type Conferencia = { ok: true } | { ok: false; motivo: string }

/**
 * A venda pode ser registrada?
 *
 * A régua é curta de propósito: a proposta quer que registrar venda seja fácil
 * e honesto, não completo. Data é obrigatória porque sem ela não há recência
 * nem "cliente sem comprar há X dias" (RB-35). Valor **não** é obrigatório:
 * "comprou, não sei quanto" é resposta legítima e frequente.
 */
export function conferirVenda(rascunho: Rascunho, agora: number = Date.now()): Conferencia {
  const data = Date.parse(rascunho.dataDaVenda)
  if (Number.isNaN(data)) return { ok: false, motivo: 'informe a data da venda' }

  // Um dia de folga cobre fuso da empresa à frente do servidor sem abrir a
  // porta para data digitada errada por anos.
  if (data > agora + 86_400_000) {
    return { ok: false, motivo: 'a data da venda não pode estar no futuro' }
  }

  if (rascunho.valorTotal != null) {
    if (!Number.isFinite(rascunho.valorTotal)) {
      return { ok: false, motivo: 'o valor total precisa ser um número' }
    }
    if (rascunho.valorTotal < 0) {
      return { ok: false, motivo: 'o valor total não pode ser negativo' }
    }
  }

  for (const item of rascunho.itens ?? []) {
    if (item.descricao.trim() === '') {
      return { ok: false, motivo: 'todo item precisa de uma descrição' }
    }
    if (item.quantidade != null && item.quantidade <= 0) {
      return { ok: false, motivo: `quantidade inválida em "${item.descricao}"` }
    }
    if (item.valorUnitario != null && item.valorUnitario < 0) {
      return { ok: false, motivo: `valor inválido em "${item.descricao}"` }
    }
  }

  const conferido = conferirTotal(rascunho.valorTotal ?? null, rascunho.itens ?? [])
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// O que as vendas somam
// ---------------------------------------------------------------------------

export type ResumoDeVendas = {
  /** Quantas compras válidas. Cancelada não conta. */
  compras: number
  /** A soma **do que se sabe**. Não é "a receita": ver `semValor`. */
  totalConhecido: number
  /** Quantas válidas não têm valor informado. A tela precisa dizer isso. */
  semValor: number
  /** A data da compra válida mais recente. `null` = nenhuma. */
  ultimaEm: string | null
}

/**
 * O resumo comercial de um contato, a partir das vendas dele.
 *
 * Duas coisas que a versão antiga (`resumoDoCliente`, em `core/crm.ts`) não
 * fazia e que a proposta exige:
 *
 * 1. **cancelada não conta** — nem no total, nem na contagem, nem na recência;
 * 2. **`semValor` é devolvido** — para a tela poder dizer "3 compras, R$ 500
 *    conhecidos, há vendas sem valor informado" em vez de apresentar R$ 500
 *    como se fosse tudo (RB-06).
 */
export function resumirVendas(
  vendas: readonly Pick<Venda, 'valorTotal' | 'situacao' | 'dataDaVenda'>[],
): ResumoDeVendas {
  let compras = 0
  let totalConhecido = 0
  let semValor = 0
  let ultimaEm: string | null = null

  for (const venda of vendas) {
    if (venda.situacao !== 'valida') continue

    compras += 1
    if (venda.valorTotal == null) semValor += 1
    else totalConhecido += venda.valorTotal

    if (ultimaEm === null || venda.dataDaVenda > ultimaEm) ultimaEm = venda.dataDaVenda
  }

  return { compras, totalConhecido: arredondar(totalConhecido), semValor, ultimaEm }
}
