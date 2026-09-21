import { describe, expect, it } from 'vitest'
import { assinaturaDasReacoes, casarReacoes, type LinhaDeReacao } from './reacoes'

type Lado = 'entrada' | 'saida'

/** Uma mensagem comum: não é reação, e serve de alvo. */
function mensagem(id: string, direcao: Lado = 'entrada'): LinhaDeReacao<Lado> {
  return { id, direcao, reagiu_a: null, reacao: null }
}

function reacao(
  id: string,
  alvo: string,
  emoji: string,
  direcao: Lado = 'entrada',
): LinhaDeReacao<Lado> {
  return { id, direcao, reagiu_a: alvo, reacao: emoji }
}

describe('casar reações com as mensagens que elas comentam', () => {
  it('gruda a reação no alvo, e não na conversa', () => {
    const casadas = casarReacoes<Lado>([
      mensagem('m1'),
      reacao('r1', 'wamid-1', '❤️'),
    ])

    expect(casadas.get('wamid-1')).toEqual([{ emoji: '❤️', de: 'entrada', id: 'r1' }])
  })

  /*
   * A Meta manda troca como mensagem NOVA, não como edição. Sem colapsar por
   * lado, quem troca de 👍 para ❤️ fica com os dois pendurados para sempre.
   */
  it('reagir de novo troca, em vez de acumular', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍'),
      reacao('r2', 'wamid-1', '❤️'),
    ])

    expect(casadas.get('wamid-1')).toEqual([{ emoji: '❤️', de: 'entrada', id: 'r2' }])
  })

  /*
   * O emoji vazio é como a Meta desfaz uma reação. Se ele fosse tratado como
   * "sem emoji" em vez de "removeu", a reação tirada ficaria na tela para
   * sempre, e essa é exatamente a razão de a coluna guardar string vazia em
   * vez de `null`.
   */
  it('emoji vazio remove a reação que estava lá', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍'),
      reacao('r2', 'wamid-1', ''),
    ])

    expect(casadas.has('wamid-1')).toBe(false)
  })

  it('remover e reagir de novo devolve a reação', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍'),
      reacao('r2', 'wamid-1', ''),
      reacao('r3', 'wamid-1', '😂'),
    ])

    expect(casadas.get('wamid-1')).toEqual([{ emoji: '😂', de: 'entrada', id: 'r3' }])
  })

  /*
   * Os dois lados reagem à mesma frase, e cada um tem a sua. Colapsar sem
   * olhar o lado faria a reação do atendimento apagar a do cliente, e a
   * conversa perderia a informação mais útil das duas.
   */
  it('cada lado tem a sua reação na mesma mensagem', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍', 'entrada'),
      reacao('r2', 'wamid-1', '🙏', 'saida'),
    ])

    expect(casadas.get('wamid-1')).toEqual([
      { emoji: '👍', de: 'entrada', id: 'r1' },
      { emoji: '🙏', de: 'saida', id: 'r2' },
    ])
  })

  it('remover de um lado não mexe no outro', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍', 'entrada'),
      reacao('r2', 'wamid-1', '🙏', 'saida'),
      reacao('r3', 'wamid-1', '', 'saida'),
    ])

    expect(casadas.get('wamid-1')).toEqual([{ emoji: '👍', de: 'entrada', id: 'r1' }])
  })

  it('reações em mensagens diferentes não se misturam', () => {
    const casadas = casarReacoes<Lado>([
      reacao('r1', 'wamid-1', '👍'),
      reacao('r2', 'wamid-2', '❤️'),
    ])

    expect(casadas.get('wamid-1')).toEqual([{ emoji: '👍', de: 'entrada', id: 'r1' }])
    expect(casadas.get('wamid-2')).toEqual([{ emoji: '❤️', de: 'entrada', id: 'r2' }])
  })

  /*
   * Reagir a algo fora do histórico é caso normal: o teto é de 500 mensagens e
   * a Meta deixa reagir a mensagem de até 30 dias. O casamento não pode
   * inventar alvo nem estourar, quem desenha é que decide o que fazer com uma
   * reação sem alvo carregado.
   */
  it('reação a mensagem fora do histórico continua no mapa, sem alvo carregado', () => {
    const casadas = casarReacoes<Lado>([mensagem('m1'), reacao('r1', 'wamid-antiga', '👍')])

    expect(casadas.get('wamid-antiga')).toEqual([{ emoji: '👍', de: 'entrada', id: 'r1' }])
  })

  it('conversa sem reação nenhuma devolve mapa vazio', () => {
    expect(casarReacoes<Lado>([mensagem('m1'), mensagem('m2', 'saida')]).size).toBe(0)
  })
})

describe('a assinatura das reações', () => {
  it('muda quando o emoji muda', () => {
    const antes = assinaturaDasReacoes([{ emoji: '👍', de: 'saida' }])
    const depois = assinaturaDasReacoes([{ emoji: '❤️', de: 'saida' }])
    expect(antes).not.toBe(depois)
  })

  it('muda quando a outra pessoa também reage', () => {
    const so = assinaturaDasReacoes([{ emoji: '👍', de: 'saida' }])
    const dois = assinaturaDasReacoes([
      { emoji: '👍', de: 'saida' },
      { emoji: '😂', de: 'entrada' },
    ])
    expect(so).not.toBe(dois)
  })

  /* Sem isso, a `key` seria `''` e o React trataria como "sem chave". */
  it('tem valor para mensagem sem reação nenhuma', () => {
    expect(assinaturaDasReacoes([])).toBe('sem-reacao')
    expect(assinaturaDasReacoes(undefined)).toBe('sem-reacao')
  })
})
