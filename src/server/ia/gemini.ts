import 'server-only'
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

        return interpretarResposta(corpo.candidates?.[0]?.content?.parts?.[0]?.text)
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

type RespostaGemini = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  promptFeedback?: { blockReason?: string }
}
