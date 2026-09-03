import 'server-only'
import { createHmac } from 'node:crypto'
import { iguais } from '@/lib/segredo'

/**
 * O `state` do OAuth: o bilhete que amarra o retorno da Meta a quem começou.
 *
 * **Sem ele existe um ataque real, e não teórico.** A rota de retorno é pública
 * por obrigação — a Meta chama o navegador de quem autorizou, sem cookie
 * nosso garantido. Se ela aceitasse `?cliente=<uuid>` na lata, bastaria induzir
 * um administrador logado a abrir um link para ligar uma conta de Instagram
 * qualquer ao cliente errado — ou ligar a conta do atacante a um cliente de
 * verdade, e passar a receber os direct dele.
 *
 * O bilhete é assinado com segredo do servidor e vence rápido: um OAuth
 * inteiro leva menos de um minuto, e um bilhete que vale o dia todo é um
 * bilhete que dá para reaproveitar.
 *
 * **Não substitui a conferência de acesso.** A rota de retorno confere de novo
 * se quem está logado pode mexer naquele cliente. O bilhete prova qual cliente
 * a conexão começou; a sessão prova quem é. As duas coisas, sempre.
 */

/** Um OAuth leva menos de um minuto. Dez é folga para quem hesitou na tela. */
const VALIDADE_MS = 10 * 60 * 1_000

function segredo(): string {
  const valor = process.env.BETTER_AUTH_SECRET ?? process.env.PAINEL_SEGREDO
  if (!valor) {
    throw new Error('falta BETTER_AUTH_SECRET (ou PAINEL_SEGREDO) para assinar a conexão')
  }
  return valor
}

function assinar(carga: string): string {
  return createHmac('sha256', segredo()).update(carga).digest('base64url')
}

export function criarEstado(clienteId: string, agora: Date = new Date()): string {
  const carga = `${clienteId}.${agora.getTime()}`
  return `${carga}.${assinar(carga)}`
}

/**
 * Devolve o cliente que começou a conexão, ou `null`.
 *
 * `null` para tudo que não presta — assinatura errada, prazo vencido, formato
 * estranho. Distinguir os casos na resposta contaria a quem está testando qual
 * parte ele acertou.
 */
export function lerEstado(estado: string | null, agora: Date = new Date()): string | null {
  if (!estado) return null

  const partes = estado.split('.')
  if (partes.length !== 3) return null

  const [clienteId, carimbo, assinatura] = partes as [string, string, string]
  if (!iguais(assinatura, assinar(`${clienteId}.${carimbo}`))) return null

  const nascido = Number(carimbo)
  if (!Number.isFinite(nascido)) return null
  if (agora.getTime() - nascido > VALIDADE_MS) return null
  // Bilhete do futuro é relógio torto ou bilhete forjado; nos dois casos, não.
  if (nascido > agora.getTime() + 60_000) return null

  return clienteId
}
