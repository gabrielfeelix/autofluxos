import { describe, expect, it } from 'vitest'
import { efeitoDaPolitica, politicaDaFerramenta } from './autonomia-da-ia'

describe('o efeito da política da IA na tela', () => {
  it('sem política gravada, a escrita pede confirmação', () => {
    expect(politicaDaFerramenta('marcar_aula', {})).toBe('confirmar')
    expect(politicaDaFerramenta('marcar_aula', { marcar_aula: 'automatico' })).toBe('automatico')
  })

  it('só automático grava sem perguntar; humano ainda pergunta ao contato, como o motor faz', () => {
    expect(efeitoDaPolitica('automatico').selo).toBe('grava sem perguntar')
    expect(efeitoDaPolitica('confirmar').selo).toBe('pede confirmação')
    expect(efeitoDaPolitica('humano')).toEqual(efeitoDaPolitica('confirmar'))
  })
})
