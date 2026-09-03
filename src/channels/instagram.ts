import { LIMITE_ATRASO_SEGUNDOS, type Opcao } from '@/core/flow/schema'
import { cortarCaracteres } from '@/core/flow/texto'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import type { Canal, Midia } from './types'

/**
 * O direct do Instagram, pela Instagram Messaging API.
 *
 * ---------------------------------------------------------------------------
 * Instagram Login, e não Facebook Login — não é escolha nossa
 * ---------------------------------------------------------------------------
 *
 * Existem dois caminhos para falar com o Instagram pela Meta, e a tabela de
 * permissões da própria documentação exclui `messages` do lado do Facebook
 * Login: por lá dá para ler comentários e métricas, e **não** dá para receber
 * nem mandar direct. Então a integração é obrigatoriamente pelo Instagram
 * Login, com token por conta conectada e host `graph.instagram.com`.
 *
 * Consequência prática, e ela molda o resto do produto: o token **não é da
 * 4YU**, é de cada conta que autorizou. Não cabe no ambiente como o
 * `WHATSAPP_TOKEN` cabe; mora no Vault, apontado por `channels.token_ref`
 * (migration 0040), e vence em 60 dias.
 *
 * ---------------------------------------------------------------------------
 * O que muda em relação ao WhatsApp
 * ---------------------------------------------------------------------------
 *
 * - **Não existe lista.** O WhatsApp tem botão (até 3) e lista (até 10); o
 *   Instagram tem `quick_replies` e só. Acima de 13 a Meta recusa a mensagem
 *   inteira. Por isso `enviarOpcoes` ignora o `formato` — não há para onde
 *   degradar, e fingir que há esconderia o limite de quem desenha.
 * - **Anexo não tem legenda.** No WhatsApp a legenda viaja junto da mídia. Aqui
 *   ela vira uma segunda mensagem, mandada antes: a foto sem contexto chegando
 *   primeiro é pior do que a explicação chegando primeiro.
 * - **O indicador é `sender_action`**, e não um `status: read` com o id da
 *   mensagem. Não precisa saber qual mensagem responder.
 */

/** Sobrescreva pelo `.env` quando a Meta aposentar a versão. */
const VERSAO_PADRAO = 'v25.0'

/** Mesmo teto do WhatsApp, e pelo mesmo motivo: ver `cloud-api.ts`. */
const TIMEOUT_MS = 15_000
/** Indicador é conveniência; ele não pode consumir o prazo de um envio real. */
const TIMEOUT_INDICADOR_MS = 2_000

/**
 * Acima disto a Meta recusa a mensagem inteira — não corta, recusa.
 *
 * O número está em `DEFINICAO_DO_CANAL.instagram.limites.opcoes` e é lido de lá
 * de propósito: o validador do editor usa a mesma fonte, então a tela e o
 * adaptador não têm como discordar sobre quantas opções cabem.
 */
const LIMITE_QUICK_REPLIES = DEFINICAO_DO_CANAL.instagram.limites.opcoes

/** O rótulo de quick reply do Instagram, que é menor que o do WhatsApp. */
const LIMITE_ROTULO_QUICK_REPLY = DEFINICAO_DO_CANAL.instagram.limites.rotulo

export type ConfigInstagram = {
  /** Id da conta profissional que vai falar (o `IGSID`). */
  igUserId: string
  /** Token da própria conta, vindo do Vault. Nunca do ambiente. */
  token: string
  versaoGraph?: string
}

/**
 * O nosso nome de cada mídia e o nome da Meta no `attachment.type`.
 *
 * Três dos quatro coincidem com o WhatsApp e um não: `documento` vira `file`
 * aqui e `document` lá. É exatamente o tipo de diferença que justifica cada
 * canal ter a própria tradução em vez de uma tabela compartilhada.
 */
const TIPO_NO_INSTAGRAM = {
  imagem: 'image',
  video: 'video',
  documento: 'file',
  audio: 'audio',
} as const

export function canalInstagram(config: ConfigInstagram): Canal {
  const versao = config.versaoGraph ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
  const url = `https://graph.instagram.com/${versao}/${config.igUserId}/messages`

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
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (erro) {
      const nome = erro instanceof Error ? erro.name : ''
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new Error(`o Instagram não respondeu em ${timeoutMs / 1000}s`)
      }
      throw new Error(
        `não deu para falar com o Instagram: ${erro instanceof Error ? erro.message : erro}`,
      )
    }

    if (!resposta.ok) {
      // O texto da Meta aqui é o que separa "token venceu" (reconectar a conta)
      // de "fora da janela de 24h" (não tem conserto agora) — duas conclusões
      // opostas para quem for ler o alerta.
      const detalhe = await resposta.text().catch(() => '')
      throw new Error(`Instagram respondeu ${resposta.status}: ${detalhe.slice(0, 400)}`)
    }
  }

  async function mandarTexto(para: string, texto: string): Promise<void> {
    await mandar({ recipient: { id: para }, message: { text: texto } })
  }

  return {
    async aguardarResposta({ contato }, atrasoMs) {
      try {
        // Duas ações separadas porque a API as trata como coisas diferentes, e
        // a segunda é a que aparece na tela de quem está do outro lado.
        await mandar(
          { recipient: { id: contato }, sender_action: 'mark_seen' },
          TIMEOUT_INDICADOR_MS,
        )
        await mandar(
          { recipient: { id: contato }, sender_action: 'typing_on' },
          TIMEOUT_INDICADOR_MS,
        )
      } catch (erro) {
        // "Digitando" é conveniência, como no WhatsApp. Barrar a resposta por
        // causa dele seria transformar melhoria visual em indisponibilidade.
        console.warn(
          '[instagram] não deu para mostrar digitando',
          erro instanceof Error ? erro.message : String(erro),
        )
      }

      const tetoMs = LIMITE_ATRASO_SEGUNDOS * 1_000
      const esperaMs = Math.min(Math.max(atrasoMs, 0), tetoMs)
      await new Promise((resolver) => setTimeout(resolver, esperaMs))
    },

    async enviarTexto(para, texto) {
      await mandarTexto(para, texto)
    },

    async enviarMidia(para, { midia, url: endereco, legenda }: Midia) {
      /*
       * A legenda vai antes, como mensagem separada.
       *
       * O `attachment` do Instagram não tem campo de legenda — diferente do
       * WhatsApp, onde ela viaja com a mídia. Mandar depois deixaria a foto
       * chegar sozinha e sem contexto, que é a versão pior das duas.
       */
      if (legenda) await mandarTexto(para, legenda)

      await mandar({
        recipient: { id: para },
        message: {
          attachment: {
            type: TIPO_NO_INSTAGRAM[midia],
            // `is_reusable: false` de propósito: guardar o id para reusar seria
            // um cache com invalidação para economizar um download da Meta. É a
            // mesma decisão do `link` no WhatsApp, pelo mesmo motivo.
            payload: { url: endereco, is_reusable: false },
          },
        },
      })
    },

    async enviarOpcoes(para, texto, opcoes) {
      /*
       * O `formato` é ignorado, e isso é a implementação de uma regra do
       * produto, não um esquecimento.
       *
       * `botoes` e `lista` são as duas formas do WhatsApp. O Instagram tem uma
       * só, e o `canais.ts` já diz isso: quem desenha um fluxo de Instagram
       * escolhe o canal antes de desenhar, e o validador cobra pelas medidas
       * dele. Traduzir "lista" para alguma outra coisa aqui inventaria um
       * comportamento que a tela não prometeu.
       */
      const curto = (o: Opcao) => cortarCaracteres(o.rotulo, LIMITE_ROTULO_QUICK_REPLY)

      // O validador barra na publicação; este corte é para a versão publicada
      // antes da regra existir. Truncar a lista é ruim; ter a mensagem inteira
      // recusada pela Meta, no meio de uma conversa, é pior.
      const cabem = opcoes.slice(0, LIMITE_QUICK_REPLIES)

      await mandar({
        recipient: { id: para },
        message: {
          text: texto,
          quick_replies: cabem.map((o) => ({
            content_type: 'text',
            title: curto(o),
            // O `payload` é o que volta no webhook quando a pessoa toca. Tem
            // que ser o id da opção: é por ele que o motor sabe qual saída
            // seguir, exatamente como o `reply.id` do WhatsApp.
            payload: o.id,
          })),
        },
      })
    },
  }
}
