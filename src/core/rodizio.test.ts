import { describe, expect, it } from 'vitest'
import { entraPorPadrao, escolherAtendente, podeReceber, type Candidato } from './rodizio'

const base: Candidato = {
  usuarioId: 'b',
  papel: 'member',
  presenca: 'disponivel',
  abertas: 0,
  entraNoRodizio: null,
  tetoSimultaneo: null,
}

describe('entraPorPadrao', () => {
  it('deixa quem atende de fora só quando é gestor', () => {
    expect(entraPorPadrao('member')).toBe(true)
    expect(entraPorPadrao('owner')).toBe(false)
    expect(entraPorPadrao('admin')).toBe(false)
  })
})

describe('podeReceber', () => {
  it('recusa quem está ausente, mesmo marcado para entrar', () => {
    expect(podeReceber({ ...base, presenca: 'ausente', entraNoRodizio: true })).toBe(false)
  })

  it('a configuração da conta ganha do padrão do papel, nos dois sentidos', () => {
    expect(podeReceber({ ...base, papel: 'owner' })).toBe(false)
    expect(podeReceber({ ...base, papel: 'owner', entraNoRodizio: true })).toBe(true)
    expect(podeReceber({ ...base, papel: 'member', entraNoRodizio: false })).toBe(false)
  })

  it('teto zero é sem teto, e não teto batido', () => {
    expect(podeReceber({ ...base, abertas: 40, tetoSimultaneo: 0 })).toBe(true)
    expect(podeReceber({ ...base, abertas: 40, tetoSimultaneo: null })).toBe(true)
  })

  it('no teto para de receber, e um abaixo dele ainda recebe', () => {
    expect(podeReceber({ ...base, abertas: 5, tetoSimultaneo: 5 })).toBe(false)
    expect(podeReceber({ ...base, abertas: 4, tetoSimultaneo: 5 })).toBe(true)
  })
})

describe('escolherAtendente', () => {
  it('manda para quem tem menos conversa aberta', () => {
    const escolhido = escolherAtendente([
      { ...base, usuarioId: 'ana', abertas: 7 },
      { ...base, usuarioId: 'bia', abertas: 2 },
      { ...base, usuarioId: 'caio', abertas: 5 },
    ])
    expect(escolhido).toBe('bia')
  })

  it('empate resolve pelo id, e a mesma entrada dá sempre a mesma saída', () => {
    const equipe = [
      { ...base, usuarioId: 'caio', abertas: 3 },
      { ...base, usuarioId: 'ana', abertas: 3 },
    ]
    expect(escolherAtendente(equipe)).toBe('ana')
    expect(escolherAtendente(equipe)).toBe('ana')
  })

  it('ignora quem está no teto mesmo que seja quem tem menos', () => {
    const escolhido = escolherAtendente([
      { ...base, usuarioId: 'ana', abertas: 2, tetoSimultaneo: 2 },
      { ...base, usuarioId: 'bia', abertas: 9 },
    ])
    expect(escolhido).toBe('bia')
  })

  it('devolve null quando ninguém pode, que é o estado de hoje', () => {
    expect(escolherAtendente([])).toBeNull()
    expect(escolherAtendente([{ ...base, presenca: 'ausente' }])).toBeNull()
  })

  it('gestor sozinho e sem marcação não recebe, e a conversa fica sem dono', () => {
    expect(escolherAtendente([{ ...base, papel: 'owner' }])).toBeNull()
  })
})
