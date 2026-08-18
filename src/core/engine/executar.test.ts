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

  it('rótulo comprido é cortado em vez de derrubar a mensagem', () => {
    const r = executar(agenda, comHorarios('quarta-feira às 10h00 com a professora Carol'), {
      tipo: 'inicio',
    })

    const acao = r.acoes.find((a) => a.tipo === 'enviar_opcoes')
    if (acao?.tipo !== 'enviar_opcoes') throw new Error('faltou a pergunta')
    expect(acao.opcoes[0]?.rotulo).toHaveLength(20)
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
