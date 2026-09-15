import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProvedorDeCitacao } from './citacao'
import { RodapeDaMensagem } from './rodape-da-mensagem'

/**
 * O rodapé da bolha precisa **aparecer**, e aparecer inteiro onde dá.
 *
 * Este teste existe por um susto real, de 15/set/2026: a suspeita era de que a
 * barra sumia de todas as mensagens em produção. A causa não era essa — mas o
 * componente antigo tinha mesmo uma guarda `if (!citacao) return null` que
 * apagava a barra inteira, calada, quando o provedor não alcançava a árvore. O
 * comentário dele dizia o contrário: que só o botão de citar sumiria.
 *
 * Agora é o que o comentário sempre prometeu, e este arquivo é o que mantém a
 * promessa. Sem `.tsx` no include do vitest, é `createElement` na mão — feio, e
 * ainda assim mais barato que descobrir de novo em produção.
 */

function rodape(extra: Record<string, unknown> = {}) {
  return createElement(RodapeDaMensagem, {
    clienteId: 'c1',
    contatoId: 'k1',
    waMessageId: 'wamid-1',
    podeReagir: true,
    reacoes: [],
    nome: 'Maria',
    texto: 'quanto custa?',
    deQuem: 'a Maria',
    nossa: false,
    ...extra,
  } as never)
}

describe('o rodapé da mensagem', () => {
  it('mostra reagir e citar dentro do provedor', () => {
    const html = renderToStaticMarkup(createElement(ProvedorDeCitacao, null, rodape()))

    expect(html).toContain('Reagir a esta mensagem')
    expect(html).toContain('Responder citando esta mensagem')
  })

  /*
   * O arranjo real da página: os filhos são criados ANTES do provedor existir
   * (um Server Component renderiza `Historico` e o entrega como `children`).
   */
  it('continua aparecendo quando os filhos nascem fora do provedor', () => {
    const filhos = rodape()
    expect(renderToStaticMarkup(createElement(ProvedorDeCitacao, null, filhos))).toContain(
      'Reagir a esta mensagem',
    )
  })

  /* Sem provedor, reagir fica e só citar sai. Era a promessa que o código quebrava. */
  it('sem provedor de citação, reagir sobrevive', () => {
    const html = renderToStaticMarkup(rodape())

    expect(html).toContain('Reagir a esta mensagem')
    expect(html).not.toContain('Responder citando esta mensagem')
  })

  it('esconde o reagir depois dos 30 dias, e mantém o citar', () => {
    const html = renderToStaticMarkup(
      createElement(ProvedorDeCitacao, null, rodape({ podeReagir: false })),
    )

    expect(html).not.toContain('Reagir a esta mensagem')
    expect(html).toContain('Responder citando esta mensagem')
  })

  it('desenha a reação de cada lado, dizendo de quem ela é', () => {
    const html = renderToStaticMarkup(
      rodape({
        reacoes: [
          { emoji: '👍', de: 'entrada', id: 'r1' },
          { emoji: '❤️', de: 'saida', id: 'r2' },
        ],
      }),
    )

    expect(html).toContain('Maria reagiu')
    expect(html).toContain('atendimento reagiu')
  })

  /*
   * Saída ainda não confirmada não tem id da Meta: reagir e citar pedem esse
   * id, então os dois botões somem em vez de dar um clique que falharia sempre.
   */
  it('sem id da Meta, não oferece botão nenhum', () => {
    const html = renderToStaticMarkup(
      createElement(ProvedorDeCitacao, null, rodape({ waMessageId: null })),
    )

    expect(html).not.toContain('Reagir a esta mensagem')
    expect(html).not.toContain('Responder citando esta mensagem')
  })
})
