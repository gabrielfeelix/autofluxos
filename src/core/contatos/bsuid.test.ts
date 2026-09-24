import { describe, expect, it } from 'vitest'
import { ehBsuid } from './bsuid'
import { telefoneLegivel } from './telefone'
import { varsIniciais } from './vars-iniciais'

describe('BSUID do WhatsApp', () => {
  it('reconhece o BSUID e o BSUID principal', () => {
    expect(ehBsuid('BR.13491208655302741918')).toBe(true)
    expect(ehBsuid('US.ENT.11815799212886844830')).toBe(true)
  })

  it('não confunde telefone, IGSID nem vazio', () => {
    expect(ehBsuid('5511987654321')).toBe(false)
    expect(ehBsuid('17841400000000000')).toBe(false)
    expect(ehBsuid('')).toBe(false)
    expect(ehBsuid(undefined)).toBe(false)
    expect(ehBsuid('br.123')).toBe(false)
  })

  it('a tela não mostra o id da Meta como se fosse telefone', () => {
    expect(telefoneLegivel('BR.13491208655302741918')).toBe('número oculto')
  })

  it('{{telefone}} fica vazio quando o endereço é BSUID', () => {
    const vars = varsIniciais({ waId: 'BR.13491208655302741918', nome: 'Ana' })
    expect(vars.telefone).toBeUndefined()
    expect(vars.nome).toBe('Ana')
  })
})
