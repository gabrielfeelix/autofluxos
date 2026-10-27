import { createHmac } from 'node:crypto'
import { iguais } from '@/lib/segredo'

/**
 * O token do link do entregador (`/e/<token>`): de qual conta e qual pedido.
 *
 * Assinado, e não guardado, no molde de `formularios-do-whatsapp/token.ts`: o
 * motoboy abre sem login, então o endereço é a única chave, e um HMAC basta
 * sem tabela. A chave deriva do `BETTER_AUTH_SECRET` com um prefixo próprio,
 * para um token de formulário nunca valer aqui. Validade de 24 horas: a
 * entrega acaba no mesmo dia, e um link esquecido no celular não move pedido
 * da semana seguinte.
 */

export type DadosDoEntregador = { clienteId: string; pedidoId: string }

export const VALIDADE_DO_LINK_EM_HORAS = 24

function chave(): string {
  const segredo = process.env.BETTER_AUTH_SECRET
  if (!segredo) throw new Error('falta BETTER_AUTH_SECRET para assinar o link do entregador')
  return `link-do-entregador:${segredo}`
}

function assinar(texto: string): string {
  return createHmac('sha256', chave()).update(texto).digest('base64url')
}

export function criarTokenDoEntregador(dados: DadosDoEntregador, agora = new Date()): string {
  const expira = Math.floor(agora.getTime() / 1000) + VALIDADE_DO_LINK_EM_HORAS * 3600
  const corpo = Buffer.from(JSON.stringify([dados.clienteId, dados.pedidoId, expira])).toString('base64url')
  return `${corpo}.${assinar(corpo)}`
}

export type LeituraDoEntregador = { ok: true; dados: DadosDoEntregador } | { ok: false; motivo: 'invalido' | 'vencido' }

export function lerTokenDoEntregador(token: unknown, agora = new Date()): LeituraDoEntregador {
  if (typeof token !== 'string') return { ok: false, motivo: 'invalido' }
  const [corpo, assinatura, ...resto] = token.split('.')
  if (!corpo || !assinatura || resto.length > 0) return { ok: false, motivo: 'invalido' }
  if (!iguais(assinatura, assinar(corpo))) return { ok: false, motivo: 'invalido' }
  try {
    const [clienteId, pedidoId, expira] = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as unknown[]
    if (typeof clienteId !== 'string' || typeof pedidoId !== 'string' || typeof expira !== 'number') {
      return { ok: false, motivo: 'invalido' }
    }
    if (expira * 1000 < agora.getTime()) return { ok: false, motivo: 'vencido' }
    return { ok: true, dados: { clienteId, pedidoId } }
  } catch {
    return { ok: false, motivo: 'invalido' }
  }
}
