import { describe, expect, it } from 'vitest'
import { abaDoCaminho, acesoDoCaminho, ehEditorDeFluxo } from './aba-do-caminho'

const base = '/clientes/abc'

describe('o item aceso pelo caminho', () => {
  it('acende cada seção pelo começo do endereço', () => {
    expect(abaDoCaminho(base, base)).toBe('inicio')
    expect(abaDoCaminho(`${base}/`, base)).toBe('inicio')
    expect(abaDoCaminho(`${base}/inbox`, base)).toBe('inbox')
    expect(abaDoCaminho(`${base}/leads/123`, base)).toBe('leads')
    expect(abaDoCaminho(`${base}/conversas/canais/whatsapp`, base)).toBe('canais')
    expect(abaDoCaminho(`${base}/leads/etiquetas`, base)).toBe('etiquetas')
    expect(abaDoCaminho(`${base}/loja/catalogo`, base)).toBe('loja')
    expect(abaDoCaminho(`${base}/negocios/abc`, base)).toBe('quadros')
    expect(abaDoCaminho(`${base}/ajustes/horario`, base)).toBe('ajustes')
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

describe('a seção aberta e o subitem aceso', () => {
  const busca = (texto: string) => new URLSearchParams(texto)

  it('as três visões de Conversas são a mesma tela, separadas pela busca', () => {
    expect(acesoDoCaminho(`${base}/inbox`, base, busca(''))).toEqual({ secao: 'conversas', item: 'todas' })
    expect(acesoDoCaminho(`${base}/inbox`, base, busca('de=minhas'))).toEqual({ secao: 'conversas', item: 'minhas' })
    expect(acesoDoCaminho(`${base}/inbox`, base, busca('de=sem-dono&conversa=x'))).toEqual({ secao: 'conversas', item: 'sem-dono' })
    expect(acesoDoCaminho(`${base}/inbox`, base, busca('de=u1'), 'u1')).toEqual({ secao: 'conversas', item: 'minhas' })
    // Filtrado por um colega: a seção certa, nenhum subitem.
    expect(acesoDoCaminho(`${base}/inbox`, base, busca('de=u9'))).toEqual({ secao: 'conversas', item: null })
  })

  it('as abas antigas de Automações acendem o subitem certo', () => {
    expect(acesoDoCaminho(`${base}/fluxos`, base, busca(''))).toEqual({ secao: 'automacoes', item: 'fluxos' })
    expect(acesoDoCaminho(`${base}/fluxos`, base, busca('aba=campanhas'))).toEqual({ secao: 'automacoes', item: 'gatilhos' })
    expect(acesoDoCaminho(`${base}/fluxos`, base, busca('aba=sequencias'))).toEqual({ secao: 'automacoes', item: 'sequencias' })
  })

  it('o subitem mais específico ganha do mais geral', () => {
    expect(acesoDoCaminho(`${base}/leads/segmentos`, base)).toEqual({ secao: 'crm', item: 'segmentos' })
    expect(acesoDoCaminho(`${base}/leads/123`, base)).toEqual({ secao: 'crm', item: 'contatos' })
    expect(acesoDoCaminho(`${base}/conversas/canais/instagram`, base)).toEqual({ secao: 'conversas', item: 'canais' })
    expect(acesoDoCaminho(`${base}/loja/catalogo`, base)).toEqual({ secao: 'loja', item: 'catalogo' })
    expect(acesoDoCaminho(`${base}/negocios/abc`, base)).toEqual({ secao: 'crm', item: 'negocios' })
    expect(acesoDoCaminho(base, base)).toEqual({ secao: 'inicio', item: 'inicio' })
  })
})

describe('o editor de fluxo', () => {
  it('é só /fluxos/<id>', () => {
    expect(ehEditorDeFluxo(`${base}/fluxos/f1`, base)).toBe(true)
    expect(ehEditorDeFluxo(`${base}/fluxos`, base)).toBe(false)
    expect(ehEditorDeFluxo(`${base}/fluxos/f1/outra`, base)).toBe(false)
  })
})
