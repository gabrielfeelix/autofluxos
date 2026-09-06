import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { z } from 'zod'
import { alertar } from '@/server/alertar'
import { consumirLimite } from '@/server/limite'
import { tratarEvento } from '@/server/receber-evento'
import { segredosAtivos, marcarChamada } from '@/server/repos/webhooks-de-entrada'

/**
 * Onde um sistema de fora avisa que algo aconteceu (0044).
 *
 * **Existe para consertar uma promessa falsa que já está em produção.** O
 * preset `verandi-espera` diz, com estas palavras, "transforma o 'está lotado'
 * em 'te aviso se abrir'. Quando alguém desmarca, a agenda dispara o aviso". A
 * Verandi dispara. Não havia rota para receber, e quem entrou na fila nunca foi
 * avisado — sem nenhum sinal de que isso estava acontecendo.
 *
 * É **superfície pública**, então nasce com as quatro defesas do produto, nesta
 * ordem — da mais barata para a mais cara:
 *
 * 1. **teto de corpo** (413), antes de ler qualquer coisa;
 * 2. **limite por cliente**, no contador atômico da 0014;
 * 3. **assinatura HMAC por cliente**, conferida em tempo constante;
 * 4. **nada estoura dentro do `after()`** — regra 4 do ESTADO.md.
 *
 * A ordem importa: conferir assinatura primeiro obrigaria a ir ao cofre antes
 * de saber se o corpo tem tamanho aceitável, o que transformaria uma inundação
 * de lixo em uma inundação de leituras do Vault.
 */

/** 64 KB. Um evento é `{evento, telefone, dados}` — quem manda mais não é evento. */
const LIMITE_DO_CORPO_EM_BYTES = 64 * 1024

/**
 * Teto por cliente e janela.
 *
 * **Por cliente, e não por endereço.** Quem chama é servidor de outro sistema,
 * e vários clientes podem ser servidos pelo mesmo (a Verandi é literalmente
 * isso). Chavear por IP faria o volume de um cliente calar o webhook de outro.
 *
 * 120/min cobre a rajada real — uma agenda que cancela vinte aulas de uma vez —
 * e continua barrando script.
 */
const TETO_POR_MINUTO = 120
const JANELA_EM_SEGUNDOS = 60

/**
 * O `after()` roda depois da resposta, mas dentro do orçamento da função. Um
 * fluxo com nó de API no caminho pode demorar; 60s é o mesmo teto do webhook do
 * WhatsApp, e pelo mesmo motivo.
 */
export const maxDuration = 60

const corpoSchema = z.object({
  /** O nome do evento, como o sistema de fora o chama: `vaga.aberta`. */
  evento: z.string().trim().min(1).max(120),
  /** Quem. É o telefone, porque é a identidade que o WhatsApp usa. */
  telefone: z.string().trim().min(1).max(40),
  /**
   * O que mais o evento traz. Livre de propósito — quem define é o outro lado —
   * e usado só para a anotação quando a janela de 24h está fechada.
   */
  dados: z.record(z.unknown()).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params

  // 1. O teto de corpo vem primeiro: é a única defesa que não custa nem uma ida
  //    ao banco, e recusar 10 MB depois de já os ter lido não defende de nada.
  const tamanhoDeclarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }

  // 2. O limite por cliente, antes de ir ao cofre.
  const dentroDoLimite = await consumirLimite(
    `webhook-entrada:${clienteId}`,
    TETO_POR_MINUTO,
    JANELA_EM_SEGUNDOS,
  )
  if (!dentroDoLimite) {
    return Response.json({ erro: 'muitas chamadas' }, { status: 429 })
  }

  // O corpo cru: a assinatura é calculada sobre os bytes exatos, e um
  // `JSON.parse` seguido de `stringify` já não bate mais.
  let corpo: string
  try {
    corpo = await req.text()
  } catch {
    return Response.json({ erro: 'não foi possível ler o corpo' }, { status: 400 })
  }
  if (new TextEncoder().encode(corpo).byteLength > LIMITE_DO_CORPO_EM_BYTES) {
    return Response.json({ erro: 'corpo excede 64 KB' }, { status: 413 })
  }

  // 3. A assinatura, contra os segredos ativos **desta conta**.
  const assinatura = req.headers.get('x-autofluxos-assinatura')
  const webhookId = await qualWebhookAssinou(clienteId, corpo, assinatura)
  if (!webhookId) {
    // 401 sem detalhe: dizer "a conta não tem webhook" e "a assinatura não
    // bate" com respostas diferentes entregaria, de graça, quais contas têm
    // integração ligada.
    return Response.json({ erro: 'assinatura inválida' }, { status: 401 })
  }

  let bruto: unknown
  try {
    bruto = JSON.parse(corpo)
  } catch {
    return Response.json({ erro: 'corpo não é JSON válido' }, { status: 400 })
  }

  const analise = corpoSchema.safeParse(bruto)
  if (!analise.success) {
    // 400 e **não** 200: aqui a assinatura já conferiu, então quem manda é um
    // parceiro legítimo com o corpo errado. Ele precisa saber disso — responder
    // 200 faria o defeito virar silêncio dos dois lados.
    return Response.json({ erro: 'corpo inválido: espera { evento, telefone }' }, { status: 400 })
  }

  const entrada = analise.data

  after(async () => {
    try {
      await marcarChamada(webhookId)
      await tratarEvento({
        clienteId,
        evento: entrada.evento,
        telefone: entrada.telefone,
        dados: entrada.dados,
      })
    } catch (erro) {
      // Já respondemos 200. Deixar estourar aqui produziria um unhandled
      // rejection sem ninguém para ver — e um aviso que não saiu, em silêncio,
      // que é exatamente o defeito que esta rota existe para consertar.
      console.error('[webhook-entrada] falhou ao processar', erro)
      await alertar('o processamento do evento falhou', erro, { cliente: clienteId })
    }
  })

  /**
   * **200 mesmo quando nada acontece**, e é decisão.
   *
   * Evento sem gatilho, telefone desconhecido, janela fechada: nenhum é culpa
   * de quem chamou, e responder erro faria o outro lado reenfileirar e repetir
   * para sempre uma chamada que nunca vai dar certo. O que aconteceu de fato
   * vira alerta e anotação do nosso lado, que é onde alguém pode agir.
   */
  return Response.json({ ok: true }, { status: 200 })
}

/**
 * Qual webhook desta conta assinou este corpo — ou `null`.
 *
 * **Confere contra todos os ativos da conta**, porque a chamada não diz qual
 * webhook ela é: ela traz uma assinatura e mais nada. Exigir um id no caminho
 * daria a quem chama uma forma de enumerar webhooks de outras contas.
 *
 * A comparação é em **tempo constante**. Comparar com `===` vazaria, pelo tempo
 * de resposta, quantos bytes iniciais o atacante já acertou — e com um endereço
 * público isso é um oráculo para descobrir a assinatura byte a byte.
 */
async function qualWebhookAssinou(
  clienteId: string,
  corpo: string,
  cabecalho: string | null,
): Promise<string | null> {
  if (!cabecalho?.startsWith('sha256=')) return null

  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex')
  // Comprimento errado não é assinatura: `timingSafeEqual` **estoura** com
  // buffers de tamanhos diferentes, então a conferência precisa vir antes.
  if (recebida.length !== 32) return null

  let webhooks: { id: string; segredo: string }[]
  try {
    webhooks = await segredosAtivos(clienteId)
  } catch (erro) {
    // Cofre fora do ar fecha a porta em vez de abri-la.
    console.error('[webhook-entrada] não deu para ler os segredos', erro)
    return null
  }

  for (const webhook of webhooks) {
    const esperada = createHmac('sha256', webhook.segredo).update(corpo).digest()
    if (timingSafeEqual(esperada, recebida)) return webhook.id
  }

  return null
}
