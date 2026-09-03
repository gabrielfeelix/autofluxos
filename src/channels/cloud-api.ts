import { LIMITE_ATRASO_SEGUNDOS, LIMITE_ROTULO, type Opcao } from '@/core/flow/schema'
import { cortarCaracteres } from '@/core/flow/texto'
import type { Canal } from './types'

/**
 * A Cloud API oficial da Meta.
 *
 * Nada de chip nem cliente não oficial: a Meta vem intensificando o banimento
 * de números que usam esses caminhos, e perder o número do cliente é o pior
 * fracasso possível para uma agência.
 */

/** Sobrescreva pelo `.env` quando a Meta aposentar a versão. */
const VERSAO_PADRAO = 'v25.0'

/**
 * Quinze segundos, e não "o que a Graph API decidir".
 *
 * Sem teto, uma Graph pendurada segura o `after()` do webhook até o
 * `maxDuration` de 60s e a função morre no meio — a sessão já foi gravada, a
 * mensagem já foi deduplicada, e a pessoa fica esperando uma resposta que nunca
 * sai. O nó de API e o Gemini já tinham prazo; este caminho era o que faltava.
 *
 * O valor é folgado de propósito: a Meta responde em menos de um segundo no
 * caso normal, então quinze só corta o que já está quebrado.
 */
const TIMEOUT_MS = 15_000
/** Indicador é conveniência; ele não pode consumir o prazo de um envio real. */
const TIMEOUT_INDICADOR_MS = 2_000

export type ConfigCloudApi = {
  phoneNumberId: string
  token: string
  versaoGraph?: string
}

/**
 * O nosso nome de cada mídia e o nome da Meta.
 *
 * São diferentes em dois dos quatro (`imagem`/`image`, `video`/`video` batem;
 * `documento`/`document` e `audio`/`audio` não). Manter a tradução aqui é o que
 * deixa `core/` falar português sem saber que a Cloud API existe — a mesma
 * fronteira que já vale para o resto do domínio.
 */
const TIPO_NA_META = {
  imagem: 'image',
  video: 'video',
  documento: 'document',
  audio: 'audio',
} as const

export function canalCloudApi(config: ConfigCloudApi): Canal {
  const versao = config.versaoGraph ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
  const url = `https://graph.facebook.com/${versao}/${config.phoneNumberId}/messages`

  async function mandar(
    corpo: Record<string, unknown>,
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<void> {
    let resposta: Response
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (erro) {
      // Rede caída ou prazo estourado. Vira erro nosso com nome, e não um
      // `TypeError: fetch failed` que não diz nada a quem for ler o handoff.
      const nome = erro instanceof Error ? erro.name : ''
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new Error(`a Cloud API não respondeu em ${timeoutMs / 1000}s`)
      }
      throw new Error(`não deu para falar com a Cloud API: ${erro instanceof Error ? erro.message : erro}`)
    }

    if (!resposta.ok) {
      // O texto da Meta é específico ("token expirado", "número não é
      // destinatário de teste"). Engolir isso transformaria um problema de
      // 30 segundos numa tarde de investigação.
      const detalhe = await resposta.text().catch(() => '')
      throw new Error(`Cloud API respondeu ${resposta.status}: ${detalhe.slice(0, 400)}`)
    }
  }

  return {
    async aguardarResposta({ mensagemId }, atrasoMs) {
      try {
        // A Meta exige o id da entrada: o mesmo pedido marca como lida e liga
        // o indicador até a resposta sair (ou por no máximo 25 segundos).
        await mandar(
          {
            status: 'read',
            message_id: mensagemId,
            typing_indicator: { type: 'text' },
          },
          TIMEOUT_INDICADOR_MS,
        )
      } catch (erro) {
        // "Digitando" é conveniência. Token ou rede ruins ainda serão
        // tratados no envio que vale; barrar a resposta por este pedido seria
        // transformar uma melhoria visual em indisponibilidade.
        console.warn(
          '[whatsapp] não deu para mostrar digitando',
          erro instanceof Error ? erro.message : String(erro),
        )
      }

      const tetoMs = LIMITE_ATRASO_SEGUNDOS * 1_000
      const esperaMs = Math.min(Math.max(atrasoMs, 0), tetoMs)
      await new Promise((resolver) => setTimeout(resolver, esperaMs))
    },

    async enviarTexto(para, texto) {
      await mandar({ to: para, type: 'text', text: { preview_url: true, body: texto } })
    },

    async enviarMidia(para, { midia, url, legenda, nomeArquivo }) {
      // A Meta baixa do `link` na hora de entregar; o outro caminho é subir o
      // arquivo antes e mandar um `id`. Ficamos no link de propósito: o `id`
      // expira em 30 dias e obrigaria a guardar validade e reenviar sozinho,
      // que é um cache com invalidação para economizar um GET da Meta.
      //
      // O preço do link é ser público enquanto durar. Quem publica o endereço
      // decide isso; o canal só entrega o que o fluxo mandou.
      const tipo = TIPO_NA_META[midia]

      await mandar({
        to: para,
        type: tipo,
        [tipo]: {
          link: url,
          // Áudio não aceita legenda e o motor já não a produz. Repetir a
          // condição aqui não é redundância: o adaptador é o último ponto
          // antes da Meta, e uma versão publicada antes desta regra pode
          // carregar a legenda no grafo.
          ...(legenda && midia !== 'audio' ? { caption: legenda } : {}),
          ...(nomeArquivo && midia === 'documento' ? { filename: nomeArquivo } : {}),
        },
      })
    },

    async enviarOpcoes(para, texto, opcoes, formato) {
      // O validador já barra rótulo grande na publicação. Este corte é para a
      // versão que foi publicada antes daquela regra existir: melhor um rótulo
      // truncado do que a Meta recusar a mensagem inteira.
      //
      // `cortarCaracteres` e não `.slice`: os rótulos têm emoji ("📅 Escolher
      // outro dia"), e cortar por unidade UTF-16 devolve meio par substituto —
      // que o Postgres recusa dentro de `jsonb` na hora de gravar a mensagem.
      const curto = (o: Opcao) => cortarCaracteres(o.rotulo, LIMITE_ROTULO)

      if (formato === 'botoes') {
        await mandar({
          to: para,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: texto },
            action: {
              buttons: opcoes.map((o) => ({ type: 'reply', reply: { id: o.id, title: curto(o) } })),
            },
          },
        })
        return
      }

      await mandar({
        to: para,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: texto },
          action: {
            button: 'Ver opções',
            sections: [{ title: 'Opções', rows: opcoes.map((o) => ({ id: o.id, title: curto(o) })) }],
          },
        },
      })
    },
  }
}
