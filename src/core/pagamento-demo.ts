/**
 * O pagamento de mentira da demonstração (docs/DEMO.md).
 *
 * A demo precisa parecer um negócio de verdade até o fim: quem escolhe Pix
 * recebe o QR Code com o valor e o código "copia e cola"; quem escolhe cartão
 * recebe um link de pagamento. Nada disso cobra ninguém.
 *
 * **O código Pix tem o formato de verdade** (o BR Code do Banco Central, com o
 * CRC no fim), para o app do banco ler o QR e mostrar valor e nome. A chave é
 * uma chave aleatória inventada, que não está cadastrada em banco nenhum: o
 * app para em "chave não encontrada" e ninguém paga nada. Não troque por uma
 * chave real, nem "só para testar".
 */

/** Chave aleatória inventada: não existe no DICT, então não recebe dinheiro. */
export const CHAVE_PIX_DA_DEMO = 'a3f1c9e7-5b2d-4c8e-9f10-7d2b6e4a1c58'

export const NUMERO_DA_DEMO = '554474007438'

/** "95,80", "95.80" ou "R$ 1.095,80" viram 95.8; o resto vira null. */
export function lerValor(bruto: string | null | undefined): number | null {
  if (!bruto) return null
  let t = bruto.replace(/[^\d.,]/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const v = Number(t)
  if (!Number.isFinite(v) || v <= 0 || v > 99_999) return null
  return Math.round(v * 100) / 100
}

/** Nome de loja que cabe no QR e na tela: sem símbolo estranho, até 25 letras. */
export function limparNome(bruto: string | null | undefined): string {
  const t = (bruto ?? '').replace(/[^\p{L}\p{N} .&'-]/gu, '').replace(/\s+/g, ' ').trim()
  return [...t].slice(0, 25).join('') || 'Loja Exemplo'
}

export const reaisDito = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function campo(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`
}

/** O nome no BR Code é ASCII em maiúscula, sem acento. */
function ascii(t: string, max: number): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max).trim() || 'LOJA'
}

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), o do BR Code. */
export function crc16(t: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(t)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** O "copia e cola" com valor e nome, no formato do Banco Central. */
export function codigoPix(valor: number, nome: string): string {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', CHAVE_PIX_DA_DEMO)
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('54', valor.toFixed(2)) +
    campo('58', 'BR') +
    campo('59', ascii(nome, 25)) +
    campo('60', 'MARINGA') +
    campo('62', campo('05', 'DEMO4YU')) +
    '6304'
  return corpo + crc16(corpo)
}
