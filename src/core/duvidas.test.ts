import { describe, expect, it } from 'vitest'
import { chaveDaPergunta, ensinarResposta, lerClassificacao, TITULO_DAS_ENSINADAS } from './duvidas'

describe('ensinarResposta', () => {
  it('cria o bloco no fim quando ele não existe', () => {
    const texto = ensinarResposta('== HORÁRIO ==\nDas 9h às 18h.', 'Abre sábado?', 'Sim, das 9h às 12h.')
    expect(texto).toBe(
      `== HORÁRIO ==\nDas 9h às 18h.\n\n== ${TITULO_DAS_ENSINADAS} ==\nPergunta: Abre sábado?\nResposta: Sim, das 9h às 12h.\n`,
    )
  })

  it('acrescenta no bloco existente sem mexer nos outros', () => {
    const antes = `== ${TITULO_DAS_ENSINADAS} ==\nPergunta: A\nResposta: B\n\n== PAGAMENTO ==\nPix.`
    const depois = ensinarResposta(antes, 'C', 'D')
    expect(depois).toContain('Pergunta: A\nResposta: B\n\nPergunta: C\nResposta: D')
    expect(depois).toContain('== PAGAMENTO ==\nPix.')
  })

  it('funciona com o texto vazio', () => {
    expect(ensinarResposta('', 'A', 'B')).toBe(`== ${TITULO_DAS_ENSINADAS} ==\nPergunta: A\nResposta: B\n`)
  })
})

describe('chaveDaPergunta', () => {
  it('junta a mesma pergunta escrita quase igual', () => {
    expect(chaveDaPergunta('Qual o horário?')).toBe(chaveDaPergunta('qual o  horario'))
  })
})

describe('lerClassificacao', () => {
  const conversas = [
    {
      id: 'c1',
      falas: [
        { quem: 'cliente' as const, texto: 'quanto custa?', em: '2026-10-01T10:00:00Z' },
        { quem: 'ia' as const, texto: 'R$ 10', em: '2026-10-01T10:00:05Z' },
      ],
    },
  ]
  const categorias = ['Preço', 'Outros']

  it('aceita o que confere e corrige categoria desconhecida', () => {
    const r = lerClassificacao(
      JSON.stringify({
        duvidas: [
          { conversa: 'c1', fala: 1, categoria: 'preço', tema: 'Preço do produto', pergunta: 'Quanto custa?', resolvida_por: 'ia' },
          { conversa: 'c1', fala: 1, categoria: 'Inventada', tema: 'outra', pergunta: 'x', resolvida_por: 'equipe' },
        ],
      }),
      conversas,
      categorias,
    )
    expect(r).toEqual([
      { conversa: 'c1', categoria: 'Preço', tema: 'preço do produto', pergunta: 'Quanto custa?', resolvidaPor: 'ia', em: '2026-10-01T10:00:00Z' },
      { conversa: 'c1', categoria: 'Outros', tema: 'outra', pergunta: 'x', resolvidaPor: 'equipe', em: '2026-10-01T10:00:00Z' },
    ])
  })

  it('descarta fala que não é do cliente, conversa inexistente e JSON quebrado', () => {
    const r = lerClassificacao(
      JSON.stringify({
        duvidas: [
          { conversa: 'c1', fala: 2, categoria: 'Preço', tema: 't', pergunta: 'p', resolvida_por: 'ia' },
          { conversa: 'zz', fala: 1, categoria: 'Preço', tema: 't', pergunta: 'p', resolvida_por: 'ia' },
        ],
      }),
      conversas,
      categorias,
    )
    expect(r).toEqual([])
    expect(lerClassificacao('não é json', conversas, categorias)).toEqual([])
  })
})
