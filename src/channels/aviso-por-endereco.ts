import 'server-only'
import { createHmac } from 'node:crypto'
import { iguais } from '@/lib/segredo'
import type { Gateway } from './pagamento'

/**
 * O aviso de pago que chega num endereço nosso por organização, com um segredo
 * no `t` (`api/webhook/pagamento/[gateway]/[clienteId]`).
 *
 * É o desenho da InfinitePay generalizado para os gateways cujo aviso não
 * prova de onde veio (Woovi, PagHiper, Efí, Iugu, Pagar.me): o segredo,
 * derivado do `BETTER_AUTH_SECRET`, do gateway e da organização, barra quem
 * não sabe o endereço **antes** de tocar o banco; e o pagamento é relido na
 * API com o acesso do dono antes de a cobrança mudar. Um segredo vazado vale
 * para uma organização e um gateway, e não marca nada sozinho.
 */

export function segredoDoAviso(gateway: Gateway, clienteId: string): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o aviso de pagamento')
  return createHmac('sha256', `aviso:${gateway}:${chave}`).update(clienteId).digest('base64url')
}

export function avisoAutentico(gateway: Gateway, clienteId: string, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, segredoDoAviso(gateway, clienteId))
  } catch {
    return false
  }
}

/**
 * O endereço completo, ou `null` fora de produção sem `BETTER_AUTH_URL` (o
 * gateway não alcança a máquina local; o relógio do vencimento confirma).
 * `extra` vai no fim da query: a Efí cola `/pix` no endereço, e o `ignorar=`
 * o recolhe.
 */
export function enderecoDoAviso(gateway: Gateway, clienteId: string, extra = ''): string | null {
  const base = process.env.VERCEL_ENV === 'production' ? 'https://dialogon.com.br' : process.env.BETTER_AUTH_URL
  if (!base) return null
  return `${base.replace(/\/$/, '')}/api/webhook/pagamento/${gateway}/${clienteId}?t=${segredoDoAviso(gateway, clienteId)}${extra}`
}
