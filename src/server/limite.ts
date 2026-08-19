import 'server-only'
import { db } from './db'

/** Janela comum: cinco tentativas e cinco minutos por endereço e finalidade. */
export const TETO_DE_TENTATIVAS = 5
export const JANELA_DE_TENTATIVAS_SEGUNDOS = 5 * 60

/**
 * O simulador tem janela própria — e é **muito** mais larga.
 *
 * Ele estava no teto de login: 5 chamadas por 5 minutos. Faz todo sentido para
 * quem tenta adivinhar senha e nenhum para a aba Testar, onde **cada mensagem
 * da conversa é uma chamada**: na sexta mensagem o editor travava por cinco
 * minutos, e o sintoma na tela era o pior possível — o bot simplesmente parava
 * de responder, sem erro visível, exatamente como um fluxo quebrado. Clicar em
 * "recomeçar" gastava mais uma chamada e afundava mais.
 *
 * 60 por minuto é conversa rápida de gente testando (uma mensagem por segundo,
 * ininterruptas) e continua barrando script: a rota dispara IA e chamada de API
 * de verdade, então ela não pode ficar sem teto nenhum.
 */
export const TETO_DO_SIMULADOR = 60
export const JANELA_DO_SIMULADOR_SEGUNDOS = 60

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
