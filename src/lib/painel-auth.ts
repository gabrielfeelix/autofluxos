export const COOKIE_PAINEL = 'autofluxos_painel'
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 12

/**
 * Deriva um token opaco da senha configurada sem colocar a senha no cookie.
 * Trocar PAINEL_SENHA invalida todas as sessões existentes automaticamente.
 */
export async function tokenDaSenha(senha: string): Promise<string> {
  const bytes = new TextEncoder().encode(`autofluxos:painel:v1:${senha}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Compara sem sair cedo no primeiro caractere diferente. */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}
