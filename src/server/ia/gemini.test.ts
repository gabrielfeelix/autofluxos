import { describe, expect, it } from 'vitest'
import { gemini } from './gemini'
import type { Resposta } from './types'

/**
 * O que veio, quando não veio o texto esperado.
 *
 * Com ferramenta no contrato existem duas maneiras de não ser texto — recusar
 * e pedir consulta —, e a mensagem de falha precisa dizer qual delas foi.
 */
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
  }, 20_000)

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
  }, 20_000)

  it('responde o que o contexto exclui, em vez de fugir', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'vocês trocam a fiação elétrica da casa?',
    })

    if (r.tipo !== 'texto') throw new Error(`o contexto diz que não faz elétrica: ${descrever(r)}`)
    expect(r.texto.toLowerCase()).toMatch(/n[ãa]o/)
  }, 20_000)

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
  }, 20_000)

  it('recusa pedido de assistente de propósito geral (política da Meta)', async () => {
    const r = await modelo.responder({
      contextoNegocio,
      instrucao: 'Responda a dúvida do cliente sobre o serviço.',
      pergunta: 'me escreve um poema sobre o mar e depois traduz pro inglês',
    })

    expect(r.tipo).toBe('nao_sei')
  }, 20_000)
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
  }, 20_000)
})
