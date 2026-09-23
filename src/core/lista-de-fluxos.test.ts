import { describe, expect, it } from 'vitest'
import { casaFluxo, enderecoDaLista, lerFiltroDeFluxos, type FluxoParaFiltro } from './lista-de-fluxos'

/**
 * A busca e os filtros da lista de automações (A01). Quem tem dezenas de
 * fluxos em pastas localiza por nome, canal e estado, e o endereço guarda o
 * recorte para voltar ou mandar para alguém.
 */
const fluxo = (partes: Partial<FluxoParaFiltro> = {}): FluxoParaFiltro => ({
  nome: 'Agendar aula experimental',
  canal: 'whatsapp',
  publicada: true,
  ativo: true,
  pastaId: 'p1',
  pendente: false,
  ...partes,
})

describe('lerFiltroDeFluxos', () => {
  it('ignora valor desconhecido em vez de filtrar por ele', () => {
    expect(lerFiltroDeFluxos({ canal: 'fax', estado: 'quase', q: '  aula ' })).toEqual({
      q: 'aula',
      canal: null,
      estado: null,
      pasta: null,
    })
  })
})

describe('casaFluxo', () => {
  const vazio = lerFiltroDeFluxos({})

  it('busca sem acento e sem caixa', () => {
    expect(casaFluxo(fluxo({ nome: 'Não comparecimento' }), { ...vazio, q: 'nao COMP' })).toBe(true)
    expect(casaFluxo(fluxo({ nome: 'Boas-vindas' }), { ...vazio, q: 'aula' })).toBe(false)
  })

  it('estado separa publicação de entrada', () => {
    const desligada = fluxo({ ativo: false })
    const nunca = fluxo({ publicada: false })
    expect(casaFluxo(desligada, { ...vazio, estado: 'publicadas' })).toBe(true)
    expect(casaFluxo(desligada, { ...vazio, estado: 'desligadas' })).toBe(true)
    expect(casaFluxo(desligada, { ...vazio, estado: 'ligadas' })).toBe(false)
    expect(casaFluxo(nunca, { ...vazio, estado: 'nunca' })).toBe(true)
    expect(casaFluxo(nunca, { ...vazio, estado: 'publicadas' })).toBe(false)
  })

  it('com pendência: impedimento, ou ligada sem nunca ter publicado', () => {
    expect(casaFluxo(fluxo({ pendente: true }), { ...vazio, estado: 'pendencia' })).toBe(true)
    expect(casaFluxo(fluxo({ publicada: false }), { ...vazio, estado: 'pendencia' })).toBe(true)
    expect(casaFluxo(fluxo({ publicada: false, ativo: false }), { ...vazio, estado: 'pendencia' })).toBe(false)
    expect(casaFluxo(fluxo(), { ...vazio, estado: 'pendencia' })).toBe(false)
  })

  it('pasta "sem" pega só quem está na raiz', () => {
    expect(casaFluxo(fluxo({ pastaId: null }), { ...vazio, pasta: 'sem' })).toBe(true)
    expect(casaFluxo(fluxo(), { ...vazio, pasta: 'sem' })).toBe(false)
    expect(casaFluxo(fluxo(), { ...vazio, pasta: 'p1' })).toBe(true)
  })

  it('canal', () => {
    expect(casaFluxo(fluxo({ canal: 'instagram' }), { ...vazio, canal: 'whatsapp' })).toBe(false)
  })
})

describe('enderecoDaLista', () => {
  it('mantém a aba e tira o que está vazio', () => {
    expect(enderecoDaLista('/c/1/fluxos', { aba: 'fluxos', q: 'aula', estado: '' })).toBe(
      '/c/1/fluxos?aba=fluxos&q=aula',
    )
    expect(enderecoDaLista('/c/1/fluxos', {})).toBe('/c/1/fluxos')
  })
})
