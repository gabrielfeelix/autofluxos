import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema.js'
import { executar, MAX_TENTATIVAS } from './executar.js'
import { sessaoNova, type Acao, type Entrada, type Sessao } from './types.js'

const p = { x: 0, y: 0 }

/**
 * Fluxo de triagem parecido com o que um cliente real teria: dá boas-vindas,
 * pergunta o assunto em botões, coleta o nome, monta um resumo, e decide se
 * passa para uma pessoa ou encerra.
 */
const triagem: Fluxo = fluxoSchema.parse({
  inicio: 'boas-vindas',
  nodes: [
    { id: 'boas-vindas', type: 'mensagem', position: p, data: { texto: 'Oi! Sou o assistente virtual 👋' } },
    {
      id: 'assunto',
      type: 'pergunta',
      position: p,
      data: {
        texto: 'O que você procura?',
        salvarEm: 'assunto',
        opcoes: [
          { id: 'empresa', rotulo: 'Video p/ empresa' },
          { id: 'casamento', rotulo: 'Casamento' },
          { id: 'outro', rotulo: 'Outro assunto' },
        ],
      },
    },
    { id: 'nome', type: 'pergunta', position: p, data: { texto: 'Legal! Qual o seu nome?', salvarEm: 'nome' } },
    { id: 'resumo', type: 'salvar-campo', position: p, data: { campo: 'resumo', valor: '{{nome}} - {{assunto}}' } },
    {
      id: 'e-empresa',
      type: 'condicao',
      position: p,
      data: { variavel: 'assunto', operador: 'igual', valor: 'Video p/ empresa' },
    },
    { id: 'obrigado', type: 'mensagem', position: p, data: { texto: 'Perfeito, {{nome}}! Já te passo para o time.' } },
    { id: 'humano', type: 'handoff', position: p, data: { motivo: 'lead qualificado' } },
    { id: 'fim', type: 'mensagem', position: p, data: { texto: 'Obrigado! Tenha um ótimo dia.' } },
  ],
  edges: [
    { id: 'a1', source: 'boas-vindas', target: 'assunto' },
    { id: 'a2', source: 'assunto', sourceHandle: 'empresa', target: 'nome' },
    { id: 'a3', source: 'assunto', sourceHandle: 'casamento', target: 'nome' },
    { id: 'a4', source: 'assunto', sourceHandle: 'outro', target: 'humano' },
    { id: 'a5', source: 'nome', target: 'resumo' },
    { id: 'a6', source: 'resumo', target: 'e-empresa' },
    { id: 'a7', source: 'e-empresa', sourceHandle: 'verdadeiro', target: 'obrigado' },
    { id: 'a8', source: 'e-empresa', sourceHandle: 'falso', target: 'fim' },
    { id: 'a9', source: 'obrigado', target: 'humano' },
  ],
})

const textos = (acoes: Acao[]) =>
  acoes.filter((a) => a.tipo === 'enviar_texto').map((a) => a.texto)

const tipos = (acoes: Acao[]) => acoes.map((a) => a.tipo)

/** Roda uma conversa inteira e devolve o estado final e as ações do último turno. */
function conversar(fluxo: Fluxo, entradas: Entrada[]): { sessao: Sessao; acoes: Acao[] } {
  let sessao = sessaoNova()
  let acoes: Acao[] = []
  for (const entrada of entradas) {
    const r = executar(fluxo, sessao, entrada)
    sessao = r.sessao
    acoes = r.acoes
  }
  return { sessao, acoes }
}

describe('início da conversa', () => {
  it('manda a saudação e para na primeira pergunta', () => {
    const { acoes, sessao } = conversar(triagem, [{ tipo: 'inicio' }])

    expect(textos(acoes)).toEqual(['Oi! Sou o assistente virtual 👋'])
    expect(sessao.noAtual).toBe('assunto')
    expect(sessao.status).toBe('ativa')
  })

  it('oferece as opções como botões quando são até 3', () => {
    const { acoes } = conversar(triagem, [{ tipo: 'inicio' }])
    const pergunta = acoes.find((a) => a.tipo === 'enviar_opcoes')

    expect(pergunta).toMatchObject({ texto: 'O que você procura?', formato: 'botoes' })
    expect(pergunta?.tipo === 'enviar_opcoes' && pergunta.opcoes).toHaveLength(3)
  })

  it('usa lista quando passa de 3 opções', () => {
    const comMuitas: Fluxo = fluxoSchema.parse({
      inicio: 'q',
      nodes: [
        {
          id: 'q',
          type: 'pergunta',
          position: p,
          data: {
            texto: 'Escolha:',
            opcoes: Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, rotulo: `Opcao ${i}` })),
          },
        },
        { id: 'h', type: 'handoff', position: p, data: {} },
      ],
      edges: Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, source: 'q', sourceHandle: `o${i}`, target: 'h' })),
    })

    const { acoes } = conversar(comMuitas, [{ tipo: 'inicio' }])
    expect(acoes.find((a) => a.tipo === 'enviar_opcoes')).toMatchObject({ formato: 'lista' })
  })
})

describe('respondendo as perguntas', () => {
  it('clicar numa opção salva a resposta e segue pela aresta certa', () => {
    const { acoes, sessao } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'opcao', opcaoId: 'empresa' },
    ])

    expect(sessao.vars['assunto']).toBe('Video p/ empresa')
    expect(sessao.noAtual).toBe('nome')
    expect(textos(acoes)).toContain('Legal! Qual o seu nome?')
  })

  it('aceita o rótulo digitado, sem ligar para acento ou maiúscula', () => {
    const { sessao } = conversar(triagem, [{ tipo: 'inicio' }, { tipo: 'texto', texto: 'CASAMENTO' }])
    expect(sessao.vars['assunto']).toBe('Casamento')
    expect(sessao.noAtual).toBe('nome')
  })

  it('aceita o número da opção, porque muita gente responde "2"', () => {
    const { sessao } = conversar(triagem, [{ tipo: 'inicio' }, { tipo: 'texto', texto: '2' }])
    expect(sessao.vars['assunto']).toBe('Casamento')
  })

  it('guarda texto livre quando a pergunta não tem opções', () => {
    const { sessao, acoes } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'opcao', opcaoId: 'empresa' },
      { tipo: 'texto', texto: 'Ana Souza' },
    ])

    expect(sessao.vars['nome']).toBe('Ana Souza')
    expect(acoes).toContainEqual({ tipo: 'salvar_campo', campo: 'resumo', valor: 'Ana Souza - Video p/ empresa' })
  })
})

describe('caminhos até o fim', () => {
  it('lead de empresa passa pela condição verdadeira e vai para o humano', () => {
    const { sessao, acoes } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'opcao', opcaoId: 'empresa' },
      { tipo: 'texto', texto: 'Ana' },
    ])

    expect(textos(acoes)).toContain('Perfeito, Ana! Já te passo para o time.')
    expect(acoes).toContainEqual({ tipo: 'transferir_humano', motivo: 'lead qualificado' })
    expect(sessao.status).toBe('humano')
  })

  it('lead de casamento cai na condição falsa e encerra', () => {
    const { sessao, acoes } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'opcao', opcaoId: 'casamento' },
      { tipo: 'texto', texto: 'Bruno' },
    ])

    expect(textos(acoes)).toContain('Obrigado! Tenha um ótimo dia.')
    expect(tipos(acoes)).toContain('encerrar')
    expect(sessao.status).toBe('encerrada')
  })

  it('opção que leva direto ao handoff transfere na hora', () => {
    const { sessao } = conversar(triagem, [{ tipo: 'inicio' }, { tipo: 'opcao', opcaoId: 'outro' }])
    expect(sessao.status).toBe('humano')
  })
})

describe('as três garantias que impedem a pessoa de ficar presa', () => {
  it('pedir atendente transfere de qualquer ponto, sem estar no desenho', () => {
    const { sessao, acoes } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'texto', texto: 'quero falar com um atendente por favor' },
    ])

    expect(sessao.status).toBe('humano')
    expect(acoes).toContainEqual({
      tipo: 'transferir_humano',
      motivo: 'a pessoa pediu para falar com um atendente',
    })
  })

  it('áudio vai direto para uma pessoa em vez de "não entendi"', () => {
    const { sessao, acoes } = conversar(triagem, [
      { tipo: 'inicio' },
      { tipo: 'midia', formato: 'audio' },
    ])

    expect(sessao.status).toBe('humano')
    expect(acoes).toContainEqual({
      tipo: 'transferir_humano',
      motivo: 'a pessoa mandou audio e o bot só lê texto',
    })
  })

  it(`transfere na ${MAX_TENTATIVAS}ª resposta que o bot não entende`, () => {
    let sessao = sessaoNova()
    let acoes: Acao[] = []

    sessao = executar(triagem, sessao, { tipo: 'inicio' }).sessao

    for (let i = 1; i <= MAX_TENTATIVAS; i++) {
      const r = executar(triagem, sessao, { tipo: 'texto', texto: 'blablabla' })
      sessao = r.sessao
      acoes = r.acoes

      if (i < MAX_TENTATIVAS) {
        expect(sessao.status).toBe('ativa')
        expect(textos(acoes)[0]).toContain('não entendi')
      }
    }

    expect(sessao.status).toBe('humano')
    expect(tipos(acoes)).toContain('transferir_humano')
  })

  it('fluxo com ciclo não prende ninguém: estoura a trava e chama humano', () => {
    const emLoop: Fluxo = fluxoSchema.parse({
      inicio: 'a',
      nodes: [
        { id: 'a', type: 'mensagem', position: p, data: { texto: 'a' } },
        { id: 'b', type: 'mensagem', position: p, data: { texto: 'b' } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    })

    const { sessao, acoes } = conversar(emLoop, [{ tipo: 'inicio' }])
    expect(sessao.status).toBe('humano')
    expect(acoes).toContainEqual({ tipo: 'transferir_humano', motivo: 'o fluxo entrou em loop' })
  })

  it('depois que o humano assume, o bot fica calado', () => {
    const { sessao } = conversar(triagem, [{ tipo: 'inicio' }, { tipo: 'opcao', opcaoId: 'outro' }])

    const depois = executar(triagem, sessao, { tipo: 'texto', texto: 'oi, tem alguém aí?' })
    expect(depois.acoes).toEqual([])
    expect(depois.sessao.status).toBe('humano')
  })
})

describe('nó de IA', () => {
  const comIa: Fluxo = fluxoSchema.parse({
    inicio: 'duvida',
    nodes: [
      { id: 'duvida', type: 'pergunta', position: p, data: { texto: 'Qual sua dúvida?', salvarEm: 'duvida' } },
      { id: 'responder', type: 'ia', position: p, data: { instrucao: 'Responda: {{duvida}}', salvarEm: 'resposta_ia' } },
      { id: 'humano', type: 'handoff', position: p, data: {} },
    ],
    edges: [
      { id: 'e1', source: 'duvida', target: 'responder' },
      { id: 'e2', source: 'responder', target: 'humano' },
    ],
  })

  it('pede a chamada do modelo e espera, sem chamar nada sozinho', () => {
    const { sessao, acoes } = conversar(comIa, [
      { tipo: 'inicio' },
      { tipo: 'texto', texto: 'vocês fazem vídeo institucional?' },
    ])

    expect(acoes).toContainEqual({
      tipo: 'chamar_ia',
      instrucao: 'Responda: vocês fazem vídeo institucional?',
    })
    expect(sessao.status).toBe('aguardando_ia')
    expect(sessao.noAtual).toBe('responder')
  })

  it('ao receber a resposta do modelo, manda para a pessoa e segue o fluxo', () => {
    const { sessao, acoes } = conversar(comIa, [
      { tipo: 'inicio' },
      { tipo: 'texto', texto: 'fazem institucional?' },
      { tipo: 'ia_respondeu', texto: 'Fazemos sim!' },
    ])

    expect(textos(acoes)).toContain('Fazemos sim!')
    expect(sessao.vars['resposta_ia']).toBe('Fazemos sim!')
    expect(sessao.status).toBe('humano')
  })

  it('ignora o que a pessoa escrever enquanto o modelo pensa', () => {
    let sessao = sessaoNova()
    sessao = executar(comIa, sessao, { tipo: 'inicio' }).sessao
    sessao = executar(comIa, sessao, { tipo: 'texto', texto: 'oi' }).sessao

    const r = executar(comIa, sessao, { tipo: 'texto', texto: 'alô?' })
    expect(r.acoes).toEqual([])
    expect(r.sessao.status).toBe('aguardando_ia')
  })
})

describe('robustez', () => {
  it('sessão parada num nó que não existe mais recomeça em vez de travar', () => {
    const perdida: Sessao = { noAtual: 'no-que-sumiu', vars: {}, tentativas: 0, status: 'ativa' }
    const { acoes, sessao } = executar(triagem, perdida, { tipo: 'texto', texto: 'oi' })

    expect(textos(acoes)).toContain('Oi! Sou o assistente virtual 👋')
    expect(sessao.noAtual).toBe('assunto')
  })

  it('não modifica a sessão que recebeu', () => {
    const original = sessaoNova()
    executar(triagem, original, { tipo: 'inicio' })

    expect(original.noAtual).toBeNull()
    expect(original.vars).toEqual({})
  })
})
