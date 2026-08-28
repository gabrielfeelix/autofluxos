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
 * `-latest` de propósito, e não um número fixo.
 *
 * A primeira chamada real deste módulo levou 404: `gemini-2.5-flash` "is no
 * longer available to new users". Versão presa é dívida com data marcada — um
 * dia o Google aposenta e o bot para de responder no meio de um atendimento,
 * sem ninguém ter mexido em nada. O apelido acompanha o Flash atual.
 *
 * O preço disso é o modelo mudar debaixo do prompt. É um preço que dá para
 * pagar porque o prompt é fechado e existe teste rodando contra o modelo de
 * verdade (`gemini.test.ts`): se a obediência ao escopo regredir, a suíte
 * acusa. Para prender uma versão, use `GEMINI_MODELO`.
 */
const MODELO_PADRAO = 'gemini-flash-latest'

/**
 * Quinze segundos.
 *
 * O webhook já respondeu 200 à Meta antes de chegar aqui (o processamento roda
 * no `after()`), então o teto não é o prazo dela — é a paciência de quem está
 * com o celular na mão.
 *
 * Começou em 8 s e estourava. Medido: numa pergunta de uma linha o modelo
 * gastou **416 tokens pensando para 38 de resposta**. A demora não é rede, é
 * raciocínio, e cortar cedo demais manda para um humano uma conversa que a IA
 * ia responder bem.
 */
const TIMEOUT_MS = 15_000

export function gemini({ chave, modelo }: { chave: string; modelo?: string }): Modelo {
  const nome = modelo ?? process.env.GEMINI_MODELO ?? MODELO_PADRAO

  return {
    async responder(pedido: PedidoDeIa): Promise<Resposta> {
      const { sistema, usuario } = montarPrompt(pedido)

      try {
        const resposta = await fetch(`${ENDERECO}/${nome}:generateContent`, {
          method: 'POST',
          // No cabeçalho, não na query: chave em URL vaza para log de acesso,
          // histórico de proxy e mensagem de erro.
          headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistema }] },
            contents: [{ role: 'user', parts: [{ text: usuario }] }],
            ...declararFerramentas(pedido.ferramentas ?? []),
            generationConfig: {
              // Atendimento não é lugar de criatividade: a mesma pergunta tem
              // que receber a mesma resposta.
              temperature: 0.2,
              // Folgado de propósito: os modelos novos gastam parte deste teto
              // "pensando" antes de escrever. Com 400 a resposta chegou cortada
              // no meio da frase — e resposta cortada vai para o WhatsApp de
              // alguém. Quem encurta é o `prompt.ts`, por caractere, no fim.
              maxOutputTokens: 1200,
            },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!resposta.ok) {
          const detalhe = await resposta.text().catch(() => '')
          console.error(`[ia] gemini respondeu ${resposta.status}`, detalhe.slice(0, 300))
          return { tipo: 'nao_sei', motivo: `o modelo respondeu ${resposta.status}` }
        }

        const corpo = (await resposta.json()) as RespostaGemini

        // Filtro de segurança do Google. Não é erro nosso, e a saída é a mesma:
        // uma pessoa assume.
        const bloqueio = corpo.promptFeedback?.blockReason
        if (bloqueio) return { tipo: 'nao_sei', motivo: `o modelo bloqueou (${bloqueio})` }

        const partes = corpo.candidates?.[0]?.content?.parts ?? []

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
            tipo: 'usar_ferramenta',
            nome: chamada.name,
            // O Gemini devolve os argumentos já como JSON, e com o tipo que
            // ele achou que era. Tudo vira texto aqui porque é assim que o
            // resolvedor interpola — e porque número virando `1e3` numa data
            // é o tipo de surpresa que só aparece em produção.
            argumentos: comoTexto(chamada.args),
          }
        }

        return interpretarResposta(partes.find((p) => p.text !== undefined)?.text)
      } catch (erro) {
        const porTempo = erro instanceof Error && erro.name === 'TimeoutError'
        console.error('[ia] gemini falhou', erro)
        return {
          tipo: 'nao_sei',
          motivo: porTempo ? 'o modelo demorou demais' : 'não deu para falar com o modelo',
        }
      }
    },
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
