/**
 * O conector de BI (frente 3 do handoff de 22/out): os dados da conta como
 * tabela, em CSV ou JSON, para o Power BI ("Obter dados > Web"), o Looker
 * Studio e o Google Sheets lerem sozinhos.
 *
 * Sem data warehouse: cada conjunto é uma consulta direta, paginada, com teto
 * de linhas por resposta. O teto vem da Vercel: resposta de função acima de
 * 4,5 MB falha, e 10 mil linhas de CSV ficam perto de 2 MB no pior caso.
 *
 * Aqui só o que é regra pura: quais conjuntos existem, que colunas cada um
 * tem, como se lê o período e a página, e como se escreve o CSV.
 */

export const CONJUNTOS = {
  contatos: {
    rotulo: 'Contatos',
    data: 'criado_em',
    colunas: ['id', 'nome', 'telefone', 'criado_em', 'estado', 'estagio', 'temperatura', 'responsavel', 'etiquetas', 'ultima_mensagem_em'],
  },
  mensagens: {
    rotulo: 'Mensagens',
    data: 'enviada_em',
    colunas: ['id', 'contato_id', 'direcao', 'enviada_em', 'entregue'],
  },
  vendas: {
    rotulo: 'Vendas',
    data: 'data_da_venda',
    colunas: ['id', 'contato_id', 'data_da_venda', 'valor', 'moeda', 'situacao', 'responsavel', 'criado_em'],
  },
  cobrancas: {
    rotulo: 'Cobranças',
    data: 'criado_em',
    colunas: ['id', 'contato_id', 'descricao', 'valor', 'status', 'gateway', 'origem', 'criada_por', 'criado_em', 'vence_em', 'paga_em'],
  },
} as const

export type Conjunto = keyof typeof CONJUNTOS
export type Valor = string | number | boolean | null
export type Linha = Record<string, Valor>

export function ehConjunto(valor: string): valor is Conjunto {
  return Object.hasOwn(CONJUNTOS, valor)
}

export const LIMITE_PADRAO = 5_000
export const LIMITE_MAXIMO = 10_000

export type Consulta = {
  formato: 'csv' | 'json'
  /** Inclusivo. `null` = desde o começo. */
  desde: Date | null
  /** Exclusivo: o dia seguinte ao `ate` pedido, para o dia inteiro entrar. */
  ate: Date | null
  pagina: number
  limite: number
}

const DIA = /^\d{4}-\d{2}-\d{2}$/

/** `2026-10-01` vira meia-noite de Brasília daquele dia. */
function inicioDoDia(dia: string): Date | null {
  if (!DIA.test(dia)) return null
  const data = new Date(`${dia}T00:00:00-03:00`)
  return Number.isNaN(data.getTime()) ? null : data
}

/**
 * Lê `formato`, `desde`, `ate`, `pagina` e `limite` da URL. Recusa em vez de
 * adivinhar: um relatório que ignorou o período pedido mostra número errado
 * num painel que alguém vai apresentar numa reunião.
 */
export function lerConsulta(busca: URLSearchParams): { ok: true; consulta: Consulta } | { ok: false; erro: string } {
  const formato = (busca.get('formato') ?? 'json').toLowerCase()
  if (formato !== 'csv' && formato !== 'json') return { ok: false, erro: 'formato: use csv ou json.' }

  const desdeBruto = busca.get('desde')
  const ateBruto = busca.get('ate')
  const desde = desdeBruto ? inicioDoDia(desdeBruto) : null
  if (desdeBruto && !desde) return { ok: false, erro: 'desde: use AAAA-MM-DD.' }
  const ateInicio = ateBruto ? inicioDoDia(ateBruto) : null
  if (ateBruto && !ateInicio) return { ok: false, erro: 'ate: use AAAA-MM-DD.' }
  const ate = ateInicio ? new Date(ateInicio.getTime() + 86_400_000) : null
  if (desde && ate && desde >= ate) return { ok: false, erro: 'desde precisa ser antes de ate.' }

  const pagina = Number(busca.get('pagina') ?? '1')
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100_000) return { ok: false, erro: 'pagina: um inteiro a partir de 1.' }
  const limite = Number(busca.get('limite') ?? String(LIMITE_PADRAO))
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
    return { ok: false, erro: `limite: um inteiro de 1 a ${LIMITE_MAXIMO}.` }
  }

  return { ok: true, consulta: { formato, desde, ate, pagina, limite } }
}

/**
 * Uma célula de CSV (RFC 4180): aspas quando há vírgula, aspas, quebra de
 * linha ou espaço nas pontas, com as aspas internas dobradas.
 *
 * E o apóstrofo na frente de `=`, `+`, `-` e `@`: um nome de contato como
 * `=HYPERLINK(...)` vira fórmula ao abrir no Excel, e o nome é escrito por
 * quem manda mensagem, ou seja, por qualquer pessoa.
 */
export function celula(valor: Valor): string {
  if (valor === null) return ''
  let texto = typeof valor === 'string' ? valor : String(valor)
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[",\n\r]|^\s|\s$/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** CSV com BOM: sem ele o Excel em português abre "Cobranças" como "CobranÃ§as". */
export function paraCsv(colunas: readonly string[], linhas: Linha[]): string {
  const corpo = [colunas.join(','), ...linhas.map((linha) => colunas.map((c) => celula(linha[c] ?? null)).join(','))]
  return `\uFEFF${corpo.join('\r\n')}\r\n`
}
