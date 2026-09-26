/**
 * Conta de dinheiro dentro do fluxo: o total do carrinho.
 *
 * O bloco Guardar com `conta: true` interpola o texto e faz a conta que sobrou,
 * "{{total}} + ({{preco}} + {{ajuste}}) * {{quantidade}}". Existe porque um
 * pedido com vários itens só é pedido de verdade com o total certo, e deixar a
 * soma para a IA é deixar dinheiro com quem erra conta de vez em quando.
 *
 * Só números, `+ - * /` e parênteses. Nada de variável solta, função ou
 * potência: o texto vem de variável, e variável pode vir do cliente. Qualquer
 * coisa fora disso devolve `null`, e o bloco guarda vazio em vez de inventar.
 *
 * Aceita o número do jeito que o fluxo mostra ("52,90") e do jeito da máquina
 * ("52.90"); devolve sempre com vírgula e duas casas, sem separador de milhar,
 * para a próxima conta ler de volta sem ambiguidade.
 */

/** "1.234,50" e "52,90" viram 1234.5 e 52.9; "52.90" fica como está. */
function lerNumero(bruto: string): number | null {
  const t = bruto.trim()
  if (!/^\d[\d.,]*$/.test(t)) return null
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

export function calcular(expressao: string): number | null {
  const pedacos = expressao.match(/\d[\d.,]*|[-+*/()]|\S/g) ?? []
  let i = 0

  // expressão := termo (('+'|'-') termo)*
  function expressaoToda(): number | null {
    let valor = termo()
    while (valor !== null && (pedacos[i] === '+' || pedacos[i] === '-')) {
      const op = pedacos[i++]
      const outro = termo()
      if (outro === null) return null
      valor = op === '+' ? valor + outro : valor - outro
    }
    return valor
  }
  // termo := fator (('*'|'/') fator)*
  function termo(): number | null {
    let valor = fator()
    while (valor !== null && (pedacos[i] === '*' || pedacos[i] === '/')) {
      const op = pedacos[i++]
      const outro = fator()
      if (outro === null || (op === '/' && outro === 0)) return null
      valor = op === '*' ? valor * outro : valor / outro
    }
    return valor
  }
  // fator := número | '-' fator | '(' expressão ')'
  function fator(): number | null {
    const p = pedacos[i++]
    if (p === undefined) return null
    if (p === '-') {
      const v = fator()
      return v === null ? null : -v
    }
    if (p === '(') {
      const v = expressaoToda()
      if (pedacos[i++] !== ')') return null
      return v
    }
    return lerNumero(p)
  }

  if (pedacos.length === 0) return null
  const resultado = expressaoToda()
  return i === pedacos.length ? resultado : null
}

/** 1234.5 vira "1234,50". */
export function formatarConta(valor: number): string {
  return (Math.round(valor * 100) / 100).toFixed(2).replace('.', ',')
}

/** O que o bloco guarda: a conta feita, ou vazio quando o texto não é conta. */
export function resultadoDaConta(texto: string): string {
  const valor = calcular(texto)
  return valor === null ? '' : formatarConta(valor)
}
