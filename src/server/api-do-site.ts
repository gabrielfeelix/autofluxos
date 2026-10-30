import 'server-only'
import { origemPermitida, segredoValido } from '@/core/chat-do-site'
import { consumirLimite } from './limite'
import { acharChatPorChave, type CanalDoSite } from './repos/canais-site'

/**
 * A porta comum das rotas do balão do site (`app/api/site/[chave]/`).
 *
 * Cada rota passa por aqui antes de fazer qualquer coisa, e a ordem é a das
 * conferências mais baratas para as mais caras: forma da chave, canal ligado,
 * origem na lista, limite por IP. O que recusa, recusa sem dizer por quê ao
 * navegador (um "não" genérico), porque quem está testando a rota de fora não
 * precisa saber se errou a chave ou o domínio.
 */

/** Nunca em produção: lá o balão só abre nos domínios cadastrados. */
const LOCAL = process.env.NODE_ENV !== 'production'

/** Por minuto, por IP. Escritório com NAT põe dez visitantes num IP só. */
const TETO_DE_ENVIO_POR_IP = 40
const TETO_DE_LEITURA_POR_IP = 300
/** Por minuto, por visitante: gente escreve menos que isso; robô, mais. */
export const TETO_DE_ENVIO_POR_VISITANTE = 20

export function cabecalhosCors(origem: string): Record<string, string> {
  return {
    'access-control-allow-origin': origem,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-visitante',
    'access-control-max-age': '600',
    vary: 'Origin',
    'cache-control': 'no-store',
  }
}

export function responder(origem: string | null, corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(origem ? cabecalhosCors(origem) : {}) },
  })
}

function ip(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'desconhecido'
}

export type Porta =
  | { ok: true; canal: CanalDoSite; origem: string }
  | { ok: false; resposta: Response }

/**
 * Confere canal, origem e limite. `leitura` usa o teto maior: o balão consulta
 * a conversa em intervalos enquanto espera resposta.
 */
export async function abrirPorta(req: Request, chave: string, uso: 'leitura' | 'envio'): Promise<Porta> {
  const origem = origemDoPedido(req)
  const canal = await acharChatPorChave(chave)

  if (!canal || canal.status !== 'ativo' || !origemPermitida(origem, canal.config.dominios, LOCAL)) {
    return { ok: false, resposta: responder(null, { erro: 'indisponível' }, 403) }
  }

  const teto = uso === 'leitura' ? TETO_DE_LEITURA_POR_IP : TETO_DE_ENVIO_POR_IP
  if (!(await consumirLimite(`site-${uso}:${ip(req)}`, teto, 60))) {
    return { ok: false, resposta: responder(origem, { erro: 'muitas mensagens, espere um pouco' }, 429) }
  }

  return { ok: true, canal, origem: origem! }
}

/**
 * A origem de quem chama. Num GET do mesmo domínio o navegador não manda
 * `Origin` (é o caso do balão no próprio site do AutoFluxos); aí vale o
 * `Sec-Fetch-Site: same-origin`, e a origem é a do próprio pedido, que ainda
 * passa pela lista de domínios do canal.
 */
function origemDoPedido(req: Request): string | null {
  const origem = req.headers.get('origin')
  if (origem) return origem
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return null
  // `req.url` pode vir com o host interno do servidor; o `Host` é o que o navegador pediu.
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const protocolo = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')
  return host ? `${protocolo}://${host}` : null
}

/** O preflight do navegador: só responde com CORS a origem que está na lista. */
export async function preflight(req: Request, chave: string): Promise<Response> {
  const origem = req.headers.get('origin')
  const canal = await acharChatPorChave(chave)
  if (!canal || !origemPermitida(origem, canal.config.dominios, LOCAL)) return new Response(null, { status: 403 })
  return new Response(null, { status: 204, headers: cabecalhosCors(origem!) })
}

/** O segredo do visitante, do cabeçalho. `null` quando não tem forma de segredo. */
export function segredoDoPedido(req: Request): string | null {
  const valor = req.headers.get('x-visitante')
  return segredoValido(valor) ? valor : null
}
