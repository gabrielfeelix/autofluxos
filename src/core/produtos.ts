/**
 * O catálogo mínimo (0079).
 *
 * ---------------------------------------------------------------------------
 * Por que ele é mínimo, e por que isso é uma decisão e não preguiça
 * ---------------------------------------------------------------------------
 *
 * Produto/serviço, nome, preço, ativo/arquivado. Nada de estoque, imposto, SKU
 * ou ERP. O catálogo existe para responder três perguntas do produto:
 *
 *   - "no que esta oportunidade está interessada?"
 *   - "quem comprou o Plano XYZ nos últimos 90 dias?" (RB-36, na F6)
 *   - "quanto custa o Plano XYZ?", que é a pergunta do bot (0091)
 *
 * Nenhuma das três exige cadastro fiscal, e tentar incluí-lo agora faria a
 * empresa ter que recadastrar o catálogo inteiro antes de registrar a primeira
 * venda.
 *
 * ---------------------------------------------------------------------------
 * O preço chegou depois, e a recusa antiga continua de pé
 * ---------------------------------------------------------------------------
 *
 * A 0079 recusou preço com um argumento bom: preço de tabela vira "uma segunda
 * verdade que ninguém atualiza". O que mudou não foi o argumento, foi o leitor.
 * Enquanto o catálogo só era lido por gente, o preço era redundante, quem
 * registrava a venda sabia o valor. O bot não sabe: sem preço na oferta ele não
 * diz quanto custa nem recomenda.
 *
 * Então o preço aqui é **a oferta de hoje**, nunca o histórico, e as duas
 * coisas não se misturam em lugar nenhum do código.
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

import { lerValor } from './crm'

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
  /**
   * O preço de oferta de hoje, em BRL.
   *
   * `null` é **"não informado", e nunca 0**. É a mesma regra do
   * `vendas.valorTotal`, e a distinção não é preciosismo: colapsar as duas
   * faria o bot anunciar "sai de graça" para todo item que o dono ainda não
   * cadastrou, que é o pior erro que este campo pode cometer. Zero segue
   * válido de propósito, para brinde e plano gratuito, só não é o default.
   */
  preco: number | null
  /** `null` = ativo. Data = arquivado naquele instante, e ainda legível. */
  arquivadoEm: string | null
}

/** Arquivado impede uso novo e preserva leitura (RB-24). */
export function estaAtivo(produto: Pick<Produto, 'arquivadoEm'>): boolean {
  return produto.arquivadoEm === null
}

export type Conferencia = { ok: true; nome: string } | { ok: false; motivo: string }

export type ConferenciaDePreco =
  | { ok: true; preco: number | null }
  | { ok: false; motivo: string }

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
 * O preço serve?
 *
 * Quem entende a grafia é `lerValor`, do `core/crm.ts`, e reusar não é
 * economia: ele já sabe que "1.500" é mil e quinhentos e que "1.50" é um e
 * cinquenta, e um segundo parser daria respostas diferentes para a mesma mão
 * em duas telas do mesmo sistema.
 *
 * O que esta função acrescenta é o teto. `lerValor` recusa acima de dez
 * bilhões porque é o limite do `numeric` das vendas; aqui o limite é menor de
 * propósito, `numeric(12, 2)` guarda dez dígitos antes da vírgula, e um preço
 * de tabela que chega perto disso é dedo escorregado no teclado, não oferta.
 */
export function conferirPreco(bruto: string): ConferenciaDePreco {
  const lido = lerValor(bruto)
  if (!lido.ok) return { ok: false, motivo: lido.motivo }
  if (lido.valor === null) return { ok: true, preco: null }

  if (lido.valor > 9_999_999_99) {
    return { ok: false, motivo: 'esse preço é alto demais, confira o número' }
  }

  return { ok: true, preco: lido.valor }
}

/**
 * Dá para oferecer este item?
 *
 * O bot só anuncia preço que alguém cadastrou. Item sem preço não é item de
 * graça, é item que o dono não configurou, e a diferença é toda a razão de
 * `preco` ser anulável. Quem for montar a oferta pergunta aqui em vez de
 * testar `preco != null` espalhado, que é o teste que mais cedo ou mais tarde
 * alguém escreve como `preco > 0` e some com o brinde da lista.
 */
export function temPrecoInformado(produto: Pick<Produto, 'preco'>): boolean {
  return produto.preco !== null
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
