import { itensDaLista } from './schema'

/**
 * Como o valor que veio de um sistema aparece na conversa.
 *
 * A API devolve `2026-09-01` porque é assim que sistema fala com sistema. A
 * aluna do estúdio lê `01/09/2026`, e não havia como pedir isso: o mapeamento
 * sabia de onde tirar o dado e não sabia como mostrá-lo. Quem montava o fluxo
 * ou aceitava a data crua no WhatsApp, ou pedia para o cliente mudar a API dele
 * — as duas respostas erradas.
 *
 * Puro e sem relógio: converte texto em texto. Data sem fuso não vira `Date`
 * de propósito — `new Date('2026-09-01')` interpreta como UTC e, no Brasil,
 * devolve o dia anterior.
 */
export const FORMATOS_DE_SAIDA = ['data', 'hora', 'data_hora', 'dinheiro'] as const
export type FormatoDeSaida = (typeof FORMATOS_DE_SAIDA)[number]

/** O nome de cada um no painel, com exemplo — que é o que ensina. */
export const EXEMPLO_DO_FORMATO: Record<FormatoDeSaida, string> = {
  data: '2026-09-01 vira 01/09/2026',
  hora: '07:00:00 vira 07:00',
  data_hora: '2026-09-01T07:30 vira 01/09/2026 07:30',
  dinheiro: '4200.5 vira 4.200,50',
}

/**
 * Formata **cada item** do valor.
 *
 * O mesmo campo carrega um item ou uma lista inteira (`07:00; 08:00`), e quem
 * escolheu "hora" quer as duas coisas formatadas. Valor que não casa com o
 * formato atravessa intacto: é melhor mostrar o dado cru do que sumir com ele.
 */
export function formatarValor(valor: string, formato?: FormatoDeSaida): string {
  if (!formato) return valor

  const itens = itensDaLista(valor)
  if (itens.length <= 1) return formatarUm(valor.trim(), formato)
  return itens.map((item) => formatarUm(item, formato)).join('; ')
}

function formatarUm(valor: string, formato: FormatoDeSaida): string {
  switch (formato) {
    case 'data':
      return comoData(valor) ?? valor
    case 'hora':
      return comoHora(valor) ?? valor
    case 'data_hora': {
      const [dia, hora] = separarDataEHora(valor)
      const d = comoData(dia)
      if (d === null) return valor
      const h = hora === undefined ? null : comoHora(hora)
      return h === null ? d : `${d} ${h}`
    }
    case 'dinheiro':
      return comoDinheiro(valor) ?? valor
  }
}

/** `2026-09-01` → `01/09/2026`. Já brasileira, devolve como está. */
function comoData(valor: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`
  return /^\d{2}\/\d{2}\/\d{4}$/.test(valor) ? valor : null
}

/** `07:00:00` → `07:00`. Segundos não dizem nada a quem lê. */
function comoHora(valor: string): string | null {
  const achado = /^(\d{1,2}):(\d{2})(:\d{2})?$/.exec(valor)
  if (!achado) return null
  return `${(achado[1] as string).padStart(2, '0')}:${achado[2]}`
}

/** Separa `2026-09-01T07:30:00` e `2026-09-01 07:30` do mesmo jeito. */
function separarDataEHora(valor: string): [string, string | undefined] {
  const partes = valor.split(/[T ]/)
  return [partes[0] ?? '', partes[1]]
}

/** `4200.5` → `4.200,50`. Sem símbolo: quem escreve a frase escolhe se põe R$. */
function comoDinheiro(valor: string): string | null {
  const numero = Number(valor.trim().replace(',', '.'))
  if (!Number.isFinite(numero)) return null
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
