import { createHmac } from 'node:crypto'
import { iguais } from '@/lib/segredo'

/**
 * O `flow_token`: viaja na mensagem do formulário e volta em toda chamada do
 * endpoint e no `nfm_reply` do "Concluir". É por ele que sabemos de quem é o
 * formulário e qual bloco da conversa está esperando.
 *
 * Assinado, e não guardado: a Meta pede que não seja adivinhável, e um HMAC
 * resolve isso sem tabela. A chave deriva do `BETTER_AUTH_SECRET`, como o
 * aviso do Asaas (`segredoDoAviso`); trocá-lo invalida os formulários abertos,
 * que é o certo depois de trocar um segredo.
 */

export type DadosDoToken = {
  formularioId: string
  contatoId: string
  /** A sessão e o bloco que esperam o "Concluir". Nulos fora de fluxo. */
  sessaoId: string | null
  noId: string | null
  /** Segundos desde 1970. Depois disso, o endpoint responde 427. */
  expira: number
}

/** Três dias: quem abre a mensagem no dia seguinte ainda consegue marcar. */
export const VALIDADE_DO_TOKEN_EM_HORAS = 72

function chave(): string {
  const segredo = process.env.BETTER_AUTH_SECRET
  if (!segredo) throw new Error('falta BETTER_AUTH_SECRET para assinar o formulário do WhatsApp')
  return `formulario-whatsapp:${segredo}`
}

function assinar(texto: string): string {
  return createHmac('sha256', chave()).update(texto).digest('base64url')
}

export function criarTokenDoFormulario(
  dados: Omit<DadosDoToken, 'expira'>,
  agora = new Date(),
  validadeEmHoras = VALIDADE_DO_TOKEN_EM_HORAS,
): string {
  const expira = Math.floor(agora.getTime() / 1000) + validadeEmHoras * 3600
  const corpo = Buffer.from(JSON.stringify([dados.formularioId, dados.contatoId, dados.sessaoId, dados.noId, expira])).toString('base64url')
  return `${corpo}.${assinar(corpo)}`
}

export type LeituraDoToken = { ok: true; dados: DadosDoToken } | { ok: false; motivo: 'invalido' | 'vencido' }

export function lerTokenDoFormulario(token: unknown, agora = new Date()): LeituraDoToken {
  if (typeof token !== 'string') return { ok: false, motivo: 'invalido' }
  const [corpo, assinatura, ...resto] = token.split('.')
  if (!corpo || !assinatura || resto.length > 0) return { ok: false, motivo: 'invalido' }
  if (!iguais(assinatura, assinar(corpo))) return { ok: false, motivo: 'invalido' }
  try {
    const [formularioId, contatoId, sessaoId, noId, expira] = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as unknown[]
    if (typeof formularioId !== 'string' || typeof contatoId !== 'string' || typeof expira !== 'number') {
      return { ok: false, motivo: 'invalido' }
    }
    if (expira * 1000 < agora.getTime()) return { ok: false, motivo: 'vencido' }
    return {
      ok: true,
      dados: {
        formularioId,
        contatoId,
        sessaoId: typeof sessaoId === 'string' ? sessaoId : null,
        noId: typeof noId === 'string' ? noId : null,
        expira,
      },
    }
  } catch {
    return { ok: false, motivo: 'invalido' }
  }
}
