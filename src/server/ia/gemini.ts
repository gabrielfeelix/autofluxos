import 'server-only'
import type { Ferramenta } from '@/core/ferramentas'
import { interpretarResposta, montarPrompt } from './prompt'
import type { Modelo, PedidoDeIa, Resposta } from './types'

/**
 * O adaptador do Gemini.
 *
 * Só transporte: o que fecha o escopo está em `prompt.ts`, que é puro e tem
 * teste. Aqui a única regra é **nunca estourar**. Chave errada, cota estourada,
 * modelo fora do ar, resposta esquisita — tudo vira `nao_sei`, que vira uma
 * pessoa assumindo a conversa. Uma exceção subindo daqui deixaria alguém
 * esperando no WhatsApp uma resposta que não vem.
 */

const ENDERECO = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * Versão presa, e não `-latest` — a decisão virou ao contrário em 28/ago/2026.
 *
 * O argumento antigo era bom: versão presa é dívida com data marcada, o Google
 * aposenta e o bot para de responder no meio de um atendimento. O que ele não
 * previu é o apelido apontar para um modelo **congestionado**. Medido com a
 * chave de produção: `gemini-flash-latest` devolveu 503 UNAVAILABLE em toda
 * tentativa ao longo de vários minutos, enquanto modelos presos respondiam em
 * menos de dois segundos. Um apelido que aponta para o modelo mais popular
 * aponta, por construção, para o mais disputado.
 *
 * A dívida do apelido continua real — ela só passou a ser paga pela reserva e
 * pela suíte contra o modelo de verdade, que acusa no dia em que este nome sair
 * do ar ou regredir.
 *
 * **Por que este, e a escolha foi medida, não deduzida.** `flash-lite` é a faixa
 * mais barata e a cota diária do free tier é por modelo, então lite rende mais
 * conversa pelo mesmo nada. Entre os lite:
 *
 * | modelo | escopo | ferramenta | tempo |
 * |---|---|---|---|
 * | `gemini-3.5-flash-lite` | **falha** | ok | 0,7-1,3 s |
 * | `gemini-3.1-flash-lite` | ok | ok | 0,6-1,5 s |
 *
 * O mais novo **não** é o melhor aqui, e o jeito de falhar é o caro: pedido que
 * o contexto responde ("vocês trocam fiação?" com o contexto dizendo que não
 * faz elétrica) vira `NAO_SEI` no 3.5-lite, e `NAO_SEI` é uma pessoa assumindo
 * uma conversa que a IA daria conta. Reproduzido duas vezes.
 *
 * A suíte inteira contra o modelo de verdade passa 11/11 neste nome — obediência
 * de escopo, recusa de propósito geral (política da Meta) e escolha entre
 * consultas parecidas. Trocar de modelo sem rodar ela é trocar no escuro.
 */
const MODELO_PADRAO = 'gemini-3.1-flash-lite'

/**
 * Para onde ir quando o padrão está congestionado ou sem cota.
 *
 * **É de outra faixa de propósito, e isso é metade do valor.** A cota diária do
 * free tier é *por modelo* (`GenerateRequestsPerDayPerProjectPerModel`, medida
 * em 20/dia na faixa flash), então a reserva não divide o teto com o padrão:
 * ela o soma. E congestionamento costuma bater numa faixa de cada vez — cair de
 * `flash-lite` para `flash` sai do lugar cheio, o que trocar de nome dentro da
 * mesma faixa não faria.
 *
 * Sem reserva, uma tarde ruim do lado do Google manda **toda** conversa do
 * produto para atendimento humano, e a tela não diz por quê.
 *
 * Também passa a suíte contra o modelo de verdade — reserva que ninguém testou
 * é reserva que só falha no dia em que é usada.
 */
const MODELO_RESERVA = 'gemini-3.6-flash'

/**
 * O que merece uma segunda tentativa.
 *
 * 503 e 429 são o Google dizendo "agora não, tente de novo" — a mensagem
 * literal do 503 pede isso. Sem retentar, cada pico do lado deles vira uma
 * pessoa assumindo uma conversa que a IA responderia bem. 4xx de verdade
 * (chave errada, pedido malformado) não melhora repetindo, e repetir só
 * atrasaria o handoff.
 */
const VALE_RETENTAR = new Set([429, 500, 502, 503, 504])

/**
 * Quanto se espera pelo modelo.
 *
 * O webhook já respondeu 200 à Meta antes de chegar aqui (o processamento roda
 * no `after()`), então o teto não é o prazo dela — é a paciência de quem está
 * com o celular na mão.
 *
 * Começou em 8 s e estourava. Medido: numa pergunta de uma linha o modelo
 * gastou **416 tokens pensando para 38 de resposta**. A demora não é rede, é
 * raciocínio, e cortar cedo demais manda para um humano uma conversa que a IA
 * ia responder bem.
 *
 * **São dois tetos desde 28/ago/2026, e a assimetria é medida.** Contra o
 * modelo de verdade, num modelo saudável nada passou de 12 s (11,3 · 8,0 · 5,6
 * · 4,9 · 3,9 · 2,4 · 1,5). Tudo que estourou 15 s foi o modelo congestionado —
 * lentidão ali é sintoma, não raciocínio.
 *
 * Então a primeira tentativa corta cedo **de propósito**: passou de 15 s, é
 * congestionamento, e o certo é ir para a reserva em vez de esperar mais. A
 * reserva ganha o teto folgado porque é a última chance — cortar ali manda para
 * uma pessoa uma resposta que estava quase pronta.
 *
 * O pior caso somado é 40 s, com "digitando…" na tela o tempo todo. É muito, e
 * é melhor que o handoff que acontecia antes.
 *
 * O teto não multiplica sem limite com ferramenta: as chamadas que **escolhem**
 * consulta são curtas (1,5 s e 2,4 s medidos), porque a saída é uma linha. As
 * demoradas são as que escrevem prosa, e há uma só por resposta.
 */
const TIMEOUT_MS = 15_000

/** O teto da reserva. Ver acima: última chance, então não se corta cedo. */
const TIMEOUT_RESERVA_MS = 25_000

export function gemini({ chave, modelo }: { chave: string; modelo?: string }): Modelo {
  const escolhido = modelo ?? process.env.GEMINI_MODELO
  const nome = escolhido ?? MODELO_PADRAO

  /*
   * Modelo escolhido à mão não ganha reserva.
   *
   * Quem passou `GEMINI_MODELO` ou o parâmetro está prendendo uma versão de
   * propósito — para reproduzir um comportamento, ou porque a reserva é
   * justamente o que ele quer testar. Trocar por baixo transformaria uma
   * escolha explícita numa surpresa, e o teste que prende versão deixaria de
   * provar o que diz provar.
   */
  const reserva = escolhido === undefined && MODELO_RESERVA !== nome ? MODELO_RESERVA : null

  return {
    async responder(pedido: PedidoDeIa): Promise<Resposta> {
      const corpo = montarCorpo(pedido)

      // Sem reserva não há para onde correr, então não se corta cedo: cortar
      // ali é o mesmo que desistir.
      const primeira = await tentar(
        nome,
        chave,
        corpo,
        reserva === null ? TIMEOUT_RESERVA_MS : TIMEOUT_MS,
      )
      if (primeira.tipo !== 'retentar') return primeira.resposta

      if (reserva === null) return primeira.desistencia

      /*
       * Uma segunda tentativa, e uma só.
       *
       * Duas seriam três esperas somadas na frente de quem está com o celular
       * na mão. Se o segundo modelo também está fora, o problema não é pico —
       * e insistir só atrasa a pessoa que vai assumir a conversa.
       */
      console.warn(`[ia] ${nome} devolveu ${primeira.status}; tentando ${reserva}`)
      const segunda = await tentar(reserva, chave, corpo, TIMEOUT_RESERVA_MS)
      return segunda.tipo === 'retentar' ? segunda.desistencia : segunda.resposta
    },
  }
}

/** O corpo do pedido, montado uma vez e reaproveitado na retentativa. */
function montarCorpo(pedido: PedidoDeIa): string {
  const { sistema, usuario } = montarPrompt(pedido)

  return JSON.stringify({
    systemInstruction: { parts: [{ text: sistema }] },
    contents: [{ role: 'user', parts: [{ text: usuario }] }],
    ...declararFerramentas(pedido.ferramentas ?? []),
    generationConfig: {
      // Atendimento não é lugar de criatividade: a mesma pergunta tem que
      // receber a mesma resposta.
      temperature: 0.2,
      // Folgado de propósito: os modelos novos gastam parte deste teto
      // "pensando" antes de escrever. Com 400 a resposta chegou cortada no
      // meio da frase — e resposta cortada vai para o WhatsApp de alguém. Quem
      // encurta é o `prompt.ts`, por caractere, no fim.
      maxOutputTokens: 1200,
    },
  })
}

/**
 * Uma tentativa contra um modelo.
 *
 * `retentar` traz junto a `desistencia` já escrita: quem chama pode parar ali
 * sem ter que reconstruir a frase, e assim não existe caminho em que o pedido
 * termina sem resposta nenhuma.
 */
type Tentativa =
  | { tipo: 'pronta'; resposta: Resposta }
  | { tipo: 'retentar'; status: string; desistencia: Resposta }

async function tentar(
  nome: string,
  chave: string,
  corpo: string,
  timeout: number,
): Promise<Tentativa> {
  try {
    const resposta = await fetch(`${ENDERECO}/${nome}:generateContent`, {
      method: 'POST',
      // No cabeçalho, não na query: chave em URL vaza para log de acesso,
      // histórico de proxy e mensagem de erro.
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: corpo,
      signal: AbortSignal.timeout(timeout),
    })

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '')
      console.error(`[ia] gemini respondeu ${resposta.status}`, detalhe.slice(0, 300))

      const desistencia: Resposta = {
        tipo: 'nao_sei',
        motivo: `o modelo respondeu ${resposta.status}`,
      }

      return VALE_RETENTAR.has(resposta.status)
        ? { tipo: 'retentar', status: String(resposta.status), desistencia }
        : { tipo: 'pronta', resposta: desistencia }
    }

    const json = (await resposta.json()) as RespostaGemini

    // Filtro de segurança do Google. Não é erro nosso, e a saída é a mesma:
    // uma pessoa assume. Não retenta — o outro modelo bloquearia igual.
    const bloqueio = json.promptFeedback?.blockReason
    if (bloqueio) {
      return { tipo: 'pronta', resposta: { tipo: 'nao_sei', motivo: `o modelo bloqueou (${bloqueio})` } }
    }

    const partes = json.candidates?.[0]?.content?.parts ?? []

    /*
     * Pedido de consulta tem precedência sobre texto na mesma resposta.
     *
     * O modelo às vezes manda os dois: uma frase de espera ("deixa eu ver
     * aqui") e a chamada junto. Mandar a frase e ignorar a chamada seria o
     * pior desfecho — o bot promete olhar e nunca olha. Quem decide o que
     * fazer com o pedido é o resolvedor.
     */
    const chamada = partes.find((p) => p.functionCall)?.functionCall
    if (chamada?.name) {
      return {
        tipo: 'pronta',
        resposta: {
          tipo: 'usar_ferramenta',
          nome: chamada.name,
          // O Gemini devolve os argumentos já como JSON, e com o tipo que ele
          // achou que era. Tudo vira texto aqui porque é assim que o resolvedor
          // interpola — e porque número virando `1e3` numa data é o tipo de
          // surpresa que só aparece em produção.
          argumentos: comoTexto(chamada.args),
        },
      }
    }

    return {
      tipo: 'pronta',
      resposta: interpretarResposta(partes.find((p) => p.text !== undefined)?.text),
    }
  } catch (erro) {
    const porTempo = erro instanceof Error && erro.name === 'TimeoutError'
    console.error('[ia] gemini falhou', erro)

    const desistencia: Resposta = {
      tipo: 'nao_sei',
      motivo: porTempo ? 'o modelo demorou demais' : 'não deu para falar com o modelo',
    }

    /*
     * Timeout retenta; falha de rede não.
     *
     * Um modelo lento é exatamente o sintoma de congestionamento que a reserva
     * existe para contornar. Já uma rede fora do ar deste lado não melhora
     * trocando o endereço de destino, e a espera dobraria à toa.
     */
    return porTempo
      ? { tipo: 'retentar', status: 'timeout', desistencia }
      : { tipo: 'pronta', resposta: desistencia }
  }
}

type ParteGemini = {
  text?: string
  functionCall?: { name?: string; args?: unknown }
}

type RespostaGemini = {
  candidates?: { content?: { parts?: ParteGemini[] } }[]
  promptFeedback?: { blockReason?: string }
}

/**
 * O catálogo neutro traduzido para o formato do Gemini.
 *
 * **A tradução mora aqui, e não no catálogo**, porque `functionDeclarations` é
 * palavra deste provedor. OpenAI e Anthropic chamam de `tools` e aninham
 * diferente; com o catálogo neutro, o próximo adaptador é um arquivo novo em
 * vez de uma reescrita.
 *
 * Sem ferramenta nenhuma o corpo sai igual ao de antes — nem `tools` nem
 * `toolConfig` aparecem, e o comportamento de hoje não muda em nada.
 */
function declararFerramentas(ferramentas: readonly Ferramenta[]) {
  if (ferramentas.length === 0) return {}

  return {
    tools: [
      {
        functionDeclarations: ferramentas.map((f) => ({
          name: f.nome,
          description: f.descricao,
          parameters: {
            type: 'OBJECT',
            properties: Object.fromEntries(
              f.argumentos.map((a) => [a.nome, { type: 'STRING', description: a.descricao }]),
            ),
            required: f.argumentos.filter((a) => a.obrigatorio).map((a) => a.nome),
          },
        })),
      },
    ],
    // `AUTO`: o modelo decide entre responder e consultar. `ANY` o obrigaria a
    // sempre chamar alguma coisa, e a maior parte das mensagens de um
    // atendimento — "oi", "obrigado" — não tem consulta que sirva.
    toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
  }
}

/**
 * Os argumentos do modelo, todos como texto.
 *
 * O que não for texto, número ou booleano é descartado: objeto ou lista dentro
 * de um argumento é o modelo inventando estrutura que nenhuma ferramenta pede,
 * e interpolar isso na URL escreveria `[object Object]` no endereço.
 */
function comoTexto(args: unknown): Record<string, string> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {}

  const saida: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(args as Record<string, unknown>)) {
    if (typeof valor === 'string') saida[chave] = valor
    else if (typeof valor === 'number' || typeof valor === 'boolean') saida[chave] = String(valor)
  }
  return saida
}
