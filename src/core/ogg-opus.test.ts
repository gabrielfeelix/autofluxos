import { describe, expect, it } from 'vitest'
import { amostrasDoPacote, crcDoOgg, webmOpusParaOgg } from './ogg-opus'

/**
 * O remux existe por causa de uma falha medida, não de uma preferência.
 *
 * O `MediaRecorder` grava em streaming, e em MP4 isso obriga o formato
 * fragmentado: o arquivo que não chegou em 15/set/2026 tinha `stts`, `stsz` e
 * `stco` vazios, `mvex` presente e `mvhd duration = 0`. Quem lê MP4 progressivo
 * — e é o que o WhatsApp faz — vê zero amostras. OGG não tem esse problema por
 * desenho: é um contêiner de streaming, sem índice e sem duração no cabeçalho.
 */

/* --------------------------------------------------------------------------
 * Um WebM mínimo, montado à mão
 * ----------------------------------------------------------------------- */

function vint(n: number): number[] {
  // Só os tamanhos pequenos que estes testes usam (1 byte, até 127).
  if (n < 0x80) return [0x80 | n]
  return [0x40 | (n >> 8), n & 0xff]
}

function elemento(id: number[], corpo: number[]): number[] {
  return [...id, ...vint(corpo.length), ...corpo]
}

/** `OpusHead` de 19 bytes, mapeamento family 0, mono, 48 kHz. */
const OPUS_HEAD = [
  ...[...'OpusHead'].map((c) => c.charCodeAt(0)),
  1, // versão
  1, // canais — mono, que é o que a Meta exige
  0x38, 0x01, // pre-skip 312
  0x80, 0xbb, 0x00, 0x00, // 48000 LE
  0, 0, // ganho
  0, // mapping family
]

/** TOC de 20 ms CELT fullband mono: config 31 (`0xF8`), um quadro. */
const TOC_20MS = 0xf8

function pacoteOpus(bytes: number): number[] {
  return [TOC_20MS, ...Array.from({ length: bytes - 1 }, (_, i) => i % 251)]
}

function simpleBlock(pacote: number[]): number[] {
  // faixa 1 (VINT) · timecode int16 · flags (sem lacing) · quadro
  return elemento([0xa3], [0x81, 0x00, 0x00, 0x80, ...pacote])
}

function webmDeTeste(pacotes: number[][], tamanhoDesconhecido = false): Uint8Array {
  const tracks = elemento(
    [0x16, 0x54, 0xae, 0x6b],
    elemento(
      [0xae],
      [
        ...elemento([0x86], [...'A_OPUS'].map((c) => c.charCodeAt(0))),
        ...elemento([0x63, 0xa2], OPUS_HEAD),
      ],
    ),
  )
  const cluster = elemento([0x1f, 0x43, 0xb6, 0x75], pacotes.flatMap(simpleBlock))
  const corpo = [...tracks, ...cluster]

  /*
   * Tamanho desconhecido é o caso real: o `MediaRecorder` escreve o `Segment`
   * assim porque, gravando, ele não sabe onde o arquivo vai acabar.
   */
  const tamanho = tamanhoDesconhecido ? [0xff] : vint(corpo.length)
  return new Uint8Array([0x18, 0x53, 0x80, 0x67, ...tamanho, ...corpo])
}

/* --------------------------------------------------------------------------
 * Testes
 * ----------------------------------------------------------------------- */

describe('crcDoOgg', () => {
  /*
   * O CRC do Ogg NÃO é o CRC32 do zip: mesmo polinômio, mas sem reflexão de
   * entrada, sem valor inicial e sem XOR final. Usar o comum produz um arquivo
   * que nenhum player abre, e o sintoma é "o áudio não toca" — sem pista.
   */
  it('confere com uma implementação bit a bit independente', () => {
    const bitAbit = (dados: Uint8Array) => {
      let crc = 0
      for (const byte of dados) {
        crc = (crc ^ (byte << 24)) >>> 0
        for (let i = 0; i < 8; i++) {
          crc = crc & 0x80000000 ? ((crc << 1) ^ 0x04c11db7) >>> 0 : (crc << 1) >>> 0
        }
      }
      return crc >>> 0
    }

    for (const amostra of [
      new Uint8Array(0),
      new Uint8Array([0]),
      new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
      new Uint8Array(Array.from({ length: 300 }, (_, i) => (i * 7) % 256)),
    ]) {
      expect(crcDoOgg(amostra)).toBe(bitAbit(amostra))
    }
  })

  it('muda quando um único bit muda', () => {
    const a = new Uint8Array([1, 2, 3, 4])
    const b = new Uint8Array([1, 2, 3, 5])
    expect(crcDoOgg(a)).not.toBe(crcDoOgg(b))
  })
})

describe('amostrasDoPacote', () => {
  /*
   * A duração não está no contêiner: está no primeiro byte do pacote, o TOC.
   * Errar isto não corrompe nada — produz um áudio que toca certo e mostra a
   * duração errada, que é bem pior de descobrir.
   */
  it('lê 20 ms de CELT fullband como 960 amostras a 48 kHz', () => {
    expect(amostrasDoPacote(new Uint8Array([0xf8]))).toBe(960)
  })

  it('lê as quatro durações do SILK', () => {
    // config 0..3 → 10, 20, 40, 60 ms
    expect(amostrasDoPacote(new Uint8Array([0 << 3]))).toBe(480)
    expect(amostrasDoPacote(new Uint8Array([1 << 3]))).toBe(960)
    expect(amostrasDoPacote(new Uint8Array([2 << 3]))).toBe(1920)
    expect(amostrasDoPacote(new Uint8Array([3 << 3]))).toBe(2880)
  })

  it('lê 2,5 ms do CELT sem virar fração de amostra', () => {
    expect(amostrasDoPacote(new Uint8Array([16 << 3]))).toBe(120)
  })

  it('multiplica pelos quadros que o código do TOC anuncia', () => {
    expect(amostrasDoPacote(new Uint8Array([(1 << 3) | 1]))).toBe(1920) // 2 quadros
    expect(amostrasDoPacote(new Uint8Array([(1 << 3) | 3, 5]))).toBe(4800) // 5 quadros
  })

  it('pacote vazio não estoura', () => {
    expect(amostrasDoPacote(new Uint8Array([]))).toBe(0)
  })
})

describe('webmOpusParaOgg', () => {
  const ler = (d: Uint8Array) => new DataView(d.buffer, d.byteOffset)

  it('produz um OGG que começa com a assinatura e o OpusHead', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40)]))!
    expect(ogg).not.toBeNull()
    expect([...ogg.subarray(0, 4)]).toEqual([0x4f, 0x67, 0x67, 0x53]) // "OggS"
    // 27 bytes de cabeçalho + 1 de tabela de segmentos → começa o OpusHead
    expect(new TextDecoder().decode(ogg.subarray(28, 36))).toBe('OpusHead')
  })

  it('a primeira página é BOS e sozinha, como a RFC 7845 exige', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40)]))!
    expect(ogg[5]).toBe(0x02) // header_type = início do fluxo
  })

  it('o OpusTags vem logo depois do OpusHead', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40)]))!
    expect(new TextDecoder().decode(ogg).includes('OpusTags')).toBe(true)
  })

  /*
   * O CRC é o que separa "arquivo válido" de "arquivo que nenhum player abre".
   * Este teste refaz o cálculo de cada página como um leitor faria.
   */
  it('todas as páginas fecham com o CRC certo', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(60), pacoteOpus(80), pacoteOpus(70)]))!
    let p = 0
    let paginas = 0

    while (p < ogg.length) {
      expect([...ogg.subarray(p, p + 4)]).toEqual([0x4f, 0x67, 0x67, 0x53])
      const nSegmentos = ogg[p + 26]!
      const tabela = ogg.subarray(p + 27, p + 27 + nSegmentos)
      const bytes = [...tabela].reduce((s, n) => s + n, 0)
      const fim = p + 27 + nSegmentos + bytes

      const copia = ogg.slice(p, fim)
      const guardado = ler(copia).getUint32(22, true)
      new DataView(copia.buffer).setUint32(22, 0, true)
      expect(crcDoOgg(copia), `página ${paginas}`).toBe(guardado)

      p = fim
      paginas++
    }
    expect(paginas).toBeGreaterThanOrEqual(3)
  })

  it('a última página é marcada como fim do fluxo', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40), pacoteOpus(40)]))!
    let p = 0
    let ultimoTipo = -1
    while (p < ogg.length) {
      ultimoTipo = ogg[p + 5]!
      const n = ogg[p + 26]!
      const bytes = [...ogg.subarray(p + 27, p + 27 + n)].reduce((s, x) => s + x, 0)
      p = p + 27 + n + bytes
    }
    expect(ultimoTipo).toBe(0x04)
  })

  it('a granule final soma a duração de todos os pacotes', () => {
    // Três pacotes de 20 ms = 3 × 960 amostras.
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40), pacoteOpus(40), pacoteOpus(40)]))!
    let p = 0
    let granuleFinal = 0n
    while (p < ogg.length) {
      granuleFinal = new DataView(ogg.buffer, ogg.byteOffset + p).getBigUint64(6, true)
      const n = ogg[p + 26]!
      const bytes = [...ogg.subarray(p + 27, p + 27 + n)].reduce((s, x) => s + x, 0)
      p = p + 27 + n + bytes
    }
    expect(granuleFinal).toBe(2880n)
  })

  /*
   * O `Segment` com tamanho desconhecido é o caso REAL: é assim que o
   * `MediaRecorder` escreve, porque gravando ele não sabe onde o arquivo acaba.
   * Tratar isso como tamanho zero devolveria um áudio vazio.
   */
  it('lê o Segment de tamanho desconhecido, que é como o navegador grava', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40)], true))
    expect(ogg).not.toBeNull()
    expect(new TextDecoder().decode(ogg!.subarray(28, 36))).toBe('OpusHead')
  })

  it('devolve null para entrada que não é WebM', () => {
    expect(webmOpusParaOgg(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull()
    expect(webmOpusParaOgg(new Uint8Array(0))).toBeNull()
  })

  it('devolve null quando não há pacote nenhum, em vez de um OGG vazio', () => {
    expect(webmOpusParaOgg(webmDeTeste([]))).toBeNull()
  })

  /*
   * Pacote de exatamente 255 bytes precisa de um segmento zero no fim. Sem ele,
   * o leitor acha que o pacote continua na página seguinte e o áudio sai
   * truncado — e só no fim do arquivo.
   */
  it('fecha pacote de 255 bytes com o segmento zero', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(255)]))!
    // Terceira página (0: head, 1: tags, 2: áudio).
    let p = 0
    for (let i = 0; i < 2; i++) {
      const n = ogg[p + 26]!
      const bytes = [...ogg.subarray(p + 27, p + 27 + n)].reduce((s, x) => s + x, 0)
      p = p + 27 + n + bytes
    }
    const nSeg = ogg[p + 26]!
    const tabela = [...ogg.subarray(p + 27, p + 27 + nSeg)]
    expect(tabela).toEqual([255, 0])
  })

  it('quebra em várias páginas quando passa de 255 segmentos', () => {
    const muitos = Array.from({ length: 300 }, () => pacoteOpus(40))
    const ogg = webmOpusParaOgg(webmDeTeste(muitos))!
    let p = 0
    let paginas = 0
    while (p < ogg.length) {
      const n = ogg[p + 26]!
      expect(n).toBeLessThanOrEqual(255)
      const bytes = [...ogg.subarray(p + 27, p + 27 + n)].reduce((s, x) => s + x, 0)
      p = p + 27 + n + bytes
      paginas++
    }
    // head + tags + pelo menos duas de áudio
    expect(paginas).toBeGreaterThanOrEqual(4)
  })

  it('a sequência de páginas é contínua, que é o que o leitor confere', () => {
    const ogg = webmOpusParaOgg(webmDeTeste([pacoteOpus(40), pacoteOpus(40)]))!
    let p = 0
    let esperada = 0
    while (p < ogg.length) {
      const seq = new DataView(ogg.buffer, ogg.byteOffset + p).getUint32(18, true)
      expect(seq).toBe(esperada++)
      const n = ogg[p + 26]!
      const bytes = [...ogg.subarray(p + 27, p + 27 + n)].reduce((s, x) => s + x, 0)
      p = p + 27 + n + bytes
    }
  })
})
