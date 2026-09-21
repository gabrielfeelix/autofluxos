import { describe, expect, it } from 'vitest'
import { organizar, type ArestaDoDesenho, type NoDoDesenho } from './organizar'

const no = (id: string, x = 0, y = 0, altura = 140): NoDoDesenho => ({
  id,
  position: { x, y },
  measured: { width: 248, height: altura },
})

const liga = (source: string, target: string, sourceHandle?: string): ArestaDoDesenho => ({
  source,
  target,
  sourceHandle,
})

/** Retângulo do bloco depois de organizado, para conferir sobreposição. */
function caixas(nos: NoDoDesenho[], posicoes: Map<string, { x: number; y: number }>) {
  return nos.map((n) => {
    const p = posicoes.get(n.id)!
    return { id: n.id, x: p.x, y: p.y, h: n.measured?.height ?? 140 }
  })
}

describe('organizar', () => {
  it('põe cada bloco numa coluna à direita do anterior', () => {
    const nos = [no('a', 500, 300), no('b', 10, 900), no('c', 200, 50)]
    const p = organizar(nos, [liga('a', 'b'), liga('b', 'c')], 'a')

    expect(p.get('a')!.x).toBeLessThan(p.get('b')!.x)
    expect(p.get('b')!.x).toBeLessThan(p.get('c')!.x)
  })

  it('deixa os dois ramos de uma pergunta na mesma coluna, sem se cobrir', () => {
    const pergunta: NoDoDesenho = {
      ...no('p'),
      data: { opcoes: [{ id: 'o1' }, { id: 'o2' }] },
    }
    const nos = [pergunta, no('sim'), no('nao')]
    const p = organizar(nos, [liga('p', 'sim', 'o1'), liga('p', 'nao', 'o2')], 'p')

    expect(p.get('sim')!.x).toBe(p.get('nao')!.x)
    expect(Math.abs(p.get('sim')!.y - p.get('nao')!.y)).toBeGreaterThanOrEqual(140)
  })

  it('segue a ordem das opções: a primeira opção fica acima da segunda', () => {
    const pergunta: NoDoDesenho = {
      ...no('p'),
      data: { opcoes: [{ id: 'o1' }, { id: 'o2' }] },
    }
    // De propósito ao contrário na tela: quem manda é a ordem das opções.
    const nos = [pergunta, no('segundo', 0, 0), no('primeiro', 0, 900)]
    const p = organizar(nos, [liga('p', 'primeiro', 'o1'), liga('p', 'segundo', 'o2')], 'p')

    expect(p.get('primeiro')!.y).toBeLessThan(p.get('segundo')!.y)
  })

  it('não trava com ciclo (voltar ao menu)', () => {
    const nos = [no('menu'), no('a'), no('b')]
    const p = organizar(nos, [liga('menu', 'a'), liga('a', 'b'), liga('b', 'menu')], 'menu')

    expect(p.size).toBe(3)
    expect(p.get('menu')!.x).toBeLessThan(p.get('a')!.x)
  })

  it('separa os pedaços soltos em faixas próprias', () => {
    const nos = [no('a'), no('b'), no('solto')]
    const p = organizar(nos, [liga('a', 'b')], 'a')

    expect(p.get('solto')!.y).toBeGreaterThan(p.get('a')!.y + 140)
  })

  it('nenhum bloco cobre outro', () => {
    const nos = [no('i'), no('a', 0, 0, 300), no('b'), no('c'), no('d'), no('e')]
    const arestas = [
      liga('i', 'a'),
      liga('i', 'b'),
      liga('i', 'c'),
      liga('a', 'd'),
      liga('b', 'd'),
      liga('c', 'e'),
    ]
    const p = organizar(nos, arestas, 'i')

    for (const um of caixas(nos, p)) {
      for (const outro of caixas(nos, p)) {
        if (um.id === outro.id) continue
        const cobreX = Math.abs(um.x - outro.x) < 248
        const cobreY = um.y < outro.y + outro.h && outro.y < um.y + um.h
        expect(cobreX && cobreY).toBe(false)
      }
    }
  })

  it('organizar duas vezes dá o mesmo desenho', () => {
    const nos = [no('a', 300, 20), no('b', 5, 700), no('c', 900, 90)]
    const arestas = [liga('a', 'b'), liga('a', 'c')]
    const uma = organizar(nos, arestas, 'a')
    const outra = organizar(
      nos.map((n) => ({ ...n, position: uma.get(n.id)! })),
      arestas,
      'a',
    )

    for (const n of nos) expect(outra.get(n.id)).toEqual(uma.get(n.id))
  })

  it('aguenta desenho vazio e aresta órfã', () => {
    expect(organizar([], [], null).size).toBe(0)
    const p = organizar([no('a')], [liga('a', 'sumiu'), liga('a', 'a')], null)
    expect(p.size).toBe(1)
  })
})
