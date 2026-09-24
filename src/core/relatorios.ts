/**
 * O período dos relatórios, e a regra de comparação (plano de UX, 11.1).
 *
 * Tudo aqui é conta de calendário em texto `YYYY-MM-DD`, no dia de São Paulo:
 * o mesmo dia que as views de métrica gravam. Converter para `Date` no meio do
 * caminho é o jeito mais curto de uma conversa das 22h aparecer no dia
 * seguinte, porque o servidor roda em UTC.
 */

export const FUSO_DOS_RELATORIOS = 'America/Sao_Paulo'

/** Os atalhos da tela. Qualquer outro intervalo é "personalizado". */
export const ATALHOS_DE_PERIODO = [7, 30, 90] as const

/**
 * Venda anda mais devagar que conversa: uma semana de negócios quase sempre é
 * zero ganho, e o gráfico por mês pede ao menos um trimestre para dizer algo.
 */
export const ATALHOS_DE_VENDAS = [30, 90, 365] as const

export type AtalhoDePeriodo = number

/** Mais que um ano vira gráfico de barra fina demais para ler um dia. */
export const MAXIMO_DE_DIAS = 366

export type Periodo = {
  /** Primeiro dia, incluído. */
  de: string
  /** Último dia, incluído. */
  ate: string
  dias: number
  /** O atalho que gerou este período, ou `null` quando foi escolhido à mão. */
  atalho: AtalhoDePeriodo | null
}

/** Um dia da série do gráfico. */
export type DiaDoRelatorio = {
  dia: string
  contatosNovos: number
  conversas: number
  foramParaPessoa: number
}

const DIA_EM_MS = 24 * 60 * 60 * 1000
const FORMATO_DO_DIA = /^\d{4}-\d{2}-\d{2}$/

/** O dia de hoje em São Paulo, `YYYY-MM-DD`. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DOS_RELATORIOS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora)
}

function paraMs(dia: string): number {
  return Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10)))
}

function deMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** `dia` mais `n` dias (negativo volta). */
export function somarDias(dia: string, n: number): string {
  return deMs(paraMs(dia) + n * DIA_EM_MS)
}

/** Quantos dias de `de` a `ate`, os dois incluídos. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((paraMs(ate) - paraMs(de)) / DIA_EM_MS) + 1
}

/** Data de verdade no calendário? `2026-02-30` não é. */
export function ehDiaValido(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !FORMATO_DO_DIA.test(valor)) return false
  return deMs(paraMs(valor)) === valor
}

function periodoDoAtalho(atalho: AtalhoDePeriodo, hoje: string): Periodo {
  return { de: somarDias(hoje, -(atalho - 1)), ate: hoje, dias: atalho, atalho }
}

/**
 * O período pedido na URL (`?de=&ate=` ou `?dias=7|30|90`).
 *
 * Endereço inválido não quebra a tela: cai nos últimos 30 dias, que é o que a
 * tela mostra sem parâmetro. Futuro é cortado em hoje, porque dia que ainda
 * não aconteceu entraria no gráfico como zero e puxaria a comparação para
 * baixo sem motivo.
 */
export function lerPeriodo(
  parametros: Record<string, string | string[] | undefined>,
  hoje: string,
  atalhos: readonly number[] = ATALHOS_DE_PERIODO,
  padrao = 30,
): Periodo {
  const um = (chave: string) => {
    const valor = parametros[chave]
    return Array.isArray(valor) ? valor[0] : valor
  }

  const de = um('de')
  const ate = um('ate')
  if (ehDiaValido(de) && ehDiaValido(ate)) {
    const fim = ate > hoje ? hoje : ate
    if (de <= fim) {
      const inicio = diasEntre(de, fim) > MAXIMO_DE_DIAS ? somarDias(fim, -(MAXIMO_DE_DIAS - 1)) : de
      const dias = diasEntre(inicio, fim)
      // Um intervalo escolhido à mão que termina hoje e tem o tamanho de um
      // atalho é o atalho: o botão dele acende, em vez de "personalizado".
      const atalho =
        fim === hoje ? (atalhos.find((a) => a === dias) ?? null) : null
      return { de: inicio, ate: fim, dias, atalho }
    }
  }

  const dias = Number(um('dias'))
  const atalho = atalhos.find((a) => a === dias) ?? padrao
  return periodoDoAtalho(atalho, hoje)
}

/**
 * O período de comparação: **o mesmo tamanho, logo antes**.
 *
 * Não é "o mês passado": comparar 7 dias com um mês inteiro sempre daria
 * queda. Também não é o mesmo período do ano anterior, que esta conta ainda
 * não tem para quase ninguém.
 */
export function periodoAnterior(periodo: Periodo): Periodo {
  const ate = somarDias(periodo.de, -1)
  return { de: somarDias(ate, -(periodo.dias - 1)), ate, dias: periodo.dias, atalho: null }
}

/**
 * A série com **todos os dias do período**, zero incluído.
 *
 * O banco só devolve os dias em que alguma coisa aconteceu. Um gráfico que
 * pula os dias parados comprime o eixo e transforma uma semana sem movimento
 * num degrau: a barra de sexta encosta na de segunda e parece que nada parou.
 * Dias fora do período são descartados, e cada dia aparece uma vez só.
 */
export function completarDias<T extends { dia: string }>(
  serie: readonly T[],
  de: string,
  ate: string,
  vazio: (dia: string) => T,
): T[] {
  const porDia = new Map(serie.map((item) => [item.dia, item]))
  const total = diasEntre(de, ate)
  const completa: T[] = []
  for (let i = 0; i < total; i++) {
    const dia = somarDias(de, i)
    completa.push(porDia.get(dia) ?? vazio(dia))
  }
  return completa
}

export type Variacao =
  | { tipo: 'sem-base' }
  | { tipo: 'igual' }
  | { tipo: 'subiu' | 'caiu'; percentual: number }

/**
 * Quanto mudou em relação ao período anterior.
 *
 * `sem-base` quando o anterior é zero ou não existe: "+∞%" ou "+100%" sobre
 * nada é número que não diz coisa nenhuma, e a tela escreve "sem base para
 * comparar".
 */
export function variacao(atual: number | null, anterior: number | null): Variacao {
  if (atual === null || anterior === null || anterior === 0) return { tipo: 'sem-base' }
  if (atual === anterior) return { tipo: 'igual' }
  const percentual = Math.round((Math.abs(atual - anterior) / anterior) * 100)
  if (percentual === 0) return { tipo: 'igual' }
  return { tipo: atual > anterior ? 'subiu' : 'caiu', percentual }
}

/** `2026-09-23` como `23/09`, e com o ano quando o período cruza anos. */
export function diaCurto(dia: string, comAno = false): string {
  const [ano = '', mes, d] = dia.split('-')
  return comAno ? `${d}/${mes}/${ano.slice(2)}` : `${d}/${mes}`
}

/**
 * "3 min", "1h20", "2 dias". `null` vira `-`: não há o que dizer.
 *
 * A régua da home (espera na fila), trazida para cá porque os tempos agora
 * moram nos Relatórios. A mesma régua nos dois lugares, para não dar "1h20"
 * numa tela e "80 min" na outra.
 */
export function comoDuracao(segundos: number | null): string {
  if (segundos === null) return '-'
  if (segundos < 60) return `${Math.round(segundos)}s`

  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const resto = minutos % 60
    return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, '0')}`
  }

  const dias = Math.round(horas / 24)
  return dias === 1 ? '1 dia' : `${dias} dias`
}
