import { createCipheriv, createDecipheriv, publicEncrypt, constants, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { abrirPedido, fecharResposta, gerarParDeChaves, ivInvertido, type CorpoCifrado } from './cripto'

/**
 * Ida e volta com vetores próprios, sem rede: o teste faz o papel da Meta
 * (cifra o pedido com a pública, decifra a resposta com o IV invertido) e
 * confere que o nosso lado entende e é entendido.
 */

const PAR = gerarParDeChaves()

function cifrarComoAMeta(dados: unknown, publica = PAR.publica, chaveAes = randomBytes(16), iv = randomBytes(12)) {
  const cifrador = createCipheriv('aes-128-gcm', chaveAes, iv)
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(dados), 'utf8'), cifrador.final(), cifrador.getAuthTag()])
  const corpo: CorpoCifrado = {
    encrypted_flow_data: cifrado.toString('base64'),
    encrypted_aes_key: publicEncrypt({ key: publica, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, chaveAes).toString(
      'base64',
    ),
    initial_vector: iv.toString('base64'),
  }
  return { corpo, chaveAes, iv }
}

function decifrarComoAMeta(resposta: string, chaveAes: Buffer, iv: Buffer): unknown {
  const bruto = Buffer.from(resposta, 'base64')
  const flip = Buffer.from(iv.map((b) => ~b & 0xff))
  const decifrador = createDecipheriv('aes-128-gcm', chaveAes, flip)
  decifrador.setAuthTag(bruto.subarray(bruto.length - 16))
  return JSON.parse(Buffer.concat([decifrador.update(bruto.subarray(0, bruto.length - 16)), decifrador.final()]).toString('utf8'))
}

describe('formulário do WhatsApp: criptografia', () => {
  it('gera PEM de chave pública e privada', () => {
    expect(PAR.publica).toMatch(/^-----BEGIN PUBLIC KEY-----/)
    expect(PAR.privada).toMatch(/^-----BEGIN PRIVATE KEY-----/)
  })

  it('abre o pedido que a Meta cifrou com a nossa pública', () => {
    const pedido = { version: '3.0', action: 'data_exchange', screen: 'DIA', data: { dia: '2026-10-23' }, flow_token: 'f1.abc' }
    const { corpo, chaveAes, iv } = cifrarComoAMeta(pedido)
    const aberto = abrirPedido(corpo, PAR.privada)
    expect(aberto.dados).toEqual(pedido)
    expect(aberto.chaveAes.equals(chaveAes)).toBe(true)
    expect(aberto.iv.equals(iv)).toBe(true)
  })

  it('a resposta volta com a mesma chave e o IV invertido, legível pela Meta', () => {
    const { corpo, chaveAes, iv } = cifrarComoAMeta({ version: '3.0', action: 'ping' })
    const aberto = abrirPedido(corpo, PAR.privada)
    const resposta = { data: { status: 'active' } }
    expect(decifrarComoAMeta(fecharResposta(resposta, aberto), chaveAes, iv)).toEqual(resposta)
  })

  it('vetor fixo: IV invertido byte a byte', () => {
    expect(ivInvertido(Buffer.from([0x00, 0xff, 0x0f, 0xa5])).toString('hex')).toBe('ff00f05a')
  })

  it('vetor fixo: chave e IV conhecidos produzem sempre o mesmo texto cifrado', () => {
    const chaveAes = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex')
    const iv = Buffer.from('101112131415161718191a1b', 'hex')
    const uma = fecharResposta({ ok: 1 }, { chaveAes, iv })
    expect(fecharResposta({ ok: 1 }, { chaveAes, iv })).toBe(uma)
    expect(decifrarComoAMeta(uma, chaveAes, iv)).toEqual({ ok: 1 })
  })

  it('chave privada de outro par não abre (vira 421 na rota)', () => {
    const { corpo } = cifrarComoAMeta({ action: 'ping' })
    expect(() => abrirPedido(corpo, gerarParDeChaves().privada)).toThrow()
  })

  it('dado adulterado não passa na etiqueta', () => {
    const { corpo } = cifrarComoAMeta({ action: 'ping' })
    const bytes = Buffer.from(corpo.encrypted_flow_data, 'base64')
    bytes[0] = (bytes[0] ?? 0) ^ 1
    expect(() => abrirPedido({ ...corpo, encrypted_flow_data: bytes.toString('base64') }, PAR.privada)).toThrow()
  })
})
