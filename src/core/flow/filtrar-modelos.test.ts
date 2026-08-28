import { describe, expect, it } from 'vitest'
import { contarEtiquetas, filtrarModelos } from './filtrar-modelos'

const MODELOS = [
  {
    id: 'nps',
    nome: 'Pesquisa de satisfação (NPS)',
    resumo: 'Nota de 0 a 10 depois do atendimento.',
    etiquetas: ['WhatsApp', 'Pós-venda'],
  },
  {
    id: 'sdr',
    nome: 'Qualificar lead antes do time comercial',
    resumo: 'Três perguntas e só quem tem verba chega ao vendedor.',
    etiquetas: ['WhatsApp', 'SDR', 'Vendas'],
  },
  {
    id: 'agenda',
    nome: 'Lembrete de aula',
    resumo: 'Lembra da aula e deixa confirmar.',
    etiquetas: ['WhatsApp', 'Agenda'],
  },
] as const

describe('filtrarModelos — a busca da galeria', () => {
  it('sem termo e sem etiqueta, devolve tudo', () => {
    expect(filtrarModelos(MODELOS, '').map((m) => m.id)).toEqual(['nps', 'sdr', 'agenda'])
  })

  it('ignora acento e caixa', () => {
    // Quem digita "pos venda" tem que achar "Pós-venda", senão a busca ensina a
    // não usar busca.
    expect(filtrarModelos(MODELOS, 'pos venda').map((m) => m.id)).toEqual(['nps'])
    expect(filtrarModelos(MODELOS, 'SATISFAÇÃO').map((m) => m.id)).toEqual(['nps'])
  })

  it('acha por etiqueta escrita no campo de busca', () => {
    expect(filtrarModelos(MODELOS, 'sdr').map((m) => m.id)).toEqual(['sdr'])
  })

  it('toda palavra precisa casar, e podem casar em campos diferentes', () => {
    // "agenda" é etiqueta e "lembrete" é nome: as duas juntas ainda acham.
    expect(filtrarModelos(MODELOS, 'agenda lembrete').map((m) => m.id)).toEqual(['agenda'])
    // Com "ou", digitar mais palavras traria mais resultado — o contrário do
    // que quem digita espera.
    expect(filtrarModelos(MODELOS, 'lembrete vendedor')).toEqual([])
  })

  it('etiquetas marcadas se somam com "e"', () => {
    expect(filtrarModelos(MODELOS, '', ['WhatsApp']).map((m) => m.id)).toEqual([
      'nps',
      'sdr',
      'agenda',
    ])
    expect(filtrarModelos(MODELOS, '', ['WhatsApp', 'SDR']).map((m) => m.id)).toEqual(['sdr'])
    expect(filtrarModelos(MODELOS, '', ['SDR', 'Agenda'])).toEqual([])
  })

  it('termo e etiqueta trabalham juntos', () => {
    expect(filtrarModelos(MODELOS, 'lembrete', ['Agenda']).map((m) => m.id)).toEqual(['agenda'])
    expect(filtrarModelos(MODELOS, 'lembrete', ['SDR'])).toEqual([])
  })
})

describe('contarEtiquetas — o número no chip', () => {
  it('conta e esconde etiqueta que não tem nenhum modelo', () => {
    expect(contarEtiquetas(MODELOS, ['WhatsApp', 'SDR', 'Instagram'])).toEqual([
      { etiqueta: 'WhatsApp', quantos: 3 },
      { etiqueta: 'SDR', quantos: 1 },
    ])
  })
})

describe('sinônimos — o que a pessoa digita e o cartão não diz', () => {
  const cobranca = [
    {
      id: 'cobranca',
      nome: 'Lembrete de pagamento',
      resumo: 'Lembra da parcela em aberto e manda a 2ª via.',
      etiquetas: ['WhatsApp', 'Financeiro'],
      sinonimos: ['cobrança', 'boleto', 'pix'],
    },
  ] as const

  it('acha por palavra que não está no nome nem no resumo', () => {
    // Sem isto, procurar "cobrança" devolvia vazio — e busca que falha no termo
    // mais óbvio ensina a não usar busca.
    expect(filtrarModelos(cobranca, 'cobranca').map((m) => m.id)).toEqual(['cobranca'])
    expect(filtrarModelos(cobranca, 'boleto').map((m) => m.id)).toEqual(['cobranca'])
  })

  it('modelo sem sinônimo continua funcionando', () => {
    expect(filtrarModelos(MODELOS, 'lembrete').map((m) => m.id)).toEqual(['agenda'])
  })
})
