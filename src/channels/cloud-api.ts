import { ehBsuid } from '@/core/contatos/bsuid'
import { LIMITE_ATRASO_SEGUNDOS, LIMITE_ROTULO, type Opcao } from '@/core/flow/schema'
import { cortarCaracteres } from '@/core/flow/texto'
import { linhasDoCard } from '@/core/loja'
import { lerStatusDeEnvio } from '@/core/templates'
import type { Canal, EnvioDeTemplate, Template } from './types'

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
 * `maxDuration` de 60s e a função morre no meio, a sessão já foi gravada, a
 * mensagem já foi deduplicada, e a pessoa fica esperando uma resposta que nunca
 * sai. O nó de API e o Gemini já tinham prazo; este caminho era o que faltava.
 *
 * O valor é folgado de propósito: a Meta responde em menos de um segundo no
 * caso normal, então quinze só corta o que já está quebrado.
 */
const TIMEOUT_MS = 15_000

/**
 * Limites do `interactive` `cta_url`, conferidos na documentação da Meta em
 * 23/set/2026 (developers.facebook.com, "Interactive Call-to-Action URL
 * Button Messages"): corpo até 1024 caracteres, botão até 20.
 */
const LIMITE_CORPO_CTA = 1024
const TEXTO_DO_BOTAO_DA_LOJA = 'Ver na loja'
/** Indicador é conveniência; ele não pode consumir o prazo de um envio real. */
const TIMEOUT_INDICADOR_MS = 2_000
/**
 * Baixar arquivo é outro tipo de espera.
 *
 * Os outros pedidos trocam JSON pequeno; aqui trafega até 16 MB, e numa conexão
 * ruim isso não cabe em quinze segundos. Ainda assim tem teto: sem ele, um
 * download travado seguraria a função até o limite da Vercel e levaria a
 * conversa junto.
 */
const TIMEOUT_DOWNLOAD_MS = 30_000
/**
 * O orçamento **inteiro** de subir um arquivo para a Meta antes de enviar.
 *
 * Um prazo só para as duas pernas (ler do Storage e subir para a Meta), e não
 * um prazo para cada uma. Com um prazo por perna, o pior caso soma, e o envio
 * de mídia roda dentro do `after()` do webhook, que morre no `maxDuration` de
 * 60s da Vercel. Dois prazos de 30s mais os 15s do envio passariam desse teto,
 * e a função morreria no meio: a mensagem gravada, nada entregue, e nenhum
 * erro que explique.
 *
 * Vinte segundos deixa 40s de folga para o envio em si. Estourar aqui não
 * perde a mensagem, devolve `null` e o envio sai pelo `link`, como antes.
 */
const TIMEOUT_SUBIDA_MS = 20_000

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
 * deixa `core/` falar português sem saber que a Cloud API existe, a mesma
 * fronteira que já vale para o resto do domínio.
 */
const TIPO_NA_META = {
  imagem: 'image',
  video: 'video',
  documento: 'document',
  audio: 'audio',
} as const

/**
 * O trecho `context` que transforma um envio em resposta citada.
 *
 * Fica numa função só porque entra em mais de um tipo de mensagem, texto e
 * mídia hoje, e porque o formato é a parte fácil de errar: a Meta quer
 * `context.message_id` no **nível de cima** do corpo, irmão do `type`, e não
 * dentro do objeto do tipo. Escrever nos dois lugares e ver qual pega é como
 * isso costuma ser descoberto.
 *
 * Citação vazia devolve `{}` e o envio segue sem citar: quem chama não precisa
 * montar o espalhamento condicional em cada chamada.
 */
function citacao(mensagemId: string | undefined): Record<string, unknown> {
  if (!mensagemId) return {}
  return { context: { message_id: mensagemId } }
}

/**
 * O nome de arquivo que está no fim de uma URL.
 *
 * Serve só como rótulo do `multipart` no upload, o nome que o cliente vê num
 * documento é o `filename` da mensagem, que vem de quem chamou. Mas rótulo
 * vazio faz a Meta recusar o `multipart` inteiro, então nunca devolve vazio.
 *
 * `decodeURIComponent` estoura em `%` solto, que aparece em nome vindo de fora.
 * Aqui isso viraria "o upload falhou" e o envio cairia para o `link` por causa
 * de um acento, cara caro demais para um rótulo.
 */
function nomeNaUrl(endereco: string): string {
  const semConsulta = endereco.split('?')[0] ?? endereco
  const ultimo = semConsulta.split('/').pop() ?? ''
  try {
    return decodeURIComponent(ultimo) || 'arquivo'
  } catch {
    return ultimo || 'arquivo'
  }
}

/**
 * O que a Cloud API devolve num 200 de `/messages`.
 *
 * Tudo opcional porque é resposta de fora: campo que a Meta renomear vira
 * `undefined` aqui em vez de estourar no meio de uma transmissão de 5.000.
 */
type RespostaDeEnvio = {
  messages?: { id?: string; message_status?: string }[]
}

/**
 * O `wamid` que a Meta deu ao envio, ou `null` quando o corpo não trouxe.
 *
 * É o id que liga a mensagem gravada ao toque, à citação e à reação que
 * vierem depois. Sem ele o Inbox não conseguia reagir nem citar nada que o
 * bot ou a equipe mandaram, e o toque num botão aparecia como resposta a uma
 * "mensagem original" que não existia no histórico.
 */
function idDoEnvio(resposta: RespostaDeEnvio): string | null {
  const id = resposta.messages?.[0]?.id
  return typeof id === 'string' && id !== '' ? id : null
}

/**
 * Troca `to` por `recipient` quando o destino é um BSUID.
 *
 * Contato que adotou nome de usuário no WhatsApp e não deu o telefone fica com
 * o BSUID no `wa_id` (ver `core/contatos/bsuid.ts`). A Cloud API aceita o
 * BSUID só em `recipient`; em `to` ela trataria como telefone e recusaria.
 * Feito aqui, no único POST de `/messages`, para nenhum dos sete tipos de envio
 * precisar saber disso.
 */
export function enderecar(corpo: Record<string, unknown>): Record<string, unknown> {
  if (!ehBsuid(corpo.to as string | undefined)) return corpo
  const { to, ...resto } = corpo
  return { ...resto, recipient: to }
}

export function canalCloudApi(config: ConfigCloudApi): Canal {
  const versao = config.versaoGraph ?? process.env.META_GRAPH_VERSION ?? VERSAO_PADRAO
  const raiz = `https://graph.facebook.com/${versao}`
  const url = `${raiz}/${config.phoneNumberId}/messages`

  /**
   * O POST de `/messages`, com o corpo da resposta de volta.
   *
   * **Devolvia `void` e agora devolve a resposta** por causa do template: para
   * todos os outros envios o 200 basta, e o corpo só repete o que já se sabe.
   * Para template não: é ali que vêm o `wamid`, a chave que liga o webhook de
   * status de volta à linha do destinatário, e o `message_status`, que pode
   * dizer que a Meta **segurou** a mensagem. Ver `enviarTemplate`.
   *
   * Quem não quer a resposta simplesmente ignora o retorno, como antes.
   */
  async function mandar(
    corpo: Record<string, unknown>,
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<RespostaDeEnvio> {
    let resposta: Response
    try {
      resposta = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...enderecar(corpo) }),
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

    /*
     * Corpo ilegível num 200 não é motivo para desfazer um envio que **já
     * aconteceu**. Quem precisa do `wamid` trata a ausência; quem não precisa
     * nem olha. Estourar aqui faria o motor de disparo tentar de novo uma
     * mensagem que a pessoa já recebeu.
     */
    return ((await resposta.json().catch(() => ({}))) ?? {}) as RespostaDeEnvio
  }

  /**
   * Sobe um arquivo para a Meta e devolve o `id` dela. `null` quando não deu.
   *
   * ---------------------------------------------------------------------------
   * Devolver `null` é a parte importante
   * ---------------------------------------------------------------------------
   *
   * Nunca estoura. Quem chama trata `null` mandando o `link`, que é o que este
   * código fazia antes, então toda falha aqui degrada para o comportamento
   * antigo em vez de virar mensagem não entregue. É o que permite trocar o
   * caminho de envio sem ter podido testar num WhatsApp de verdade.
   *
   * ---------------------------------------------------------------------------
   * O `content-type` vem da origem, e não de um palpite pela extensão
   * ---------------------------------------------------------------------------
   *
   * A Meta decide o que aceita pelo tipo declarado no `multipart`. O Storage
   * devolve o tipo com que o arquivo subiu, que é o mesmo que o acervo já
   * validou contra a tabela dela. Adivinhar pela extensão aqui criaria uma
   * terceira opinião sobre o tipo do mesmo arquivo.
   */
  async function subirParaAMeta(endereco: string): Promise<string | null> {
    /*
     * Um prazo só para as duas pernas. `AbortSignal.timeout` começa a contar
     * quando é criado, então criá-lo aqui fora e passá-lo aos dois `fetch` é
     * literalmente "vinte segundos para tudo isto", e não vinte para cada,
     * que somaria além do teto da função. Ver `TIMEOUT_SUBIDA_MS`.
     */
    const prazo = AbortSignal.timeout(TIMEOUT_SUBIDA_MS)

    try {
      const arquivo = await fetch(endereco, { signal: prazo })
      if (!arquivo.ok) {
        console.warn(`[whatsapp] não deu para ler o arquivo para subir (${arquivo.status})`)
        return null
      }

      const bytes = await arquivo.blob()
      const mime = arquivo.headers.get('content-type') ?? 'application/octet-stream'

      /*
       * O nome vem do fim da URL. A Meta o usa só como rótulo do `multipart` ,
       * o nome que o cliente vê num documento é o `filename` da mensagem, que
       * segue vindo de quem chamou. Um nome vazio faria a Meta recusar o
       * `multipart` inteiro, então há um padrão.
       */
      const nome = nomeNaUrl(endereco)

      const formulario = new FormData()
      formulario.append('messaging_product', 'whatsapp')
      formulario.append('file', new File([bytes], nome, { type: mime }))

      const resposta = await fetch(`${raiz}/${config.phoneNumberId}/media`, {
        method: 'POST',
        // Sem `content-type` à mão: o `fetch` monta o `boundary` do multipart
        // sozinho, e escrever o cabeçalho aqui apaga esse boundary, o pedido
        // sai malformado e a Meta responde 400 sem dizer por quê.
        headers: { Authorization: `Bearer ${config.token}` },
        body: formulario,
        signal: prazo,
      })

      if (!resposta.ok) {
        const detalhe = await resposta.text().catch(() => '')
        console.warn(
          `[whatsapp] a Meta recusou o upload da mídia (${resposta.status})`,
          detalhe.slice(0, 200),
        )
        return null
      }

      const dados = (await resposta.json()) as { id?: string }
      return dados.id ?? null
    } catch (erro) {
      console.warn(
        '[whatsapp] não deu para subir a mídia',
        erro instanceof Error ? erro.message : String(erro),
      )
      return null
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

    async enviarTexto(para, texto, citando) {
      const resposta = await mandar({
        to: para,
        type: 'text',
        ...citacao(citando),
        text: { preview_url: true, body: texto },
      })
      return idDoEnvio(resposta)
    },

    /**
     * Reagir a uma mensagem.
     *
     * `emoji: ''` é **remoção**, e é assim que a própria Meta documenta: não há
     * endpoint de "desreagir". Passar a string vazia adiante em vez de barrá-la
     * é o que faz tirar a reação funcionar.
     */
    async reagir(para, mensagemId, emoji) {
      await mandar({
        to: para,
        type: 'reaction',
        reaction: { message_id: mensagemId, emoji },
      })
    },

    /**
     * O segundo tique, sem o "digitando".
     *
     * A Meta marca a conversa inteira como lida a partir de **uma** mensagem:
     * mandar o id da última que chegou cobre as anteriores. Por isso aqui não
     * há laço nem lista, um pedido por conversa aberta, e não um por mensagem.
     */
    async marcarLida(mensagemId) {
      await mandar({ status: 'read', message_id: mensagemId }, TIMEOUT_INDICADOR_MS)
    },

    /**
     * Baixar o que a pessoa mandou, antes de a Meta apagar.
     *
     * -----------------------------------------------------------------------
     * O relógio, que é a razão de esta função existir
     * -----------------------------------------------------------------------
     *
     * O `id` que chega no webhook **vive 7 dias**. A URL que o `GET /{id}`
     * devolve vive **5 minutos**. Depois disso o arquivo não existe em lugar
     * nenhum: os termos da Cloud API (4.5) dizem que a Meta não guarda cópia e
     * que o backup é nosso. Não baixar não é adiar, é perder.
     *
     * -----------------------------------------------------------------------
     * Por que o token vai no segundo pedido também
     * -----------------------------------------------------------------------
     *
     * A URL parece pública e não é: baixar sem o `Authorization` falha. É fácil
     * errar porque a URL já vem assinada, e o erro só aparece em produção.
     *
     * Devolve `null` em vez de estourar: quem chama roda depois de a mensagem
     * já estar gravada, e uma foto que não desceu não pode derrubar a conversa.
     */
    async baixarMidia(mediaId) {
      let endereco: string
      let mime: string
      let nomeArquivo: string | undefined

      try {
        const resposta = await fetch(`${raiz}/${mediaId}`, {
          headers: { Authorization: `Bearer ${config.token}` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!resposta.ok) {
          const detalhe = await resposta.text().catch(() => '')
          console.warn(
            `[whatsapp] a Meta recusou o id da mídia (${resposta.status})`,
            detalhe.slice(0, 200),
          )
          return null
        }

        const dados = (await resposta.json()) as {
          url?: string
          mime_type?: string
          file_name?: string
        }
        if (!dados.url) return null

        endereco = dados.url
        mime = dados.mime_type ?? 'application/octet-stream'
        nomeArquivo = dados.file_name
      } catch (erro) {
        console.warn(
          '[whatsapp] não deu para pedir a URL da mídia',
          erro instanceof Error ? erro.message : String(erro),
        )
        return null
      }

      try {
        /*
         * `TIMEOUT_DOWNLOAD_MS` é maior que o dos outros pedidos porque aqui
         * trafega arquivo, não JSON: um vídeo de 16 MB numa conexão ruim leva
         * mais que os segundos que bastam para uma resposta de texto. Ainda
         * assim tem teto, sem ele, um download travado seguraria a função até
         * o limite da Vercel e levaria a conversa junto.
         */
        const arquivo = await fetch(endereco, {
          headers: { Authorization: `Bearer ${config.token}` },
          signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS),
        })
        if (!arquivo.ok) {
          console.warn(`[whatsapp] a mídia não desceu (${arquivo.status})`)
          return null
        }

        const bytes = new Uint8Array(await arquivo.arrayBuffer())
        return { bytes, mime, ...(nomeArquivo ? { nomeArquivo } : {}) }
      } catch (erro) {
        console.warn(
          '[whatsapp] não deu para baixar a mídia',
          erro instanceof Error ? erro.message : String(erro),
        )
        return null
      }
    },

    async enviarMidia(para, { midia, url, legenda, nomeArquivo }, citando) {
      /*
       * -------------------------------------------------------------------
       * Por que o arquivo sobe antes, em vez de ir como `link`
       * -------------------------------------------------------------------
       *
       * A Cloud API aceita os dois: um `link` que **ela** baixa na hora de
       * entregar, ou um `id` de um arquivo que **nós** subimos antes.
       *
       * Este código mandava `link`, e o comentário que estava aqui defendia a
       * escolha dizendo que o `id` expira em 30 dias e viraria "um cache com
       * invalidação para economizar um GET da Meta". O argumento estava certo
       * sobre o cache e errado sobre o que estava em jogo, e o handoff de
       * 15/set nomeou o que faltava: **mandar `link` obriga o arquivo a estar
       * num endereço que a Meta alcança sem credencial nossa**, e é por isso
       * que o `autofluxos-acervo` é público e permanente. A `0017` escreveu a
       * fronteira ("documento pessoal não entra") e nada no código a faz valer.
       *
       * Subindo antes, não há cache nenhum: o `id` é usado no mesmo pedido em
       * que nasce. Os 30 dias de validade nunca chegam a importar.
       *
       * **E não é gambiarra nossa**: a doc da Meta lista o upload como caminho
       * de primeira classe, e é o que ela recomenda para arquivo próprio.
       *
       * O preço é honesto e está medido: os bytes passam por nós duas vezes ,
       * uma para baixar do Storage, outra para subir. Em troca, o endereço de
       * origem só precisa ser alcançável por **nós**, o que é o que permite
       * fechar o bucket depois (item 2 do handoff de 15/set).
       *
       * **A queda para `link` fica, e é ela que torna esta troca segura.** Se
       * o upload falhar por qualquer motivo, o envio sai como saía antes. O
       * pior caso desta mudança é o comportamento de ontem, e isso é o que
       * permite subi-la sem ter podido testar num WhatsApp de verdade.
       */
      const tipo = TIPO_NA_META[midia]
      const mediaId = await subirParaAMeta(url)

      const resposta = await mandar({
        to: para,
        type: tipo,
        ...citacao(citando),
        [tipo]: {
          ...(mediaId ? { id: mediaId } : { link: url }),
          // Áudio não aceita legenda e o motor já não a produz. Repetir a
          // condição aqui não é redundância: o adaptador é o último ponto
          // antes da Meta, e uma versão publicada antes desta regra pode
          // carregar a legenda no grafo.
          ...(legenda && midia !== 'audio' ? { caption: legenda } : {}),
          ...(nomeArquivo && midia === 'documento' ? { filename: nomeArquivo } : {}),
        },
      })
      return idDoEnvio(resposta)
    },

    /**
     * O modelo aprovado, o único caminho para fora da janela de 24h.
     *
     * -------------------------------------------------------------------
     * Por que este envio lê a resposta e os outros não
     * -------------------------------------------------------------------
     *
     * A Meta responde **200** e manda `message_status` junto, com três valores
     * possíveis: `accepted`, `held_for_quality_assessment` e `paused`. O do
     * meio significa que ela **segurou** a mensagem para avaliar a qualidade ,
     * acontece com template novo, com template sem nota verde e, desde 2026,
     * com portfólio novo de pouco histórico.
     *
     * Se o veredito for ruim, o template é pausado e **cada mensagem retida é
     * descartada**, chegando depois no webhook `messages` como `failed` com
     * código 132015.
     *
     * Quem lê só o status HTTP mostra "campanha enviada" para o cliente e nada
     * saiu. É por isso que aqui se devolve `EnvioDeTemplate` e não `void`, e
     * por que a tradução mora em `lerStatusDeEnvio()`, a mesma função que o
     * banco e a tela usam, para que os três não discordem sobre o que é
     * "enviado".
     *
     * -------------------------------------------------------------------
     * O formato dos parâmetros
     * -------------------------------------------------------------------
     *
     * A Meta liga valor e lacuna **pela posição** dentro de cada componente, e
     * numera cabeçalho e corpo separadamente. Componente sem variável não pode
     * ir no payload: mandar `parameters: []` faz ela recusar com 132000
     * ("contagem de parâmetros não bate") mesmo o template não tendo lacuna
     * nenhuma. Por isso os dois só entram quando têm o que carregar.
     */
    async enviarTemplate(para, { nome, idioma, valores }): Promise<EnvioDeTemplate> {
      const componentes: Record<string, unknown>[] = []

      const doCabecalho = valores?.cabecalho ?? []
      if (doCabecalho.length > 0) {
        componentes.push({
          type: 'header',
          parameters: doCabecalho.map((texto) => ({ type: 'text', text: texto })),
        })
      }

      const doCorpo = valores?.corpo ?? []
      if (doCorpo.length > 0) {
        componentes.push({
          type: 'body',
          parameters: doCorpo.map((texto) => ({ type: 'text', text: texto })),
        })
      }

      const resposta = await mandar({
        to: para,
        type: 'template',
        template: {
          name: nome,
          language: { code: idioma },
          ...(componentes.length > 0 ? { components: componentes } : {}),
        },
      })

      const primeira = resposta.messages?.[0]

      return {
        /*
         * Sem `wamid` o webhook de status nunca acha esta linha, a entrega
         * fica parada em "aceita" para sempre. É perda de informação, não de
         * mensagem: a mensagem saiu. String vazia deixa isso explícito para
         * quem grava, em vez de um `undefined` que se confunde com "ainda não
         * tentamos".
         */
        wamid: primeira?.id ?? '',
        situacao: lerStatusDeEnvio(primeira?.message_status),
      }
    },

    cardSemFoto: true,

    async enviarProdutos(para, produtos) {
      /*
       * Um card por produto, e não o carrossel de mídia: o carrossel exige de
       * 2 a 10 cards, e "mostra esse aqui" é um produto só na maior parte das
       * vezes. Um formato só para 1 e para 3 deixa o JSON que sai igual ao que
       * o teste confere.
       */
      /*
       * Os cards são gravados numa linha só do histórico, e ela leva o id do
       * primeiro: é nele que a reação e a citação da pessoa costumam cair.
       */
      let primeiro: string | null = null
      for (const produto of produtos) {
        // Sem link não há botão, e o cta_url sem url a Meta recusa. Sem foto
        // o card sai igual, só sem o cabeçalho de imagem, que é opcional.
        if (!produto.link) continue
        const { titulo, detalhe } = linhasDoCard(produto, { whatsapp: true })
        const resposta = await mandar({
          to: para,
          type: 'interactive',
          interactive: {
            type: 'cta_url',
            ...(produto.foto ? { header: { type: 'image', image: { link: produto.foto } } } : {}),
            body: { text: cortarCaracteres(`*${titulo}*\n${detalhe}`, LIMITE_CORPO_CTA) },
            action: {
              name: 'cta_url',
              parameters: { display_text: TEXTO_DO_BOTAO_DA_LOJA, url: produto.link },
            },
          },
        })
        primeiro ??= idDoEnvio(resposta)
      }
      return primeiro
    },

    async enviarOpcoes(para, texto, opcoes, formato) {
      // O validador já barra rótulo grande na publicação. Este corte é para a
      // versão que foi publicada antes daquela regra existir: melhor um rótulo
      // truncado do que a Meta recusar a mensagem inteira.
      //
      // `cortarCaracteres` e não `.slice`: os rótulos têm emoji ("📅 Escolher
      // outro dia"), e cortar por unidade UTF-16 devolve meio par substituto ,
      // que o Postgres recusa dentro de `jsonb` na hora de gravar a mensagem.
      const curto = (o: Opcao) => cortarCaracteres(o.rotulo, LIMITE_ROTULO)

      if (formato === 'botoes') {
        const resposta = await mandar({
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
        return idDoEnvio(resposta)
      }

      const resposta = await mandar({
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
      return idDoEnvio(resposta)
    },
  }
}
