import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProvedorDeCitacao } from './citacao'
import { RodapeDaMensagem } from './rodape-da-mensagem'

/**
 * O rodapé da bolha precisa **aparecer**, e aparecer inteiro onde dá.
 *
 * Este teste existe por um susto real, de 15/set/2026: a suspeita era de que a
 * barra sumia de todas as mensagens em produção. A causa não era essa, mas o
 * componente antigo tinha mesmo uma guarda `if (!citacao) return null` que
 * apagava a barra inteira, calada, quando o provedor não alcançava a árvore. O
 * comentário dele dizia o contrário: que só o botão de citar sumiria.
 *
 * Agora é o que o comentário sempre prometeu, e este arquivo é o que mantém a
 * promessa. Sem `.tsx` no include do vitest, é `createElement` na mão, feio, e
 * ainda assim mais barato que descobrir de novo em produção.
 *
 * Desde 01/out/2026 reagir e citar moram no menu da seta da bolha, como no
 * WhatsApp, e o menu só abre no clique. Sem DOM para clicar, o teste desenha
 * com `menuAbertoDeInicio`; a seta em si é o que tem que aparecer sempre.
 */

const SETA = 'Mais opções desta mensagem'
/** O item do menu termina no texto dele, logo depois do ícone. */
const REAGIR = /<\/svg> Reagir<\/button>/
const CITAR = /<\/svg> Responder<\/button>/

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
    mensagemId: 'm1',
    favorita: false,
    menuAbertoDeInicio: true,
    ...extra,
  } as never)
}

describe('o rodapé da mensagem', () => {
  it('mostra reagir e citar dentro do provedor', () => {
    const html = renderToStaticMarkup(createElement(ProvedorDeCitacao, null, rodape()))

    expect(html).toMatch(REAGIR)
    expect(html).toMatch(CITAR)
  })

  /*
   * O arranjo real da página: os filhos são criados ANTES do provedor existir
   * (um Server Component renderiza `Historico` e o entrega como `children`).
   */
  it('continua aparecendo quando os filhos nascem fora do provedor', () => {
    const filhos = rodape()
    const html = renderToStaticMarkup(createElement(ProvedorDeCitacao, null, filhos))
    expect(html).toMatch(REAGIR)
    expect(html).toMatch(CITAR)
  })

  /* Sem provedor, reagir fica e só citar sai. Era a promessa que o código quebrava. */
  it('sem provedor de citação, reagir sobrevive', () => {
    const html = renderToStaticMarkup(rodape())

    expect(html).toMatch(REAGIR)
    expect(html).not.toMatch(CITAR)
  })

  it('esconde o reagir depois dos 30 dias, e mantém o citar', () => {
    const html = renderToStaticMarkup(
      createElement(ProvedorDeCitacao, null, rodape({ podeReagir: false })),
    )

    expect(html).not.toMatch(REAGIR)
    expect(html).toMatch(CITAR)
  })

  /* A seta é a porta do menu: fechado ou sem provedor, ela continua lá. */
  it('a seta do menu aparece sempre, mesmo fechado e fora do provedor', () => {
    const html = renderToStaticMarkup(rodape({ menuAbertoDeInicio: false }))

    expect(html).toContain(SETA)
    expect(html).not.toMatch(REAGIR)
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

    expect(html).not.toMatch(REAGIR)
    expect(html).not.toMatch(CITAR)
  })
})
