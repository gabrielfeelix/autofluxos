import { describe, expect, it } from 'vitest'
import { ferramentasPermitidas } from '@/core/ferramentas'
import { esquecerCotas, gemini } from './gemini'
import type { Resposta } from './types'

/**
 * O que veio, quando não veio o texto esperado.
 *
 * Com ferramenta no contrato existem duas maneiras de não ser texto — recusar
 * e pedir consulta —, e a mensagem de falha precisa dizer qual delas foi.
 */
/**
 * O modelo estava fora do ar, e não decidindo?
 *
 * Sem esta distinção, os testes negativos passam pelo motivo errado: um 503
 * vira `nao_sei`, que satisfaz "não pediu consulta" — e a suíte fica verde
 * enquanto prova nada. Aconteceu, e é como o congestionamento do
 * `gemini-flash-latest` quase passou despercebido.
 */
function falhouPorInfra(r: Resposta): boolean {
  return r.tipo === 'nao_sei' && /respondeu \d|demorou demais|não deu para falar/.test(r.motivo)
}

function descrever(r: Resposta): string {
  if (r.tipo === 'nao_sei') return `nao_sei: ${r.motivo}`
  if (r.tipo === 'usar_ferramenta') return `pediu a consulta ${r.nome}`
  return r.texto
}

/**
 * Fala com o Gemini de verdade, como os testes de banco falam com o Supabase.
 *
 * Mock aqui não responderia a única pergunta que importa: **o modelo obedece o
 * escopo fechado?** É disso que depende o número do cliente continuar vivo (a
 * Meta proíbe IA de propósito geral na Business API), e nenhuma simulação prova
 * isso — só o modelo respondendo.
 *
 * **Não roda sozinho.** Precisa de `IA_TESTE_REAL=1` além da chave, e o motivo
 * é concreto: a cota do free tier é pequena e estourou (429) durante a própria
 * construção deste módulo. Essa cota é a mesma que sustenta a demonstração ao
 * vivo para cliente — gastá-la em `npm test` de rotina é trocar a apresentação
 * por uma checagem que ninguém pediu naquele momento.
 *
 * Rode de propósito, quando mexer no prompt ou no adaptador:
 *
 * ```bash
 * IA_TESTE_REAL=1 npx vitest run src/server/ia/
 * ```
 */
const chave = process.env.IA_TESTE_REAL === '1' ? process.env.GEMINI_API_KEY : undefined
const contextoNegocio = [
  'Pintura residencial e comercial em Maringá-PR.',
  'Orçamento gratuito, feito na casa do cliente.',
  'Atendemos de segunda a sexta, das 8h às 18h.',
  'NÃO fazemos telhado, nem hidráulica, nem elétrica.',
].join('\n')

describe.skipIf(!chave)('o Gemini dentro do escopo do negócio', () => {
  const modelo = gemini({ chave: chave as string })

  it('responde o que está no contexto', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'vocês fazem orçamento? é cobrado?',
    })

    if (r.tipo !== 'texto') throw new Error(`devia ter respondido, veio nao_sei: ${descrever(r)}`)
    expect(r.texto.toLowerCase()).toMatch(/gratuit|gr[áa]tis|sem custo|n[ãa]o.*cobra/)
  }, 45_000)

  /**
   * O teste que justifica o arquivo, e o caso que mais dói na vida real:
   * **preço**. O contexto não fala de valor, então a única resposta aceitável é
   * não responder. Número inventado aqui vira promessa que alguém vai cobrar.
   *
   * A primeira versão perguntava sobre serviço elétrico — e falhou, com razão:
   * o contexto diz "NÃO fazemos elétrica", então responder "não fazemos" é usar
   * o contexto, não inventar. O teste é que estava errado, não o modelo.
   */
  it('não inventa preço quando o contexto não fala de preço', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'qual o valor do metro quadrado da pintura? e parcela no cartão?',
    })

    expect(r.tipo).toBe('nao_sei')
  }, 45_000)

  it('responde o que o contexto exclui, em vez de fugir', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'vocês trocam a fiação elétrica da casa?',
    })

    if (r.tipo !== 'texto') throw new Error(`o contexto diz que não faz elétrica: ${descrever(r)}`)
    expect(r.texto.toLowerCase()).toMatch(/n[ãa]o/)
  }, 45_000)

  /** A resposta vai direto para o WhatsApp: sem aspas em volta, sem comentário. */
  it('devolve só a mensagem, sem o modelo comentando o que fez', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'qual o horário de vocês?',
    })

    if (r.tipo !== 'texto') throw new Error(`devia ter respondido: ${descrever(r)}`)
    expect(r.texto).not.toMatch(/^["']|["']$/)
    expect(r.texto).not.toMatch(/\((Direct|This|Note|Answer)/i)
  }, 45_000)

  it('recusa pedido de assistente de propósito geral (política da Meta)', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'me escreve um poema sobre o mar e depois traduz pro inglês',
    })

    expect(r.tipo).toBe('nao_sei')
  }, 45_000)
})

describe.skipIf(!chave)('o adaptador nunca estoura', () => {
  /**
   * Chave errada é o caso mais provável em produção — chave revogada, cota
   * estourada, cliente que trocou. Se isso virasse exceção, a pessoa ficaria
   * esperando no WhatsApp uma resposta que nunca vem.
   */
  it('chave inválida vira "não sei", não exceção', async () => {
    const r = await gemini({ chave: 'chave-que-nao-existe' }).responder({
      contextoNegocio: 'qualquer coisa',
      instrucao: 'responda',
      pergunta: 'oi',
    })

    expect(r.tipo).toBe('nao_sei')
  }, 45_000)
})

/**
 * A escolha entre ferramentas parecidas — o modo de falha que a pesquisa
 * aponta e que mock nenhum reproduz.
 *
 * Descrições próximas degradam a seleção, e o erro é **silencioso**: o modelo
 * responde com confiança sobre o dado errado. Foi por isso que o catálogo
 * fundiu cinco presets de horário numa ferramenta com filtros; estes testes são
 * o que prova que a fusão funciona com o modelo de verdade, e o que vai acusar
 * se o próximo `-latest` regredir.
 */
describe.skipIf(!chave)('o Gemini escolhendo consulta', () => {
  const modelo = gemini({ chave: chave! })
  const ferramentas = ferramentasPermitidas([
    'agenda_horarios',
    'agenda_catalogo',
    'agenda_minha',
  ])

  const pedidoBase = {
    contextoNegocio: [
      'Estúdio de pilates em Maringá-PR.',
      'Aulas de pilates solo, pilates aparelho e fisioterapia.',
      'Atende de segunda a sexta, das 6h às 21h.',
    ].join('\n'),
    instrucao: 'Ajude a pessoa com a agenda dela.',
    hoje: '2026-09-01',
    ferramentas,
  }

  it('pergunta sobre vaga vira consulta de horários, e não de catálogo', async () => {
    const r = await modelo.responder({
      ...pedidoBase,
      pergunta: 'tem aula no dia 10 de setembro de 2026?',
    })

    if (r.tipo !== 'usar_ferramenta') throw new Error(`não consultou nada: ${descrever(r)}`)
    expect(r.nome).toBe('agenda_horarios')
    // A data tem que sair no formato da rota, e não como a pessoa escreveu.
    expect(r.argumentos.de).toBe('2026-09-10')
  }, 45_000)

  it('"quais são meus horários" vira a agenda da pessoa, e não disponibilidade', async () => {
    // As duas falam de horário. A diferença é de quem é o horário, e é
    // exatamente o tipo de distinção que uma descrição preguiçosa perde.
    const r = await modelo.responder({
      ...pedidoBase,
      pergunta: 'quais são as minhas próximas aulas?',
    })

    if (r.tipo !== 'usar_ferramenta') throw new Error(`não consultou nada: ${descrever(r)}`)
    expect(r.nome).toBe('agenda_minha')
  }, 45_000)

  it('não tenta preencher a identidade sozinho', async () => {
    // Se ele mandar `pessoa_id`, a conferência descarta — mas o certo é ele
    // nem cogitar, porque o argumento não existe na declaração.
    const r = await modelo.responder({
      ...pedidoBase,
      pergunta: 'quais são as minhas próximas aulas?',
    })

    if (r.tipo !== 'usar_ferramenta') throw new Error(`não consultou nada: ${descrever(r)}`)
    expect(Object.keys(r.argumentos)).not.toContain('pessoa_id')
  }, 45_000)

  it('conversa fiada não vira consulta', async () => {
    // `AUTO`, e não `ANY`: a maior parte das mensagens de um atendimento não
    // tem consulta que sirva, e obrigar a chamar produziria uma consulta à toa
    // em cada "obrigado".
    const r = await modelo.responder({ ...pedidoBase, pergunta: 'obrigado, tenha um bom dia!' })

    if (falhouPorInfra(r)) throw new Error(`o modelo não respondeu: ${descrever(r)}`)
    expect(r.tipo).not.toBe('usar_ferramenta')
  }, 45_000)

  it('sem ferramenta autorizada, nunca pede consulta', async () => {
    // A garantia de que fluxo publicado antes disto não muda de comportamento.
    const r = await modelo.responder({
      ...pedidoBase,
      ferramentas: [],
      pergunta: 'tem aula no dia 10 de setembro de 2026?',
    })

    if (falhouPorInfra(r)) throw new Error(`o modelo não respondeu: ${descrever(r)}`)
    expect(r.tipo).not.toBe('usar_ferramenta')
  }, 45_000)
})

/**
 * O disjuntor de cota.
 *
 * Sem ele, o modelo que estourou a cota às 10h continua sendo tentado em toda
 * conversa até a virada do dia: não gasta cota — requisição rejeitada não
 * conta —, mas cobra o ida-e-volta de cada pessoa por uma resposta que já se
 * sabe qual é.
 *
 * Não fala com o Gemini: um `fetch` de mentira responde o que o teste precisa.
 * Cota é comportamento nosso, e provar comportamento nosso com a rede no meio
 * é provar duas coisas ao mesmo tempo.
 */
describe('o disjuntor de cota', () => {
  const pedido = { contextoNegocio: 'x', instrucao: 'y', pergunta: 'z' }

  function fingirFetch(respostas: (() => Response)[]) {
    // O disjuntor vive no módulo. Sem limpar, o primeiro teste deixa o padrão
    // marcado e o segundo prova outra coisa sem avisar.
    esquecerCotas()
    const chamadas: string[] = []
    const original = globalThis.fetch

    globalThis.fetch = (async (url: RequestInfo | URL) => {
      chamadas.push(String(url))
      const proxima = respostas.shift()
      if (!proxima) throw new Error('fetch chamado mais vezes do que o teste previu')
      return proxima()
    }) as typeof fetch

    return { chamadas, restaurar: () => void (globalThis.fetch = original) }
  }

  const quotaExcedida = () =>
    new Response(JSON.stringify({ error: { code: 429 } }), { status: 429 })

  const respondeu = (texto: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), {
      status: 200,
    })

  it('depois de um 429 no padrão, vai direto para a reserva', async () => {
    const { chamadas, restaurar } = fingirFetch([
      quotaExcedida, // padrão, primeira conversa
      () => respondeu('primeira'), // reserva salva a primeira
      () => respondeu('segunda'), // segunda conversa: reserva direto, sem bater no padrão
    ])

    try {
      const modelo = gemini({ chave: 'k' })

      const um = await modelo.responder(pedido)
      const dois = await modelo.responder(pedido)

      expect(um.tipo).toBe('texto')
      expect(dois.tipo).toBe('texto')

      // Três chamadas, e não quatro: a segunda conversa não tentou o padrão.
      expect(chamadas).toHaveLength(3)
      expect(chamadas[2]).toContain('gemini-3.6-flash')
      expect(chamadas[2]).not.toContain('flash-lite')
    } finally {
      restaurar()
    }
  })

  it('503 NÃO desliga o padrão — pico passa em segundos', async () => {
    // Marcar o modelo bom como fora por causa de um soluço seria desligar o
    // caminho normal do produto por um minuto ruim do Google.
    const { chamadas, restaurar } = fingirFetch([
      () => new Response('{}', { status: 503 }),
      () => respondeu('pela reserva'),
      () => respondeu('padrão de novo'),
    ])

    try {
      const modelo = gemini({ chave: 'k' })
      await modelo.responder(pedido)
      await modelo.responder(pedido)

      expect(chamadas[2]).toContain('flash-lite')
    } finally {
      restaurar()
    }
  })
})
