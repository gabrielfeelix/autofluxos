import { describe, expect, it } from 'vitest'
import { camposSemOrigem, origemDoContato } from './origem'

describe('origemDoContato', () => {
  it('não inventa origem para contato que nunca teve uma', () => {
    expect(origemDoContato({})).toBeNull()
    expect(origemDoContato({ objetivo: 'emagrecer' })).toBeNull()
  })

  it('lê o anúncio inteiro quando ele veio', () => {
    const origem = origemDoContato({
      origem: 'Anúncio',
      origem_anuncio: '120210000000001',
      origem_titulo: 'Filme institucional para sua empresa',
      origem_url: 'https://fb.me/3Exemplo',
    })

    expect(origem).toEqual({
      rotulo: 'Anúncio',
      nome: 'Anúncio',
      deAnuncio: true,
      titulo: 'Filme institucional para sua empresa',
      anuncio: '120210000000001',
      url: 'https://fb.me/3Exemplo',
    })
  })

  it('quem chegou direto não é anúncio', () => {
    const origem = origemDoContato({ origem: 'Direto' })
    expect(origem?.deAnuncio).toBe(false)
    // "Direto" o time lia como Direct do Instagram.
    expect(origem?.nome).toBe('Por conta própria')
    expect(origem?.titulo).toBe('')
  })

  /*
   * O caso do WhatsApp Status: o `referral` chega sem `ctwa_clid` e pode chegar
   * sem `source_id`. Continua sendo anúncio.
   */
  it('anúncio sem id continua sendo anúncio', () => {
    const origem = origemDoContato({ origem: 'Anúncio' })
    expect(origem?.deAnuncio).toBe(true)
    expect(origem?.anuncio).toBe('')
  })

  it('campo em branco não conta como origem', () => {
    expect(origemDoContato({ origem: '   ' })).toBeNull()
  })
})

describe('camposSemOrigem', () => {
  it('tira da lista o que a origem já mostra', () => {
    const campos: [string, string][] = [
      ['origem', 'Anúncio'],
      ['origem_anuncio', '120210000000001'],
      ['origem_titulo', 'Filme institucional'],
      ['objetivo', 'orçamento'],
    ]
    expect(camposSemOrigem(campos)).toEqual([['objetivo', 'orçamento']])
  })

  it('não mexe em contato sem origem', () => {
    const campos: [string, string][] = [['objetivo', 'orçamento']]
    expect(camposSemOrigem(campos)).toEqual(campos)
  })
})
