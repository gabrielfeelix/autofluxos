import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { assinaturaConfere } from './route'

/**
 * O caso que motivou o teste: o Direct do Instagram é assinado com a chave do
 * app do Instagram, não com a do app da Meta. Enquanto só a segunda era
 * conferida, todo evento levava 401 e nenhuma mensagem chegava ao Inbox.
 */

const CORPO = '{"object":"instagram","entry":[]}'

function assinar(corpo: string, segredo: string): string {
  return `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`
}

afterEach(() => {
  delete process.env.INSTAGRAM_APP_SECRET
  delete process.env.META_APP_SECRET
})

describe('assinaturaConfere', () => {
  it('aceita o que foi assinado com a chave do app do Instagram', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'
    process.env.META_APP_SECRET = 'segredo-da-meta'

    expect(assinaturaConfere(CORPO, assinar(CORPO, 'segredo-do-instagram'))).toBe(true)
  })

  it('continua aceitando o que foi assinado com a chave do app da Meta', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'
    process.env.META_APP_SECRET = 'segredo-da-meta'

    expect(assinaturaConfere(CORPO, assinar(CORPO, 'segredo-da-meta'))).toBe(true)
  })

  it('funciona no ambiente que só tem a chave da Meta', () => {
    process.env.META_APP_SECRET = 'segredo-da-meta'

    expect(assinaturaConfere(CORPO, assinar(CORPO, 'segredo-da-meta'))).toBe(true)
  })

  it('recusa assinatura de um segredo que não é nenhum dos dois', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'
    process.env.META_APP_SECRET = 'segredo-da-meta'

    expect(assinaturaConfere(CORPO, assinar(CORPO, 'segredo-de-terceiro'))).toBe(false)
  })

  it('recusa corpo adulterado depois da assinatura', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'
    const assinatura = assinar(CORPO, 'segredo-do-instagram')

    expect(assinaturaConfere(`${CORPO} `, assinatura)).toBe(false)
  })

  it('recusa cabeçalho ausente, vazio ou sem o prefixo sha256', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'

    expect(assinaturaConfere(CORPO, null)).toBe(false)
    expect(assinaturaConfere(CORPO, '')).toBe(false)
    expect(assinaturaConfere(CORPO, 'sha1=abc')).toBe(false)
  })

  it('recusa quando não há segredo nenhum configurado', () => {
    expect(assinaturaConfere(CORPO, assinar(CORPO, 'qualquer'))).toBe(false)
  })

  it('recusa assinatura de tamanho diferente sem estourar', () => {
    process.env.INSTAGRAM_APP_SECRET = 'segredo-do-instagram'

    expect(assinaturaConfere(CORPO, 'sha256=abcd')).toBe(false)
  })
})
