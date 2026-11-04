/**
 * Áudio de voz em WAV, para o Instagram e o Messenger.
 *
 * O WhatsApp quer OGG/Opus (ver `audio-de-voz.ts`); a Send API do Instagram e
 * do Messenger lista `aac`, `m4a`, `wav` e `mp4`, e OGG não está lá. O navegador
 * não grava AAC utilizável (o MP4 que ele produz é fragmentado, mesmo motivo
 * de `audio-de-voz.ts`), então o caminho é decodificar o que foi gravado e
 * reescrever como PCM num WAV, que é só um cabeçalho de 44 bytes.
 *
 * 16 kHz mono 16 bits: 32 KB por segundo, cinco minutos (o teto da gravação)
 * dão 9,6 MB, abaixo dos 16 MB do acervo e dos 25 MB da Meta. É a taxa de
 * telefone de banda larga, sobra para voz.
 */

export const TAXA_DO_WAV = 16_000
export const MIME_WAV = 'audio/wav'

/** Amostras em ponto flutuante (-1 a 1), mono, viram um arquivo WAV PCM 16 bits. */
export function pcmParaWav(amostras: Float32Array, taxa: number = TAXA_DO_WAV): Uint8Array {
  const bytesDeDados = amostras.length * 2
  const buffer = new ArrayBuffer(44 + bytesDeDados)
  const v = new DataView(buffer)
  const escrever = (pos: number, texto: string) => {
    for (let i = 0; i < texto.length; i++) v.setUint8(pos + i, texto.charCodeAt(i))
  }

  escrever(0, 'RIFF')
  v.setUint32(4, 36 + bytesDeDados, true)
  escrever(8, 'WAVE')
  escrever(12, 'fmt ')
  v.setUint32(16, 16, true) // tamanho do bloco fmt
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, taxa, true)
  v.setUint32(28, taxa * 2, true) // bytes por segundo
  v.setUint16(32, 2, true) // bytes por amostra
  v.setUint16(34, 16, true) // bits por amostra
  escrever(36, 'data')
  v.setUint32(40, bytesDeDados, true)

  for (let i = 0; i < amostras.length; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i] ?? 0))
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buffer)
}
