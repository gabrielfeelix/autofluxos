/**
 * Trocar o contêiner de um áudio Opus: de WebM para OGG.
 *
 * ---------------------------------------------------------------------------
 * Por que isto precisou existir
 * ---------------------------------------------------------------------------
 *
 * O `MediaRecorder` grava em **streaming**: ele começa a escrever antes de
 * saber quanto tempo a gravação vai durar. Em MP4 isso obriga o formato
 * **fragmentado** (`fMP4`), e o preço aparece no arquivo pronto — medido no
 * áudio que não chegou em 15/set/2026:
 *
 * ```
 * moov → stbl → stts size=16, stsz size=20, stco size=16   (zero entradas)
 *        mvex                                              (declara fragmentos)
 * moof + mdat                                              (o áudio está aqui)
 * mvhd duration = 0
 * ```
 *
 * Não há índice de amostras nem duração no `moov`. Quem lê MP4 progressivo —
 * e é o que o WhatsApp faz — vê **zero amostras e duração zero**. O arquivo é
 * válido para quem entende fragmento e vazio para quem não entende. Daí o
 * sintoma: sobe, a Cloud API responde 200, e nada chega.
 *
 * **OGG não tem esse problema, por desenho.** Ele é um contêiner de streaming:
 * o áudio é uma sequência de páginas autossuficientes, sem índice no começo e
 * sem duração declarada. É também o que o WhatsApp usa nativamente para voz, e
 * o que a Meta documenta — *"audio/ogg (OPUS codecs only)"*.
 *
 * ---------------------------------------------------------------------------
 * Isto é remux, não conversão
 * ---------------------------------------------------------------------------
 *
 * O Chrome grava `audio/webm;codecs=opus`. Os pacotes Opus dentro desse WebM
 * são **byte a byte os mesmos** que entrariam num OGG — o que muda é o
 * envelope. Não há decodificação, não há reencode, não há perda de qualidade,
 * não entra WASM e não entra dependência nova. Só se tira os pacotes de um
 * contêiner e se escreve o outro à volta deles.
 *
 * ---------------------------------------------------------------------------
 * Referências
 * ---------------------------------------------------------------------------
 *
 * - RFC 3533 (contêiner Ogg) e RFC 7845 (Opus dentro de Ogg).
 * - Matroska/WebM: `CodecPrivate` de uma faixa `A_OPUS` **já é** o `OpusHead`
 *   da RFC 7845. É por isso que ele é copiado inteiro em vez de remontado.
 */

/** O que a Meta aceita como `audio/ogg`, e o que sai daqui. */
export const MIME_OGG_OPUS = 'audio/ogg'

/* ---------------------------------------------------------------------------
 * CRC do Ogg
 * ------------------------------------------------------------------------ */

/**
 * O CRC32 do Ogg **não é o CRC32 comum**, e confundir os dois é a forma
 * clássica de produzir um arquivo que nenhum player abre.
 *
 * O do zip/PNG reflete a entrada e a saída e inverte o resultado. O do Ogg usa
 * o mesmo polinômio (`0x04c11db7`) e **não faz nada disso**: sem reflexão, sem
 * valor inicial, sem XOR final.
 */
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0
    tabela[i] = r >>> 0
  }
  return tabela
})()

export function crcDoOgg(dados: Uint8Array): number {
  let crc = 0
  for (const byte of dados) {
    crc = ((crc << 8) ^ TABELA_CRC[((crc >>> 24) ^ byte) & 0xff]!) >>> 0
  }
  return crc >>> 0
}

/* ---------------------------------------------------------------------------
 * Quanto tempo dura um pacote Opus
 * ------------------------------------------------------------------------ */

/**
 * A duração de um pacote Opus, em amostras de 48 kHz.
 *
 * Ela não está em lugar nenhum do contêiner: está no **primeiro byte do
 * próprio pacote**, o TOC (RFC 6716 §3.1). É o que alimenta a `granule
 * position` de cada página do Ogg — o relógio que o player usa para mostrar a
 * duração e para procurar dentro do áudio.
 *
 * Errar isto não corrompe o arquivo: produz um áudio que toca certo e mostra a
 * duração errada, que é bem pior de descobrir.
 *
 * `0` quando o pacote é vazio ou malformado; quem chama trata.
 */
export function amostrasDoPacote(pacote: Uint8Array): number {
  if (pacote.length === 0) return 0

  const toc = pacote[0]!
  const config = toc >> 3

  /*
   * Três famílias, e cada uma tem a sua grade de durações:
   *   config  0–11  SILK    — 10, 20, 40, 60 ms
   *   config 12–15  Híbrido — 10, 20 ms
   *   config 16–31  CELT    — 2.5, 5, 10, 20 ms
   */
  let ms: number
  if (config < 12) ms = [10, 20, 40, 60][config % 4]!
  else if (config < 16) ms = [10, 20][config % 2]!
  else ms = [2.5, 5, 10, 20][config % 4]!

  // Os dois últimos bits do TOC dizem quantos quadros o pacote carrega.
  const codigo = toc & 0b11
  let quadros: number
  if (codigo === 0) quadros = 1
  else if (codigo === 1 || codigo === 2) quadros = 2
  else quadros = (pacote[1] ?? 0) & 0b0011_1111 // código 3: o contador vem no byte seguinte

  return Math.round(ms * 48 * quadros)
}

/* ---------------------------------------------------------------------------
 * Ler o WebM
 * ------------------------------------------------------------------------ */

/** Os poucos elementos que interessam. Matroska tem centenas; ignoramos o resto. */
const EBML = {
  segment: 0x18538067,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  codecId: 0x86,
  codecPrivate: 0x63a2,
  cluster: 0x1f43b675,
  simpleBlock: 0xa3,
  blockGroup: 0xa0,
  block: 0xa1,
} as const

/** Os que têm filhos e nos quais descemos. */
const MASTERS = new Set<number>([
  EBML.segment,
  EBML.tracks,
  EBML.trackEntry,
  EBML.cluster,
  EBML.blockGroup,
])

/**
 * Lê um identificador EBML. Ele **mantém** os bits marcadores — `0xA3` é o id
 * do `SimpleBlock`, não `0x23`. Tirar os marcadores aqui é um erro comum e faz
 * todos os ids colidirem.
 */
function lerId(d: Uint8Array, p: number): { valor: number; tamanho: number } | null {
  const primeiro = d[p]
  if (primeiro === undefined || primeiro === 0) return null
  let comprimento = 1
  for (let mascara = 0x80; comprimento <= 4; comprimento++, mascara >>= 1) {
    if (primeiro & mascara) break
  }
  if (comprimento > 4 || p + comprimento > d.length) return null
  let valor = 0
  for (let i = 0; i < comprimento; i++) valor = valor * 256 + d[p + i]!
  return { valor, tamanho: comprimento }
}

/**
 * Lê um tamanho EBML. Aqui os marcadores **saem**, ao contrário do id.
 *
 * `desconhecido` é o caso que importa: o `MediaRecorder` escreve o `Segment` (e
 * às vezes os `Cluster`) com tamanho desconhecido, porque em streaming ele não
 * sabe onde vão acabar. Tratar isso como tamanho zero faria a varredura parar
 * no começo do arquivo e devolver um áudio vazio.
 */
function lerTamanho(
  d: Uint8Array,
  p: number,
): { valor: number; tamanho: number; desconhecido: boolean } | null {
  const primeiro = d[p]
  if (primeiro === undefined || primeiro === 0) return null
  let comprimento = 1
  let mascara = 0x80
  while (comprimento <= 8 && !(primeiro & mascara)) {
    comprimento++
    mascara >>= 1
  }
  if (comprimento > 8 || p + comprimento > d.length) return null

  let valor = primeiro & (mascara - 1)
  let todosUns = valor === mascara - 1
  for (let i = 1; i < comprimento; i++) {
    const b = d[p + i]!
    valor = valor * 256 + b
    if (b !== 0xff) todosUns = false
  }
  return { valor, tamanho: comprimento, desconhecido: todosUns }
}

type FaixaOpus = { opusHead: Uint8Array }

/**
 * Percorre o WebM e junta o `OpusHead` e os pacotes de áudio, em ordem.
 *
 * Uma varredura só, recursiva nos elementos que têm filhos. Não há índice a
 * consultar (o `Cues` costuma nem existir num arquivo de streaming) e não
 * precisa: os `Cluster` já estão em ordem de tempo no arquivo.
 */
function lerWebmOpus(d: Uint8Array): { faixa: FaixaOpus; pacotes: Uint8Array[] } | null {
  let opusHead: Uint8Array | null = null
  let codecDaFaixa = ''
  const pacotes: Uint8Array[] = []

  function bloco(corpo: Uint8Array) {
    // SimpleBlock: número da faixa (VINT) · timecode (int16) · flags (1) · quadros
    const faixa = lerTamanho(corpo, 0)
    if (!faixa) return
    const inicio = faixa.tamanho + 3
    if (inicio >= corpo.length) return

    const flags = corpo[faixa.tamanho + 2]!
    const lacing = (flags >> 1) & 0b11

    /*
     * Lacing junta vários quadros num bloco só. Áudio do `MediaRecorder` vem
     * sem lacing (`0`), que é o caso que importa. Os outros três existem no
     * formato e não os montamos: em vez de adivinhar e produzir um áudio
     * embaralhado, devolvemos nada e quem chama diz isso na tela.
     */
    if (lacing !== 0) throw new Error('lacing não suportado')

    pacotes.push(corpo.subarray(inicio))
  }

  function varrer(inicio: number, fim: number) {
    let p = inicio
    while (p < fim) {
      const id = lerId(d, p)
      if (!id) return
      const tam = lerTamanho(d, p + id.tamanho)
      if (!tam) return

      const corpoEm = p + id.tamanho + tam.tamanho
      const corpoAte = tam.desconhecido ? fim : Math.min(corpoEm + tam.valor, fim)

      switch (id.valor) {
        case EBML.codecId:
          codecDaFaixa = new TextDecoder().decode(d.subarray(corpoEm, corpoAte)).replace(/\0+$/, '')
          break
        case EBML.codecPrivate:
          if (!opusHead) opusHead = d.subarray(corpoEm, corpoAte)
          break
        case EBML.simpleBlock:
        case EBML.block:
          bloco(d.subarray(corpoEm, corpoAte))
          break
        default:
          if (MASTERS.has(id.valor)) varrer(corpoEm, corpoAte)
      }

      /*
       * Tamanho desconhecido num master significa "vai até onde o pai acabar".
       * Já descemos nele acima, então não há mais irmãos a visitar aqui.
       */
      if (tam.desconhecido) return
      p = corpoAte
    }
  }

  varrer(0, d.length)

  if (!opusHead || pacotes.length === 0) return null
  if (codecDaFaixa !== '' && codecDaFaixa !== 'A_OPUS') return null
  return { faixa: { opusHead }, pacotes }
}

/* ---------------------------------------------------------------------------
 * Escrever o OGG
 * ------------------------------------------------------------------------ */

const MAX_SEGMENTOS = 255

/** Divide um pacote em segmentos de lacing de no máximo 255 bytes. */
function lacing(tamanho: number): number[] {
  const segmentos: number[] = []
  let resto = tamanho
  while (resto >= 255) {
    segmentos.push(255)
    resto -= 255
  }
  /*
   * O segmento final **sempre** entra, mesmo valendo zero. É ele que diz "o
   * pacote acabou aqui": um pacote de exatamente 255 bytes sem o zero no fim
   * seria lido como um pacote que continua na página seguinte.
   */
  segmentos.push(resto)
  return segmentos
}

function montarPagina(
  tipo: number,
  granule: bigint,
  serial: number,
  sequencia: number,
  segmentos: number[],
  carga: Uint8Array,
): Uint8Array {
  const pagina = new Uint8Array(27 + segmentos.length + carga.length)
  const visao = new DataView(pagina.buffer)

  pagina.set([0x4f, 0x67, 0x67, 0x53], 0) // "OggS"
  pagina[4] = 0 // versão
  pagina[5] = tipo
  visao.setBigUint64(6, granule, true)
  visao.setUint32(14, serial, true)
  visao.setUint32(18, sequencia, true)
  visao.setUint32(22, 0, true) // o CRC entra depois, com o campo zerado
  pagina[26] = segmentos.length
  pagina.set(segmentos, 27)
  pagina.set(carga, 27 + segmentos.length)

  visao.setUint32(22, crcDoOgg(pagina), true)
  return pagina
}

/**
 * Troca o contêiner de WebM/Opus para OGG/Opus.
 *
 * `null` quando a entrada não é um WebM com faixa Opus — e `null` é resposta
 * legítima, não erro: quem chama transforma numa frase na tela em vez de subir
 * um arquivo que a Meta recusaria em silêncio.
 */
export function webmOpusParaOgg(webm: Uint8Array): Uint8Array | null {
  let lido: ReturnType<typeof lerWebmOpus>
  try {
    lido = lerWebmOpus(webm)
  } catch {
    return null
  }
  if (!lido) return null

  const { opusHead } = lido.faixa
  // `OpusHead` tem 19 bytes no mapeamento family 0. Menor que isso não é um.
  if (opusHead.length < 19 || new TextDecoder().decode(opusHead.subarray(0, 8)) !== 'OpusHead') {
    return null
  }

  /*
   * O serial identifica o fluxo dentro do arquivo. Qualquer número serve, desde
   * que seja o mesmo em todas as páginas — aqui há um fluxo só.
   */
  const serial = (Math.random() * 0xffffffff) >>> 0
  const paginas: Uint8Array[] = []
  let sequencia = 0

  // Página de abertura: só o OpusHead, e ela é sempre sozinha (RFC 7845 §3).
  paginas.push(montarPagina(0x02, 0n, serial, sequencia++, lacing(opusHead.length), opusHead))

  // OpusTags, obrigatório e logo em seguida. Vendor vazio, zero comentários.
  const marca = new TextEncoder().encode('OpusTags')
  const tags = new Uint8Array(marca.length + 8)
  tags.set(marca, 0)
  new DataView(tags.buffer).setUint32(marca.length, 0, true) // vendor de tamanho 0
  new DataView(tags.buffer).setUint32(marca.length + 4, 0, true) // nenhum comentário
  paginas.push(montarPagina(0x00, 0n, serial, sequencia++, lacing(tags.length), tags))

  /*
   * As páginas de áudio.
   *
   * A `granule position` de uma página é a do **último** pacote que termina
   * nela, contada em amostras de 48 kHz — é o relógio que o player usa para
   * mostrar a duração e para procurar dentro do áudio.
   */
  let granule = 0n
  let segmentos: number[] = []
  const carga: Uint8Array[] = []
  let bytesNaPagina = 0

  const fechar = (ultima: boolean) => {
    if (segmentos.length === 0) return
    const corpo = new Uint8Array(bytesNaPagina)
    let em = 0
    for (const parte of carga) {
      corpo.set(parte, em)
      em += parte.length
    }
    paginas.push(montarPagina(ultima ? 0x04 : 0x00, granule, serial, sequencia++, segmentos, corpo))
    segmentos = []
    carga.length = 0
    bytesNaPagina = 0
  }

  for (const pacote of lido.pacotes) {
    const doPacote = lacing(pacote.length)

    /*
     * Uma página comporta no máximo 255 segmentos. Quando o próximo pacote não
     * cabe inteiro, a página atual fecha — assim nenhum pacote fica partido
     * entre páginas, que é o que manteria o `granule` ambíguo.
     */
    if (segmentos.length + doPacote.length > MAX_SEGMENTOS) fechar(false)

    segmentos.push(...doPacote)
    carga.push(pacote)
    bytesNaPagina += pacote.length
    granule += BigInt(amostrasDoPacote(pacote))
  }
  fechar(true)

  const total = paginas.reduce((soma, p) => soma + p.length, 0)
  const ogg = new Uint8Array(total)
  let em = 0
  for (const p of paginas) {
    ogg.set(p, em)
    em += p.length
  }
  return ogg
}
