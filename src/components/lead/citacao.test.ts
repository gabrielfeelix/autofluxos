import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BarraDaMensagem } from './barra-da-mensagem'
import { ProvedorDeCitacao } from './citacao'

/**
 * A barra de reagir/citar precisa **aparecer**.
 *
 * Este teste existe por um bug real, de 15/set/2026: a barra sumia de todas as
 * mensagens em produção. `BarraDaMensagem` tem uma guarda
 * `if (!citacao) return null` — ela existe para a Ficha, que usa a mesma bolha
 * sem montar citação — e quando o provedor não alcança a árvore, essa guarda
 * apaga a barra inteira, calada.
 *
 * Nada mais pegava isso: typecheck passa, build passa, e a tela simplesmente
 * não tem os botões. Sem `.tsx` no include do vitest, é `createElement` na mão
 * — feio, e ainda assim mais barato que descobrir de novo em produção.
 */

function barra() {
  return createElement(BarraDaMensagem, {
    clienteId: 'c1',
    contatoId: 'k1',
    waMessageId: 'wamid-1',
    podeReagir: true,
    texto: 'quanto custa?',
    deQuem: 'a Maria',
    nossa: false,
  })
}

describe('a barra de ações da mensagem', () => {
  it('aparece quando está dentro do provedor', () => {
    const html = renderToStaticMarkup(createElement(ProvedorDeCitacao, null, barra()))

    expect(html).toContain('Reagir a esta mensagem')
    expect(html).toContain('Responder citando esta mensagem')
  })

  /* Sem provedor ela some inteira — é o que a guarda faz, e o que causou o bug. */
  it('some quando não há provedor nenhum', () => {
    expect(renderToStaticMarkup(barra())).toBe('')
  })
})

/*
 * O arranjo real da página: os filhos são criados ANTES do provedor existir
 * (Server Component renderiza `Historico` e entrega como `children`), e não
 * dentro dele. Se o contexto não alcançasse esse caso, a barra sumiria em
 * produção mesmo com o provedor no lugar certo.
 */
describe('o provedor alcança children criados fora dele', () => {
  it('a barra continua aparecendo', () => {
    const filhos = barra()
    const html = renderToStaticMarkup(createElement(ProvedorDeCitacao, null, filhos))

    expect(html).toContain('Reagir a esta mensagem')
  })
})
