/**
 * O catálogo mínimo (0079).
 *
 * ---------------------------------------------------------------------------
 * Por que ele é mínimo, e por que isso é uma decisão e não preguiça
 * ---------------------------------------------------------------------------
 *
 * Produto/serviço, nome, preço, ativo/arquivado, e desde a 0093 o que o card
 * precisa (SKU, descrição, link, foto). Nada de estoque, imposto ou ERP. O
 * catálogo existe para responder três perguntas do produto:
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
  /**
   * O que o card do produto precisa (0093). Todos opcionais: o catálogo do CRM
   * vive sem eles, e item sem foto sai como texto com link.
   */
  sku: string | null
  descricao: string | null
  /** Só `https://`, o banco recusa o resto. */
  link: string | null
  foto: string | null
  /**
   * O grupo do item (0106): "Pizzas", "Bebidas". `null` = sem categoria, e o
   * item vai para o fim da lista, num grupo sem nome.
   */
  categoria: string | null
  /**
   * A posição que o dono escolheu dentro da categoria. `null` = ninguém
   * ordenou ainda: fica depois dos ordenados, pelo nome.
   */
  ordem: number | null
  /** `null` = ativo. Data = arquivado naquele instante, e ainda legível. */
  arquivadoEm: string | null
}

/** Arquivado impede uso novo e preserva leitura (RB-24). */
export function estaAtivo(produto: Pick<Produto, 'arquivadoEm'>): boolean {
  return produto.arquivadoEm === null
}

export type Conferencia = { ok: true; nome: string } | { ok: false; motivo: string }

export type ConferenciaDeCategoria =
  | { ok: true; categoria: string | null }
  | { ok: false; motivo: string }

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
 * A categoria serve?
 *
 * Vazio é "sem categoria" e não erro: o catálogo que existia antes da 0106
 * vive sem ela. O teto de 60 é o `check` do banco, repetido aqui para a
 * recusa chegar em português. Espaço repetido vira um só: "Pizzas  doces" e
 * "Pizzas doces" digitados em dias diferentes seriam dois grupos na grade.
 */
export function conferirCategoria(bruto: string): ConferenciaDeCategoria {
  const categoria = bruto.trim().replace(/\s+/g, ' ')
  if (categoria === '') return { ok: true, categoria: null }
  if (categoria.length > 60) return { ok: false, motivo: 'a categoria precisa ter até 60 caracteres' }
  return { ok: true, categoria }
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

/** Compara texto como a tela lê: sem caixa e sem acento ("Água" antes de "Bebidas"). */
const COMPARAR_TEXTO = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true }).compare

/**
 * A ordem do catálogo: categoria, depois a ordem do dono, depois o nome.
 *
 * Nulo vai por último nos dois primeiros critérios, e não é detalhe: item sem
 * categoria no topo empurraria o cardápio para baixo de uma pilha de itens que
 * o dono ainda não organizou, e item sem ordem antes dos ordenados desfaria a
 * ordem que ele escolheu. É a mesma regra para a tela, para a busca do bot e
 * para a grade: uma função só, para as três não discordarem.
 */
export function compararNoCatalogo(
  a: Pick<Produto, 'categoria' | 'ordem' | 'nome'>,
  b: Pick<Produto, 'categoria' | 'ordem' | 'nome'>,
): number {
  if (a.categoria !== b.categoria) {
    if (a.categoria === null) return 1
    if (b.categoria === null) return -1
    const porCategoria = COMPARAR_TEXTO(a.categoria, b.categoria)
    if (porCategoria !== 0) return porCategoria
  }
  if (a.ordem !== b.ordem) {
    if (a.ordem === null) return 1
    if (b.ordem === null) return -1
    return a.ordem - b.ordem
  }
  return COMPARAR_TEXTO(a.nome, b.nome)
}

/** Mesmo grupo na grade: sem distinguir caixa nem acento, e nulo só com nulo. */
export function mesmaCategoria(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  return COMPARAR_TEXTO(a, b) === 0
}

export function ordenarCatalogo<T extends Pick<Produto, 'categoria' | 'ordem' | 'nome'>>(produtos: readonly T[]): T[] {
  return [...produtos].sort(compararNoCatalogo)
}

/** Um grupo da grade. `categoria: null` é o grupo "sem categoria", sempre o último. */
export type GrupoDoCatalogo<T> = { categoria: string | null; itens: T[] }

/**
 * Agrupa por categoria, na ordem do catálogo.
 *
 * "pizzas" e "Pizzas" caem no mesmo grupo, com o nome do primeiro item que
 * aparecer: o dono que digitou com caixa diferente em dois dias quis dizer a
 * mesma coisa, e dois grupos quase iguais na grade seriam ruído.
 */
export function agruparPorCategoria<T extends Pick<Produto, 'categoria' | 'ordem' | 'nome'>>(
  produtos: readonly T[],
): GrupoDoCatalogo<T>[] {
  const grupos: GrupoDoCatalogo<T>[] = []
  for (const p of ordenarCatalogo(produtos)) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo !== undefined && mesmaCategoria(ultimo.categoria, p.categoria)) ultimo.itens.push(p)
    else grupos.push({ categoria: p.categoria, itens: [p] })
  }
  return grupos
}

/** As categorias já usadas, sem repetir, para a tela sugerir ao digitar. */
export function categoriasUsadas(produtos: readonly Pick<Produto, 'categoria' | 'ordem' | 'nome'>[]): string[] {
  return agruparPorCategoria(produtos).flatMap((g) => (g.categoria === null ? [] : [g.categoria]))
}

/**
 * Subir ou descer um item dentro da categoria dele.
 *
 * Devolve só as linhas cuja `ordem` muda. A categoria inteira é renumerada de
 * 1 em diante na ordem que a tela mostra, e não só os dois itens trocados:
 * enquanto houver item com `ordem` nula, trocar dois números não mexe em quem
 * não tem número, e o clique pareceria não funcionar. Renumerar na primeira
 * vez resolve de uma vez, e daí em diante cada clique muda duas linhas.
 *
 * Primeiro item subindo ou último descendo devolve vazio: não há para onde ir.
 */
export function mover<T extends Pick<Produto, 'id' | 'categoria' | 'ordem' | 'nome'>>(
  daCategoria: readonly T[],
  produtoId: string,
  direcao: 'subir' | 'descer',
): { id: string; ordem: number }[] {
  const lista = ordenarCatalogo(daCategoria)
  const de = lista.findIndex((p) => p.id === produtoId)
  const para = direcao === 'subir' ? de - 1 : de + 1
  if (de === -1 || para < 0 || para >= lista.length) return []

  const trocada = [...lista]
  ;[trocada[de], trocada[para]] = [trocada[para]!, trocada[de]!]
  return trocada.flatMap((p, i) => (p.ordem === i + 1 ? [] : [{ id: p.id, ordem: i + 1 }]))
}
