import { describe, expect, it } from 'vitest'
import { organizar, type ArestaDoDesenho, type NoDoDesenho } from './organizar'

const no = (id: string, x = 0, y = 0, altura = 140): NoDoDesenho => ({
  id,
  position: { x, y },
  measured: { width: 248, height: altura },
})

const liga = (source: string, target: string, sourceHandle?: string): ArestaDoDesenho => ({
  id: `${source}-${target}-${sourceHandle ?? ''}`,
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
    const p = organizar(nos, [liga('a', 'b'), liga('b', 'c')], 'a').posicoes

    expect(p.get('a')!.x).toBeLessThan(p.get('b')!.x)
    expect(p.get('b')!.x).toBeLessThan(p.get('c')!.x)
  })

  it('deixa os dois ramos de uma pergunta na mesma coluna, sem se cobrir', () => {
    const pergunta: NoDoDesenho = {
      ...no('p'),
      data: { opcoes: [{ id: 'o1' }, { id: 'o2' }] },
    }
    const nos = [pergunta, no('sim'), no('nao')]
    const p = organizar(nos, [liga('p', 'sim', 'o1'), liga('p', 'nao', 'o2')], 'p').posicoes

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
    const p = organizar(nos, [liga('p', 'primeiro', 'o1'), liga('p', 'segundo', 'o2')], 'p').posicoes

    expect(p.get('primeiro')!.y).toBeLessThan(p.get('segundo')!.y)
  })

  it('não trava com ciclo (voltar ao menu)', () => {
    const nos = [no('menu'), no('a'), no('b')]
    const p = organizar(nos, [liga('menu', 'a'), liga('a', 'b'), liga('b', 'menu')], 'menu').posicoes

    expect(p.size).toBe(3)
    expect(p.get('menu')!.x).toBeLessThan(p.get('a')!.x)
  })

  it('separa os pedaços soltos em faixas próprias', () => {
    const nos = [no('a'), no('b'), no('solto')]
    const p = organizar(nos, [liga('a', 'b')], 'a').posicoes

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
    const p = organizar(nos, arestas, 'i').posicoes

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
    const uma = organizar(nos, arestas, 'a').posicoes
    const outra = organizar(
      nos.map((n) => ({ ...n, position: uma.get(n.id)! })),
      arestas,
      'a',
    ).posicoes

    for (const n of nos) expect(outra.get(n.id)).toEqual(uma.get(n.id))
  })

  it('dá corredor à ligação que pula colunas, e nenhum à que não pula', () => {
    // `a` alimenta a corrente inteira e também fala direto com `d`, três
    // colunas à frente. É o caso que embaralhava o desenho: sem corredor essa
    // ligação atravessa `b` e `c` em diagonal, por trás dos dois.
    const nos = [no('a'), no('b'), no('c'), no('d')]
    const arestas = [liga('a', 'b'), liga('b', 'c'), liga('c', 'd'), liga('a', 'd', 'o2')]
    const { posicoes, curvas } = organizar(nos, arestas, 'a')

    expect(curvas.get('a-b-')).toBeUndefined()
    const pulo = curvas.get('a-d-o2')!
    // Duas colunas de passagem (a de `b` e a de `c`), dois pontos em cada: um
    // em cada borda da coluna, para o trecho do meio sair reto.
    expect(pulo).toHaveLength(4)
    expect(pulo[0]!.y).toBe(pulo[1]!.y)
    expect(pulo[1]!.x - pulo[0]!.x).toBe(248)

    // O corredor anda para a direita junto com as colunas, e passa por dentro
    // da faixa de cada uma delas.
    expect(pulo[2]!.x).toBeGreaterThan(pulo[1]!.x)
    expect(pulo[0]!.x).toBe(posicoes.get('b')!.x)
    expect(pulo[2]!.x).toBe(posicoes.get('c')!.x)

    // E não cobre nenhum bloco: o empilhamento reservou a altura dele.
    for (const id of ['b', 'c']) {
      const caixa = posicoes.get(id)!
      const dentro = pulo.some((p) => p.y > caixa.y && p.y < caixa.y + 140)
      expect(dentro).toBe(false)
    }

    // Nenhum apoio sobra fingindo ser bloco.
    expect(posicoes.size).toBe(4)
  })

  it('não reserva corredor para ligação que vai virar crachá', () => {
    // Cinco colunas de distância: acima do teto. Fio assim não é desenhado no
    // canvas, então abrir faixa para ele nas quatro colunas do meio só
    // esticaria o desenho para nada.
    const nos = [no('a'), no('b'), no('c'), no('d'), no('e'), no('f')]
    const arestas = [
      liga('a', 'b'),
      liga('b', 'c'),
      liga('c', 'd'),
      liga('d', 'e'),
      liga('e', 'f'),
      liga('a', 'f', 'o2'),
    ]
    const { curvas } = organizar(nos, arestas, 'a')
    expect(curvas.get('a-f-o2')).toBeUndefined()
  })

  it('aguenta desenho vazio e aresta órfã', () => {
    expect(organizar([], [], null).posicoes.size).toBe(0)
    const p = organizar([no('a')], [liga('a', 'sumiu'), liga('a', 'a')], null).posicoes
    expect(p.size).toBe(1)
  })
})
