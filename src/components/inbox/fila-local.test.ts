import { describe, expect, it } from 'vitest'
import { contarDonos, contarEstados, recortarFila } from './fila-local'

/**
 * As três funções que decidem o que a pessoa vê quando a fila inteira está no
 * navegador.
 *
 * O que elas erram, erram em silêncio: uma conversa resolvida aparecendo na aba
 * de abertas, ou um número no rail que não bate com a lista logo abaixo dele.
 * Nada quebra — só fica errado.
 */

type Falso = {
  contatoId: string
  estadoEfetivo: 'aberta' | 'adiada' | 'resolvida'
  atribuidoA: string | null
}

const lead = (
  contatoId: string,
  estadoEfetivo: Falso['estadoEfetivo'],
  atribuidoA: string | null = null,
): Falso => ({ contatoId, estadoEfetivo, atribuidoA })

const FILA: Falso[] = [
  lead('a', 'aberta'),
  lead('b', 'aberta', 'ana'),
  lead('c', 'adiada', 'ana'),
  lead('d', 'resolvida'),
  lead('e', 'aberta', 'bruno'),
]

describe('recortarFila', () => {
  it('filtra por estado', () => {
    expect(recortarFila(FILA, 'aberta', 'todos').map((l) => l.contatoId)).toEqual(['a', 'b', 'e'])
    expect(recortarFila(FILA, 'adiada', 'todos').map((l) => l.contatoId)).toEqual(['c'])
    expect(recortarFila(FILA, 'resolvida', 'todos').map((l) => l.contatoId)).toEqual(['d'])
  })

  it('filtra por dono, e "sem-dono" é nulo — não string vazia', () => {
    expect(recortarFila(FILA, 'todas', 'ana').map((l) => l.contatoId)).toEqual(['b', 'c'])
    expect(recortarFila(FILA, 'todas', 'sem-dono').map((l) => l.contatoId)).toEqual(['a', 'd'])
  })

  it('os dois eixos restringem juntos, e não um OU outro', () => {
    // `ana` tem uma aberta e uma adiada; com a aba "Abertas" ligada, só a aberta.
    expect(recortarFila(FILA, 'aberta', 'ana').map((l) => l.contatoId)).toEqual(['b'])
  })

  it('`todas` + `todos` devolve a fila inteira', () => {
    expect(recortarFila(FILA, 'todas', 'todos')).toHaveLength(5)
  })

  it('lê estadoEfetivo, que é onde o adiamento vencido já conta como aberta', () => {
    // A view resolve o prazo; aqui só se prova que é esse campo que se lê — ler
    // o `estado` cru esconderia a conversa no dia em que ela deve reaparecer.
    const vencida = [{ contatoId: 'x', estadoEfetivo: 'aberta' as const, atribuidoA: null }]
    expect(recortarFila(vencida, 'aberta', 'todos')).toHaveLength(1)
    expect(recortarFila(vencida, 'adiada', 'todos')).toHaveLength(0)
  })
})

describe('contarEstados', () => {
  it('conta cada estado, e zera o que não aparece', () => {
    expect(contarEstados(FILA)).toEqual({ aberta: 3, adiada: 1, resolvida: 1 })
    expect(contarEstados([])).toEqual({ aberta: 0, adiada: 0, resolvida: 0 })
  })
})

describe('contarDonos', () => {
  it('conta DENTRO do estado escolhido — senão o número não bate com a lista', () => {
    const abertas = contarDonos(FILA, 'aberta')
    expect(abertas.total).toBe(3)
    expect(abertas.semDono).toBe(1)
    expect(abertas.porUsuario.get('ana')).toBe(1)
    expect(abertas.porUsuario.get('bruno')).toBe(1)
  })

  it('em `todas`, conta a fila inteira', () => {
    const tudo = contarDonos(FILA, 'todas')
    expect(tudo.total).toBe(5)
    expect(tudo.semDono).toBe(2)
    expect(tudo.porUsuario.get('ana')).toBe(2)
  })

  it('quem não tem conversa no estado não aparece no mapa', () => {
    const resolvidas = contarDonos(FILA, 'resolvida')
    expect(resolvidas.total).toBe(1)
    expect(resolvidas.porUsuario.has('ana')).toBe(false)
  })
})
