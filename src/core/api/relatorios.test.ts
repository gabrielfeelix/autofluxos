import { describe, expect, it } from 'vitest'
import { celula, ehConjunto, lerConsulta, LIMITE_PADRAO, paraCsv } from './relatorios'

const ler = (q: string) => lerConsulta(new URLSearchParams(q))

describe('conector de BI', () => {
  it('padrão: JSON, sem período, primeira página', () => {
    expect(ler('')).toEqual({ ok: true, consulta: { formato: 'json', desde: null, ate: null, pagina: 1, limite: LIMITE_PADRAO } })
  })

  it('o período conta o dia inteiro do ate, no relógio do Brasil', () => {
    const r = ler('formato=csv&desde=2026-10-01&ate=2026-10-31')
    expect(r.ok && r.consulta.desde?.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.ok && r.consulta.ate?.toISOString()).toBe('2026-11-01T03:00:00.000Z')
  })

  it('recusa em vez de adivinhar', () => {
    expect(ler('formato=xlsx').ok).toBe(false)
    expect(ler('desde=01/10/2026').ok).toBe(false)
    expect(ler('desde=2026-10-31&ate=2026-10-01').ok).toBe(false)
    expect(ler('limite=50000').ok).toBe(false)
    expect(ler('pagina=0').ok).toBe(false)
  })

  it('conjunto só dos que existem', () => {
    expect(ehConjunto('vendas')).toBe(true)
    expect(ehConjunto('toString')).toBe(false)
  })

  it('célula com aspas, vírgula e fórmula', () => {
    expect(celula('Ana, a "Bia"')).toBe('"Ana, a ""Bia"""')
    expect(celula('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(celula(-10)).toBe('-10')
    expect(celula(null)).toBe('')
    expect(celula(true)).toBe('true')
  })

  it('CSV com BOM, cabeçalho e coluna ausente vazia', () => {
    expect(paraCsv(['id', 'valor', 'nome'], [{ id: 'a', valor: 10.5 }])).toBe('\uFEFFid,valor,nome\r\na,10.5,\r\n')
  })
})
