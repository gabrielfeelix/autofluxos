import { describe, expect, it } from 'vitest'
import { fluxoSchema, LIMITE_LISTA, type Fluxo } from './schema'
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
