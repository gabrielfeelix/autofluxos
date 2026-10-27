import { createHmac } from 'node:crypto'
import type { PlataformaDePedido } from '@/core/pedidos-de-fora'
import { iguais } from '@/lib/segredo'

/**
 * O token que o lojista cola no webhook da plataforma de cardápio, um por
 * conta e plataforma.
 *
 * Derivado, e não guardado, no molde do aviso do Asaas (`segredoDoAviso`): o
 * mesmo `BETTER_AUTH_SECRET` com um prefixo próprio. Trocar o segredo invalida
 * os webhooks, e a passada de 10 minutos segura os pedidos até o lojista colar
 * o token novo.
 */
export function tokenDoWebhook(clienteId: string, plataforma: PlataformaDePedido): string {
  const chave = process.env.BETTER_AUTH_SECRET
  if (!chave) throw new Error('falta BETTER_AUTH_SECRET para assinar o webhook do cardápio')
  return createHmac('sha256', `cardapio:${plataforma}:${chave}`).update(clienteId).digest('base64url')
}

/** O cabeçalho que chegou bate? Falha fechada sem o segredo no ambiente. */
export function webhookAutentico(clienteId: string, plataforma: PlataformaDePedido, recebido: string | null): boolean {
  if (!recebido) return false
  try {
    return iguais(recebido, tokenDoWebhook(clienteId, plataforma))
  } catch {
    return false
  }
}
