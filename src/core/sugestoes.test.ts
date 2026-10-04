import { describe, expect, it } from 'vitest'
import { conferirSugestao, LIMITE_DA_SUGESTAO, telaDaSugestao } from './sugestoes'

describe('conferirSugestao', () => {
  it('aceita e apara o texto', () => {
    expect(conferirSugestao('  status de atividade atrasada  ')).toEqual({
      ok: true,
      texto: 'status de atividade atrasada',
    })
  })

  it('recusa vazio e tecla escapada', () => {
    expect(conferirSugestao('   ').ok).toBe(false)
    expect(conferirSugestao('ok').ok).toBe(false)
  })

  it('recusa acima do limite, sem cortar calado', () => {
    expect(conferirSugestao('a'.repeat(LIMITE_DA_SUGESTAO + 1)).ok).toBe(false)
    expect(conferirSugestao('a'.repeat(LIMITE_DA_SUGESTAO)).ok).toBe(true)
  })
})

describe('telaDaSugestao', () => {
  it('tira o id da conta e a busca', () => {
    expect(telaDaSugestao('/clientes/3a1d5ac8-369c/quadros?q=abc')).toBe('/quadros')
    expect(telaDaSugestao('/clientes/3a1d5ac8-369c/negocios/9f2?x=1#topo')).toBe('/negocios/9f2')
  })

  it('o início da conta vira a barra', () => {
    expect(telaDaSugestao('/clientes/3a1d5ac8-369c')).toBe('/')
  })

  it('fora da conta fica como está', () => {
    expect(telaDaSugestao('/admin/organizacoes')).toBe('/admin/organizacoes')
  })
})
