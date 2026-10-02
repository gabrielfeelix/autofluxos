/**
 * Senha provisória de 14 caracteres, sem os que se confundem ao ditar (0/O,
 * 1/l/I). Roda no navegador: quem dá o acesso precisa ver a senha para passar
 * para a pessoa.
 */
export function senhaAleatoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (byte) => letras[byte % letras.length]).join('')
}
