import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * O link da página de pagar uma cobrança (`/pagar/<código>`, 0145).
 *
 * É o destino do botão Pagar do modelo de lembrete, que leva a cobrança a
 * quem não conversa há mais de 24 horas. O código é o id da cobrança assinado:
 * sem a assinatura, qualquer um trocaria o id no fim do endereço e leria o
 * valor e o nome da cobrança dos outros.
 */

export const ENDERECO_DE_PAGAR = 'https://autofluxos.4yu.com.br/pagar/'

function assinar(id: string, chave: string): string {
  return createHmac('sha256', `pagar:${chave}`).update(id).digest('base64url').slice(0, 22)
}

/** `null` sem segredo no ambiente: sem assinatura não há link seguro, e o lembrete não sai. */
export function codigoDePagar(cobrancaId: string): string | null {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) return null
  return `${cobrancaId}.${assinar(cobrancaId, chave)}`
}

export function linkDePagar(cobrancaId: string): string | null {
  const codigo = codigoDePagar(cobrancaId)
  return codigo ? `${ENDERECO_DE_PAGAR}${codigo}` : null
}

/** O id da cobrança, se a assinatura bate. */
export function lerCodigoDePagar(codigo: string): string | null {
  const chave = process.env.BETTER_AUTH_SECRET
  const [id, assinatura] = codigo.split('.')
  if (!chave || !id || !assinatura || !/^[0-9a-f-]{36}$/.test(id)) return null
  const esperada = Buffer.from(assinar(id, chave))
  const recebida = Buffer.from(assinatura)
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida) ? id : null
}
