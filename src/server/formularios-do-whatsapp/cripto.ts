import { createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt, constants } from 'node:crypto'

/**
 * A criptografia do endpoint de dados do WhatsApp Flows (o formulário nativo).
 *
 * Cada chamada da Meta chega com três campos em base64:
 *
 * - `encrypted_aes_key`: uma chave AES-128 nova, cifrada com a **nossa chave
 *   pública** (RSA-OAEP, SHA-256 no hash e no MGF1). Só a privada abre;
 * - `initial_vector`: o IV do AES-GCM;
 * - `encrypted_flow_data`: o JSON do pedido em AES-128-GCM, com a etiqueta de
 *   16 bytes colada no fim.
 *
 * A resposta volta com a **mesma** chave AES e o IV invertido bit a bit (cada
 * byte XOR 0xFF), também com a etiqueta no fim, em base64, como texto puro.
 *
 * A chave privada mora no cofre (`cofre.ts`), nunca no repositório nem no
 * banco. Este arquivo não sabe de onde ela vem: recebe o PEM.
 */

export type ParDeChaves = { publica: string; privada: string }

/** RSA 2048, como a Meta pede. A pública vai para o número; a privada, para o cofre. */
export function gerarParDeChaves(): ParDeChaves {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { publica: publicKey, privada: privateKey }
}

export type CorpoCifrado = {
  encrypted_flow_data: string
  encrypted_aes_key: string
  initial_vector: string
}

export function ehCorpoCifrado(valor: unknown): valor is CorpoCifrado {
  if (!valor || typeof valor !== 'object') return false
  const v = valor as Record<string, unknown>
  return (
    typeof v.encrypted_flow_data === 'string' &&
    typeof v.encrypted_aes_key === 'string' &&
    typeof v.initial_vector === 'string'
  )
}

export type PedidoAberto = {
  /** O JSON que a Meta mandou, já decifrado. */
  dados: unknown
  /** Guardados só para cifrar a resposta desta mesma chamada. */
  chaveAes: Buffer
  iv: Buffer
}

const TAMANHO_DA_ETIQUETA = 16

/**
 * Decifra o pedido. Lança em qualquer falha (chave errada, etiqueta que não
 * bate, JSON torto): quem chama responde 421, e a Meta baixa a chave pública de
 * novo e repete.
 */
export function abrirPedido(corpo: CorpoCifrado, chavePrivada: string): PedidoAberto {
  const chaveAes = privateDecrypt(
    { key: chavePrivada, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(corpo.encrypted_aes_key, 'base64'),
  )
  if (chaveAes.length !== 16) throw new Error(`chave AES de ${chaveAes.length} bytes, esperava 16`)

  const iv = Buffer.from(corpo.initial_vector, 'base64')
  const cifrado = Buffer.from(corpo.encrypted_flow_data, 'base64')
  if (cifrado.length < TAMANHO_DA_ETIQUETA) throw new Error('dados cifrados menores que a etiqueta')

  const decifrador = createDecipheriv('aes-128-gcm', chaveAes, iv)
  decifrador.setAuthTag(cifrado.subarray(cifrado.length - TAMANHO_DA_ETIQUETA))
  const claro = Buffer.concat([decifrador.update(cifrado.subarray(0, cifrado.length - TAMANHO_DA_ETIQUETA)), decifrador.final()])
  return { dados: JSON.parse(claro.toString('utf8')) as unknown, chaveAes, iv }
}

/** O IV da resposta: o do pedido com cada bit invertido. */
export function ivInvertido(iv: Buffer): Buffer {
  return Buffer.from(iv.map((byte) => byte ^ 0xff))
}

/** Cifra a resposta com a chave do pedido. O corpo HTTP é este base64, como `text/plain`. */
export function fecharResposta(resposta: unknown, pedido: Pick<PedidoAberto, 'chaveAes' | 'iv'>): string {
  const cifrador = createCipheriv('aes-128-gcm', pedido.chaveAes, ivInvertido(pedido.iv))
  const cifrado = Buffer.concat([cifrador.update(JSON.stringify(resposta), 'utf8'), cifrador.final()])
  return Buffer.concat([cifrado, cifrador.getAuthTag()]).toString('base64')
}
