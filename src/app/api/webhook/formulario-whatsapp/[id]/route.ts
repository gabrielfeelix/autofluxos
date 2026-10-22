import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { lerDoCofre } from '@/server/cofre'
import { lerCorpoComTeto } from '@/server/corpo-com-teto'
import { abrirPedido, ehCorpoCifrado, fecharResposta } from '@/server/formularios-do-whatsapp/cripto'
import { responderAoFormulario } from '@/server/formularios-do-whatsapp/endpoint'
import { acharFormulario } from '@/server/repos/formularios-do-whatsapp'

/**
 * O endpoint de dados do formulário nativo do WhatsApp (WhatsApp Flows).
 *
 * Cada troca de tela do formulário chega aqui, cifrada com a chave pública
 * do número. Na ordem, e cada passo recusa antes do seguinte:
 *
 * 1. **assinatura** `X-Hub-Signature-256` com o segredo do app da Meta, como
 *    o webhook do WhatsApp. Errada: 432;
 * 2. **o formulário** pelo id do caminho, que diz qual chave privada abre;
 * 3. **decifrar** com a chave privada do cofre. Falhou: 421, e a Meta baixa a
 *    chave pública de novo e repete;
 * 4. **responder** (`server/formularios-do-whatsapp/endpoint.ts`) e cifrar a
 *    resposta com a mesma chave AES, como texto puro.
 *
 * A Meta espera no máximo 10 segundos. A conversa que segue depois de marcar
 * roda no `after()`, fora desse prazo.
 */

export const maxDuration = 15

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.META_APP_SECRET
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const esperada = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'), 'hex')
  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex')
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const lido = await lerCorpoComTeto(req)
  if (!lido.ok) return lido.resposta
  if (!assinaturaConfere(lido.corpo, req.headers.get('x-hub-signature-256'))) {
    return new Response('assinatura inválida', { status: 432 })
  }

  const { id } = await params
  const formulario = await acharFormulario(id)
  if (!formulario) return new Response('formulário não encontrado', { status: 404 })

  let corpo: unknown
  try {
    corpo = JSON.parse(lido.corpo)
  } catch {
    return new Response('json inválido', { status: 400 })
  }
  if (!ehCorpoCifrado(corpo)) return new Response('corpo fora do formato', { status: 400 })

  const chavePrivada = await lerDoCofre(formulario.chavePrivadaRef)
  if (!chavePrivada) return new Response('chave indisponível', { status: 421 })

  let pedido
  try {
    pedido = abrirPedido(corpo, chavePrivada)
  } catch {
    return new Response('não foi possível decifrar', { status: 421 })
  }

  const resposta = await responderAoFormulario(formulario, pedido.dados, (token, marcacao) => {
    after(async () => {
      const { acordarFluxoDoFormulario } = await import('@/server/receber-mensagem')
      await acordarFluxoDoFormulario(formulario.clienteId, token, marcacao).catch((erro: unknown) =>
        console.error('[formulario] marcou, mas a conversa não seguiu:', erro instanceof Error ? erro.message : erro),
      )
    })
  })
  if (resposta.status !== 200) return new Response(null, { status: resposta.status })

  return new Response(fecharResposta(resposta.corpo, pedido), { status: 200, headers: { 'content-type': 'text/plain' } })
}
