import { LIMITE_ROTULO, type Opcao } from '@/core/flow/schema'
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

export type ConfigCloudApi = {
  phoneNumberId: string
  token: string
  versaoGraph?: string
}

export function canalCloudApi(config: ConfigCloudApi): Canal {
  const versao = config.versaoGraph ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
  const url = `https://graph.facebook.com/${versao}/${config.phoneNumberId}/messages`

  async function mandar(corpo: Record<string, unknown>): Promise<void> {
    let resposta: Response
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (erro) {
      // Rede caída ou prazo estourado. Vira erro nosso com nome, e não um
      // `TypeError: fetch failed` que não diz nada a quem for ler o handoff.
      const nome = erro instanceof Error ? erro.name : ''
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new Error(`a Cloud API não respondeu em ${TIMEOUT_MS / 1000}s`)
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
    async enviarTexto(para, texto) {
      await mandar({ to: para, type: 'text', text: { preview_url: true, body: texto } })
    },

    async enviarOpcoes(para, texto, opcoes, formato) {
      // O validador já barra rótulo grande na publicação. Este corte é para a
      // versão que foi publicada antes daquela regra existir: melhor um rótulo
      // truncado do que a Meta recusar a mensagem inteira.
      const curto = (o: Opcao) => o.rotulo.slice(0, LIMITE_ROTULO)

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
