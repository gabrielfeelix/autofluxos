import { describe, expect, it } from 'vitest'
import { base64urlParaBytes } from './vapid'

/** O `atob` do navegador, que no Node existe com o mesmo nome e comportamento. */
const decodificar = (texto: string) => Buffer.from(texto, 'base64').toString('binary')

describe('base64urlParaBytes', () => {
  /*
   * A chave VAPID real tem 65 bytes e começa com 0x04 — o prefixo de ponto não
   * comprimido de uma curva P-256. É o que o `PushManager` confere; errar o
   * tamanho ou o primeiro byte faz a assinatura não bater e nenhum push chegar,
   * sem erro em lugar nenhum.
   */
  it('uma chave VAPID de verdade vira 65 bytes começando em 0x04', () => {
    const chave =
      'BMpJBHLQasjnXY8azkKgg-JE9xMSQ1J9COCbaQL6Gm5vO8XmjLaYxDOrna96JykWjuecTzYTeJpgaJ3xrnT3TQM'
    const bytes = base64urlParaBytes(chave, decodificar)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04)
  })

  // `-` e `_` são o alfabeto do base64url. Decodificar como base64 comum
  // produziria bytes diferentes, calado.
  it('traduz o alfabeto do base64url', () => {
    expect(Array.from(base64urlParaBytes('-_8', decodificar))).toEqual([251, 255])
  })

  it('completa o preenchimento que o base64url omite', () => {
    // "Ma" sem `=` tem comprimento 2; sem completar, `atob` recusa.
    expect(() => base64urlParaBytes('TWE', decodificar)).not.toThrow()
    expect(Array.from(base64urlParaBytes('TWE', decodificar))).toEqual([77, 97])
  })

  it('string vazia devolve zero bytes em vez de estourar', () => {
    expect(base64urlParaBytes('', decodificar)).toHaveLength(0)
  })

  // Ele vai direto para `applicationServerKey`, que recusa SharedArrayBuffer.
  it('o buffer é ArrayBuffer, que é o que o PushManager aceita', () => {
    expect(base64urlParaBytes('TWE', decodificar).buffer).toBeInstanceOf(ArrayBuffer)
  })
})
