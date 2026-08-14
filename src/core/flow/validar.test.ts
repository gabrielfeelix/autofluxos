import { describe, expect, it } from 'vitest'
import { fluxoSchema, LIMITE_LISTA, noHttpSchema, type Fluxo } from './schema'
import { validar } from './validar'

const p = { x: 0, y: 0 }

/** Menor fluxo que pode ir ao ar: pergunta, e uma saída para gente de verdade. */
function fluxoValido(): Fluxo {
  return fluxoSchema.parse({
    inicio: 'oi',
    nodes: [
      { id: 'oi', type: 'mensagem', position: p, data: { texto: 'Olá!' } },
      {
        id: 'q',
        type: 'pergunta',
        position: p,
        data: {
          texto: 'Quer falar com a gente?',
          salvarEm: 'quer',
          opcoes: [
            { id: 'sim', rotulo: 'Sim' },
            { id: 'nao', rotulo: 'Agora não' },
          ],
        },
      },
      { id: 'humano', type: 'handoff', position: p, data: {} },
      { id: 'tchau', type: 'mensagem', position: p, data: { texto: 'Tudo bem, até mais!' } },
    ],
    edges: [
      { id: 'e0', source: 'oi', target: 'q' },
      { id: 'e1', source: 'q', sourceHandle: 'sim', target: 'humano' },
      { id: 'e2', source: 'q', sourceHandle: 'nao', target: 'tchau' },
    ],
  })
}

const codigos = (lista: { codigo: string }[]) => lista.map((e) => e.codigo)

describe('validar', () => {
  it('aprova um fluxo bem montado', () => {
    const r = validar(fluxoValido())
    expect(r.erros).toEqual([])
    expect(r.ok).toBe(true)
  })

  it('BLOQUEIA fluxo sem nenhuma saída para humano', () => {
    const fluxo = fluxoValido()
    fluxo.nodes = fluxo.nodes.filter((n) => n.id !== 'humano')
    fluxo.edges = fluxo.edges.map((a) => (a.target === 'humano' ? { ...a, target: 'tchau' } : a))

    const r = validar(fluxo)
    expect(r.ok).toBe(false)
    expect(codigos(r.erros)).toContain('SEM_SAIDA_HUMANA')
  })

  it('reclama de opção que não leva a lugar nenhum', () => {
    const fluxo = fluxoValido()
    fluxo.edges = fluxo.edges.filter((a) => a.sourceHandle !== 'nao')

    const r = validar(fluxo)
    expect(codigos(r.erros)).toContain('OPCAO_SEM_SAIDA')
    expect(r.erros.find((e) => e.codigo === 'OPCAO_SEM_SAIDA')?.mensagem).toContain('Agora não')
  })

  it('reclama de nó de início inexistente', () => {
    const fluxo = { ...fluxoValido(), inicio: 'nao-existe' }
    expect(codigos(validar(fluxo).erros)).toContain('SEM_INICIO')
  })

  it('reclama de condição sem as duas saídas', () => {
    const fluxo: Fluxo = fluxoSchema.parse({
      inicio: 'c',
      nodes: [
        { id: 'c', type: 'condicao', position: p, data: { variavel: 'x', operador: 'preenchido' } },
        { id: 'h', type: 'handoff', position: p, data: {} },
      ],
      edges: [{ id: 'e1', source: 'c', sourceHandle: 'verdadeiro', target: 'h' }],
    })

    const erros = codigos(validar(fluxo).erros)
    expect(erros).toContain('CONDICAO_SEM_SAIDA')
  })

  it('reclama de mais opções do que o WhatsApp aceita', () => {
    const demais = LIMITE_LISTA + 2
    const fluxo = {
      inicio: 'q',
      nodes: [
        {
          id: 'q',
          type: 'pergunta' as const,
          position: p,
          data: {
            texto: 'Escolha:',
            opcoes: Array.from({ length: demais }, (_, i) => ({ id: `o${i}`, rotulo: `Op ${i}` })),
          },
        },
        { id: 'h', type: 'handoff' as const, position: p, data: { motivo: 'x', mensagem: 'y' } },
      ],
      edges: Array.from({ length: demais }, (_, i) => ({
        id: `e${i}`,
        source: 'q',
        sourceHandle: `o${i}`,
        target: 'h',
      })),
    } as unknown as Fluxo

    expect(codigos(validar(fluxo).erros)).toContain('OPCOES_DEMAIS')
  })

  it('avisa sobre bloco solto que a conversa nunca alcança', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push({
      id: 'orfao',
      type: 'mensagem',
      position: p,
      data: { texto: 'ninguém me vê' },
    })

    const r = validar(fluxo)
    expect(r.ok).toBe(true) // é aviso, não impede de publicar
    expect(codigos(r.avisos)).toContain('NO_ORFAO')
  })

  it('avisa sobre {{variavel}} que nenhum bloco preenche', () => {
    const fluxo = fluxoValido()
    const oi = fluxo.nodes.find((n) => n.id === 'oi')
    if (oi?.type === 'mensagem') oi.data.texto = 'Olá, {{nome_do_cliente}}!'

    const r = validar(fluxo)
    expect(codigos(r.avisos)).toContain('VARIAVEL_DESCONHECIDA')
  })

  it('não reclama de variável que algum bloco preenche', () => {
    const fluxo = fluxoValido()
    const tchau = fluxo.nodes.find((n) => n.id === 'tchau')
    if (tchau?.type === 'mensagem') tchau.data.texto = 'Beleza, marquei {{quer}}.'

    expect(codigos(validar(fluxo).avisos)).not.toContain('VARIAVEL_DESCONHECIDA')
  })

  it('reclama de bloco de mensagem sem texto', () => {
    const fluxo = fluxoValido()
    const oi = fluxo.nodes.find((n) => n.id === 'oi')
    if (oi?.type === 'mensagem') oi.data.texto = '   '

    expect(codigos(validar(fluxo).erros)).toContain('TEXTO_VAZIO')
  })

  it('reclama de opção sem rótulo', () => {
    const fluxo = fluxoValido()
    const q = fluxo.nodes.find((n) => n.id === 'q')
    if (q?.type === 'pergunta' && q.data.opcoes[0]) q.data.opcoes[0].rotulo = ''

    expect(codigos(validar(fluxo).erros)).toContain('ROTULO_VAZIO')
  })

  it('reclama de rótulo maior do que o WhatsApp mostra', () => {
    const fluxo = fluxoValido()
    const q = fluxo.nodes.find((n) => n.id === 'q')
    if (q?.type === 'pergunta' && q.data.opcoes[0]) {
      q.data.opcoes[0].rotulo = 'um rótulo absurdamente comprido que não cabe'
    }

    expect(codigos(validar(fluxo).erros)).toContain('ROTULO_LONGO')
  })

  it('deixa passar mensagem longa de texto puro, mas barra acima de 4096', () => {
    const fluxo = fluxoValido()
    const m = fluxo.nodes.find((n) => n.type === 'mensagem')
    if (m?.type !== 'mensagem') throw new Error('o fluxo de teste precisa de um nó de mensagem')

    m.data.texto = 'a'.repeat(4096)
    expect(codigos(validar(fluxo).erros)).not.toContain('TEXTO_LONGO')

    m.data.texto = 'a'.repeat(4097)
    expect(codigos(validar(fluxo).erros)).toContain('TEXTO_LONGO')
  })

  it('barra pergunta com opções acima de 1024 — interativa aceita um quarto', () => {
    const fluxo = fluxoValido()
    const q = fluxo.nodes.find((n) => n.id === 'q')
    if (q?.type !== 'pergunta') throw new Error('o fluxo de teste precisa da pergunta "q"')
    expect(q.data.opcoes.length).toBeGreaterThan(0)

    // Caberia numa mensagem de texto puro, e não cabe numa com botões.
    q.data.texto = 'a'.repeat(1025)
    expect(codigos(validar(fluxo).erros)).toContain('TEXTO_LONGO')

    q.data.texto = 'a'.repeat(1024)
    expect(codigos(validar(fluxo).erros)).not.toContain('TEXTO_LONGO')
  })

  it('pergunta sem opção é texto puro, então o teto volta a ser 4096', () => {
    const fluxo = fluxoValido()
    const q = fluxo.nodes.find((n) => n.id === 'q')
    if (q?.type !== 'pergunta') throw new Error('o fluxo de teste precisa da pergunta "q"')

    q.data.opcoes = []
    q.data.texto = 'a'.repeat(2000)

    expect(codigos(validar(fluxo).erros)).not.toContain('TEXTO_LONGO')
  })

  it('reclama de nome de variável com espaço ou acento', () => {
    const fluxo = fluxoValido()
    const q = fluxo.nodes.find((n) => n.id === 'q')
    if (q?.type === 'pergunta') q.data.salvarEm = 'nome do cliente'

    const erro = validar(fluxo).erros.find((e) => e.codigo === 'VARIAVEL_INVALIDA')
    expect(erro?.mensagem).toContain('nome do cliente')
  })

  /**
   * O contrato que o editor depende: rascunho pela metade é estruturalmente
   * válido (o Zod aceita), e é o `validar()` que impede de ir ao ar. Sem isso o
   * editor quebraria a cada campo apagado para redigitar.
   */
  it('aceita rascunho incompleto na estrutura, mas barra na publicação', () => {
    const bruto = {
      inicio: 'a',
      nodes: [
        { id: 'a', type: 'mensagem', position: p, data: { texto: '' } },
        { id: 'h', type: 'handoff', position: p, data: {} },
      ],
      edges: [{ id: 'e', source: 'a', target: 'h' }],
    }

    const analise = fluxoSchema.safeParse(bruto)
    expect(analise.success).toBe(true)

    const r = validar(analise.data as Fluxo)
    expect(r.ok).toBe(false)
    expect(codigos(r.erros)).toContain('TEXTO_VAZIO')
  })

  it('reclama de id repetido', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push({ id: 'oi', type: 'mensagem', position: p, data: { texto: 'de novo' } })

    expect(codigos(validar(fluxo).erros)).toContain('ID_DUPLICADO')
  })
})

describe('IA é plano à parte', () => {
  /** Um fluxo com bloco de IA, válido em tudo o mais. */
  const comIa: Fluxo = {
    inicio: 'duvida',
    nodes: [
      {
        id: 'duvida',
        type: 'ia',
        position: { x: 0, y: 0 },
        data: { instrucao: 'Responda a dúvida do cliente.' },
      },
      {
        id: 'humano',
        type: 'handoff',
        position: { x: 0, y: 100 },
        data: { motivo: 'fim', mensagem: 'Já te passo para alguém.' },
      },
    ],
    edges: [{ id: 'a1', source: 'duvida', target: 'humano' }],
  }

  it('recusa publicar fluxo com IA quando a automação não contratou', () => {
    const r = validar(comIa)
    expect(r.ok).toBe(false)
    expect(r.erros.map((e) => e.codigo)).toContain('IA_NAO_CONTRATADA')
  })

  it('aceita quando a automação tem IA', () => {
    expect(validar(comIa, { iaHabilitada: true }).ok).toBe(true)
  })

  /**
   * O padrão é falhar fechado: quem esquecer de dizer que a automação tem IA vê
   * a publicação ser recusada — o erro barulhento. O contrário seria entregar
   * IA de graça por descuido de chamada.
   */
  it('sem dizer nada, o padrão é recusar', () => {
    expect(validar(comIa, {}).ok).toBe(false)
  })

  it('fluxo sem bloco de IA não é afetado pelo plano', () => {
    expect(validar(fluxoValido(), { iaHabilitada: false }).ok).toBe(true)
    expect(validar(fluxoValido(), { iaHabilitada: true }).ok).toBe(true)
  })
})

describe('schema do nó http', () => {
  it('nasce com os padrões certos quando só a URL é informada', () => {
    const no = noHttpSchema.parse({
      id: 'n1',
      position: { x: 0, y: 0 },
      type: 'http',
      data: { url: 'https://exemplo.com/x' },
    })

    expect(no.data.metodo).toBe('GET')
    expect(no.data.cabecalhos).toEqual([])
    expect(no.data.corpo).toBe('')
    expect(no.data.mapear).toEqual([])
    // Falhar fechado: quem esquecer de escolher não deixa ninguém pendurado.
    expect(no.data.aoFalhar).toBe('humano')
  })

  it('entra na união de nós, então um fluxo com ele é um fluxo válido', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'a',
      nodes: [
        { id: 'a', type: 'http', position: { x: 0, y: 0 }, data: { url: 'https://e.com' } },
      ],
      edges: [],
    })

    expect(fluxo.nodes[0]?.type).toBe('http')
  })
})

describe('validação do nó de API', () => {
  const comHttp = (data: Record<string, unknown>) =>
    fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        { id: 'api', type: 'http', position: { x: 0, y: 0 }, data },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [{ id: 'a1', source: 'api', target: 'humano' }],
    })

  const codigos = (fluxo: Fluxo) => validar(fluxo).erros.map((e) => e.codigo)

  it('recusa URL vazia', () => {
    expect(codigos(comHttp({ url: '' }))).toContain('URL_VAZIA')
  })

  it('recusa URL que não é https', () => {
    expect(codigos(comHttp({ url: 'http://exemplo.com' }))).toContain('URL_INSEGURA')
  })

  it('aceita https', () => {
    expect(codigos(comHttp({ url: 'https://exemplo.com' }))).not.toContain('URL_INSEGURA')
  })

  it('recusa nome de variável inválido no mapeamento', () => {
    const fluxo = comHttp({
      url: 'https://e.com',
      mapear: [{ variavel: 'nome do lead', caminho: 'a' }],
    })
    expect(codigos(fluxo)).toContain('VARIAVEL_INVALIDA')
  })

  it('recusa POST com corpo que não é JSON', () => {
    const fluxo = comHttp({ url: 'https://e.com', metodo: 'POST', corpo: '{ nome: }' })
    expect(codigos(fluxo)).toContain('CORPO_INVALIDO')
  })

  it('aceita POST com corpo que usa {{variavel}} entre aspas', () => {
    const fluxo = comHttp({
      url: 'https://e.com',
      metodo: 'POST',
      corpo: '{"nome": "{{nome}}", "assunto": "quero {{assunto}} agora"}',
    })
    expect(codigos(fluxo)).not.toContain('CORPO_INVALIDO')
    expect(codigos(fluxo)).not.toContain('VARIAVEL_FORA_DE_ASPAS')
  })

  it('recusa variável fora de aspas — vira JSON quebrado no envio', () => {
    // `{"idade": {{idade}}}` parece válido e não é: as variáveis da sessão são
    // sempre texto, então isso vira `{"idade": 34 anos}` na hora de enviar.
    const fluxo = comHttp({
      url: 'https://e.com',
      metodo: 'POST',
      corpo: '{"idade": {{idade}}}',
    })
    expect(codigos(fluxo)).toContain('VARIAVEL_FORA_DE_ASPAS')
  })

  it('recusa nome de variável que interpolar() nunca vai substituir', () => {
    // `{{1abc}}` não casa com o regex de interpolação, então sai literal na
    // requisição. Se o validador usasse um padrão mais frouxo, isso passaria.
    const fluxo = comHttp({
      url: 'https://e.com',
      metodo: 'POST',
      corpo: '{"idade": {{1abc}}}',
    })
    expect(codigos(fluxo)).toContain('CORPO_INVALIDO')
  })

  it('chave escapada não confunde a contagem de aspas', () => {
    const fluxo = comHttp({
      url: 'https://e.com',
      metodo: 'POST',
      corpo: '{"aspas \\" no meio": "{{nome}}"}',
    })
    expect(codigos(fluxo)).not.toContain('VARIAVEL_FORA_DE_ASPAS')
    expect(codigos(fluxo)).not.toContain('CORPO_INVALIDO')
  })

  it('recusa endereço que começa com variável', () => {
    // O host não pode sair do que a pessoa digitou no WhatsApp. O erro
    // específico é HOST_VARIAVEL, que explica melhor do que URL_INSEGURA.
    expect(codigos(comHttp({ url: '{{base}}/pedidos' }))).toContain('HOST_VARIAVEL')
  })

  it('não cobra corpo de GET', () => {
    const fluxo = comHttp({ url: 'https://e.com', metodo: 'GET', corpo: 'nada disso é JSON' })
    expect(codigos(fluxo)).not.toContain('CORPO_INVALIDO')
  })

  it('o que o nó mapeia conta como variável definida do fluxo', () => {
    const fluxo = fluxoSchema.parse({
      inicio: 'api',
      nodes: [
        {
          id: 'api',
          type: 'http',
          position: { x: 0, y: 0 },
          data: { url: 'https://e.com', mapear: [{ variavel: 'situacao', caminho: 's' }] },
        },
        { id: 'diz', type: 'mensagem', position: { x: 0, y: 0 }, data: { texto: 'está {{situacao}}' } },
        { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'a1', source: 'api', target: 'diz' },
        { id: 'a2', source: 'diz', target: 'humano' },
      ],
    })

    expect(validar(fluxo).avisos.map((a) => a.codigo)).not.toContain('VARIAVEL_DESCONHECIDA')
  })

  it('avisa que o cofre de segredos ainda não existe', () => {
    const fluxo = comHttp({ url: 'https://e.com?k={{segredo.token}}' })
    expect(validar(fluxo).avisos.map((a) => a.codigo)).toContain('SEGREDO_INEXISTENTE')
  })
})

describe('o destino da chamada não pode sair da conversa', () => {
  const comUrl = (url: string) =>
    validar(
      fluxoSchema.parse({
        inicio: 'api',
        nodes: [
          { id: 'api', type: 'http', position: { x: 0, y: 0 }, data: { url } },
          { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a1', source: 'api', target: 'humano' }],
      }),
    ).erros.map((e) => e.codigo)

  it('recusa variável no host', () => {
    expect(comUrl('https://{{host}}/pedidos')).toContain('HOST_VARIAVEL')
  })

  it('recusa variável no meio do host', () => {
    expect(comUrl('https://{{cliente}}.exemplo.com/x')).toContain('HOST_VARIAVEL')
  })

  it('recusa variável na porta', () => {
    expect(comUrl('https://exemplo.com:{{porta}}/x')).toContain('HOST_VARIAVEL')
  })

  it('recusa variável no esquema', () => {
    expect(comUrl('{{base}}/pedidos')).toContain('HOST_VARIAVEL')
  })

  it('aceita variável no caminho', () => {
    expect(comUrl('https://exemplo.com/pedido/{{codigo}}')).not.toContain('HOST_VARIAVEL')
  })

  it('aceita variável na consulta', () => {
    expect(comUrl('https://exemplo.com/busca?q={{termo}}')).not.toContain('HOST_VARIAVEL')
  })

  it('aceita URL sem variável nenhuma', () => {
    expect(comUrl('https://exemplo.com/x')).toEqual([])
  })
})

describe('mapeamento precisa dizer o que ler', () => {
  const comMapa = (mapear: { variavel: string; caminho: string }[]) =>
    validar(
      fluxoSchema.parse({
        inicio: 'api',
        nodes: [
          {
            id: 'api',
            type: 'http',
            position: { x: 0, y: 0 },
            data: { url: 'https://e.com', mapear },
          },
          { id: 'humano', type: 'handoff', position: { x: 0, y: 0 }, data: {} },
        ],
        edges: [{ id: 'a1', source: 'api', target: 'humano' }],
      }),
    ).erros.map((e) => e.codigo)

  it('recusa caminho vazio — a variável nunca seria preenchida', () => {
    expect(comMapa([{ variavel: 'situacao', caminho: '' }])).toContain('CAMINHO_VAZIO')
  })

  it('aceita mapeamento completo', () => {
    expect(comMapa([{ variavel: 'situacao', caminho: 'pedido.status' }])).toEqual([])
  })
})

describe('IA sem contexto de negócio não vai ao ar', () => {
  const comBlocoDeIa = fluxoSchema.parse({
    inicio: 'duvida',
    nodes: [
      { id: 'duvida', type: 'ia', position: p, data: { instrucao: 'Responda a dúvida.' } },
      { id: 'humano', type: 'handoff', position: p, data: {} },
    ],
    edges: [{ id: 'a1', source: 'duvida', target: 'humano' }],
  })

  it('bloqueia quando o cliente não escreveu o contexto', () => {
    // O prompt manda responder só com o que está no contexto. Vazio, a IA
    // responde "não sei" a tudo — um bot que parece pronto e nunca responde.
    const r = validar(comBlocoDeIa, { iaHabilitada: true, temContextoDeNegocio: false })
    expect(codigos(r.erros)).toContain('SEM_CONTEXTO_DE_NEGOCIO')
    expect(r.ok).toBe(false)
  })

  it('libera quando o contexto existe', () => {
    const r = validar(comBlocoDeIa, { iaHabilitada: true, temContextoDeNegocio: true })
    expect(codigos(r.erros)).not.toContain('SEM_CONTEXTO_DE_NEGOCIO')
  })

  it('não cobra quando ninguém disse — é o editor validando sem ir ao banco', () => {
    const r = validar(comBlocoDeIa, { iaHabilitada: true })
    expect(codigos(r.erros)).not.toContain('SEM_CONTEXTO_DE_NEGOCIO')
  })

  it('fluxo sem bloco de IA não se importa com contexto', () => {
    const r = validar(fluxoValido(), { temContextoDeNegocio: false })
    expect(codigos(r.erros)).not.toContain('SEM_CONTEXTO_DE_NEGOCIO')
  })
})

describe('pergunta com opções dinâmicas', () => {
  /** Consulta a agenda, mostra o que voltou, e trata o dia sem vaga. */
  function fluxoDinamico(dados: Record<string, unknown> = {}, arestas: unknown[] = []): Fluxo {
    return fluxoSchema.parse({
      inicio: 'consulta',
      nodes: [
        {
          id: 'consulta',
          type: 'http',
          position: p,
          data: {
            metodo: 'GET',
            url: 'https://script.google.com/macros/s/abc/exec',
            mapear: [{ variavel: 'horarios', caminho: 'livres' }],
          },
        },
        {
          id: 'q',
          type: 'pergunta',
          position: p,
          data: { texto: 'Qual horário?', salvarEm: 'horario', opcoesDe: 'horarios', ...dados },
        },
        { id: 'humano', type: 'handoff', position: p, data: {} },
        { id: 'tchau', type: 'mensagem', position: p, data: { texto: 'Sem vaga nesse dia.' } },
      ],
      edges: [
        { id: 'e0', source: 'consulta', target: 'q' },
        { id: 'e1', source: 'q', sourceHandle: 'escolheu', target: 'humano' },
        { id: 'e2', source: 'q', sourceHandle: 'vazio', target: 'tchau' },
        { id: 'e3', source: 'tchau', target: 'humano' },
        ...arestas,
      ],
    })
  }

  it('aprova quando as duas saídas estão ligadas', () => {
    expect(validar(fluxoDinamico()).ok).toBe(true)
  })

  it('recusa sem a saída "vazio" — lista que vem de fora vem vazia', () => {
    const fluxo = fluxoDinamico()
    fluxo.edges = fluxo.edges.filter((a) => a.sourceHandle !== 'vazio')

    expect(codigos(validar(fluxo).erros)).toContain('PERGUNTA_DINAMICA_SEM_SAIDA')
  })

  it('recusa sem a saída "escolheu"', () => {
    const fluxo = fluxoDinamico()
    fluxo.edges = fluxo.edges.filter((a) => a.sourceHandle !== 'escolheu')

    expect(codigos(validar(fluxo).erros)).toContain('PERGUNTA_DINAMICA_SEM_SAIDA')
  })

  it('recusa misturar opção desenhada com opção de variável', () => {
    const fluxo = fluxoDinamico({ opcoes: [{ id: 'x', rotulo: 'Manhã' }] })

    expect(codigos(validar(fluxo).erros)).toContain('OPCOES_MISTURADAS')
  })

  it('não cobra aresta por opção, que é justamente o que não dá para desenhar', () => {
    expect(codigos(validar(fluxoDinamico()).erros)).not.toContain('OPCAO_SEM_SAIDA')
  })

  it('nome de variável torto é recusado', () => {
    const fluxo = fluxoDinamico({ opcoesDe: 'os horarios' })

    expect(codigos(validar(fluxo).erros)).toContain('VARIAVEL_INVALIDA')
  })

  it('avisa quando nenhum bloco preenche a variável das opções', () => {
    const fluxo = fluxoDinamico({ opcoesDe: 'ninguem_preenche' })

    expect(codigos(validar(fluxo).avisos)).toContain('VARIAVEL_DESCONHECIDA')
  })
})

describe('as mensagens dizem de qual bloco estão falando', () => {
  /**
   * As listas de impedimento e aviso são do fluxo inteiro, não do bloco
   * selecionado. Mensagem que começa com "Este bloco" vira, com dois blocos no
   * mesmo estado, duas linhas idênticas — e nenhuma responde qual é qual.
   */
  it('dois blocos soltos viram dois avisos distinguíveis', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push(
      { id: 'orfao1', type: 'mensagem', position: p, data: { texto: 'Promoção de janeiro' } },
      { id: 'orfao2', type: 'mensagem', position: p, data: { texto: 'Aviso de recesso' } },
    )

    const soltos = validar(fluxo).avisos.filter((a) => a.codigo === 'NO_ORFAO')
    expect(soltos).toHaveLength(2)
    expect(soltos[0]?.mensagem).toContain('Promoção de janeiro')
    expect(soltos[1]?.mensagem).toContain('Aviso de recesso')
    expect(soltos[0]?.mensagem).not.toBe(soltos[1]?.mensagem)
  })

  it('bloco sem texto ainda se identifica pelo tipo', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push({ id: 'orfao', type: 'mensagem', position: p, data: { texto: '' } })

    const solto = validar(fluxo).avisos.find((a) => a.codigo === 'NO_ORFAO')
    expect(solto?.mensagem).toContain('bloco de Mensagem')
  })

  it('texto comprido é cortado em vez de virar um parágrafo na lista', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push({
      id: 'orfao',
      type: 'mensagem',
      position: p,
      data: { texto: 'a'.repeat(200) },
    })

    const solto = validar(fluxo).avisos.find((a) => a.codigo === 'NO_ORFAO')
    expect(solto?.mensagem.length).toBeLessThan(110)
    expect(solto?.mensagem).toContain('…')
  })

  it('a API solta se identifica pelo endereço', () => {
    const fluxo = fluxoValido()
    fluxo.nodes.push(
      noHttpSchema.parse({
        id: 'orfao',
        type: 'http',
        position: p,
        data: { metodo: 'GET', url: 'https://viacep.com.br/ws/01310100/json/' },
      }),
    )

    const solto = validar(fluxo).avisos.find((a) => a.codigo === 'NO_ORFAO')
    expect(solto?.mensagem).toContain('viacep')
  })
})
