import { describe, expect, it } from 'vitest'
import { amostra, categoriaDoMonteSeuPc, ehPcCompleto, lerPecas, linkDoMonteSeuPc, urlDasPecas } from './monte-seu-pc'

const json = {
  items: [
    { name: 'Processador Amd Ryzen 5 7600 X Am 5 4 7 Ghz', price: 1999, status: 1 },
    { name: 'Processador Intel Core I5-12400f 2.5ghz Lga 1700', price: 1029, status: 1 },
    { name: 'Processador Intel Core I 5 9500 3 0 Ghz Lga 1151', price: 866.4944, status: 1 },
    { name: 'Processador Amd Ryzen 5 5600gt Am4', price: 1159, status: 1,
      custom_attributes: [{ attribute_code: 'special_price', value: '1099.9' }] },
    { name: 'Processador desativado', price: 500, status: 2 },
  ],
}

describe('Monte seu PC', () => {
  it('lê da mais barata para a mais cara, com o preço da página', () => {
    expect(lerPecas(json).map((p) => p.preco)).toEqual([866.49, 1029, 1099.9, 1999])
  })

  it('promocional só vale menor que o cheio e dentro das datas', () => {
    const ryzen = lerPecas(json).find((p) => p.nome.includes('5600gt'))
    expect(ryzen).toEqual({ nome: 'Processador Amd Ryzen 5 5600gt Am4', preco: 1099.9, precoDe: 1159 })

    const vencido = { items: [{ name: 'X', price: 100, custom_attributes: [
      { attribute_code: 'special_price', value: '80' },
      { attribute_code: 'special_to_date', value: '2026-01-01 00:00:00' },
    ] }] }
    expect(lerPecas(vencido, '', new Date('2026-10-22'))).toEqual([{ nome: 'X', preco: 100 }])
  })

  it('o termo acha "i5" escrito de qualquer jeito, e "ryzen 7" não acha Ryzen 5', () => {
    expect(lerPecas(json, 'i5').map((p) => p.preco)).toEqual([866.49, 1029])
    expect(lerPecas(json, 'Ryzen 5')).toHaveLength(2)
    expect(lerPecas(json, 'ryzen 7')).toEqual([])
  })

  it('entende a categoria como a pessoa escreve', () => {
    expect(categoriaDoMonteSeuPc('Placa de vídeo')).toBe('placa_de_video')
    expect(categoriaDoMonteSeuPc('placa-mãe')).toBe('placa_mae')
    expect(categoriaDoMonteSeuPc('CPU')).toBe('processador')
    expect(categoriaDoMonteSeuPc('geladeira')).toBeNull()
  })

  it('consulta a categoria só com estoque e só peça do montador', () => {
    const url = decodeURIComponent(urlDasPecas('https://www.pcyes.com.br/', 'processador'))
    expect(url).toContain('https://www.pcyes.com.br/rest/V1/public/products?')
    expect(url).toContain('[0][filters][0][field]=category_id')
    expect(url).toContain('[0][filters][0][value]=40')
    expect(url).toContain('[1][filters][0][field]=is_in_stock')
    expect(url).toContain('[2][filters][0][field]=monte_seu_kit')
    expect(linkDoMonteSeuPc('https://www.pcyes.com.br/')).toBe('https://www.pcyes.com.br/monte-seu-pc/')
  })

  it('o PC inteiro aceita o jeito que o modelo escreve', () => {
    expect(ehPcCompleto('pc_completo')).toBe(true)
    expect(ehPcCompleto('Setup')).toBe(true)
    expect(ehPcCompleto('placa de vídeo')).toBe(false)
  })

  it('a amostra vai da mais barata à mais cara, sem repetir', () => {
    const precos = Array.from({ length: 30 }, (_, i) => i)
    expect(amostra(precos, 4)).toEqual([0, 10, 19, 29])
    expect(amostra([1, 2], 8)).toEqual([1, 2])
  })
})
