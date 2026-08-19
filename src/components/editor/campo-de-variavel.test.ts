import { describe, expect, it } from 'vitest'
import { classificarNomeDeVariavel } from './campo-de-variavel'

describe('classificarNomeDeVariavel', () => {
  it('campo vazio não diz nada — a dica do campo continua valendo', () => {
    expect(
      classificarNomeDeVariavel({ valor: '  ', modo: 'guarda', existeEmOutroBloco: false }),
    ).toBeNull()
  })

  it('nome novo é nome novo, e a tela diz isso antes da publicação', () => {
    expect(
      classificarNomeDeVariavel({ valor: 'agendar_aula', modo: 'guarda', existeEmOutroBloco: false }),
    ).toEqual({ tom: 'neutro', texto: 'variável nova neste fluxo.' })
  })

  it('nome que outro bloco já guarda avisa que os dois escrevem no mesmo lugar', () => {
    const r = classificarNomeDeVariavel({
      valor: 'agendar_aula',
      modo: 'guarda',
      existeEmOutroBloco: true,
    })
    expect(r?.tom).toBe('reuso')
  })

  it('quem só lê e não encontra a variável recebe aviso, não silêncio', () => {
    const r = classificarNomeDeVariavel({
      valor: 'horarios',
      modo: 'usa',
      existeEmOutroBloco: false,
    })
    expect(r?.tom).toBe('aviso')
  })

  it('formato inválido ganha aviso mesmo quando o nome parece existir', () => {
    for (const valor of ['nome do cliente', 'ação', '2fatores', '{{nome}}']) {
      expect(
        classificarNomeDeVariavel({ valor, modo: 'guarda', existeEmOutroBloco: true })?.tom,
      ).toBe('aviso')
    }
  })
})
