import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { receberDoInstagram } from '@/server/receber-do-instagram'

/**
 * Onde o Instagram bate.
 *
 * As duas regras que moldaram o webhook do WhatsApp valem iguais aqui —
 * responder 200 rápido (senão a Meta reenvia e a conversa anda duas vezes) e
 * validar a assinatura (senão qualquer um manda mensagem falsa em nome de
 * qualquer cliente). O que muda é o formato do corpo, e isso mora inteiro em
 * `receber-do-instagram.ts`.
 *
 * **Por que uma rota separada, e não a mesma do WhatsApp.** A Meta permite
 * apontar produtos diferentes para URLs diferentes, e separar tem uma
 * consequência prática: um erro no formato do Instagram não pode derrubar o
 * caminho do WhatsApp, que é o que atende cliente pagante hoje. O `verify
 * token` também é próprio — repetir o do WhatsApp faria a validação de um
 * produto autorizar o outro.
 *
 * **O segredo NÃO é o mesmo do WhatsApp, e essa suposição já custou caro.** A
 * API do Instagram com login do Instagram cria um app próprio dentro do app da
 * Meta — ID e chave secreta separados, visíveis em "Configuração da API com
 * login do Instagram". É esse segredo que assina os eventos do Direct. Enquanto
 * conferimos só com `META_APP_SECRET`, todo evento levava 401 aqui e morria
 * antes de virar mensagem no Inbox — sem alerta nenhum, porque o 401 sai antes
 * do processamento que alerta.
 *
 * Conferimos contra os dois porque a Meta assina de um jeito quando o produto é
 * o Instagram Login e de outro quando é o login do Facebook, e um ambiente que
 * ainda não tem `INSTAGRAM_APP_SECRET` continua funcionando como funcionava.
 */

/** Mesmo orçamento do webhook do WhatsApp, e pelo mesmo motivo. */
export const maxDuration = 60

export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams
  const modo = parametros.get('hub.mode')
  const token = parametros.get('hub.verify_token')
  const desafio = parametros.get('hub.challenge')

  /*
   * Cai no token do WhatsApp quando o próprio não estiver preenchido.
   *
   * Um ambiente que ainda não configurou o Instagram não deveria falhar a
   * verificação por causa de uma variável que ninguém sabia que existia — e a
   * alternativa (recusar) manda quem está registrando o webhook procurar um
   * erro de permissão que não existe.
   */
  const esperado = process.env.INSTAGRAM_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN

  if (modo === 'subscribe' && esperado && token === esperado && desafio) {
    return new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  return new Response('não autorizado', { status: 403 })
}

export async function POST(req: Request) {
  // Precisa ser o corpo cru: a assinatura é calculada sobre os bytes exatos, e
  // um `JSON.parse` seguido de `stringify` já não bate mais.
  const corpo = await req.text()

  if (!assinaturaConfere(corpo, req.headers.get('x-hub-signature-256'))) {
    return new Response('assinatura inválida', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(corpo)
  } catch {
    // Corpo estranho não é motivo para a Meta ficar reenviando.
    return new Response('ok', { status: 200 })
  }

  after(async () => {
    try {
      await receberDoInstagram(payload)
    } catch (erro) {
      // Já respondemos 200 e a Meta não reenvia: sem este aviso, uma pessoa
      // fica sem resposta no direct e ninguém fica sabendo. Agora o alerta é
      // gravado no banco, então ele existe mesmo sem webhook de Discord.
      console.error('[webhook instagram] falhou ao processar', erro)
      await alertar('o processamento do webhook do Instagram falhou', erro)
    }
  })

  return new Response('ok', { status: 200 })
}

export function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false

  // O do Instagram primeiro: é o que assina o Direct quando o produto é o
  // Instagram Login, que é o nosso caso.
  const segredos = [process.env.INSTAGRAM_APP_SECRET, process.env.META_APP_SECRET].filter(
    (valor): valor is string => Boolean(valor),
  )
  if (segredos.length === 0) return false

  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex')

  // Todos os segredos são conferidos mesmo depois de um acerto: sair no primeiro
  // que bate faz o tempo da resposta contar quantos segredos existem.
  let confere = false
  for (const segredo of segredos) {
    const esperada = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'), 'hex')

    // `timingSafeEqual` estoura se os tamanhos diferem, e comparar tamanho antes
    // não vaza nada: ele é público na própria forma do cabeçalho.
    if (esperada.length !== recebida.length) continue
    if (timingSafeEqual(esperada, recebida)) confere = true
  }

  return confere
}
