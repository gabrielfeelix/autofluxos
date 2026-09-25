import { after } from 'next/server'
import { z } from 'zod'
import { TETO_DA_MENSAGEM } from '@/core/chat-do-site'
import { alertar } from '@/server/alertar'
import {
  abrirPorta,
  preflight,
  responder,
  segredoDoPedido,
  TETO_DE_ENVIO_POR_VISITANTE,
} from '@/server/api-do-site'
import { consumirLimite } from '@/server/limite'
import { conversaDoVisitante, enderecoDoVisitante, receberDoSite } from '@/server/receber-do-site'

export const dynamic = 'force-dynamic'

/**
 * O mesmo orçamento do webhook do WhatsApp, e pelo mesmo motivo: a rodada roda
 * no `after()`, e com IA ela pode levar até três chamadas ao modelo com novas
 * tentativas. Cortar em 60s deixaria o visitante sem resposta e sem handoff.
 */
export const maxDuration = 300

type Contexto = { params: Promise<{ chave: string }> }

/** A conversa do visitante. O segredo vem no cabeçalho, nunca na URL. */
export async function GET(req: Request, { params }: Contexto) {
  const { chave } = await params
  const porta = await abrirPorta(req, chave, 'leitura')
  if (!porta.ok) return porta.resposta

  const segredo = segredoDoPedido(req)
  if (!segredo) return responder(porta.origem, { erro: 'visitante inválido' }, 400)

  return responder(porta.origem, await conversaDoVisitante(porta.canal, segredo))
}

const corpoSchema = z.object({
  /** O id que o balão deu à mensagem. Reenviar o mesmo é descartado. */
  ref: z.string().regex(/^[A-Za-z0-9_-]{8,40}$/),
  texto: z.string().trim().min(1).max(TETO_DA_MENSAGEM).optional(),
  opcao: z.object({ id: z.string().min(1).max(200), rotulo: z.string().min(1).max(120) }).optional(),
  pagina: z.string().url().max(500).optional(),
})

/**
 * Uma mensagem do visitante.
 *
 * Responde 202 na hora e trata depois, no `after()`, como o webhook da Meta: o
 * balão já mostrou a bolha dele, e segurar a requisição pelos segundos da IA só
 * deixaria o navegador esperando uma resposta que ele vai buscar de qualquer
 * jeito na conversa.
 */
export async function POST(req: Request, { params }: Contexto) {
  const { chave } = await params
  const porta = await abrirPorta(req, chave, 'envio')
  if (!porta.ok) return porta.resposta

  const segredo = segredoDoPedido(req)
  if (!segredo) return responder(porta.origem, { erro: 'visitante inválido' }, 400)

  const analise = corpoSchema.safeParse(await req.json().catch(() => null))
  if (!analise.success || (!analise.data.texto && !analise.data.opcao)) {
    return responder(porta.origem, { erro: 'mensagem inválida' }, 400)
  }

  const endereco = enderecoDoVisitante(porta.canal.id, segredo)
  if (!(await consumirLimite(`site-visitante:${endereco}`, TETO_DE_ENVIO_POR_VISITANTE, 60))) {
    return responder(porta.origem, { erro: 'muitas mensagens, espere um pouco' }, 429)
  }

  const { ref, texto, opcao, pagina } = analise.data
  const canal = porta.canal

  after(async () => {
    try {
      await receberDoSite(
        canal,
        segredo,
        opcao ? { tipo: 'opcao', ref, opcaoId: opcao.id, rotulo: opcao.rotulo } : { tipo: 'texto', ref, texto: texto! },
        pagina ?? null,
      )
    } catch (erro) {
      console.error('[site] falhou ao processar a mensagem', erro)
      await alertar('o processamento de uma mensagem do chat do site falhou', erro, {})
    }
  })

  return responder(porta.origem, { ok: true }, 202)
}

export async function OPTIONS(req: Request, { params }: Contexto) {
  return preflight(req, (await params).chave)
}
