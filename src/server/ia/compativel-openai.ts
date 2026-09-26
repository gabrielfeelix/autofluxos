import 'server-only'
import type { Ferramenta } from '@/core/ferramentas'
import { interpretarResposta, montarPrompt } from './prompt'
import type { Modelo, PedidoDeIa, Resposta } from './types'

/**
 * O adaptador dos provedores que falam o dialeto da OpenAI.
 *
 * Groq, Cerebras, Mistral e Cloudflare aceitam o mesmo `chat/completions`, com `tools` no
 * mesmo formato, então um arquivo atende os quatro. O que muda entre eles é
 * endereço, nome do modelo e um ou outro parâmetro, e isso mora em
 * `PROVEDORES`, não em código espalhado.
 *
 * Mesma regra do `gemini.ts`: **nunca estourar**. Toda falha de transporte vira
 * `nao_sei` com `falhou: true`, que é o sinal para a cadeia (`cadeia.ts`)
 * passar a mensagem para o próximo provedor em vez de chamar uma pessoa.
 *
 * Existe porque a cota grátis do Gemini acaba cedo. Somando free tiers de
 * provedores diferentes, cada um com o seu balde, dá para testar a IA nos
 * fluxos o dia inteiro sem pagar.
 */

export type NomeDoProvedor = 'groq' | 'cerebras' | 'mistral' | 'cloudflare'

type Provedor = {
  /** Com `{conta}` quando o endereço leva o id da conta (`variavelDaConta`). */
  endereco: string
  /** A variável de ambiente com o id da conta, para quem precisa dele na URL. */
  variavelDaConta?: string
  modelo: string
  /** A variável de ambiente que guarda a chave. */
  variavel: string
  /** Parâmetros que só este provedor entende. */
  extras: Record<string, unknown>
}

/**
 * Os provedores, com o modelo que cada um usa.
 *
 * `gpt-oss-120b` no Groq e no Cerebras: é o mesmo modelo nos dois, então o
 * comportamento que a suíte provar num vale para o outro, e o Cerebras vira
 * reserva de verdade em vez de um segundo modelo a validar.
 *
 * `reasoning_effort: 'medium'`, e não `low`, é medido (25/set/2026, suíte de
 * escopo do `gemini.test.ts` contra o Groq): com `low` passou 7 de 11, trocou
 * "semana que vem" por catálogo e fugiu de "não fazemos elétrica" com
 * `NAO_SEI`. Com `medium` passou 11 de 11, ainda em 0,4 a 0,9 s. O custo é
 * cota: o Groq grátis dá 8 mil tokens por minuto, e rajada de conversa bate
 * 429 ali. Por isso a pausa abaixo é curta e a cadeia segue para o próximo.
 *
 * Mistral por último entre os três: é o mais generoso em volume, mas no plano
 * grátis **treina com o que passa por ele, a menos que se desligue** no painel
 * (admin.mistral.ai → Privacy).
 */
export const PROVEDORES: Record<NomeDoProvedor, Provedor> = {
  groq: {
    endereco: 'https://api.groq.com/openai/v1/chat/completions',
    modelo: 'openai/gpt-oss-120b',
    variavel: 'GROQ_API_KEY',
    extras: { reasoning_effort: 'medium', max_completion_tokens: 1200 },
  },
  cerebras: {
    endereco: 'https://api.cerebras.ai/v1/chat/completions',
    modelo: 'gpt-oss-120b',
    variavel: 'CEREBRAS_API_KEY',
    extras: { reasoning_effort: 'medium', max_completion_tokens: 1200 },
  },
  mistral: {
    endereco: 'https://api.mistral.ai/v1/chat/completions',
    modelo: 'mistral-medium-latest',
    variavel: 'MISTRAL_API_KEY',
    extras: { max_tokens: 1200 },
  },
  /*
   * Workers AI, pela porta compatível com a OpenAI. Entrou em 26/set/2026
   * porque Mistral e Cerebras recusaram cartão brasileiro no cadastro e o
   * Cloudflare dá cota diária grátis sem cartão. O mesmo `gpt-oss-120b` do
   * Groq, pelo motivo de cima. **Ainda não passou pela suíte de escopo**: sem
   * as duas variáveis no ambiente ele nem entra na cadeia, e antes de pôr as
   * duas em produção roda `IA_PROVEDOR=cloudflare` no `gemini.test.ts`. Só
   * `max_tokens` nos extras até a suíte provar que ele aceita os parâmetros de
   * raciocínio dos outros dois.
   */
  cloudflare: {
    endereco: 'https://api.cloudflare.com/client/v4/accounts/{conta}/ai/v1/chat/completions',
    variavelDaConta: 'CLOUDFLARE_ACCOUNT_ID',
    modelo: '@cf/openai/gpt-oss-120b',
    variavel: 'CLOUDFLARE_API_TOKEN',
    extras: { max_tokens: 1200 },
  },
}

/**
 * O endereço pronto, ou `null` quando falta o id da conta que ele exige.
 *
 * Quem monta a cadeia usa isto para não pôr na fila um provedor que só ia
 * falhar: chave sem conta é configuração pela metade.
 */
export function enderecoDo(provedor: NomeDoProvedor): string | null {
  const config = PROVEDORES[provedor]
  if (!config.variavelDaConta) return config.endereco
  const conta = process.env[config.variavelDaConta]
  return conta ? config.endereco.replace('{conta}', encodeURIComponent(conta)) : null
}

/**
 * Quanto se espera. Mais curto que o do Gemini porque aqui sempre há um
 * próximo elo na cadeia, e esses provedores respondem em 1 a 3 segundos
 * quando estão bem: passou disso por muito, é fila, e a reserva ganha.
 */
const TIMEOUT_MS = 12_000

/**
 * Provedor que devolveu 429, e até quando fica de fora.
 *
 * Diferente do Gemini, aqui a cota que mais estoura é **por minuto** (tokens
 * por minuto do Groq), então marcar o dia inteiro desligaria o melhor provedor
 * por um minuto de pico. Espera o que o `retry-after` disser, ou um minuto.
 * Em memória do processo pelo mesmo motivo do `gemini.ts`: é latência, não
 * correção, e um deploy que esquece custa uma requisição.
 */
const foraAte = new Map<NomeDoProvedor, number>()

/** Esquece quem está de fora. Só para teste, como `esquecerCotas`. */
export function esquecerPausas(): void {
  foraAte.clear()
}

export function compativelOpenai({
  provedor,
  chave,
  modelo,
}: {
  provedor: NomeDoProvedor
  chave: string
  modelo?: string
}): Modelo {
  const config = PROVEDORES[provedor]
  const nome = modelo ?? config.modelo
  const endereco = enderecoDo(provedor)

  return {
    async responder(pedido: PedidoDeIa): Promise<Resposta> {
      const ate = foraAte.get(provedor)
      if (ate !== undefined && Date.now() < ate) {
        return { tipo: 'nao_sei', motivo: `${provedor} está sem cota agora`, falhou: true }
      }

      if (!endereco) {
        return { tipo: 'nao_sei', motivo: `${provedor} sem o id da conta no ambiente`, falhou: true }
      }

      try {
        const resposta = await fetch(endereco, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
          body: montarCorpo(pedido, nome, config.extras),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!resposta.ok) {
          const detalhe = await resposta.text().catch(() => '')
          console.error(`[ia] ${provedor} respondeu ${resposta.status}`, detalhe.slice(0, 300))

          if (resposta.status === 429) {
            const segundos = Number(resposta.headers.get('retry-after')) || 60
            foraAte.set(provedor, Date.now() + segundos * 1000)
          }

          return { tipo: 'nao_sei', motivo: `o modelo respondeu ${resposta.status}`, falhou: true }
        }

        const json = (await resposta.json()) as RespostaOpenai
        const mensagem = json.choices?.[0]?.message

        // Mesma precedência do Gemini: pedido de consulta ganha da frase de
        // espera que vem junto, senão o bot promete olhar e nunca olha.
        const chamada = mensagem?.tool_calls?.find((c) => c.function?.name)?.function
        if (chamada?.name) {
          return {
            tipo: 'usar_ferramenta',
            nome: chamada.name,
            argumentos: comoTexto(lerJson(chamada.arguments)),
          }
        }

        return interpretarResposta(mensagem?.content)
      } catch (erro) {
        const porTempo = erro instanceof Error && erro.name === 'TimeoutError'
        console.error(`[ia] ${provedor} falhou`, erro)
        return {
          tipo: 'nao_sei',
          motivo: porTempo ? 'o modelo demorou demais' : 'não deu para falar com o modelo',
          falhou: true,
        }
      }
    },
  }
}

function montarCorpo(pedido: PedidoDeIa, modelo: string, extras: Record<string, unknown>): string {
  const { sistema, usuario } = montarPrompt(pedido)
  const ferramentas = pedido.ferramentas ?? []

  return JSON.stringify({
    model: modelo,
    messages: [
      { role: 'system', content: sistema },
      { role: 'user', content: usuario },
    ],
    // Atendimento não é lugar de criatividade, igual ao Gemini.
    temperature: 0.2,
    ...(ferramentas.length > 0
      ? { tools: declararFerramentas(ferramentas), tool_choice: 'auto' }
      : {}),
    ...extras,
  })
}

type RespostaOpenai = {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: { function?: { name?: string; arguments?: string } }[]
    }
  }[]
}

/** O catálogo neutro no formato `tools` da OpenAI. */
function declararFerramentas(ferramentas: readonly Ferramenta[]) {
  return ferramentas.map((f) => ({
    type: 'function',
    function: {
      name: f.nome,
      description: f.descricao,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          f.argumentos.map((a) => [a.nome, { type: 'string', description: a.descricao }]),
        ),
        required: f.argumentos.filter((a) => a.obrigatorio).map((a) => a.nome),
      },
    },
  }))
}

/** Aqui os argumentos chegam como texto JSON, não como objeto. */
function lerJson(bruto: string | undefined): unknown {
  try {
    return JSON.parse(bruto ?? '{}')
  } catch {
    return {}
  }
}

/** Mesma regra do `gemini.ts`: só texto, número e booleano, tudo como texto. */
function comoTexto(args: unknown): Record<string, string> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {}

  const saida: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(args as Record<string, unknown>)) {
    if (typeof valor === 'string') saida[chave] = valor
    else if (typeof valor === 'number' || typeof valor === 'boolean') saida[chave] = String(valor)
  }
  return saida
}
