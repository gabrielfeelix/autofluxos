import { LIMITE_ATRASO_SEGUNDOS, type Opcao } from '@/core/flow/schema'
import { cortarCaracteres } from '@/core/flow/texto'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import type { Canal, Midia } from './types'

/**
 * Um bot do Telegram, pela Bot API.
 *
 * ---------------------------------------------------------------------------
 * O que muda em relação à Meta, e é quase tudo
 * ---------------------------------------------------------------------------
 *
 * - **Não há janela de 24h, não há template, não há aprovação.** O bot fala
 *   quando quiser com quem já falou com ele uma vez. É por isso que
 *   `canais.ts` dá `janelaHoras: null` ao Telegram, e é por isso que este
 *   arquivo não tem nada parecido com `janela.ts`.
 * - **O token é do bot, não da conta.** Ele sai do @BotFather inteiro e não
 *   vence sozinho, o oposto do token do Instagram, que morre em 60 dias. Quem
 *   revoga é o dono, pelo próprio BotFather, e aí o token velho responde 401
 *   para sempre.
 * - **O token vai na URL, e não num header.** A Bot API não usa `Authorization`:
 *   o endereço é `/bot<token>/<metodo>`. Consequência que molda o tratamento de
 *   erro aqui embaixo: **o token está dentro da URL**, então repetir a URL numa
 *   mensagem de erro vazaria a credencial para o log. Ver `descrever()`.
 * - **O destinatário é um número (`chat_id`)**, não um telefone nem um IGSID.
 *   Ele chega no webhook e é estável por par (bot, pessoa).
 *
 * ---------------------------------------------------------------------------
 * Opções viram teclado inline, e o `formato` é ignorado
 * ---------------------------------------------------------------------------
 *
 * Pelo mesmo motivo do Instagram: o WhatsApp é que tem duas formas (botão e
 * lista). O Telegram tem uma, `inline_keyboard` , e ela já é mais generosa
 * que as duas. Traduzir "lista" para outra coisa inventaria comportamento que
 * a tela não prometeu.
 *
 * O `callback_data` leva o id da opção, exatamente como o `payload` do
 * Instagram e o `reply.id` do WhatsApp: é por ele que o motor sabe qual saída
 * seguir. **O teto dele é 64 bytes**, imposto pelo Telegram, ver
 * `LIMITE_CALLBACK_DATA`.
 */

/** A Bot API não é versionada por caminho; o host é fixo. */
const RAIZ_PADRAO = 'https://api.telegram.org'

/** Mesmo teto dos outros canais, e pelo mesmo motivo: ver `cloud-api.ts`. */
const TIMEOUT_MS = 15_000
/** Indicador é conveniência; ele não pode consumir o prazo de um envio real. */
const TIMEOUT_INDICADOR_MS = 2_000

/**
 * Quantas opções cabem numa pergunta, pela tabela de `canais.ts`.
 *
 * O número é lido de lá de propósito, como no Instagram: o validador do editor
 * usa a mesma fonte, então a tela e o adaptador não têm como discordar. E aqui
 * ele é **nosso**, não do Telegram, o teclado inline aguenta dezenas, e o 10
 * existe para a lista continuar legível.
 */
const LIMITE_OPCOES = DEFINICAO_DO_CANAL.telegram.limites.opcoes

/** Quantos botões por linha antes de quebrar. Também nosso, e pela mesma razão. */
const BOTOES_POR_LINHA = DEFINICAO_DO_CANAL.telegram.limites.botoes

/** O rótulo de um botão, pela tabela de `canais.ts`. */
const LIMITE_ROTULO = DEFINICAO_DO_CANAL.telegram.limites.rotulo

/**
 * O teto de `callback_data`, em **bytes**, e este é do Telegram, não nosso.
 *
 * Passar disso faz a API recusar a mensagem inteira, e não só o botão. Os ids
 * de opção do editor são curtos e não chegam perto, mas o corte existe porque
 * o preço de errar é a pergunta não aparecer no meio de uma conversa.
 *
 * Contado em bytes, e não em caracteres, porque é assim que o Telegram conta:
 * um id com acento ocuparia dois bytes por letra acentuada.
 */
const LIMITE_CALLBACK_DATA = 64

export type ConfigTelegram = {
  /** O token do @BotFather, inteiro (`123456:ABC-DEF...`). Nunca do ambiente. */
  token: string
  /** Só os testes trocam. Existe para não precisar de rede na suíte. */
  raiz?: string
}

/**
 * O nosso nome de cada mídia e o método da Bot API que a entrega.
 *
 * Aqui não é um campo `type` dentro de um corpo comum, como na Meta: **cada
 * mídia tem método próprio**, com nome de campo próprio. Documento é
 * `sendDocument` com `document`, áudio é `sendAudio` com `audio`. Por isso a
 * tabela guarda os dois.
 */
const ENTREGA_NO_TELEGRAM = {
  imagem: { metodo: 'sendPhoto', campo: 'photo' },
  video: { metodo: 'sendVideo', campo: 'video' },
  documento: { metodo: 'sendDocument', campo: 'document' },
  audio: { metodo: 'sendAudio', campo: 'audio' },
} as const

/** Quantos bytes este texto ocupa em UTF-8, que é como o Telegram conta. */
function bytes(texto: string): number {
  return new TextEncoder().encode(texto).length
}

/**
 * Corta o `callback_data` para caber nos 64 bytes do Telegram.
 *
 * Corta por **byte** e não por caractere, e nunca no meio de um: `TextDecoder`
 * não-fatal devolveria um caractere de substituição, que voltaria no webhook
 * como um id que não existe. Cortar um caractere a menos é a versão certa de
 * errar.
 */
function cortarBytes(valor: string, teto: number): string {
  if (bytes(valor) <= teto) return valor

  let corte = valor
  while (corte.length > 0 && bytes(corte) > teto) {
    corte = corte.slice(0, -1)
  }
  return corte
}

export function canalTelegram(config: ConfigTelegram): Canal {
  const raiz = config.raiz ?? process.env.TELEGRAM_API_ROOT ?? RAIZ_PADRAO
  const base = `${raiz}/bot${config.token}`

  /**
   * O nome do método, para a mensagem de erro, **sem o token**.
   *
   * A URL inteira carrega a credencial. Um `throw new Error(url)` inocente
   * colocaria o token do cliente no log de produção, de onde ele não sai. É a
   * diferença mais importante entre este adaptador e os da Meta, onde o token
   * viaja num header e a URL é pública.
   */
  function descrever(metodo: string): string {
    return `Telegram (${metodo})`
  }

  async function mandar(
    metodo: string,
    corpo: Record<string, unknown>,
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<void> {
    let resposta: Response
    try {
      resposta = await fetch(`${base}/${metodo}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (erro) {
      const nome = erro instanceof Error ? erro.name : ''
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new Error(`${descrever(metodo)} não respondeu em ${timeoutMs / 1000}s`)
      }
      throw new Error(
        `não deu para falar com o ${descrever(metodo)}: ${erro instanceof Error ? erro.message : erro}`,
      )
    }

    if (!resposta.ok) {
      /*
       * O corpo do Telegram traz `description` com o motivo em inglês claro
       * ("bot was blocked by the user", "chat not found"), e ele separa
       * "a pessoa bloqueou o bot" de "o token foi revogado", duas conclusões
       * opostas para quem for ler o alerta. Mesma decisão dos adaptadores da
       * Meta.
       *
       * O texto da resposta **não** contém o token: ele só existe na URL, que
       * não entra aqui.
       */
      const detalhe = await resposta.text().catch(() => '')
      throw new Error(`${descrever(metodo)} respondeu ${resposta.status}: ${detalhe.slice(0, 400)}`)
    }
  }

  return {
    async aguardarResposta({ contato }, atrasoMs) {
      try {
        /*
         * `sendChatAction` é o "digitando" do Telegram, e ele **não marca como
         * lida**: não existe tique azul para bot, então aqui não há o segundo
         * pedido que o Instagram faz nem o `status: read` do WhatsApp.
         *
         * O indicador some sozinho em 5 segundos, ou quando a mensagem chega ,
         * o que sempre acontece antes, porque o atraso é de no máximo
         * `LIMITE_ATRASO_SEGUNDOS`.
         */
        await mandar(
          'sendChatAction',
          { chat_id: contato, action: 'typing' },
          TIMEOUT_INDICADOR_MS,
        )
      } catch (erro) {
        // "Digitando" é conveniência, como nos outros canais. Barrar a resposta
        // por causa dele seria transformar melhoria visual em indisponibilidade.
        console.warn(
          '[telegram] não deu para mostrar digitando',
          erro instanceof Error ? erro.message : String(erro),
        )
      }

      const tetoMs = LIMITE_ATRASO_SEGUNDOS * 1_000
      const esperaMs = Math.min(Math.max(atrasoMs, 0), tetoMs)
      await new Promise((resolver) => setTimeout(resolver, esperaMs))
    },

    async enviarTexto(para, texto, citando) {
      await mandar('sendMessage', {
        chat_id: para,
        text: texto,
        ...citacao(citando),
      })
    },

    async enviarMidia(para, { midia, url: endereco, legenda }: Midia, citando) {
      const { metodo, campo } = ENTREGA_NO_TELEGRAM[midia]

      /*
       * A legenda viaja **junto** da mídia, como no WhatsApp e ao contrário do
       * Instagram: o Telegram tem `caption` em todos os métodos de mídia. Não
       * há a segunda mensagem que o Instagram precisa mandar antes.
       *
       * A URL vai como está. O Telegram busca o arquivo ele mesmo, não há o
       * `subirParaAMeta` da Cloud API, porque não há id de mídia com validade
       * para economizar aqui.
       */
      await mandar(metodo, {
        chat_id: para,
        [campo]: endereco,
        ...(legenda ? { caption: legenda } : {}),
        ...citacao(citando),
      })
    },

    async enviarOpcoes(para, texto, opcoes) {
      /*
       * O `formato` é ignorado, ver o cabeçalho. O Telegram tem uma forma só.
       *
       * O validador barra na publicação; este corte é para a versão publicada
       * antes da regra existir. Truncar a lista é ruim; ter a mensagem inteira
       * recusada no meio de uma conversa é pior.
       */
      const cabem = opcoes.slice(0, LIMITE_OPCOES)

      const botoes = cabem.map((o: Opcao) => ({
        text: cortarCaracteres(o.rotulo, LIMITE_ROTULO),
        callback_data: cortarBytes(o.id, LIMITE_CALLBACK_DATA),
      }))

      /*
       * O teclado é uma matriz de linhas, e não uma lista de botões: quem
       * decide a quebra somos nós. Em linhas de `BOTOES_POR_LINHA` os rótulos
       * curtos ficam lado a lado e nenhum botão fica espremido.
       */
      const linhas: (typeof botoes)[] = []
      for (let i = 0; i < botoes.length; i += BOTOES_POR_LINHA) {
        linhas.push(botoes.slice(i, i + BOTOES_POR_LINHA))
      }

      await mandar('sendMessage', {
        chat_id: para,
        text: texto,
        reply_markup: { inline_keyboard: linhas },
      })
    },
  }
}

/**
 * O trecho que transforma um envio em resposta a outra mensagem.
 *
 * Vazio quando não há citação, para o corpo não carregar um campo nulo. O id
 * do Telegram é numérico (`message_id`), e o nosso `Citacao` é string, a
 * conversão é aqui e não no chamador, porque é este canal que tem essa
 * exigência.
 *
 * Id que não seja número vira "sem citação" em vez de erro: citar é enfeite,
 * e a regra de `types.ts` é que o canal que não sabe citar entrega mesmo assim.
 */
function citacao(citando?: string): Record<string, unknown> {
  if (!citando) return {}

  const id = Number(citando)
  if (!Number.isInteger(id)) return {}

  /*
   * `allow_sending_without_reply` é o que impede a mensagem de ser recusada
   * quando a citada foi apagada, sem ele, apagar a mensagem original faria a
   * resposta do bot sumir junto.
   */
  return { reply_parameters: { message_id: id, allow_sending_without_reply: true } }
}
