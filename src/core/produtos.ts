/**
 * O catálogo mínimo (0079).
 *
 * ---------------------------------------------------------------------------
 * Por que ele é mínimo, e por que isso é uma decisão e não preguiça
 * ---------------------------------------------------------------------------
 *
 * Produto/serviço, nome, ativo/arquivado. Nada de estoque, imposto, SKU ou
 * ERP. O catálogo existe para responder duas perguntas do produto:
 *
 *   - "no que esta oportunidade está interessada?"
 *   - "quem comprou o Plano XYZ nos últimos 90 dias?" (RB-36, na F6)
 *
 * Nenhuma das duas exige cadastro fiscal, e tentar incluí-lo agora faria a
 * empresa ter que recadastrar o catálogo inteiro antes de registrar a primeira
 * venda.
 *
 * ---------------------------------------------------------------------------
 * O que este arquivo NÃO decide
 * ---------------------------------------------------------------------------
 *
 * O nome e o valor **da época** de uma venda moram em `venda_itens` (0071),
 * não aqui. Renomear "Plano Ouro" para "Plano Premium" não pode reescrever o
 * que foi vendido em março. Este cadastro é vínculo, não fonte do histórico,
 * e é por isso que arquivar não apaga.
 *
 * Puro e sem rede. Quem grava é `server/repos/produtos.ts`.
 */

/**
 * Produto ou serviço.
 *
 * A distinção é do vocabulário de quem vende e aparece na tela. O sistema
 * trata os dois igual de propósito: separar o comportamento exigiria saber o
 * que muda entre eles, e nada no produto muda hoje.
 */
export const ESPECIES = ['produto', 'servico'] as const

export type Especie = (typeof ESPECIES)[number]

export function ehEspecie(valor: unknown): valor is Especie {
  return typeof valor === 'string' && (ESPECIES as readonly string[]).includes(valor)
}

/** Como cada espécie se chama na tela. Minúsculo: é rótulo, não título. */
export const NOME_DA_ESPECIE: Record<Especie, string> = {
  produto: 'produto',
  servico: 'serviço',
}

export type Produto = {
  id: string
  nome: string
  especie: Especie
  /** `null` = ativo. Data = arquivado naquele instante, e ainda legível. */
  arquivadoEm: string | null
}

/** Arquivado impede uso novo e preserva leitura (RB-24). */
export function estaAtivo(produto: Pick<Produto, 'arquivadoEm'>): boolean {
  return produto.arquivadoEm === null
}

export type Conferencia = { ok: true; nome: string } | { ok: false; motivo: string }

/**
 * O nome serve?
 *
 * O limite de 120 não é estético: o nome entra em `venda_itens.descricao`, que
 * vira linha de histórico e coluna de exportação. Nome de parágrafo inteiro
 * quebra as duas e ninguém percebe até a exportação sair ilegível.
 */
export function conferirNome(bruto: string): Conferencia {
  const nome = bruto.trim()
  if (nome === '') return { ok: false, motivo: 'dê um nome ao item do catálogo' }
  if (nome.length > 120) return { ok: false, motivo: 'o nome precisa ter até 120 caracteres' }
  return { ok: true, nome }
}

/**
 * Os produtos que podem ser escolhidos **agora**.
 *
 * Existe porque a lista de seleção e a lista de leitura são diferentes: quem
 * está registrando uma venda hoje não pode escolher um item arquivado, mas
 * quem lê uma venda de março precisa ver o nome do que foi arquivado depois.
 * Uma consulta só, com um `filter()` na tela, erraria um dos dois lados.
 */
export function selecionaveis(produtos: readonly Produto[]): Produto[] {
  return produtos.filter(estaAtivo)
}
