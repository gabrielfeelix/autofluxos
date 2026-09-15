import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { avisosDoWebhook } from '@/core/lead-ads'
import { alertar } from '@/server/alertar'
import { clientePelaPagina } from '@/server/repos/paginas-de-lead'
import { receberLeadsDoFormulario } from '@/server/receber-lead-do-formulario'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'

/**
 * Onde a Meta avisa que alguém preencheu um formulário de anúncio.
 *
 * ---------------------------------------------------------------------------
 * Por que uma rota separada do webhook do WhatsApp
 * ---------------------------------------------------------------------------
 *
 * Porque é **outro objeto**. O webhook do WhatsApp assina
 * `whatsapp_business_account`; este assina `page`, campo `leadgen`. São
 * inscrições diferentes no painel da Meta, e misturá-las numa rota só
 * significaria um `if` no topo decidindo qual produto está falando — com o
 * risco de um payload novo de um cair no tratador do outro.
 *
 * Mora sob `/api/webhook/`, que o proxy já deixa passar (`src/proxy.ts`). Rota
 * fora desse prefixo levaria `401` antes de executar, e o sintoma é cruel: a
 * Meta diz "entregue", o console não acusa nada e o banco fica vazio. Foi assim
 * que a primeira conexão real falhou em 13/set.
 *
 * ---------------------------------------------------------------------------
 * A regra que decide a forma deste arquivo
 * ---------------------------------------------------------------------------
 *
 * **A Meta não reentrega depois de um `200`, e reentrega tudo depois de um
 * erro.** Então: responder `200` primeiro, processar no `after()`. Buscar cada
 * lead na Graph dentro do handler somaria segundos, e uma Graph lenta viraria
 * timeout — que a Meta lê como falha e responde reentregando o lote, criando
 * lead duplicado por causa de lentidão dela mesma.
 */

/** 128 KB. Um lote de avisos é pequeno; quem manda mais não é a Meta. */
const LIMITE_DO_CORPO_EM_BYTES = 128 * 1024

/** Mesmo teto do webhook do WhatsApp: buscar N leads na Graph leva tempo. */
export const maxDuration = 60

/**
 * O handshake de verificação.
 *
 * A Meta chama isto uma vez, ao inscrever o webhook no painel, e recusa a
 * inscrição se o `hub.challenge` não voltar em texto puro.
 */
export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams
  const modo = parametros.get('hub.mode')
  const token = parametros.get('hub.verify_token')
  const desafio = parametros.get('hub.challenge')

  /*
   * O mesmo `WHATSAPP_VERIFY_TOKEN` serve aos dois webhooks: é segredo
   * compartilhado com a Meta para provar que a URL é nossa, não credencial de
   * produto. Uma variável a mais aqui seria mais uma coisa para esquecer de
   * configurar, com o mesmo valor dentro.
   */
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN

  if (modo === 'subscribe' && esperado && token === esperado && desafio) {
    return new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  return new Response('não autorizado', { status: 403 })
}

export async function POST(req: Request) {
  const tamanho = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanho) && tamanho > LIMITE_DO_CORPO_EM_BYTES) {
    return new Response('corpo grande demais', { status: 413 })
  }

  // Cru: a assinatura é sobre os bytes exatos, e `JSON.parse` + `stringify` já
  // não bate mais.
  const corpo = await req.text()

  if (!assinaturaConfere(corpo, req.headers.get('x-hub-signature-256'))) {
    return new Response('assinatura inválida', { status: 401 })
  }

  let json: unknown
  try {
    json = JSON.parse(corpo)
  } catch {
    // Corpo ilegível não é motivo para a Meta reentregar: ela mandaria o mesmo
    // lixo de novo. Aceita e registra.
    await alertar('webhook de leadgen com corpo ilegível', corpo.slice(0, 400), {})
    return new Response('ok', { status: 200 })
  }

  const avisos = avisosDoWebhook(json)

  /*
   * O trabalho vai para depois da resposta. Se `after()` falhar, o lead fica
   * para a reconciliação — que existe justamente porque a Meta não reentrega.
   */
  if (avisos.length > 0) {
    after(async () => {
      try {
        await tratar(avisos)
      } catch (erro) {
        const detalhe = erro instanceof Error ? erro.message : String(erro)
        await alertar('o lote de leads do formulário falhou inteiro', detalhe, {})
      }
    })
  }

  return new Response('ok', { status: 200 })
}

/**
 * Agrupa por Página e trata cada conta com o token dela.
 *
 * **O cliente vem da Página, nunca do corpo.** Aceitar um `clienteId` que o
 * payload informasse deixaria qualquer um que descubra a URL escrever na conta
 * alheia — e a assinatura só prova que a Meta mandou, não de quem é o lead.
 */
async function tratar(avisos: ReturnType<typeof avisosDoWebhook>): Promise<void> {
  const porPagina = new Map<string, typeof avisos>()
  for (const aviso of avisos) {
    const lista = porPagina.get(aviso.pageId) ?? []
    lista.push(aviso)
    porPagina.set(aviso.pageId, lista)
  }

  for (const [pageId, doGrupo] of porPagina) {
    const clienteId = await clientePelaPagina(pageId)
    if (!clienteId) {
      /*
       * Página que ninguém ligou a uma conta. Acontece quando o cliente inscreve
       * o app numa Página a mais sem avisar — e o alerta é o que transforma
       * "os leads não chegam" numa resposta em vez de uma caça.
       */
      await alertar(
        'chegou lead de uma Página que não está ligada a nenhuma conta',
        `página ${pageId}, ${doGrupo.length} lead(s) descartado(s)`,
        {},
      )
      continue
    }

    const token = await tokenDeAnuncios(clienteId)
    if (!token) {
      await alertar(
        'chegou lead do formulário, mas a conta não tem o acesso aos anúncios ligado',
        `conta ${clienteId}: crie a conexão meta-ads para os leads entrarem`,
        {},
      )
      continue
    }

    const resultado = await receberLeadsDoFormulario({ clienteId, avisos: doGrupo, token })

    /*
     * Só alerta quando alguma coisa ficou de fora. Lote inteiro criado é o
     * caminho normal, e alerta de caminho normal é o que faz parar de ler
     * alerta.
     */
    if (resultado.recusados > 0) {
      await alertar(
        'nem todo lead do formulário entrou',
        `conta ${clienteId}: ${resultado.criados} criado(s), ${resultado.repetidos} repetido(s), ${resultado.recusados} recusado(s)`,
        {},
      )
    }
  }
}

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.META_APP_SECRET
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false

  const esperada = createHmac('sha256', segredo).update(corpo).digest('hex')
  const recebida = cabecalho.slice('sha256='.length)

  const a = Buffer.from(esperada, 'hex')
  const b = Buffer.from(recebida, 'hex')
  if (a.length !== b.length) return false

  // Tempo constante: `===` vazaria, pelo tempo de resposta, quantos bytes
  // iniciais o atacante já acertou.
  return timingSafeEqual(a, b)
}
