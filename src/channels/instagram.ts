import { LIMITE_ATRASO_SEGUNDOS, type Opcao } from '@/core/flow/schema'
import { cortarCaracteres } from '@/core/flow/texto'
import { linhasDoCard } from '@/core/loja'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { ehArquivoDaMeta } from '@/core/compartilhado'
import type { Canal, Midia } from './types'

/**
 * O direct do Instagram, pela Instagram Messaging API.
 *
 * ---------------------------------------------------------------------------
 * Instagram Login, e não Facebook Login, não é escolha nossa
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
 *   inteira. Por isso `enviarOpcoes` ignora o `formato`, não há para onde
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

/**
 * Limites do template `generic`, conferidos na documentação da Meta em
 * 23/set/2026 (developers.facebook.com, "Generic Template" do Instagram
 * Messaging): até 10 elementos, título e subtítulo até 80 caracteres.
 */
const LIMITE_ELEMENTOS_GENERIC = 10
const LIMITE_TITULO_GENERIC = 80
const TEXTO_DO_BOTAO_DA_LOJA = 'Ver na loja'
/** Arquivo, não JSON: mesmo teto do download do WhatsApp (`cloud-api.ts`). */
const TIMEOUT_DOWNLOAD_MS = 30_000
/** O CDN da Meta redireciona uma vez, às vezes duas. Mais que isso é estranho. */
const MAXIMO_DE_SALTOS = 3
/** Indicador é conveniência; ele não pode consumir o prazo de um envio real. */
const TIMEOUT_INDICADOR_MS = 2_000

/**
 * Acima disto a Meta recusa a mensagem inteira, não corta, recusa.
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
  /**
   * `messenger`: a mesma Send API, pela página do Facebook. O corpo é
   * idêntico ao do Instagram; mudam o endereço (`graph.facebook.com/me`, com o
   * token da página o `me` é a própria página) e o `messaging_type`, que o
   * Messenger cobra em toda mensagem.
   */
  plataforma?: 'instagram' | 'messenger'
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
  const messenger = config.plataforma === 'messenger'
  const url = messenger
    ? `https://graph.facebook.com/${versao}/me/messages`
    : `https://graph.instagram.com/${versao}/${config.igUserId}/messages`
  const nomeDaRede = messenger ? 'Messenger' : 'Instagram'

  async function mandar(
    corpo: Record<string, unknown>,
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<string | null> {
    let resposta: Response
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(messenger && 'message' in corpo ? { messaging_type: 'RESPONSE', ...corpo } : corpo),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (erro) {
      const nome = erro instanceof Error ? erro.name : ''
      if (nome === 'TimeoutError' || nome === 'AbortError') {
        throw new Error(`o ${nomeDaRede} não respondeu em ${timeoutMs / 1000}s`)
      }
      throw new Error(
        `não foi possível falar com o ${nomeDaRede}: ${erro instanceof Error ? erro.message : erro}`,
      )
    }

    if (!resposta.ok) {
      // O texto da Meta aqui é o que separa "token venceu" (reconectar a conta)
      // de "fora da janela de 24h" (não tem conserto agora), duas conclusões
      // opostas para quem for ler o alerta.
      const detalhe = await resposta.text().catch(() => '')
      throw new Error(`${nomeDaRede} respondeu ${resposta.status}: ${detalhe.slice(0, 400)}`)
    }
    /*
     * O `message_id` vira o `wa_message_id` da linha. É ele que faz o eco
     * desta mesma mensagem (o Instagram ecoa tudo, inclusive o que a API
     * mandou) cair no `unique` em vez de virar bolha duplicada.
     */
    const corpoDaResposta = (await resposta.json().catch(() => null)) as { message_id?: unknown } | null
    return typeof corpoDaResposta?.message_id === 'string' ? corpoDaResposta.message_id : null
  }

  async function mandarTexto(para: string, texto: string): Promise<string | null> {
    return mandar({ recipient: { id: para }, message: { text: texto } })
  }

  return {
    origem: messenger ? 'messenger' : 'instagram',
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
          '[instagram] não foi possível mostrar digitando',
          erro instanceof Error ? erro.message : String(erro),
        )
      }

      const tetoMs = LIMITE_ATRASO_SEGUNDOS * 1_000
      const esperaMs = Math.min(Math.max(atrasoMs, 0), tetoMs)
      await new Promise((resolver) => setTimeout(resolver, esperaMs))
    },

    async enviarTexto(para, texto) {
      return mandarTexto(para, texto)
    },

    /*
     * O anexo do direct, pela URL de CDN que veio no webhook.
     *
     * Diferente do WhatsApp, não há troca de id por URL: a Meta já manda o
     * endereço, e ele desce **sem token** (assinado na própria URL). Só baixa
     * de host da Meta (`ehArquivoDaMeta`), e confere de novo a cada
     * redirecionamento: seguir sozinho deixaria um redirecionamento levar o
     * servidor para fora da lista.
     *
     * Reel e post compartilhados chegam como `instagram.com/...`, que não é
     * arquivo, e param aqui sem pedido nenhum: a bolha os desenha como cartão.
     */
    async baixarMidia(endereco) {
      let atual = endereco
      try {
        for (let salto = 0; salto <= MAXIMO_DE_SALTOS; salto++) {
          if (!ehArquivoDaMeta(atual)) return null
          const resposta = await fetch(atual, {
            redirect: 'manual',
            signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS),
          })
          const destino = resposta.headers.get('location')
          if (resposta.status >= 300 && resposta.status < 400 && destino) {
            atual = new URL(destino, atual).toString()
            continue
          }
          if (!resposta.ok) {
            console.warn(`[${nomeDaRede.toLowerCase()}] o anexo não desceu (${resposta.status})`)
            return null
          }
          const bytes = new Uint8Array(await resposta.arrayBuffer())
          const mime = resposta.headers.get('content-type') ?? 'application/octet-stream'
          return { bytes, mime }
        }
        return null
      } catch (erro) {
        console.warn(
          `[${nomeDaRede.toLowerCase()}] não foi possível baixar o anexo`,
          erro instanceof Error ? erro.message : String(erro),
        )
        return null
      }
    },

    async enviarMidia(para, { midia, url: endereco, legenda }: Midia) {
      /*
       * A legenda vai antes, como mensagem separada.
       *
       * O `attachment` do Instagram não tem campo de legenda, diferente do
       * WhatsApp, onde ela viaja com a mídia. Mandar depois deixaria a foto
       * chegar sozinha e sem contexto, que é a versão pior das duas.
       */
      if (legenda) await mandarTexto(para, legenda)

      return mandar({
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

    async enviarProdutos(para, produtos) {
      // Um carrossel só: o `generic` com vários elementos rola de lado, que é
      // o jeito do Instagram mostrar mais de um produto sem uma mensagem cada.
      const elementos = produtos
        // Sem link não há botão nem ação: o generic sem url a Meta recusa.
        .filter((p) => p.foto && p.link)
        .slice(0, LIMITE_ELEMENTOS_GENERIC)
        .map((p) => {
          const { titulo, detalhe } = linhasDoCard(p)
          return {
            title: cortarCaracteres(titulo, LIMITE_TITULO_GENERIC),
            subtitle: cortarCaracteres(detalhe, LIMITE_TITULO_GENERIC),
            image_url: p.foto,
            default_action: { type: 'web_url', url: p.link },
            buttons: [{ type: 'web_url', url: p.link, title: TEXTO_DO_BOTAO_DA_LOJA }],
          }
        })
      if (elementos.length === 0) return null

      await mandar({
        recipient: { id: para },
        message: {
          attachment: {
            type: 'template',
            payload: { template_type: 'generic', elements: elementos },
          },
        },
      })
      return null
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
      return null
    },
  }
}
