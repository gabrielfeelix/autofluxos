/**
 * O que dá para ler de um Pix copia e cola (o BR Code, formato EMV do Banco
 * Central): quem recebe e a chave.
 *
 * Existe para a mensagem nativa de pedido do WhatsApp (`order_details`, etapa
 * E da cobrança), que exige nome, chave e tipo da chave ao lado do código. O
 * gateway devolve só o código; o resto está dentro dele.
 *
 * Pix dinâmico de alguns bancos (o do Asaas, por exemplo) traz uma URL no
 * lugar da chave. Aí não há chave para mostrar, e quem chama manda o Pix do
 * jeito de sempre.
 */

export type TipoDeChavePix = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'

export type PixLido = { nome: string; chave: string; tipoDaChave: TipoDeChavePix }

/** Campos EMV: dois dígitos de id, dois de tamanho, e o valor. */
function campos(texto: string): Map<string, string> {
  const lidos = new Map<string, string>()
  let i = 0
  while (i + 4 <= texto.length) {
    const id = texto.slice(i, i + 2)
    const tamanho = Number(texto.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(id) || !Number.isInteger(tamanho)) break
    lidos.set(id, texto.slice(i + 4, i + 4 + tamanho))
    i += 4 + tamanho
  }
  return lidos
}

export function tipoDaChavePix(chave: string): TipoDeChavePix {
  if (chave.includes('@')) return 'EMAIL'
  if (/^\+\d{10,15}$/.test(chave)) return 'PHONE'
  if (/^\d{11}$/.test(chave)) return 'CPF'
  if (/^\d{14}$/.test(chave)) return 'CNPJ'
  return 'EVP'
}

/** Nome e chave do recebedor, ou `null` quando o código não traz chave. */
export function lerPix(codigo: string | null | undefined): PixLido | null {
  if (!codigo) return null
  const topo = campos(codigo.trim())
  const nome = topo.get('59')?.trim()
  // A conta do recebedor mora entre 26 e 51; a do Pix tem o GUI do BC.
  for (let id = 26; id <= 51; id++) {
    const conta = campos(topo.get(String(id)) ?? '')
    if ((conta.get('00') ?? '').toLowerCase() !== 'br.gov.bcb.pix') continue
    const chave = conta.get('01')?.trim()
    if (!chave || !nome) return null
    return { nome, chave, tipoDaChave: tipoDaChavePix(chave) }
  }
  return null
}
