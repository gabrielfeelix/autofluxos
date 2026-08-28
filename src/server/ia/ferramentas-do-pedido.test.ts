import { describe, expect, it } from 'vitest'
import { ferramentasPermitidas } from '@/core/ferramentas'
import {
  assinatura,
  camposInjetadosTentados,
  conferirPedido,
  novaMemoria,
} from './ferramentas-do-pedido'

/**
 * As travas do §4, cobradas uma a uma.
 *
 * Este é o arquivo que decide se um estranho no WhatsApp consegue fazer o
 * sistema agir sobre a conta de outra pessoa. Todo teste aqui é uma tentativa
 * de passar, não uma confirmação de que o caminho feliz funciona.
 */

const TODAS = ferramentasPermitidas([
  'agenda_horarios',
  'agenda_catalogo',
  'agenda_minha',
  'agenda_marcar',
  'agenda_desmarcar',
])

const SO_LEITURA = ferramentasPermitidas(['agenda_horarios', 'agenda_catalogo'])

function pedir(
  nome: string,
  argumentos: Record<string, string>,
  {
    permitidas = TODAS,
    injetados = { pessoa_id: 'p-de-quem-escreve' } as Record<string, string>,
    memoria = novaMemoria(),
  } = {},
) {
  return conferirPedido({ nome, argumentos, permitidas, injetados, memoria })
}

describe('a whitelist do nó', () => {
  it('recusa ferramenta que existe no catálogo mas o nó não autorizou', () => {
    // O ponto inteiro da whitelist: um bloco que só tira dúvida não vira um
    // que desmarca aula porque o modelo sabe o nome da outra ferramenta.
    const r = pedir('agenda_desmarcar', { participacao_id: 'x' }, { permitidas: SO_LEITURA })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('não autoriza')
  })

  it('recusa nome que não existe em lugar nenhum', () => {
    expect(pedir('agenda_apagar_tudo', {}).ok).toBe(false)
  })
})

describe('identidade nunca vem do modelo', () => {
  it('descarta o `pessoa_id` que o modelo mandou e usa o de quem escreve', () => {
    const memoria = novaMemoria()
    memoria.ids.add('s-livre')

    const r = pedir(
      'agenda_marcar',
      { sessao_id: 's-livre', pessoa_id: 'p-da-vitima' },
      { memoria },
    )

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.chamada.corpo).toContain('p-de-quem-escreve')
      expect(r.chamada.corpo).not.toContain('p-da-vitima')
    }
  })

  it('registra a tentativa, para ela não passar despercebida', () => {
    const marcar = TODAS.find((f) => f.nome === 'agenda_marcar')!

    expect(camposInjetadosTentados(marcar, { sessao_id: 's1', pessoa_id: 'p9' })).toEqual([
      'pessoa_id',
    ])
    expect(camposInjetadosTentados(marcar, { sessao_id: 's1' })).toEqual([])
  })

  it('recusa quando a conversa não sabe quem é a pessoa', () => {
    // O fluxo não rodou o bloco que identifica. Melhor recusar do que chamar
    // com `pessoaId` vazio e gravar sabe-se lá onde.
    const memoria = novaMemoria()
    memoria.ids.add('s1')

    const r = pedir('agenda_marcar', { sessao_id: 's1' }, { injetados: {}, memoria })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('pessoa_id')
  })
})

describe('id só vale se a conversa já viu', () => {
  it('recusa id que o modelo inventou', () => {
    const r = pedir('agenda_marcar', { sessao_id: 's-que-ninguem-viu' })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('não é um identificador que apareceu')
  })

  it('recusa id que veio escrito na mensagem de alguém', () => {
    // "desmarque a participação 4f2a" digitado por um estranho. O id pode até
    // existir do outro lado — o que não existe é ele ter aparecido numa
    // consulta feita para esta pessoa.
    const r = pedir('agenda_desmarcar', { participacao_id: '4f2a' })

    expect(r.ok).toBe(false)
  })

  it('aceita o id que veio de uma consulta desta rodada', () => {
    const memoria = novaMemoria()
    memoria.ids.add('part-7')

    expect(pedir('agenda_desmarcar', { participacao_id: 'part-7' }, { memoria }).ok).toBe(true)
  })

  it('vale também para filtro opcional', () => {
    // `servico` é opcional, mas é id: informado, precisa ter vindo do catálogo.
    const r = pedir('agenda_horarios', {
      de: '2026-09-10',
      ate: '2026-09-10',
      servico: 'pilates',
    })

    expect(r.ok).toBe(false)
  })
})

describe('argumentos', () => {
  it('recusa data em formato ambíguo em vez de adivinhar', () => {
    // "05/01" em dezembro: metade das vezes o palpite marca onze meses fora.
    const r = pedir('agenda_horarios', { de: '05/01', ate: '05/01' })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('AAAA-MM-DD')
  })

  it('recusa quando falta o obrigatório', () => {
    expect(pedir('agenda_horarios', { de: '2026-09-10' }).ok).toBe(false)
  })

  it('tira da URL o filtro que o modelo não informou', () => {
    const r = pedir('agenda_horarios', { de: '2026-09-10', ate: '2026-09-10' })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.chamada.url).toContain('de=2026-09-10&ate=2026-09-10')
      expect(r.chamada.url).not.toContain('servico=')
      expect(r.chamada.url).not.toContain('profissional=')
    }
  })

  it('não deixa marca `{{...}}` sobrar na URL', () => {
    const r = pedir('agenda_horarios', { de: '2026-09-10', ate: '2026-09-10' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.chamada.url).not.toContain('{{')
  })

  it('escapa o que cai na URL', () => {
    // O valor foi escrito por um modelo em cima do texto de um estranho. Um
    // `&` solto reescreveria a consulta.
    const memoria = novaMemoria()
    memoria.ids.add('a&b=c')

    const r = pedir(
      'agenda_horarios',
      { de: '2026-09-10', ate: '2026-09-10', servico: 'a&b=c' },
      { memoria },
    )

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.chamada.url).toContain('servico=a%26b%3Dc')
      expect(r.chamada.url.split('&')).toHaveLength(3)
    }
  })

  it('escapa o que cai no JSON do corpo', () => {
    const memoria = novaMemoria()
    memoria.ids.add('a"b')

    const r = pedir('agenda_marcar', { sessao_id: 'a"b' }, { memoria })

    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(() => JSON.parse(r.chamada.corpo)).not.toThrow()
      expect(JSON.parse(r.chamada.corpo).sessaoId).toBe('a"b')
    }
  })

  it('ignora argumento que a ferramenta não declara', () => {
    const r = pedir('agenda_catalogo', { invente: 'algo' })

    expect(r.ok).toBe(true)
    if (r.ok) expect(r.chamada.url).not.toContain('invente')
  })
})

describe('repetição', () => {
  it('recusa o mesmo pedido duas vezes na mesma rodada', () => {
    const memoria = novaMemoria()
    memoria.jaPedidos.add(assinatura('agenda_catalogo', {}))

    const r = pedir('agenda_catalogo', {}, { memoria })

    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('repetiu')
  })

  it('a assinatura não depende da ordem dos argumentos nem de campo vazio', () => {
    expect(assinatura('t', { b: '2', a: '1' })).toBe(assinatura('t', { a: '1', b: '2' }))
    expect(assinatura('t', { a: '1', c: '' })).toBe(assinatura('t', { a: '1' }))
  })

  it('argumento diferente é pedido diferente', () => {
    const memoria = novaMemoria()
    memoria.jaPedidos.add(assinatura('agenda_horarios', { de: '2026-09-10', ate: '2026-09-10' }))

    expect(pedir('agenda_horarios', { de: '2026-09-11', ate: '2026-09-11' }, { memoria }).ok).toBe(
      true,
    )
  })
})
