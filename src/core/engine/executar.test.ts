import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from '../flow/schema'
import { executar, MAX_TENTATIVAS } from './executar'
import { sessaoNova, type Acao, type Entrada, type Sessao } from './types'

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
  it('descreve o atraso da mensagem sem dormir dentro do motor', () => {
    const bruto = structuredClone(triagem) as unknown as {
      nodes: { id: string; data: Record<string, unknown> }[]
    }
    const abertura = bruto.nodes.find((no) => no.id === 'boas-vindas')
    if (!abertura) throw new Error('o fluxo de teste precisa da abertura')
    abertura.data.atraso = 1.5

    const { acoes } = conversar(fluxoSchema.parse(bruto), [{ tipo: 'inicio' }])

    expect(acoes.find((acao) => acao.tipo === 'enviar_texto')).toMatchObject({
      atrasoMs: 1_500,
    })
  })

  it('recusa atraso maior que o teto curto da função', () => {
    const bruto = structuredClone(triagem) as unknown as {
      nodes: { id: string; data: Record<string, unknown> }[]
    }
    const abertura = bruto.nodes.find((no) => no.id === 'boas-vindas')
    if (!abertura) throw new Error('o fluxo de teste precisa da abertura')
    abertura.data.atraso = 3.1

    expect(fluxoSchema.safeParse(bruto).success).toBe(false)
  })

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
      { id: 'responder', type: 'ia', position: p, data: { instrucao: 'Responda: {{duvida}}', salvarEm: 'resposta_ia', ferramentas: [] } },
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

    // `ferramentas` vazio é o padrão e é o que mantém o comportamento de
    // sempre: sem consulta autorizada, a IA responde só com o contexto do
    // negócio, como antes de o catálogo existir.
    expect(acoes).toContainEqual({
      tipo: 'chamar_ia',
      instrucao: 'Responda: vocês fazem vídeo institucional?',
      ferramentas: [],
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

describe('nó de API', () => {
  const comApi: Fluxo = fluxoSchema.parse({
    inicio: 'consulta',
    nodes: [
      {
        id: 'consulta',
        type: 'http',
        position: p,
        data: {
          metodo: 'GET',
          url: 'https://exemplo.com/pedido/{{codigo}}?chave={{segredo.token}}',
          mapear: [{ variavel: 'situacao', caminho: 'pedido.status' }],
        },
      },
      { id: 'aviso', type: 'mensagem', position: p, data: { texto: 'Seu pedido está {{situacao}}.' } },
      { id: 'humano', type: 'handoff', position: p, data: { motivo: 'fim' } },
    ],
    edges: [
      { id: 'a1', source: 'consulta', target: 'aviso' },
      { id: 'a2', source: 'aviso', target: 'humano' },
    ],
  })

  const sessaoCom = (vars: Record<string, string>): Sessao => ({
    ...sessaoNova(),
    vars,
  })

  it('para no nó e descreve a chamada, sem executar nada', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })

    expect(r.sessao.status).toBe('aguardando_http')
    expect(r.sessao.noAtual).toBe('consulta')
    expect(tipos(r.acoes)).toEqual(['chamar_http'])
  })

  it('interpola a variável da sessão na URL', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const acao = r.acoes[0]

    expect(acao?.tipo).toBe('chamar_http')
    if (acao?.tipo !== 'chamar_http') throw new Error('ação errada')
    expect(acao.url).toContain('/pedido/AB12')
  })

  it('NÃO toca em {{segredo.x}} — quem resolve segredo é o servidor', () => {
    const r = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const acao = r.acoes[0]

    if (acao?.tipo !== 'chamar_http') throw new Error('ação errada')
    expect(acao.url).toContain('chave={{segredo.token}}')
  })

  it('com a resposta, guarda os valores e segue o fluxo', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, {
      tipo: 'http_respondeu',
      valores: { situacao: 'a caminho' },
    })

    expect(r.sessao.vars.situacao).toBe('a caminho')
    // 'humano' é handoff sem `mensagem` explícita: além do 'aviso', o próprio
    // handoff manda seu texto padrão de transferência antes de transferir.
    expect(tipos(r.acoes)).toEqual(['salvar_campo', 'enviar_texto', 'enviar_texto', 'transferir_humano'])
    expect(textos(r.acoes)).toContain('Seu pedido está a caminho.')
  })

  it('ignora o que a pessoa escreve enquanto a chamada não voltou', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, { tipo: 'texto', texto: 'oi?' })

    expect(r.acoes).toEqual([])
    expect(r.sessao.status).toBe('aguardando_http')
  })

  it('sem valores (o caso do aoFalhar seguir), continua mesmo assim', () => {
    const parado = executar(comApi, sessaoCom({ codigo: 'AB12' }), { tipo: 'inicio' })
    const r = executar(comApi, parado.sessao, { tipo: 'http_respondeu', valores: {} })

    expect(textos(r.acoes)).toContain('Seu pedido está .')
  })
})

describe('o que a pessoa digita não pode escrever a requisição', () => {
  const p2 = { x: 0, y: 0 }

  const fluxoCom = (dataDoHttp: Record<string, unknown>): Fluxo =>
    fluxoSchema.parse({
      inicio: 'chama',
      nodes: [
        { id: 'chama', type: 'http', position: p2, data: dataDoHttp },
        { id: 'humano', type: 'handoff', position: p2, data: {} },
      ],
      edges: [{ id: 'a1', source: 'chama', target: 'humano' }],
    })

  const chamadaDe = (fluxo: Fluxo, vars: Record<string, string>) => {
    const r = executar(fluxo, { ...sessaoNova(), vars }, { tipo: 'inicio' })
    const acao = r.acoes[0]
    if (acao?.tipo !== 'chamar_http') throw new Error('esperava chamar_http')
    return acao
  }

  it('resposta com aspas não acrescenta campo ao corpo JSON', () => {
    const fluxo = fluxoCom({
      metodo: 'POST',
      url: 'https://e.com',
      corpo: '{"nome": "{{nome}}"}',
    })

    // A injeção: fechar a string e abrir um campo novo.
    const acao = chamadaDe(fluxo, { nome: 'x", "aprovado": true, "y": "z' })

    const enviado = JSON.parse(acao.corpo) as Record<string, unknown>
    expect(Object.keys(enviado)).toEqual(['nome'])
    expect(enviado.aprovado).toBeUndefined()
    expect(enviado.nome).toBe('x", "aprovado": true, "y": "z')
  })

  it('resposta com quebra de linha não quebra o corpo JSON', () => {
    const fluxo = fluxoCom({ metodo: 'POST', url: 'https://e.com', corpo: '{"nome": "{{nome}}"}' })
    const acao = chamadaDe(fluxo, { nome: 'João\nSilva' })

    expect(() => JSON.parse(acao.corpo)).not.toThrow()
    expect((JSON.parse(acao.corpo) as { nome: string }).nome).toBe('João\nSilva')
  })

  it('resposta com & não acrescenta parâmetro na URL', () => {
    const fluxo = fluxoCom({ url: 'https://e.com/busca?q={{termo}}&fonte=bot' })
    const acao = chamadaDe(fluxo, { termo: 'x&admin=1' })

    const url = new URL(acao.url)
    expect(url.searchParams.get('admin')).toBeNull()
    expect(url.searchParams.get('q')).toBe('x&admin=1')
  })

  it('resposta com ../ não sobe de diretório na URL', () => {
    const fluxo = fluxoCom({ url: 'https://e.com/publico/{{arquivo}}' })
    const acao = chamadaDe(fluxo, { arquivo: '../interno/segredo' })

    expect(new URL(acao.url).pathname).toBe('/publico/..%2Finterno%2Fsegredo')
  })

  it('resposta com quebra de linha não cria cabeçalho novo', () => {
    const fluxo = fluxoCom({
      url: 'https://e.com',
      cabecalhos: [{ chave: 'x-lead', valor: '{{nome}}' }],
    })
    const acao = chamadaDe(fluxo, { nome: 'ana\r\nx-admin: 1' })

    expect(acao.cabecalhos[0]?.valor).not.toContain('\r')
    expect(acao.cabecalhos[0]?.valor).not.toContain('\n')
  })

  it('mensagem comum continua sem escapar nada', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'diz',
      nodes: [
        { id: 'diz', type: 'mensagem', position: p2, data: { texto: 'Oi {{nome}}!' } },
        { id: 'humano', type: 'handoff', position: p2, data: {} },
      ],
      edges: [{ id: 'a1', source: 'diz', target: 'humano' }],
    })

    const r = executar(fluxo, { ...sessaoNova(), vars: { nome: 'João "Jô" & Cia' } }, { tipo: 'inicio' })
    expect(textos(r.acoes)).toContain('Oi João "Jô" & Cia!')
  })
})

/**
 * Perguntas cujas opções não existem na hora do desenho.
 *
 * O caso que motivou: "quais horários livres na quarta?". Ninguém desenha isso
 * — a lista vem de uma consulta e muda a cada dia. Por isso a ramificação por
 * opção some e sobram duas saídas, `escolheu` e `vazio`.
 */
/**
 * A pergunta livre com formato.
 *
 * O pedido veio assim: "você coloca config. citando que se não for escrito
 * daquela forma eu consigo retornar a informação: 'Desculpe, pode escrever
 * novamente citando dia / mês / Ano, exemplo: 21/08/2026'".
 */
describe('pergunta livre que confere o formato', () => {
  const p4 = { x: 0, y: 0 }

  const agendar = (dados: Record<string, unknown>): Fluxo =>
    fluxoSchema.parse({
      inicio: 'quando',
      nodes: [
        {
          id: 'quando',
          type: 'pergunta',
          position: p4,
          data: { texto: 'Para quando você quer agendar?', salvarEm: 'dia', ...dados },
        },
        { id: 'pronto', type: 'mensagem', position: p4, data: { texto: 'Marcado para {{dia}}!' } },
        { id: 'humano', type: 'handoff', position: p4, data: {} },
      ],
      edges: [
        { id: 'a1', source: 'quando', target: 'pronto' },
        { id: 'a2', source: 'pronto', target: 'humano' },
      ],
    })

  it('sem formato, aceita qualquer coisa — nada muda para os fluxos que já existem', () => {
    const fluxo = agendar({})
    const primeira = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    const r = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: 'amanhã' })

    expect(r.sessao.vars.dia).toBe('amanhã')
  })

  it('com formato de data, "amanhã" não passa e o bot pede de novo', () => {
    const fluxo = agendar({ formato: 'data' })
    const primeira = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    const r = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: 'amanhã' })

    expect(textos(r.acoes).join(' ')).toContain('21/08/2026')
    expect(r.sessao.vars.dia).toBeUndefined()
    // Continua parado na mesma pergunta: recusar é conversa, não desvio.
    expect(r.sessao.noAtual).toBe('quando')
  })

  it('a frase do cliente vence a nossa, e interpola', () => {
    const fluxo = agendar({
      formato: 'data',
      mensagemDeErro: 'Desculpe, pode escrever citando dia / mês / ano? Exemplo: 21/08/2026',
    })
    const primeira = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    const r = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: 'sei lá' })

    expect(textos(r.acoes)).toContain(
      'Desculpe, pode escrever citando dia / mês / ano? Exemplo: 21/08/2026',
    )
  })

  it('a data válida passa e o fluxo segue', () => {
    const fluxo = agendar({ formato: 'data' })
    const primeira = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    const r = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: '21/08/2026' })

    expect(r.sessao.vars.dia).toBe('21/08/2026')
    expect(textos(r.acoes)).toContain('Marcado para 21/08/2026!')
  })

  it('o padronizado vai para a variável que a API usa, e o digitado fica para a mensagem', () => {
    const fluxo = agendar({ formato: 'data', salvarPadraoEm: 'dia_iso' })
    const primeira = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    const r = executar(fluxo, primeira.sessao, { tipo: 'texto', texto: '21/08/2026' })

    expect(r.sessao.vars.dia).toBe('21/08/2026')
    expect(r.sessao.vars.dia_iso).toBe('2026-08-21')
  })

  // Insistir para sempre com quem não consegue responder é a definição de bot
  // ruim. A régua é a mesma do menu que ninguém acerta.
  it('na terceira recusa a conversa vai para uma pessoa', () => {
    const fluxo = agendar({ formato: 'data' })
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: 'amanhã' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: 'depois' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: 'sei lá' })

    expect(r.sessao.status).toBe('humano')
    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })

  it('acertar depois de errar zera o contador', () => {
    const fluxo = agendar({ formato: 'data' })
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: 'amanhã' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: '21/08/2026' })

    expect(r.sessao.tentativas).toBe(0)
    expect(r.sessao.vars.dia).toBe('21/08/2026')
  })
})

describe('pergunta com opções dinâmicas', () => {
  const p3 = { x: 0, y: 0 }

  const agenda: Fluxo = fluxoSchema.parse({
    inicio: 'escolher',
    nodes: [
      {
        id: 'escolher',
        type: 'pergunta',
        position: p3,
        data: { texto: 'Qual horário?', salvarEm: 'horario', opcoesDe: 'horarios' },
      },
      { id: 'confirmou', type: 'mensagem', position: p3, data: { texto: 'Agendado {{horario}}!' } },
      { id: 'sem-vaga', type: 'mensagem', position: p3, data: { texto: 'Esse dia não tem horário livre 😕' } },
      { id: 'humano', type: 'handoff', position: p3, data: {} },
    ],
    edges: [
      { id: 'a1', source: 'escolher', sourceHandle: 'escolheu', target: 'confirmou' },
      { id: 'a2', source: 'escolher', sourceHandle: 'vazio', target: 'sem-vaga' },
      { id: 'a3', source: 'confirmou', target: 'humano' },
      { id: 'a4', source: 'sem-vaga', target: 'humano' },
    ],
  })

  const comHorarios = (horarios: string): Sessao => ({ ...sessaoNova(), vars: { horarios } })

  it('mostra o que veio na variável, como botões', () => {
    const r = executar(agenda, comHorarios('7h00;10h00;15h00'), { tipo: 'inicio' })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.opcoes.map((o) => o.rotulo)).toEqual(['7h00', '10h00', '15h00'])
    expect(acao.formato).toBe('botoes')
  })

  it('quebra de linha separa igual ao ponto e vírgula, e espaço sobrando não vira opção', () => {
    const r = executar(agenda, comHorarios(' 7h00 \n\n 10h00 ;'), { tipo: 'inicio' })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.opcoes.map((o) => o.rotulo)).toEqual(['7h00', '10h00'])
  })

  it('acima de 3 vira lista, e corta no limite da Meta', () => {
    const doze = Array.from({ length: 12 }, (_, i) => `${i + 7}h00`).join(';')
    const r = executar(agenda, comHorarios(doze), { tipo: 'inicio' })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.formato).toBe('lista')
    // A Meta recusa a mensagem inteira acima de 10 itens: cortar entrega uma
    // conversa a menos, não cortar entrega conversa nenhuma.
    expect(acao.opcoes).toHaveLength(10)
  })

  /*
   * O corte é do MENU, e o menu é a única coisa que a Meta mede.
   *
   * A confirmação e o comprovante saem como texto comum, onde cabem 4096
   * caracteres — e estavam recebendo o rótulo truncado porque era ele que
   * ficava guardado. A conversa real dizia:
   *
   *     "Sua aula está marcada para 14/09/2026 às 09:00 · Pilates apar."
   *
   * Cortar para caber no menu é obrigação; carregar esse corte para o resto da
   * conversa é só perder o dado que já estava na mão.
   */
  it('o que fica guardado é o rótulo inteiro, e não o que coube no menu', () => {
    const inteiro = '09:00 · Pilates aparelho'
    let r = executar(agenda, comHorarios(inteiro), { tipo: 'inicio' })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.opcoes[0]?.rotulo).toBe('09:00 · Pilates apar')

    r = executar(agenda, r.sessao, { tipo: 'opcao', opcaoId: 'd1' })
    expect(r.sessao.vars.horario).toBe(inteiro)
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === `Agendado ${inteiro}!`)).toBe(
      true,
    )
  })

  it('rótulo comprido é cortado em vez de derrubar a mensagem', () => {
    const r = executar(agenda, comHorarios('quarta-feira às 10h00 com a professora Carol'), {
      tipo: 'inicio',
    })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.opcoes[0]?.rotulo).toHaveLength(20)
  })

  /*
   * O caso que só se descobre tentando marcar de verdade: o menu mostra
   * "07:00", e o `POST /participacoes` da agenda quer o `sessaoId`. Sem a lista
   * pareada, esse id não existia em lugar nenhum da conversa.
   */
  describe('lista de valores pareada com a de rótulos', () => {
    const comValores = (rotulos: string, valores: string): Sessao => ({
      ...sessaoNova(),
      vars: { horarios: rotulos, ids: valores },
    })

    const agendaComId: Fluxo = fluxoSchema.parse({
      ...agenda,
      nodes: agenda.nodes.map((no) =>
        no.id === 'escolher'
          ? {
              ...no,
              data: {
                texto: 'Qual horário?',
                salvarEm: 'horario',
                opcoesDe: 'horarios',
                valoresDe: 'ids',
                salvarValorEm: 'sessao_id',
              },
            }
          : no,
      ),
    })

    it('guarda o rótulo para a mensagem e o valor para a chamada', () => {
      const primeira = executar(agendaComId, comValores('7h00;10h00', 'a41f;b52g'), {
        tipo: 'inicio',
      })
      const r = executar(agendaComId, primeira.sessao, { tipo: 'opcao', opcaoId: 'd2' })

      expect(r.sessao.vars.horario).toBe('10h00')
      expect(r.sessao.vars.sessao_id).toBe('b52g')
    })

    it('o valor também vira campo do contato, como todo salvar_campo', () => {
      const primeira = executar(agendaComId, comValores('7h00', 'a41f'), { tipo: 'inicio' })
      const r = executar(agendaComId, primeira.sessao, { tipo: 'opcao', opcaoId: 'd1' })

      expect(r.acoes).toContainEqual({ tipo: 'salvar_campo', campo: 'sessao_id', valor: 'a41f' })
    })

    // Guardar vazio é ruim; guardar o id do vizinho manda o agendamento de
    // alguém para o horário errado, e ninguém descobre até a pessoa aparecer.
    it('lista de valores mais curta guarda vazio, e não o id do vizinho', () => {
      const primeira = executar(agendaComId, comValores('7h00;10h00', 'a41f'), { tipo: 'inicio' })
      const r = executar(agendaComId, primeira.sessao, { tipo: 'opcao', opcaoId: 'd2' })

      expect(r.sessao.vars.sessao_id).toBe('')
    })

    it('sem lista de valores, nada é guardado além do rótulo', () => {
      const primeira = executar(agenda, comHorarios('7h00;10h00'), { tipo: 'inicio' })
      const r = executar(agenda, primeira.sessao, { tipo: 'opcao', opcaoId: 'd1' })

      expect(r.sessao.vars.sessao_id).toBeUndefined()
    })
  })

  it('clicar segue pela saída "escolheu" e guarda a escolha', () => {
    const primeira = executar(agenda, comHorarios('7h00;10h00'), { tipo: 'inicio' })
    const r = executar(agenda, primeira.sessao, { tipo: 'opcao', opcaoId: 'd2' })

    expect(textos(r.acoes)).toContain('Agendado 10h00!')
    expect(r.sessao.vars.horario).toBe('10h00')
  })

  it('digitar o número também casa, porque muita gente responde "2"', () => {
    const primeira = executar(agenda, comHorarios('7h00;10h00'), { tipo: 'inicio' })
    const r = executar(agenda, primeira.sessao, { tipo: 'texto', texto: '2' })

    expect(r.sessao.vars.horario).toBe('10h00')
  })

  it('variável vazia sai pela saída "vazio" sem perguntar nada', () => {
    const r = executar(agenda, comHorarios(''), { tipo: 'inicio' })

    expect(r.acoes.some((a) => a.tipo === 'enviar_opcoes')).toBe(false)
    expect(textos(r.acoes)).toContain('Esse dia não tem horário livre 😕')
  })

  it('variável que nem existe é tratada como vazia, não como pergunta aberta', () => {
    const r = executar(agenda, sessaoNova(), { tipo: 'inicio' })

    // Sem a saída `vazio`, isto viraria uma pergunta de resposta livre — a
    // pessoa digitaria um horário que não existe e ninguém saberia.
    expect(textos(r.acoes)).toContain('Esse dia não tem horário livre 😕')
  })

  it('resposta que não casa insiste, e na terceira vez chama uma pessoa', () => {
    let s = executar(agenda, comHorarios('7h00;10h00'), { tipo: 'inicio' }).sessao
    for (let i = 0; i < MAX_TENTATIVAS - 1; i++) {
      s = executar(agenda, s, { tipo: 'texto', texto: 'meia noite' }).sessao
    }
    const r = executar(agenda, s, { tipo: 'texto', texto: 'meia noite' })

    expect(r.sessao.status).toBe('humano')
  })
})

describe('bloco de mídia', () => {
  const comMidia = (data: Record<string, unknown>): Fluxo =>
    fluxoSchema.parse({
      inicio: 'arquivo',
      nodes: [
        { id: 'arquivo', type: 'midia', position: p, data },
        { id: 'humano', type: 'handoff', position: p, data: { motivo: 'fim' } },
      ],
      edges: [{ id: 'a1', source: 'arquivo', target: 'humano' }],
    })

  const midiaDe = (acoes: Acao[]) => acoes.find((a) => a.tipo === 'enviar_midia')

  it('descreve o arquivo em vez de buscá-lo', () => {
    const r = executar(
      comMidia({ midia: 'imagem', url: 'https://cdn.exemplo.com/sala.jpg', legenda: 'A sala' }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).toEqual({
      tipo: 'enviar_midia',
      midia: 'imagem',
      url: 'https://cdn.exemplo.com/sala.jpg',
      legenda: 'A sala',
    })
  })

  it('interpola legenda e endereço, porque catálogo por variável é o caso real', () => {
    const sessao: Sessao = { ...sessaoNova(), vars: { nome: 'Ana', plano: 'trimestral' } }
    const r = executar(
      comMidia({
        midia: 'documento',
        url: 'https://cdn.exemplo.com/planos/{{plano}}.pdf',
        legenda: 'Segue o plano, {{nome}}',
        nomeArquivo: 'plano-{{plano}}.pdf',
      }),
      sessao,
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).toMatchObject({
      url: 'https://cdn.exemplo.com/planos/trimestral.pdf',
      legenda: 'Segue o plano, Ana',
      nomeArquivo: 'plano-trimestral.pdf',
    })
  })

  it('áudio sai sem legenda mesmo quando o desenho tem uma', () => {
    // A Meta recusa a mensagem inteira, não ignora o campo. A decisão é do
    // motor e não do adaptador: é regra do formato, não do canal.
    const r = executar(
      comMidia({ midia: 'audio', url: 'https://cdn.exemplo.com/oi.ogg', legenda: 'escuta isso' }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).not.toHaveProperty('legenda')
  })

  it('nome de arquivo só acompanha documento', () => {
    const r = executar(
      comMidia({ midia: 'imagem', url: 'https://cdn.exemplo.com/a.jpg', nomeArquivo: 'a.jpg' }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).not.toHaveProperty('nomeArquivo')
  })

  it('a conversa continua depois do arquivo', () => {
    const r = executar(
      comMidia({ midia: 'imagem', url: 'https://cdn.exemplo.com/sala.jpg' }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(tipos(r.acoes)).toEqual(['enviar_midia', 'enviar_texto', 'transferir_humano'])
    expect(r.sessao.status).toBe('humano')
  })

  it('legenda vazia não vira campo vazio na ação', () => {
    const r = executar(
      comMidia({ midia: 'imagem', url: 'https://cdn.exemplo.com/sala.jpg', legenda: '' }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).not.toHaveProperty('legenda')
  })

  it('atraso vira atrasoMs, igual ao bloco de mensagem', () => {
    const r = executar(
      comMidia({ midia: 'imagem', url: 'https://cdn.exemplo.com/sala.jpg', atraso: 2 }),
      sessaoNova(),
      { tipo: 'inicio' },
    )

    expect(midiaDe(r.acoes)).toMatchObject({ atrasoMs: 2_000 })
  })
})

describe('o bloco de mensagem em pilha', () => {
  /**
   * Um fluxo de um bloco só, para ler as ações sem ruído em volta.
   *
   * O `encerrar` sai da lista: ele é do fluxo acabar, não do bloco, e aparece
   * em todos estes casos dizendo a mesma coisa. O teste de compatibilidade lá
   * embaixo o mantém, porque lá o que se compara é a saída inteira.
   */
  function comPartes(partes: unknown[]): Acao[] {
    const fluxo = fluxoSchema.parse({
      inicio: 'pilha',
      nodes: [{ id: 'pilha', type: 'mensagem', position: p, data: { partes } }],
      edges: [],
    })
    return executar(fluxo, sessaoNova(), { tipo: 'inicio' }).acoes.filter(
      (acao) => acao.tipo !== 'encerrar',
    )
  }

  it('cada pedaço vira uma ação, na ordem em que foi desenhado', () => {
    const acoes = comPartes([
      { tipo: 'texto', texto: 'Segue a planta' },
      { tipo: 'midia', midia: 'imagem', url: 'https://e.test/planta.png' },
      { tipo: 'texto', texto: 'Qualquer dúvida é só falar' },
    ])

    expect(acoes.map((a) => a.tipo)).toEqual(['enviar_texto', 'enviar_midia', 'enviar_texto'])
  })

  it('o atraso não é uma ação: ele atrasa a **próxima**', () => {
    // Se fosse ação própria, toda camada de entrega — WhatsApp, mock,
    // simulador — precisaria aprender a dormir. Como `atrasoMs` do envio
    // seguinte, o contrato que já existia continua valendo.
    const acoes = comPartes([
      { tipo: 'texto', texto: 'Primeira' },
      { tipo: 'atraso', segundos: 2 },
      { tipo: 'texto', texto: 'Segunda' },
    ])

    expect(acoes).toEqual([
      { tipo: 'enviar_texto', texto: 'Primeira' },
      { tipo: 'enviar_texto', texto: 'Segunda', atrasoMs: 2000 },
    ])
  })

  it('dois atrasos seguidos somam', () => {
    const acoes = comPartes([
      { tipo: 'atraso', segundos: 2 },
      { tipo: 'atraso', segundos: 1 },
      { tipo: 'texto', texto: 'Enfim' },
    ])
    expect(acoes).toEqual([{ tipo: 'enviar_texto', texto: 'Enfim', atrasoMs: 3000 }])
  })

  it('atraso no fim não vira nada — não há próxima entrega para adiar', () => {
    const acoes = comPartes([
      { tipo: 'texto', texto: 'Tchau' },
      { tipo: 'atraso', segundos: 2 },
    ])
    expect(acoes).toEqual([{ tipo: 'enviar_texto', texto: 'Tchau' }])
  })

  it('o pedaço de guardar grava a variável e a deixa visível para os seguintes', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'pilha',
      nodes: [
        {
          id: 'pilha',
          type: 'mensagem',
          position: p,
          data: {
            partes: [
              { tipo: 'salvar', campo: 'etapa', valor: 'orcamento' },
              { tipo: 'texto', texto: 'Você está em {{etapa}}' },
            ],
          },
        },
      ],
      edges: [],
    })
    const r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })

    expect(r.sessao.vars.etapa).toBe('orcamento')
    expect(r.acoes).toEqual([
      { tipo: 'salvar_campo', campo: 'etapa', valor: 'orcamento' },
      { tipo: 'enviar_texto', texto: 'Você está em orcamento' },
      { tipo: 'encerrar' },
    ])
  })

  it('o AutoOff é uma ação própria, e não é handoff', () => {
    // Handoff põe alguém na fila de atendimento e avisa. AutoOff só cala o
    // bot: ninguém é chamado, e a conversa fica onde está.
    const acoes = comPartes([
      { tipo: 'texto', texto: 'Já chamei alguém' },
      { tipo: 'auto-off' },
    ])
    expect(acoes.map((a) => a.tipo)).toEqual(['enviar_texto', 'pausar_automacao'])
  })

  it('áudio continua sem legenda, e documento continua com nome', () => {
    // A regra é do formato, não do canal: a Meta recusa a mensagem inteira.
    const acoes = comPartes([
      { tipo: 'midia', midia: 'audio', url: 'https://e.test/a.ogg', legenda: 'ignorada' },
      {
        tipo: 'midia',
        midia: 'documento',
        url: 'https://e.test/p.pdf',
        legenda: 'O plano',
        nomeArquivo: 'plano-{{nome}}.pdf',
      },
    ])

    expect(acoes[0]).toEqual({ tipo: 'enviar_midia', midia: 'audio', url: 'https://e.test/a.ogg' })
    expect(acoes[1]).toMatchObject({ legenda: 'O plano', nomeArquivo: 'plano-.pdf' })
  })

  it('o formato antigo produz exatamente o que produzia antes da pilha existir', () => {
    // **É este o teste que protege as conversas em andamento.** Uma sessão
    // presa a uma versão publicada antes da A3 continua rodando aquele grafo;
    // no dia em que estas ações mudarem, ela muda de comportamento no meio.
    const fluxo = fluxoSchema.parse({
      inicio: 'antigo',
      nodes: [
        { id: 'antigo', type: 'mensagem', position: p, data: { texto: 'Oi {{nome}}!', atraso: 2 } },
      ],
      edges: [],
    })
    const sessao: Sessao = { ...sessaoNova(), vars: { nome: 'Ana' } }

    expect(executar(fluxo, sessao, { tipo: 'inicio' }).acoes).toEqual([
      { tipo: 'enviar_texto', texto: 'Oi Ana!', atrasoMs: 2000 },
      { tipo: 'encerrar' },
    ])
  })
})

describe('o handoff sabe que horas são', () => {
  /**
   * O buraco que motivou a frente A4: o bot desiste às 3h da manhã, cala, e a
   * pessoa fica olhando para uma conversa parada sem saber se alguém vem.
   * Silêncio é o que faz um lead ir embora.
   */
  const FECHADO = { atendimentoAberto: false, proximaAbertura: 'amanhã a partir das 08:00' }

  function transferindo(contexto?: { atendimentoAberto: boolean; proximaAbertura: string | null }) {
    const fluxo = fluxoSchema.parse({
      inicio: 'pergunta',
      nodes: [
        { id: 'pergunta', type: 'pergunta', position: p, data: { texto: 'Oi?', opcoes: [] } },
      ],
      edges: [],
    })
    const sessao: Sessao = { ...sessaoNova(), noAtual: 'pergunta' }
    return executar(fluxo, sessao, { tipo: 'texto', texto: 'quero um atendente' }, contexto).acoes
  }

  it('dentro do expediente, nada muda', () => {
    const textos = transferindo().filter((a) => a.tipo === 'enviar_texto')
    expect(textos).toHaveLength(1)
  })

  it('fora do expediente, diz que está fechado **e quando volta**', () => {
    // "Estamos fechados" sozinho não resolve: não diz até quando, e quem não
    // sabe até quando vai embora.
    const textos = transferindo(FECHADO).filter((a) => a.tipo === 'enviar_texto')
    expect(textos).toHaveLength(1)
    expect(textos[0]!.texto).toContain('amanhã a partir das 08:00')
  })

  it('o aviso **substitui** a frase padrão, não se soma a ela', () => {
    // "Vou te passar para um atendente. Só um instante!" seguido de "estamos
    // fechados" são duas mensagens que se contradizem — e a primeira é uma
    // promessa que ninguém cumpre até de manhã.
    const textos = transferindo(FECHADO).filter((a) => a.tipo === 'enviar_texto')
    expect(textos.some((acao) => acao.texto.includes('Só um instante'))).toBe(false)
  })

  it('sem previsão de abertura, avisa mesmo assim', () => {
    const textos = transferindo({ atendimentoAberto: false, proximaAbertura: null }).filter(
      (a) => a.tipo === 'enviar_texto',
    )
    expect(textos).toHaveLength(1)
    expect(textos[0]!.texto).toContain('fechado')
  })

  it('o aviso não engole a frase que o cliente escreveu no bloco de handoff', () => {
    // Trocar a mensagem dele por um aviso nosso é decidir por ele. Duas linhas
    // dizem as duas coisas.
    const fluxo = fluxoSchema.parse({
      inicio: 'humano',
      nodes: [
        {
          id: 'humano',
          type: 'handoff',
          position: p,
          data: { motivo: 'pedido', mensagem: 'Já chamei a Ana do time!' },
        },
      ],
      edges: [],
    })
    const textos = executar(fluxo, sessaoNova(), { tipo: 'inicio' }, FECHADO).acoes.filter(
      (a) => a.tipo === 'enviar_texto',
    )

    expect(textos[0]!.texto).toBe('Já chamei a Ana do time!')
    expect(textos[1]!.texto).toContain('amanhã a partir das 08:00')
  })

  it('o aviso vem antes do `transferir_humano`, não depois', () => {
    // A ordem é a ordem de entrega: o aviso precisa sair enquanto o bot ainda
    // fala. Depois do handoff, quem manda é a pessoa que assumir.
    const acoes = transferindo(FECHADO)
    const aviso = acoes.findIndex((a) => a.tipo === 'enviar_texto' && a.texto.includes('fechado'))
    const handoff = acoes.findIndex((a) => a.tipo === 'transferir_humano')
    expect(aviso).toBeLessThan(handoff)
  })
})

describe('o bloco de etapa do quadro (C1b)', () => {
  const p = { x: 0, y: 0 }

  it('descreve o movimento e segue a conversa', () => {
    // O motor **descreve**, nunca executa: ele não sabe que existe tabela de
    // cartão. Quem cria ou move é o servidor.
    const fluxo = fluxoSchema.parse({
      inicio: 'marca',
      nodes: [
        { id: 'marca', type: 'etapa', position: p, data: { quadroId: 'q1', colunaId: 'c2' } },
        { id: 'fim', type: 'mensagem', position: p, data: { partes: [{ tipo: 'texto', texto: 'Pronto!' }] } },
      ],
      edges: [{ id: 'e', source: 'marca', target: 'fim' }],
    })

    const r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    expect(r.acoes).toContainEqual({ tipo: 'mover_etapa', quadroId: 'q1', colunaId: 'c2' })
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === 'Pronto!')).toBe(true)
  })

  it('etapa não escolhida não move ninguém, e a conversa não morre', () => {
    // É o grafo publicado antes de a etapa ser apagada. O `validar()` recusa
    // publicar assim; aqui a defesa é para o que já está no ar — e seguir é o
    // único desfecho aceitável, porque a alternativa é a conversa de alguém
    // morrer por causa de uma arrumação no quadro.
    const fluxo = fluxoSchema.parse({
      inicio: 'marca',
      nodes: [
        { id: 'marca', type: 'etapa', position: p, data: { quadroId: '', colunaId: '' } },
        { id: 'fim', type: 'mensagem', position: p, data: { partes: [{ tipo: 'texto', texto: 'Segue.' }] } },
      ],
      edges: [{ id: 'e', source: 'marca', target: 'fim' }],
    })

    const r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    expect(r.acoes.some((a) => a.tipo === 'mover_etapa')).toBe(false)
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === 'Segue.')).toBe(true)
  })
})

describe('o handoff se despede antes de transferir', () => {
  function comHandoff(data: Record<string, unknown>) {
    const fluxo = fluxoSchema.parse({
      inicio: 'h',
      nodes: [{ id: 'h', type: 'handoff', position: p, data }],
      edges: [],
    })
    return executar(fluxo, sessaoNova(), { tipo: 'inicio' }).acoes
  }

  it('manda as mensagens em ordem, todas antes de a conversa mudar de mão', () => {
    const acoes = comHandoff({
      motivo: 'fim do bot',
      mensagens: [
        'Vou te passar para um atendente. Só um instante!',
        'Obrigado por falar comigo — de 0 a 10, que nota você dá para este atendimento?',
      ],
    })

    expect(textos(acoes)).toEqual([
      'Vou te passar para um atendente. Só um instante!',
      'Obrigado por falar comigo — de 0 a 10, que nota você dá para este atendimento?',
    ])
    // A transferência é a última ação: o que fosse depois dela chegaria com a
    // conversa já nas mãos do time.
    expect(tipos(acoes).at(-1)).toBe('transferir_humano')
  })

  it('as mensagens interpolam, como sempre interpolaram', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'h',
      nodes: [{ id: 'h', type: 'handoff', position: p, data: { mensagens: ['Já vai, {{nome}}!'] } }],
      edges: [],
    })
    const sessao: Sessao = { ...sessaoNova(), vars: { nome: 'Ana' } }
    const acoes = executar(fluxo, sessao, { tipo: 'inicio' }).acoes
    expect(textos(acoes)).toEqual(['Já vai, Ana!'])
  })

  it('mensagem em branco no meio não vira mensagem vazia no WhatsApp', () => {
    const acoes = comHandoff({ mensagens: ['Já te passo.', '   ', 'Obrigado!'] })
    expect(textos(acoes)).toEqual(['Já te passo.', 'Obrigado!'])
  })

  it('o formato antigo (uma `mensagem` só) continua produzindo o que produzia', () => {
    // `flow_versions` é imutável: a conversa que começou antes desta mudança
    // segue rodando o grafo de antes.
    const acoes = comHandoff({ mensagem: 'Vou te passar para o time.' })
    expect(textos(acoes)).toEqual(['Vou te passar para o time.'])
    expect(tipos(acoes).at(-1)).toBe('transferir_humano')
  })
})

/**
 * O bloco de Voltar.
 *
 * Existe porque quem monta fluxo desenhou o botão "Voltar ao Menu", procurou o
 * bloco que fizesse isso e não achou: *"quando tiver essa opção tem que ter
 * algum bloco que consegue jogar diretamente para reiniciar o fluxo"*.
 *
 * O que precisa ser provado aqui é que ele **desvia** — não manda ação nenhuma
 * para o servidor resolver — e que os três jeitos de desenhá-lo errado não
 * prendem ninguém.
 */
describe('o bloco de voltar', () => {
  const p = { x: 0, y: 0 }
  const msg = (id: string, texto: string) => ({
    id,
    type: 'mensagem',
    position: p,
    data: { partes: [{ tipo: 'texto', texto }] },
  })

  /** Um menu que pergunta, e uma opção que volta para ele. */
  const comVoltar = (destino: string) =>
    fluxoSchema.parse({
      inicio: 'menu',
      nodes: [
        {
          id: 'menu',
          type: 'pergunta',
          position: p,
          data: {
            texto: 'O que você quer?',
            opcoes: [
              { id: 'a', rotulo: 'Ver preço' },
              { id: 'b', rotulo: 'Falar com alguém' },
            ],
          },
        },
        msg('preco', 'Custa R$ 100.'),
        { id: 'volta', type: 'voltar', position: p, data: { destino, rotulo: '' } },
        { id: 'gente', type: 'handoff', position: p, data: { motivo: 'x', mensagem: 'Já chamo.' } },
      ],
      edges: [
        { id: 'e1', source: 'menu', sourceHandle: 'a', target: 'preco' },
        { id: 'e2', source: 'menu', sourceHandle: 'b', target: 'gente' },
        { id: 'e3', source: 'preco', target: 'volta' },
      ],
    })

  it('volta ao início do fluxo quando o destino é vazio', () => {
    const fluxo = comVoltar('')

    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    // Mandou o preço **e** voltou a fazer a pergunta, tudo no mesmo passo.
    const ditos = r.acoes.flatMap((a) =>
      a.tipo === 'enviar_texto' || a.tipo === 'enviar_opcoes' ? [a.texto] : [],
    )
    expect(ditos).toContain('Custa R$ 100.')
    expect(ditos).toContain('O que você quer?')
    expect(r.sessao.noAtual).toBe('menu')
  })

  it('volta para o bloco escolhido, e não só para o início', () => {
    const fluxo = comVoltar('preco')

    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    // `preco` → `volta` → `preco` gira até o teto de passos e vai para uma
    // pessoa: é um ciclo sem nenhuma pergunta no meio.
    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })

  /*
   * **Não manda ação nenhuma.** É o que separa este bloco do de ir-fluxo: lá o
   * servidor precisa resolver o salto, aqui o motor só continua de outro nó.
   */
  it('não pede nada ao servidor — é desvio, não ação', () => {
    const fluxo = comVoltar('')

    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    expect(r.acoes.some((a) => a.tipo === 'ir_para_fluxo')).toBe(false)
  })

  /*
   * Destino apagado segue em frente em vez de travar.
   *
   * `validar()` recusa publicar assim, então isto só alcança grafo que já
   * estava no ar quando o bloco de destino foi apagado — e conversa viva não
   * pode morrer por causa de uma edição no editor.
   */
  it('destino que não existe mais não trava a conversa', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'volta',
      nodes: [
        { id: 'volta', type: 'voltar', position: p, data: { destino: 'apagado', rotulo: '' } },
        msg('depois', 'Segue.'),
      ],
      edges: [{ id: 'e', source: 'volta', target: 'depois' }],
    })

    const r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === 'Segue.')).toBe(true)
  })

  /*
   * As variáveis sobrevivem ao voltar, e é decisão.
   *
   * Um "voltar" que esquece tudo é indistinguível de desligar e ligar a
   * conversa — e quem voltou ao menu depois de dizer o nome não quer dizer o
   * nome de novo.
   */
  it('o que já foi guardado continua guardado', () => {
    const fluxo = comVoltar('')

    let r = executar(fluxo, { ...sessaoNova(), vars: { nome: 'Marina' } }, { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    expect(r.sessao.vars.nome).toBe('Marina')
  })
})

describe('valor técnico da opção desenhada à mão', () => {
  const fluxoCom = (opcoes: unknown[]) =>
    fluxoSchema.parse({
      inicio: 'q',
      nodes: [
        {
          id: 'q',
          type: 'pergunta',
          position: { x: 0, y: 0 },
          data: { texto: 'Que tipo?', salvarEm: 'tipo', salvarValorEm: 'tipo_id', opcoes },
        },
        { id: 'fim', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'ok' } },
      ],
      edges: [
        { id: 'e1', source: 'q', sourceHandle: 'a', target: 'fim' },
        { id: 'e2', source: 'q', sourceHandle: 'b', target: 'fim' },
      ],
    })

  it('guarda o valor da opção, e o rótulo separado — sem lista de fora', () => {
    const fluxo = fluxoCom([
      { id: 'a', rotulo: 'Vídeo institucional', valor: 'institucional' },
      { id: 'b', rotulo: 'Social media', valor: 'social' },
    ])

    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    expect(r.sessao.vars.tipo).toBe('Vídeo institucional')
    expect(r.sessao.vars.tipo_id).toBe('institucional')
  })

  it('sem valor escrito, guarda o rótulo — é o que todo grafo já publicado faz', () => {
    const fluxo = fluxoCom([
      { id: 'a', rotulo: 'Vídeo institucional' },
      { id: 'b', rotulo: 'Social media' },
    ])

    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'opcao', opcaoId: 'a' })

    expect(r.sessao.vars.tipo_id).toBe('')
  })
})

describe('a foto como resposta', () => {
  const fluxoCom = (dadosDaPergunta: object, ligarSaidaDeMidia: boolean) =>
    fluxoSchema.parse({
      inicio: 'q',
      nodes: [
        {
          id: 'q',
          type: 'pergunta',
          position: { x: 0, y: 0 },
          data: { texto: 'Manda a foto da receita', ...dadosDaPergunta },
        },
        { id: 'cotar', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'Recebi!' } },
        { id: 'texto', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'obrigado' } },
      ],
      edges: [
        { id: 'e1', source: 'q', target: 'texto' },
        ...(ligarSaidaDeMidia
          ? [{ id: 'e2', source: 'q', sourceHandle: 'midia', target: 'cotar' }]
          : []),
      ],
    })

  it('sem saída ligada, foto continua indo para uma pessoa — como sempre foi', () => {
    const fluxo = fluxoCom({ salvarEm: 'resposta' }, false)
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'midia', formato: 'image', midiaId: 'wamid.1' })

    expect(r.sessao.status).toBe('humano')
    expect(r.acoes.some((a) => a.tipo === 'transferir_humano')).toBe(true)
  })

  it('com a saída ligada, a conversa segue e guarda a referência do arquivo', () => {
    const fluxo = fluxoCom({ aceitaMidia: true, salvarMidiaEm: 'receita' }, true)
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'midia', formato: 'image', midiaId: 'wamid.abc' })

    expect(r.sessao.status).not.toBe('humano')
    expect(r.sessao.vars.receita).toBe('wamid.abc')
    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === 'Recebi!')).toBe(true)
  })

  it('a legenda da foto conta como a resposta escrita', () => {
    const fluxo = fluxoCom(
      { aceitaMidia: true, salvarMidiaEm: 'receita', salvarEm: 'observacao' },
      true,
    )
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, {
      tipo: 'midia',
      formato: 'image',
      midiaId: 'wamid.abc',
      legenda: 'é para o meu filho',
    })

    expect(r.sessao.vars.observacao).toBe('é para o meu filho')
  })

  it('sem id (simulador), guarda o formato em vez de vazio', () => {
    const fluxo = fluxoCom({ aceitaMidia: true, salvarMidiaEm: 'receita' }, true)
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'midia', formato: 'image' })

    expect(r.sessao.vars.receita).toBe('image')
  })

  it('a saída de mídia não é confundida com a continuação normal da pergunta', () => {
    const fluxo = fluxoCom({ aceitaMidia: true }, true)
    let r = executar(fluxo, sessaoNova(), { tipo: 'inicio' })
    r = executar(fluxo, r.sessao, { tipo: 'texto', texto: 'oi' })

    expect(r.acoes.some((a) => a.tipo === 'enviar_texto' && a.texto === 'obrigado')).toBe(true)
  })
})

describe('condição que compara número e variável', () => {
  const fluxoCom = (dados: object) =>
    fluxoSchema.parse({
      inicio: 'c',
      nodes: [
        { id: 'c', type: 'condicao', position: { x: 0, y: 0 }, data: dados },
        { id: 'sim', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'passou' } },
        { id: 'nao', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'não passou' } },
      ],
      edges: [
        { id: 'e1', source: 'c', sourceHandle: 'verdadeiro', target: 'sim' },
        { id: 'e2', source: 'c', sourceHandle: 'falso', target: 'nao' },
      ],
    })

  const rodar = (dados: object, vars: Record<string, string>) => {
    const r = executar(fluxoCom(dados), { ...sessaoNova(), vars }, { tipo: 'inicio' })
    return r.acoes.find((a) => a.tipo === 'enviar_texto')?.texto
  }

  it('compara número de verdade, e não texto', () => {
    const dados = { variavel: 'faltas', operador: 'maior', valor: '9' }
    expect(rodar(dados, { faltas: '10' })).toBe('passou')
    expect(rodar(dados, { faltas: '2' })).toBe('não passou')
  })

  it('compara duas coisas da conversa', () => {
    const dados = { variavel: 'orcamento', operador: 'maior', valor: '{{preco}}' }
    expect(rodar(dados, { orcamento: '500000', preco: '420000' })).toBe('passou')
    expect(rodar(dados, { orcamento: '300000', preco: '420000' })).toBe('não passou')
  })

  it('aceita a vírgula que se digita em português', () => {
    const dados = { variavel: 'valor', operador: 'menor', valor: '10,5' }
    expect(rodar(dados, { valor: '9,75' })).toBe('passou')
  })

  it('lado que não é número é falso, e não uma ordem inventada', () => {
    const dados = { variavel: 'quando', operador: 'maior', valor: '3' }
    expect(rodar(dados, { quando: 'amanhã' })).toBe('não passou')
  })

  it('texto fixo continua comparando como texto', () => {
    const dados = { variavel: 'plano', operador: 'igual', valor: 'mensal' }
    expect(rodar(dados, { plano: 'Mensal' })).toBe('passou')
  })
})

describe('o atraso e o "digitando"', () => {
  /**
   * A espera atravessa a borda do bloco.
   *
   * "texto → esperar 1s" ligado numa Pergunta é o desenho que quem opera
   * escreve sozinho, e ele produzia pausa sem "digitando": a espera morria no
   * fim do bloco de mensagem e nunca chegava a um envio.
   */
  const comAtrasoNoFim = (): Fluxo =>
    fluxoSchema.parse({
      inicio: 'msg',
      nodes: [
        {
          id: 'msg',
          type: 'mensagem',
          position: { x: 0, y: 0 },
          data: {
            partes: [
              { tipo: 'texto', texto: 'O Personal pilates é...' },
              { tipo: 'atraso', segundos: 1 },
            ],
          },
        },
        {
          id: 'perg',
          type: 'pergunta',
          position: { x: 0, y: 160 },
          data: {
            texto: 'Quer agendar?',
            salvarEm: 'resposta',
            opcoes: [
              { id: 'a', rotulo: 'Agendar aula' },
              { id: 'b', rotulo: 'Agora não' },
            ],
          },
        },
      ],
      edges: [{ id: 'e', source: 'msg', target: 'perg' }],
    })

  it('leva a espera do fim do bloco até o menu da pergunta', () => {
    const r = executar(comAtrasoNoFim(), sessaoNova(), { tipo: 'inicio' })

    const texto = r.acoes.find((a) => a.tipo === 'enviar_texto')
    const menu = r.acoes.find((a) => a.tipo === 'enviar_opcoes')

    // O texto sai na hora: o atraso vem depois dele no desenho.
    expect(texto && 'atrasoMs' in texto ? texto.atrasoMs : undefined).toBeUndefined()
    expect(menu && 'atrasoMs' in menu ? menu.atrasoMs : undefined).toBe(1_000)
  })
})
