import { normalizar } from '@/core/engine/interpolar'

/**
 * A cobrança conferida da conversa com IA: o total que sai do catálogo, e
 * não do modelo.
 *
 * ---------------------------------------------------------------------------
 * Por que existe
 * ---------------------------------------------------------------------------
 *
 * A IA somava o pedido de cabeça. A instrução mandava "mostre a conta item a
 * item e confira", e ainda assim era conta de modelo: um preço trocado, uma
 * taxa esquecida, e o Pix sairia com o valor errado. Pedir no prompt é pedir,
 * não é garantir.
 *
 * Aqui a IA só diz **o que** a pessoa quer (itens, quantidade, tamanho,
 * entrega, pagamento). Quem acha o preço é o catálogo da conta, quem soma é
 * este arquivo, em centavos, e quem mostra o resumo é o servidor, com o texto
 * daqui. O total guardado é o que a pessoa leu, e é dele que o pagamento sai.
 *
 * Item que não está no catálogo, ou que bate com mais de um, **é recusado**
 * com o motivo, e a IA pergunta à pessoa em vez de escolher por ela.
 */

export type ItemDoCatalogo = { nome: string; preco: number | null }

/** O que muda o preço, definido pelo dono no bloco: "Média" −8, "Borda" +8. */
export type Ajuste = { nome: string; valor: number }

export type RegrasDaCobranca = {
  /** Taxa de entrega em reais; retirada não paga. */
  taxaEntrega: number
  ajustes: Ajuste[]
}

export const FORMAS_DE_PAGAMENTO = ['pix', 'cartao', 'na_hora'] as const
export type FormaDePagamento = (typeof FORMAS_DE_PAGAMENTO)[number]

const NOME_DA_FORMA: Record<FormaDePagamento, string> = {
  pix: 'Pix',
  cartao: 'Cartão de crédito',
  na_hora: 'Na hora (maquininha ou dinheiro)',
}

export type Cobranca = {
  /** "109,80": o formato de todo valor em reais nas variáveis. */
  total: string
  resumo: string
  pagamento: FormaDePagamento
  entrega: 'entrega' | 'retirada'
}

export type ResultadoDaCobranca = { ok: true; cobranca: Cobranca } | { ok: false; erro: string }

/** Quantos itens por linha, no máximo: acima disso é erro de digitação ou brincadeira. */
export const MAX_QUANTIDADE = 50

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const semMoeda = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')
const centavos = (v: number) => Math.round(v * 100)

/**
 * Acha o item pelo nome: igual (sem acento nem caixa) vence; senão, um único
 * item que contém o nome ou está contido nele. Nenhum ou mais de um é recusa.
 */
function acharItem(nome: string, catalogo: ItemDoCatalogo[]): { ok: true; item: ItemDoCatalogo } | { ok: false; erro: string } {
  const alvo = normalizar(nome).replace(/\s+/g, ' ').trim()
  if (alvo === '') return { ok: false, erro: 'um dos itens veio sem nome' }
  const n = (i: ItemDoCatalogo) => normalizar(i.nome).replace(/\s+/g, ' ').trim()
  const iguais = catalogo.filter((i) => n(i) === alvo)
  const achados = iguais.length > 0 ? iguais : catalogo.filter((i) => n(i).includes(alvo) || alvo.includes(n(i)))
  if (achados.length === 0) return { ok: false, erro: `"${nome}" não está no catálogo` }
  if (achados.length > 1) {
    return { ok: false, erro: `"${nome}" bate com mais de um item (${achados.slice(0, 4).map((i) => i.nome).join(', ')}): pergunte qual` }
  }
  const item = achados[0]!
  if (item.preco === null) return { ok: false, erro: `"${item.nome}" está sem preço no catálogo` }
  return { ok: true, item }
}

/** O ajuste que a variação cita ("média (6 fatias)" cita "Média"), ou nenhum. */
function acharAjuste(variacao: string, ajustes: Ajuste[]): Ajuste | null {
  const v = normalizar(variacao)
  // O nome mais comprido primeiro: "borda recheada" antes de "borda".
  const ordenados = [...ajustes].sort((a, b) => b.nome.length - a.nome.length)
  return ordenados.find((a) => v.includes(normalizar(a.nome))) ?? null
}

/**
 * Monta a cobrança a partir do que a IA passou.
 *
 * `itens`: uma linha por item, separadas por `;` ou quebra de linha, no
 * formato `2 x Pizza Calabresa (Média, Borda recheada)`. Meio a meio é
 * `1 x Calabresa / Mussarela`, e cobra o sabor mais caro. O que vai entre
 * parênteses e não é ajuste do dono ("ao ponto", "sem cebola") sai no resumo
 * como observação, sem mudar o preço.
 */
export function montarCobranca({
  itens,
  entrega,
  pagamento,
  catalogo,
  regras,
}: {
  itens: string
  entrega: string
  pagamento: string
  catalogo: ItemDoCatalogo[]
  regras: RegrasDaCobranca
}): ResultadoDaCobranca {
  const forma = normalizar(pagamento).trim().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '') as FormaDePagamento
  if (!FORMAS_DE_PAGAMENTO.includes(forma)) {
    return { ok: false, erro: `pagamento "${pagamento}" não existe: use pix, cartao ou na_hora` }
  }
  const modo = normalizar(entrega).trim()
  if (modo !== 'entrega' && modo !== 'retirada') {
    return { ok: false, erro: `entrega "${entrega}" não existe: use entrega ou retirada` }
  }

  const linhasDoPedido = itens.split(/[;\n]/).map((l) => l.trim()).filter(Boolean)
  if (linhasDoPedido.length === 0) return { ok: false, erro: 'o pedido veio sem itens' }

  const linhas: string[] = []
  let subtotal = 0
  for (const linha of linhasDoPedido) {
    const m = linha.match(/^(\d+)\s*x?\s+(.+?)\s*(?:\((.*)\))?\s*$/i)
    if (!m) return { ok: false, erro: `a linha "${linha}" não segue o formato "2 x Nome do item (variação)"` }
    const quantidade = Number(m[1])
    const pedido = m[2] ?? ''
    if (quantidade < 1 || quantidade > MAX_QUANTIDADE) {
      return { ok: false, erro: `a quantidade de "${pedido}" precisa ser de 1 a ${MAX_QUANTIDADE}` }
    }

    const sabores = pedido.split('/').map((s) => s.trim()).filter(Boolean)
    const achados: ItemDoCatalogo[] = []
    for (const sabor of sabores) {
      const r = acharItem(sabor, catalogo)
      if (!r.ok) return r
      achados.push(r.item)
    }
    // Meio a meio cobra o mais caro, e o nome junta os sabores na ordem dita.
    const base = Math.max(...achados.map((i) => centavos(i.preco!)))
    const nome = achados.map((i) => i.nome).join(' / ')

    const variacoes = (m[3] ?? '').split(',').map((v) => v.trim()).filter(Boolean)
    let ajuste = 0
    for (const v of variacoes) {
      const a = acharAjuste(v, regras.ajustes)
      if (a) ajuste += centavos(a.valor)
    }
    const unitario = base + ajuste
    if (unitario < 0) return { ok: false, erro: `o preço de "${nome}" com essas variações ficou negativo` }
    const valor = unitario * quantidade
    subtotal += valor
    linhas.push(`• ${quantidade}x ${nome}${variacoes.length > 0 ? ` (${variacoes.join(', ')})` : ''}: ${reais(valor)}`)
  }

  const taxa = modo === 'entrega' ? centavos(regras.taxaEntrega) : 0
  const total = subtotal + taxa
  const resumo = [
    '*Resumo do pedido*',
    ...linhas,
    '',
    `Subtotal: ${reais(subtotal)}`,
    modo === 'entrega' ? `Entrega: ${reais(taxa)}` : 'Retirada: sem taxa',
    `*Total: ${reais(total)}*`,
    `*Pagamento:* ${NOME_DA_FORMA[forma]}`,
    '',
    'Está tudo certo? Posso confirmar?',
  ].join('\n')

  return { ok: true, cobranca: { total: semMoeda(total), resumo, pagamento: forma, entrega: modo } }
}

/** As variáveis que a cobrança deixa na conversa, para o fluxo cobrar depois. */
export const VARIAVEIS_DA_COBRANCA = {
  total: 'cobranca_total',
  resumo: 'cobranca_resumo',
  pagamento: 'cobranca_pagamento',
  entrega: 'cobranca_entrega',
} as const
