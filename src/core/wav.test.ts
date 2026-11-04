import { describe, expect, it } from 'vitest'
import { pcmParaWav } from './wav'

describe('pcmParaWav', () => {
  it('escreve o cabeçalho RIFF de PCM mono 16 bits e as amostras', () => {
    const wav = pcmParaWav(new Float32Array([0, 1, -1, 2]), 16_000)
    const v = new DataView(wav.buffer)
    const texto = (i: number) => String.fromCharCode(...wav.slice(i, i + 4))

    expect(wav.byteLength).toBe(44 + 8)
    expect(texto(0)).toBe('RIFF')
    expect(texto(8)).toBe('WAVE')
    expect(v.getUint16(22, true)).toBe(1)
    expect(v.getUint32(24, true)).toBe(16_000)
    expect(v.getUint32(40, true)).toBe(8)
    expect(v.getInt16(44, true)).toBe(0)
    expect(v.getInt16(46, true)).toBe(0x7fff)
    expect(v.getInt16(48, true)).toBe(-0x8000)
    // Acima de 1 é cortado, não estoura.
    expect(v.getInt16(50, true)).toBe(0x7fff)
  })
})
