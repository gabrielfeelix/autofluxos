import { createHmac, timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { alertar } from '@/server/alertar'
import { receberCoexistencia, tratarAtualizacaoDaConta } from '@/server/receber-coexistencia'
import { receberMensagem } from '@/server/receber-mensagem'
import {
  receberStatusDeEntrega,
  receberStatusDeTemplate,
} from '@/server/receber-status-de-template'
import { enviarAgendadas } from '@/server/enviar-agendadas'
import { passadaDeTransmissoes, POR_CARONA } from '@/server/passada-de-transmissoes'
import { rodarTarefas } from '@/server/tarefas'

/**
 * Onde o WhatsApp bate.
 *
 * Duas regras da Meta moldam este arquivo:
 *
 * 1. **Responder 200 em menos de 20 segundos** (a recomendação é abaixo de 5).
 *    Passou disso, ela reenvia, e reenvio vira conversa andando duas vezes.
 *    Por isso a resposta sai na hora e o processamento vai para o `after()`.
 * 2. **Validar a assinatura.** Sem isso, a URL é pública e qualquer um manda
 *    mensagem falsa em nome de qualquer cliente.
 *
 * A duplicata que escapar mesmo assim é pega pelo `unique` em
 * `messages.wa_message_id`.
 */

/**
 * O `after()` continua rodando depois da resposta, mas dentro do orçamento de
 * tempo da função, que na Vercel é curto por padrão.
 *
 * Sem isto, um parceiro lento no nó de API estoura o orçamento antes do nosso
 * próprio timeout de 10s por chamada: a função é morta no meio, o handoff nunca
 * é gravado, e a sessão fica presa em `aguardando_http`. Como a mensagem já foi
 * deduplicada, a Meta não reenvia e a pessoa fica sem resposta nenhuma.
 *
 * 60s cobre o pior caso realista: três saltos de redirecionamento no timeout
 * cheio, mais o banco.
 */
export const maxDuration = 60

export async function GET(req: Request) {
  const parametros = new URL(req.url).searchParams
  const modo = parametros.get('hub.mode')
  const token = parametros.get('hub.verify_token')
  const desafio = parametros.get('hub.challenge')

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN

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

  /*
   * **O diário de bordo saiu em 22/set/2026, e o caso dele está fechado.**
   *
   * Entre 13 e 22/set esta linha gravava um alerta em **toda** chamada do
   * webhook, para separar "a Meta não chamou" de "chegou e foi descartado no
   * meio" quando nada aparecia no Inbox de um cliente coexistente. Ele achou o
   * culpado, que era nosso: `tratarEcos` lia `valor.messages` onde a Meta manda
   * `message_echoes`, com 200 na resposta e zero alerta. Corrigido no `0f18eca`,
   * e `receber-coexistencia.ts` hoje lê o campo certo.
   *
   * **O custo de deixá-lo ligado, medido antes de tirar:** 2.401 dos 3.087
   * alertas da tabela, 78% do volume, e 2.973 dos últimos 7 dias. A tela
   * `/admin/alertas` existe para mostrar o que quebrou, e as 177 recusas da
   * Cloud API e os 88 contatos que não entraram no quadro padrão estavam
   * enterrados no meio de bilhete de "passou por aqui". O aviso estava escrito
   * no próprio comentário que saiu daqui: alerta por chamada é barulho, e
   * barulho em alerta faz parar de ler alerta.
   *
   * **O que continua avisando**, e por isso remover é seguro: o `catch` do
   * `after()` logo abaixo alerta quando o processamento falha de verdade, que é
   * a pergunta que importa. Quem precisar do diário de novo: é esta linha de
   * volta, por pouco tempo, e com a data de saída combinada antes de ligar.
   */

  let payload: unknown
  try {
    payload = JSON.parse(corpo)
  } catch {
    // Corpo estranho não é motivo para a Meta ficar reenviando.
    return new Response('ok', { status: 200 })
  }

  after(async () => {
    try {
      await receberMensagem(payload)

      /*
       * Os campos de coexistência, no mesmo corpo.
       *
       * **Depois da mensagem e não junto**: o mesmo POST da Meta pode trazer
       * `messages` e `history` ao mesmo tempo, e a mensagem que acabou de
       * chegar de uma pessoa de verdade tem prioridade sobre a importação de
       * conversa antiga. Cada um lê a sua parte do mesmo payload e ignora a do
       * outro, ver `receber-coexistencia.ts`.
       */
      await receberCoexistencia(payload)

      /*
       * `account_update`: `PARTNER_ADDED`, `ACCOUNT_OFFBOARDED`,
       * `ACCOUNT_RECONNECTED`.
       *
       * `PARTNER_ADDED` é a Meta avisando que alguém **terminou o Embedded
       * Signup**, e é o único aviso que chega quando o navegador do cliente
       * não volta para a nossa rota de retorno. Os outros dois são a troca de
       * aparelho, que derruba o companion sozinho e faria os envios daquele
       * número falharem em silêncio.
       */
      await tratarAtualizacaoDaConta(payload)

      /*
       * O modelo aprovado, e o que aconteceu com cada mensagem dele.
       *
       * São dois campos diferentes do mesmo envelope, e os dois são a única
       * forma de a tela não mentir:
       *
       * - `message_template_status_update` diz se o modelo foi aprovado,
       *   recusado ou pausado. Sem ele, um template fica "em análise" para
       *   sempre quando o webhook chega e ninguém o lê.
       * - o `statuses` do campo `messages` diz se cada mensagem foi entregue,
       *   lida ou **falhou**, e é ali que aparece a mensagem que a Meta tinha
       *   retido e acabou descartando (132015). Sem ler isso, uma transmissão
       *   com 5.000 falhas segue mostrando "enviada".
       *
       * Depois da mensagem e da coexistência de propósito: quem está falando
       * agora tem prioridade sobre registro de entrega.
       */
      await receberStatusDeTemplate(payload)
      await receberStatusDeEntrega(payload)
    } catch (erro) {
      // Já respondemos 200. Deixar estourar aqui só produziria um unhandled
      // rejection sem ninguém para ver.
      console.error('[webhook] falhou ao processar', erro)
      // Esta é *a* exceção que deixa alguém sem resposta no WhatsApp: a Meta já
      // recebeu 200 e não reenvia. Sem aviso, ela é invisível até o cliente
      // ligar reclamando.
      await alertar('o processamento do webhook falhou', erro)
    }

    /**
     * O agendador pega carona no webhook, e não é gambiarra: é a única forma
     * de ele funcionar no plano em que estamos.
     *
     * **A Vercel no plano Hobby dispara cron uma vez por dia.** Um prazo de
     * pergunta de trinta minutos que só é conferido de madrugada não é um
     * prazo, é um lembrete atrasado que chega depois de a janela de 24h ter
     * fechado. O cron continua declarado no `vercel.json` porque ele é o piso
     * (a conta que passou o dia sem mensagem nenhuma ainda é varrida), mas quem
     * dá a resolução é isto aqui.
     *
     * Por que funciona: a conta que tem prazo vencendo é, por construção, a
     * conta que está recebendo mensagem. Quem não recebe nada não tem conversa
     * esperando resposta.
     *
     * O teto é pequeno de propósito. Isto roda **depois** da resposta à Meta,
     * mas ainda dentro do orçamento de tempo da função, e a mensagem que
     * acabou de chegar tem prioridade sobre a cobrança de outra conversa.
     * Fila vazia custa uma consulta com índice parcial.
     */
    try {
      await rodarTarefas(5)
    } catch (erro) {
      // O agendador atrasar é ruim; ele derrubar o processamento da mensagem
      // que acabou de chegar seria muito pior.
      console.error('[webhook] a carona do agendador falhou', erro)
    }

    /*
     * As mensagens marcadas para depois pegam a mesma carona, e pelo mesmo
     * motivo, cron uma vez por dia não manda mensagem às 15h.
     *
     * Vale ainda mais aqui do que para as tarefas: a janela de 24h reabre
     * quando o cliente escreve, então o instante em que chega uma mensagem dele
     * é exatamente o instante em que uma agendada para aquela conversa passa a
     * poder sair.
     *
     * Teto pequeno pela mesma razão: isto roda depois do 200 para a Meta, mas
     * ainda dentro do orçamento da função.
     */
    try {
      await enviarAgendadas(5)
    } catch (erro) {
      console.error('[webhook] a carona das agendadas falhou', erro)
    }

    /*
     * As transmissões pegam a mesma carona, com teto pequeno pelo mesmo
     * motivo: isto roda depois do 200 para a Meta, mas ainda dentro do
     * orçamento da função. `POR_CARONA` faz a campanha andar alguns
     * destinatários por mensagem recebida; a fila é do banco, e a próxima
     * carona continua de onde esta parou.
     */
    try {
      await passadaDeTransmissoes({ porPassada: POR_CARONA })
    } catch (erro) {
      console.error('[webhook] a carona das transmissões falhou', erro)
    }
  })

  return new Response('ok', { status: 200 })
}

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.META_APP_SECRET
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false

  const esperada = createHmac('sha256', segredo).update(corpo).digest('hex')
  const recebida = cabecalho.slice('sha256='.length)

  const a = Buffer.from(esperada, 'hex')
  const b = Buffer.from(recebida, 'hex')
  if (a.length !== b.length) return false

  // Comparação de tempo constante: comparar com `===` vazaria, pelo tempo de
  // resposta, quantos bytes iniciais o atacante já acertou.
  return timingSafeEqual(a, b)
}
