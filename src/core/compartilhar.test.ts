import { describe, expect, it } from 'vitest'
import { fluxoSchema, type Fluxo } from './flow/schema'
import {
  avisosDoCompartilhamento,
  diasDoPrazo,
  estadoDoLink,
  hostsExternos,
  limparParaCompartilhar,
  nomeAoImportar,
  resumirFluxo,
  roteiroDoFluxo,
} from './compartilhar'

/**
 * O que sai da conta quando alguém compartilha um fluxo.
 *
 * Estes testes existem por um motivo específico: `limparParaCompartilhar` é a
 * única barreira entre o desenho de um cliente e uma URL pública, e a forma de
 * ela falhar é silenciosa — o campo continua no objeto e ninguém percebe até
 * alguém ler o JSON do outro lado.
 */

function fluxo(nodes: unknown[], edges: unknown[] = [], inicio = 'a'): Fluxo {
  return fluxoSchema.parse({ inicio, nodes, edges })
}

const mensagem = (id: string, texto: string) => ({
  id,
  type: 'mensagem',
  position: { x: 0, y: 0 },
  data: { partes: [{ tipo: 'texto', texto }] },
})

describe('a credencial não viaja no fluxo compartilhado', () => {
  it('tira `conexaoId` de todo bloco de API', () => {
    const original = fluxo([
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: {
          metodo: 'POST',
          url: 'https://api.rd.services/platform/conversions',
          conexaoId: '6f1b0c2e-0000-4000-8000-000000000001',
          aoFalhar: 'seguir',
        },
      },
    ])

    const no = limparParaCompartilhar(original).nodes[0]
    if (no?.type !== 'http') throw new Error('o bloco de API sumiu do fluxo limpo')

    expect(no.data.conexaoId).toBeUndefined()
    expect('conexaoId' in no.data).toBe(false)
    // O resto do bloco continua inteiro: sem método e URL o passo não é um
    // passo, é um bloco vazio que quem importa teria de refazer do zero.
    expect(no.data.url).toBe('https://api.rd.services/platform/conversions')
    expect(no.data.metodo).toBe('POST')
  })

  it('não mexe em bloco que não é de API', () => {
    const original = fluxo([mensagem('a', 'Oi!')])
    expect(limparParaCompartilhar(original)).toEqual(original)
  })
})

describe('os avisos aparecem antes de o link existir', () => {
  it('sempre diz que os textos ficam visíveis', () => {
    const avisos = avisosDoCompartilhamento(fluxo([mensagem('a', 'segredo comercial')]))
    expect(avisos.map((a) => a.codigo)).toContain('TEXTOS_VISIVEIS')
  })

  it('avisa sobre credencial e endereço quando há bloco de API', () => {
    const comApi = fluxo([
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { metodo: 'GET', url: 'https://api.rd.services/x/y?chave=secreta' },
      },
    ])

    const codigos = avisosDoCompartilhamento(comApi).map((a) => a.codigo)
    expect(codigos).toContain('CREDENCIAL_NAO_VIAJA')
    expect(codigos).toContain('ENDERECOS_EXTERNOS')
  })

  it('mostra o host e nunca o caminho — é lá que chave costuma estar', () => {
    const comApi = fluxo([
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { metodo: 'GET', url: 'https://hooks.exemplo.com/webhook/tok3n-secreto' },
      },
    ])

    const aviso = avisosDoCompartilhamento(comApi).find((a) => a.codigo === 'ENDERECOS_EXTERNOS')!
    expect(aviso.mensagem).toContain('hooks.exemplo.com')
    expect(aviso.mensagem).not.toContain('tok3n-secreto')
  })

  it('URL montada com variável não vira host chutado', () => {
    const comVariavel = fluxo([
      {
        id: 'a',
        type: 'http',
        position: { x: 0, y: 0 },
        data: { metodo: 'GET', url: '{{endereco}}/pedidos' },
      },
    ])
    expect(hostsExternos(comVariavel)).toEqual([])
  })

  it('avisa que a IA não viaja', () => {
    const comIa = fluxo([
      { id: 'a', type: 'ia', position: { x: 0, y: 0 }, data: { instrucao: 'responda' } },
    ])
    expect(avisosDoCompartilhamento(comIa).map((a) => a.codigo)).toContain('IA_NAO_VIAJA')
  })
})

describe('o roteiro segue a conversa', () => {
  it('ordena a partir do início, em largura', () => {
    const desenho = fluxo(
      [mensagem('a', 'oi'), mensagem('b', 'meio'), mensagem('c', 'fim')],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    )

    expect(roteiroDoFluxo(desenho).map((l) => l.id)).toEqual(['a', 'b', 'c'])
  })

  it('marca como solto o bloco que ninguém alcança', () => {
    const desenho = fluxo([mensagem('a', 'oi'), mensagem('orfao', 'ninguém chega aqui')])

    const roteiro = roteiroDoFluxo(desenho)
    expect(roteiro.find((l) => l.id === 'a')!.alcancavel).toBe(true)
    expect(roteiro.find((l) => l.id === 'orfao')!.alcancavel).toBe(false)
    // Solto vem por último: a leitura é da conversa, e o que não é conversa
    // vem depois dela.
    expect(roteiro.at(-1)!.id).toBe('orfao')
  })

  it('a pergunta com prazo mostra a saída de quem não respondeu', () => {
    const desenho = fluxo([
      {
        id: 'a',
        type: 'pergunta',
        position: { x: 0, y: 0 },
        data: {
          texto: 'Qual plano?',
          opcoes: [{ id: 'm', rotulo: 'Mensal' }],
          timeoutMinutos: 30,
        },
      },
    ])

    expect(roteiroDoFluxo(desenho)[0]!.saidas).toEqual(['Mensal', 'sem resposta'])
  })

  it('não entra em laço quando o desenho volta para trás', () => {
    const desenho = fluxo(
      [mensagem('a', 'oi'), mensagem('b', 'volta')],
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    )
    expect(roteiroDoFluxo(desenho).map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('o resumo responde o que quem recebe pergunta', () => {
  it('conta blocos e diz se chama alguém', () => {
    const desenho = fluxo([
      mensagem('a', 'oi'),
      {
        id: 'b',
        type: 'handoff',
        position: { x: 0, y: 0 },
        data: { motivo: 'x', mensagem: 'já chamo' },
      },
    ])

    const resumo = resumirFluxo(desenho)
    expect(resumo.blocos).toBe(2)
    expect(resumo.temHandoff).toBe(true)
    expect(resumo.temIa).toBe(false)
  })
})

describe('o estado do link', () => {
  const agora = Date.parse('2026-08-19T12:00:00Z')

  it('revogado ganha de tudo', () => {
    expect(
      estadoDoLink({ expiraEm: null, revogadoEm: '2026-08-18T00:00:00Z' }, agora),
    ).toBe('revogado')
  })

  it('sem prazo vale', () => {
    expect(estadoDoLink({ expiraEm: null, revogadoEm: null }, agora)).toBe('valido')
  })

  it('prazo vencido não vale', () => {
    expect(estadoDoLink({ expiraEm: '2026-08-18T00:00:00Z', revogadoEm: null }, agora)).toBe(
      'expirado',
    )
  })

  it('data ilegível falha fechado', () => {
    // O pior lado do erro aqui é um link que devia estar morto continuar
    // aberto — então data torta vira expirado, nunca válido.
    expect(estadoDoLink({ expiraEm: 'ontem', revogadoEm: null }, agora)).toBe('expirado')
  })
})

describe('detalhes que evitam confusão na conta de destino', () => {
  it('o importado se anuncia, e não se anuncia duas vezes', () => {
    expect(nomeAoImportar('Triagem')).toBe('Triagem (importado)')
    expect(nomeAoImportar('Triagem (importado)')).toBe('Triagem (importado)')
  })

  it('prazo desconhecido cai no padrão, e não no mais permissivo', () => {
    // Um `select` de aba velha não pode produzir o link sem prazo.
    expect(diasDoPrazo('qualquer-coisa')).toBe(30)
    expect(diasDoPrazo('sem-prazo')).toBeNull()
    expect(diasDoPrazo('7')).toBe(7)
  })
})
