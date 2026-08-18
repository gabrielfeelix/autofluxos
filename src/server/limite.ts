import 'server-only'
import { db } from './db'

/** Janela comum: cinco tentativas e cinco minutos por endereço e finalidade. */
export const TETO_DE_TENTATIVAS = 5
export const JANELA_DE_TENTATIVAS_SEGUNDOS = 5 * 60

/**
 * O primeiro proxy é quem viu a conexão de fora. Não confiamos no corpo da
 * requisição para formar a chave; sem cabeçalho, todas as chamadas desconhecidas
 * ficam juntas e o comportamento continua seguro.
 */
export function chaveDeLimite(
  finalidade: 'login' | 'cadastro' | 'simular',
  cabecalhos: Headers,
): string {
  const encaminhado = cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim()
  const endereco = encaminhado || cabecalhos.get('x-real-ip') || 'desconhecido'
  return `${finalidade}:${endereco}`
}

/** Consome uma tentativa no Postgres; erro de infraestrutura fecha a porta. */
export async function consumirLimite(
  chave: string,
  teto = TETO_DE_TENTATIVAS,
  janelaSegundos = JANELA_DE_TENTATIVAS_SEGUNDOS,
): Promise<boolean> {
  try {
    const { data, error } = await db().rpc('consumir_limite', {
      p_chave: chave,
      p_teto: teto,
      p_janela_segundos: janelaSegundos,
    })
    return !error && data === true
  } catch {
    return false
  }
}
