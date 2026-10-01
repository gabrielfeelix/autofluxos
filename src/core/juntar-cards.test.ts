import { describe, expect, it } from 'vitest'
import type { Acao } from './engine/types'
import type { ProdutoDaLoja } from './loja'
import { juntarFraseAosCards, juntarTextosSeguidos, semElogioDeAbertura, semMarcacaoDeCard, semRepetirOsCards, TETO_DA_BOLHA_JUNTADA } from './juntar-cards'

const produto = (id: string, extra: Partial<ProdutoDaLoja> = {}): ProdutoDaLoja => ({
  produtoId: id,
  nome: `Produto ${id}`,
  emEstoque: true,
  foto: 'https://cdn/f.jpg',
  link: 'https://loja/p',
  ...extra,
})
const comFoto = (p: ProdutoDaLoja) => Boolean(p.foto && p.link)

describe('juntarFraseAosCards', () => {
  it('a frase seguida dos cards vira uma ação só', () => {
    const acoes: Acao[] = [
      { tipo: 'enviar_texto', texto: 'Veja estes:' },
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2')] },
      { tipo: 'enviar_texto', texto: 'Depois' },
    ]
    expect(juntarFraseAosCards(acoes, comFoto)).toEqual([
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2')], texto: 'Veja estes:' },
      { tipo: 'enviar_texto', texto: 'Depois' },
    ])
  })

  it('não junta quando algum produto não sai como card', () => {
    const acoes: Acao[] = [
      { tipo: 'enviar_texto', texto: 'Veja:' },
      { tipo: 'enviar_produtos', produtos: [produto('1'), produto('2', { foto: undefined })] },
    ]
    expect(juntarFraseAosCards(acoes, comFoto)).toEqual(acoes)
  })

  it('não junta frase comprida nem frase que espera antes de sair', () => {
    const cards: Acao = { tipo: 'enviar_produtos', produtos: [produto('1')] }
    const longa: Acao[] = [{ tipo: 'enviar_texto', texto: 'x'.repeat(900) }, cards]
    const espera: Acao[] = [{ tipo: 'enviar_texto', texto: 'Oi', atrasoMs: 1000 }, cards]
    expect(juntarFraseAosCards(longa, comFoto)).toEqual(longa)
    expect(juntarFraseAosCards(espera, comFoto)).toEqual(espera)
  })
})

describe('juntarTextosSeguidos', () => {
  const texto = (t: string, atrasoMs?: number): Acao => ({ tipo: 'enviar_texto', texto: t, ...(atrasoMs ? { atrasoMs } : {}) })
  const pergunta = (t: string): Acao => ({
    tipo: 'enviar_opcoes',
    texto: t,
    formato: 'botoes',
    opcoes: [{ id: 'a', rotulo: 'Sim' }],
  })

  it('junta texto com texto e texto com a pergunta', () => {
    expect(juntarTextosSeguidos([texto('Segue o manual.'), texto('Precisa de mais algo?')])).toEqual([
      texto('Segue o manual.\n\nPrecisa de mais algo?'),
    ])
    expect(juntarTextosSeguidos([texto('Olá!'), pergunta('Como posso ajudar?')])).toEqual([
      pergunta('Olá!\n\nComo posso ajudar?'),
    ])
  })

  it('passa por cima de ação silenciosa, mas não de atraso nem do teto', () => {
    expect(
      juntarTextosSeguidos([texto('a'), { tipo: 'salvar_campo', campo: 'x', valor: 'y' }, texto('b')]),
    ).toEqual([texto('a\n\nb'), { tipo: 'salvar_campo', campo: 'x', valor: 'y' }])
    expect(juntarTextosSeguidos([texto('a'), texto('b', 2000)])).toHaveLength(2)
    const longo = 'x'.repeat(TETO_DA_BOLHA_JUNTADA)
    expect(juntarTextosSeguidos([texto(longo), texto('b')])).toHaveLength(2)
  })
})

describe('semRepetirOsCards', () => {
  it('tira nome, preço e link que o card já mostra, e deixa a explicação', () => {
    const produto = {
      produtoId: '1',
      nome: 'Mouse Pad Desk PCYES Mat Exclusive Bordo 800x400mm 2mm PMPEXDR',
      preco: 69.9,
      emEstoque: true,
      link: 'https://www.pcyes.com.br/mouse-pad-desk',
    }
    const texto =
      'O Mouse Pad Desk PCYES é excelente para dar mais espaço.\n\nMouse Pad Desk PCYES Mat Exclusive Bordo 800x400mm 2mm PMPEXDR\nR$ 69,90, em estoque\nhttps://www.pcyes.com.br/mouse-pad-desk'
    expect(semRepetirOsCards(texto, [produto])).toBe('O Mouse Pad Desk PCYES é excelente para dar mais espaço.')
  })
})

describe('semMarcacaoDeCard', () => {
  it('tira o "[Card: ...]" que o modelo inventou e fecha a frase que apontava para ele', () => {
    const texto =
      'Ela está disponível em nosso site e você pode finalizar a compra por aqui:\n\n' +
      '[Card: Placa de Vídeo PCYES RTX 3050 - R$ 1.509,00]\n\n' +
      'Posso te ajudar com mais alguma dúvida?'
    expect(semMarcacaoDeCard(texto)).toBe(
      'Ela está disponível em nosso site e você pode finalizar a compra por aqui.\n\nPosso te ajudar com mais alguma dúvida?',
    )
  })

  it('não mexe em colchete que não é rótulo de card', () => {
    expect(semMarcacaoDeCard('Use o código [VIP] no carrinho.')).toBe('Use o código [VIP] no carrinho.')
  })
})

describe('semElogioDeAbertura', () => {
  it('tira o elogio que abre a resposta (Guto, PCYES)', () => {
    expect(semElogioDeAbertura('Essa é uma excelente escolha para um setup gamer com foco em eficiência e estilo! Ela está disponível no site.')).toBe('Ela está disponível no site.')
    expect(semElogioDeAbertura('Ótima escolha! ela tem 4GB.')).toBe('Ela tem 4GB.')
  })
  it('deixa o texto quando não há elogio, ou quando o elogio é tudo', () => {
    expect(semElogioDeAbertura('Boa tarde! Temos sim.')).toBe('Boa tarde! Temos sim.')
    expect(semElogioDeAbertura('Ótima escolha!')).toBe('Ótima escolha!')
  })
})
