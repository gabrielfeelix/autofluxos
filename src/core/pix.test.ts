import { describe, expect, it } from 'vitest'
import { codigoPix } from './pagamento-demo'
import { lerPix, tipoDaChavePix } from './pix'

describe('lerPix', () => {
  it('lê nome e chave do Pix copia e cola', () => {
    const lido = lerPix(codigoPix(49.9, 'Studio Pilates'))
    expect(lido?.nome).toBe('STUDIO PILATES')
    expect(lido?.chave).toBeTruthy()
  })

  it('Pix dinâmico com URL no lugar da chave não tem o que mostrar', () => {
    const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`
    const conta = campo('00', 'br.gov.bcb.pix') + campo('25', 'pix.asaas.com/qr/cobv/abc123')
    const codigo = campo('00', '01') + campo('26', conta) + campo('59', 'ASAAS') + campo('60', 'SAO PAULO')
    expect(lerPix(codigo)).toBeNull()
  })

  it('código que não é Pix é nulo', () => {
    expect(lerPix('qualquer coisa')).toBeNull()
    expect(lerPix(null)).toBeNull()
  })

  it('classifica a chave', () => {
    expect(tipoDaChavePix('12345678901')).toBe('CPF')
    expect(tipoDaChavePix('12345678000199')).toBe('CNPJ')
    expect(tipoDaChavePix('loja@exemplo.com')).toBe('EMAIL')
    expect(tipoDaChavePix('+5544999990000')).toBe('PHONE')
    expect(tipoDaChavePix('123e4567-e89b-12d3-a456-426614174000')).toBe('EVP')
  })
})
