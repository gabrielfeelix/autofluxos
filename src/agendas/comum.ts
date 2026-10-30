import type { ResultadoDaAgenda } from './types'

/**
 * O que todo conector de agenda repete: chamar com tempo limite, traduzir o
 * status HTTP numa frase, guardar o horário num id opaco, e mexer com data e
 * telefone. Sem estado e sem banco.
 */

export type Buscar = (url: string | URL | Request, init?: RequestInit) => Promise<Response>

const TEMPO_LIMITE_MS = 8_000

/** O período mais longo que uma consulta de horários percorre, em dias. */
export const DIAS_POR_CONSULTA = 7

export async function chamarJson(
  buscar: Buscar,
  url: string,
  init: RequestInit,
  sistema: string,
): Promise<ResultadoDaAgenda<unknown>> {
  let resposta: Response
  try {
    resposta = await buscar(url, { ...init, signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: 'no-store' })
  } catch {
    // Sem o detalhe do undici: ele às vezes carrega o endereço inteiro.
    return { ok: false, motivo: `${sistema} não respondeu` }
  }
  if (resposta.status === 401 || resposta.status === 403) return { ok: false, motivo: `${sistema} recusou a chave` }
  if (resposta.status === 429) return { ok: false, motivo: `${sistema} pediu para esperar: limite de consultas atingido` }
  if (!resposta.ok) return { ok: false, motivo: `${sistema} respondeu ${resposta.status}` }
  if (resposta.status === 204) return { ok: true, valor: null }
  try {
    return { ok: true, valor: await resposta.json() }
  } catch {
    return { ok: true, valor: null }
  }
}

export const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
export const numero = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
export const lista = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object') : []
export const objeto = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/**
 * O horário escolhido, guardado no id que o modelo devolve.
 *
 * base64url de JSON: o modelo só copia, e a trava de id visto
 * (`soDeResultadoAnterior`) garante que ele copia um que a consulta mostrou.
 */
export function guardarNoId(dados: Record<string, string | number>): string {
  return `h${Buffer.from(JSON.stringify(dados), 'utf8').toString('base64url')}`
}

export function lerDoId(id: string): Record<string, string> | null {
  if (!/^h[\w-]{4,1200}$/.test(id)) return null
  try {
    const dados = JSON.parse(Buffer.from(id.slice(1), 'base64url').toString('utf8')) as unknown
    if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) return null
    return Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, texto(v)]))
  } catch {
    return null
  }
}

/** Os dias de `de` até `ate`, AAAA-MM-DD, no máximo `DIAS_POR_CONSULTA`. */
export function diasEntre(de: string, ate: string): string[] {
  const inicio = Date.parse(`${de}T12:00:00Z`)
  const fim = Date.parse(`${ate}T12:00:00Z`)
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim < inicio) return []
  const dias: string[] = []
  for (let t = inicio; t <= fim && dias.length < DIAS_POR_CONSULTA; t += 86_400_000) {
    dias.push(new Date(t).toISOString().slice(0, 10))
  }
  return dias
}

export function somarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

/** `DD-MM-YYYY` ou `DD/MM/YYYY` para AAAA-MM-DD; o que já está em ISO passa. */
export function dataIso(v: unknown): string {
  const t = texto(v)
  const br = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(t)
  return iso ? iso[1]! : ''
}

/** AAAA-MM-DD para DD-MM-YYYY, o formato da Feegow. */
export const dataBr = (iso: string): string => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`

/** `09:30:00`, `9:30`, `2026-10-01T09:30:00` para HH:MM. */
export function horaCurta(v: unknown): string {
  const m = /(\d{1,2}):(\d{2})/.exec(texto(v))
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : ''
}

/** O telefone sem o 55: é como os sistemas daqui guardam. */
export function telefoneNacional(telefone: string): string {
  const d = telefone.replace(/\D/g, '')
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d
}

/**
 * O mesmo número? Compara os oito últimos dígitos: um sistema guarda com 55,
 * outro com DDD e o nono dígito, outro sem nenhum dos dois.
 */
export function mesmoTelefone(a: unknown, b: string): boolean {
  const x = texto(a).replace(/\D/g, '')
  const y = b.replace(/\D/g, '')
  return x.length >= 8 && y.length >= 8 && x.slice(-8) === y.slice(-8)
}

export const reais = (centavos: number): string =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** As credenciais de várias partes vão para o cofre como um JSON só. */
export function lerSegredo(valor: string): Record<string, string> {
  try {
    const dados = JSON.parse(valor) as unknown
    return Object.fromEntries(Object.entries(objeto(dados)).map(([k, v]) => [k, texto(v)]))
  } catch {
    return {}
  }
}
