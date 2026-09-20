import { describe, expect, it } from 'vitest'
import { qualificarSdr } from './qualificar-sdr'

/**
 * As duas coisas que o modelo SDR não pode voltar a fazer.
 *
 * Ele é **modelo**: quem clica em "usar este modelo" copia o grafo inteiro para
 * dentro da própria conta. Então um valor de demonstração aqui não fica aqui,
 * ele vira a política de qualificação de uma empresa que nunca o escolheu.
 *
 * O teste lê o grafo em vez de rodar o motor, de propósito: o que precisa ser
 * provado é o que está **escrito** no modelo, que é o que será copiado.
 */
const nos = qualificarSdr.nodes
const arestas = qualificarSdr.edges

describe('o modelo SDR não decide pela empresa', () => {
  /**
   * RB-22. Aqui havia `499`: não saiu de pesquisa, de preço de tabela nem de
   * conversa com cliente, e descartava toda pessoa abaixo desse valor na conta
   * de quem copiasse o modelo.
   */
  it('o limiar de orçamento não filtra ninguém por conta própria', () => {
    const condicao = nos.find((no) => no.id === 'tem-verba')
    expect(condicao).toBeDefined()

    const dados = condicao!.data as { variavel: string; valor: string }
    expect(dados.variavel).toBe('orcamento')

    /*
     * Zero, e não "algum número razoável": qualquer valor positivo aqui é um
     * palpite nosso sobre o negócio de outra pessoa. Errar deixando todo mundo
     * passar custa uma conversa; errar descartando custa o cliente, e ninguém
     * descobre qual foi.
     */
    expect(Number(dados.valor)).toBe(0)
  })

  /**
   * RB-21. Quem respondia "quero falar com alguém" caía no mesmo nó de handoff
   * rotulado `lead qualificado`, então pedir ajuda emitia qualificação positiva
   * por consequência, sem nenhum critério conferido.
   */
  it('pedir para falar com alguém não sai rotulado como qualificado', () => {
    const aresta = arestas.find((e) => e.source === 'quer-falar' && e.sourceHandle === 'sim')
    expect(aresta).toBeDefined()

    const destino = nos.find((no) => no.id === aresta!.target)
    expect(destino?.type).toBe('handoff')

    const motivo = (destino!.data as { motivo: string }).motivo
    // A passagem ao humano continua acontecendo; o que ela não faz é afirmar
    // uma qualificação que ninguém avaliou.
    expect(motivo).not.toContain('qualificado ·')
    expect(motivo).toContain('pediu para falar')
  })

  /** E o caminho que **passou** pelos critérios continua dizendo que passou. */
  it('quem passou pelos critérios continua saindo como qualificado', () => {
    const aresta = arestas.find((e) => e.source === 'aviso')
    const destino = nos.find((no) => no.id === aresta!.target)
    expect((destino!.data as { motivo: string }).motivo).toContain('lead qualificado')
  })

  /** Os dois handoffs são nós distintos: fundi-los recria o defeito. */
  it('são dois handoffs, e não um', () => {
    const handoffs = nos.filter((no) => no.type === 'handoff')
    expect(handoffs).toHaveLength(2)
  })

  /**
   * O modelo não pode ficar com destino solto: uma aresta que aponta para um nó
   * inexistente quebra a conversa no meio, e só aparece quando alguém usa.
   */
  it('nenhuma aresta aponta para nó que não existe', () => {
    const ids = new Set(nos.map((no) => no.id))
    for (const aresta of arestas) {
      expect(ids.has(aresta.source), `origem ${aresta.source}`).toBe(true)
      expect(ids.has(aresta.target), `destino ${aresta.target}`).toBe(true)
    }
  })
})
