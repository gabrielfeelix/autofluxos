import { describe, expect, it } from 'vitest'
import { abaDoCaminho, ehEditorDeFluxo } from './aba-do-caminho'

const base = '/clientes/abc'

describe('o item aceso pelo caminho', () => {
  it('acende cada seção pelo começo do endereço', () => {
    expect(abaDoCaminho(base, base)).toBe('inicio')
    expect(abaDoCaminho(`${base}/`, base)).toBe('inicio')
    expect(abaDoCaminho(`${base}/inbox`, base)).toBe('inbox')
    expect(abaDoCaminho(`${base}/leads/123`, base)).toBe('leads')
    expect(abaDoCaminho(`${base}/ajustes/whatsapp`, base)).toBe('ajustes')
    expect(abaDoCaminho(`${base}/transmissoes/9`, base)).toBe('transmissoes')
  })

  it('mantém as exceções que as páginas escolhiam à mão', () => {
    expect(abaDoCaminho(`${base}/favoritas`, base)).toBe('inbox')
    expect(abaDoCaminho(`${base}/respostas`, base)).toBe('fluxos')
    expect(abaDoCaminho(`${base}/configurar`, base)).toBe('ajustes')
  })

  it('não confunde prefixo parecido', () => {
    expect(abaDoCaminho(`${base}/leadsx`, base)).toBeNull()
    expect(abaDoCaminho('/clientes/outro/inbox', base)).toBeNull()
  })
})

describe('o editor de fluxo', () => {
  it('é só /fluxos/<id>', () => {
    expect(ehEditorDeFluxo(`${base}/fluxos/f1`, base)).toBe(true)
    expect(ehEditorDeFluxo(`${base}/fluxos`, base)).toBe(false)
    expect(ehEditorDeFluxo(`${base}/fluxos/f1/outra`, base)).toBe(false)
  })
})
