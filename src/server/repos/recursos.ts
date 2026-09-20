import 'server-only'
import {
  ehObjetivo,
  mostraCrm,
  nasceComCrm,
  OBJETIVO_PADRAO,
  type Objetivo,
} from '@/core/objetivo-da-conta'
import { db, ehIdInvalido } from '../db'

/**
 * O objetivo da conta e os recursos ligados (0084, T7.1).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que cada objetivo cobra é
 * `core/objetivo-da-conta.ts`.
 */

export type RecursosDaConta = {
  objetivo: Objetivo
  /** O valor gravado. A tela usa `crmVisivel`, que já considera os quadros. */
  crmAtivo: boolean
}

/**
 * O que a conta escolheu.
 *
 * Falha de leitura vira o default em vez de exceção, como `politicaDeEntrada`:
 * isto é lido para desenhar a barra lateral, e uma tela inteira não pode cair
 * porque a preferência de menu não foi lida. O default `atender` com
 * `crmAtivo: true` é o comportamento de hoje, e errar para ele não esconde nada
 * de ninguém.
 */
export async function recursosDaConta(clienteId: string): Promise<RecursosDaConta> {
  const { data, error } = await db()
    .from('clients')
    .select('objetivo, crm_ativo')
    .eq('id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error) || error || !data) {
    return { objetivo: OBJETIVO_PADRAO, crmAtivo: true }
  }

  const linha = data as { objetivo: string | null; crm_ativo: boolean | null }
  return {
    objetivo: ehObjetivo(linha.objetivo) ? linha.objetivo : OBJETIVO_PADRAO,
    // `null` só aconteceria com a coluna ausente, e aí `true` é o lado certo:
    // esconder o CRM por falta de leitura seria apagar uma tela por acidente.
    crmAtivo: linha.crm_ativo !== false,
  }
}

/**
 * Troca o objetivo da conta.
 *
 * **Não mexe em `crm_ativo`.** É a pergunta que custou uma decisão: mudar o
 * objetivo para `vender` poderia ligar o CRM sozinho, e mudar para `atender`
 * poderia desligá-lo. Os dois estão errados pelo mesmo motivo: quem já ligou o
 * CRM e depois diz "meu objetivo hoje é atender" não pediu para perder a tela,
 * e quem desligou de propósito não quer que uma resposta de onboarding a traga
 * de volta. Ligar o CRM é ação própria, com tela própria.
 *
 * `nasceComCrm` só vale na **criação** da conta, onde não há escolha anterior a
 * respeitar.
 */
export async function definirObjetivo(
  clienteId: string,
  objetivo: Objetivo,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!ehObjetivo(objetivo)) return { ok: false, motivo: 'esse objetivo não existe' }

  const { error } = await db().from('clients').update({ objetivo }).eq('id', clienteId)

  if (error) return { ok: false, motivo: `não deu para gravar o objetivo: ${error.message}` }
  return { ok: true }
}

/**
 * Liga ou desliga o CRM no menu.
 *
 * Devolve objeto e não booleano, pela armadilha que o handoff da F2 registrou:
 * `if (!objeto)` é sempre falso e o typecheck não avisa.
 */
export async function definirCrmAtivo(
  clienteId: string,
  ativo: boolean,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db().from('clients').update({ crm_ativo: ativo }).eq('id', clienteId)

  if (error) return { ok: false, motivo: `não deu para gravar: ${error.message}` }
  return { ok: true }
}

/**
 * O CRM aparece no menu desta conta?
 *
 * Duas idas ao banco, e a segunda só quando a primeira disse `false`: a conta
 * com o CRM ligado (que é a maioria, pelo default da 0084) não paga a contagem
 * de quadros para nada.
 */
export async function crmVisivel(clienteId: string): Promise<boolean> {
  const { crmAtivo } = await recursosDaConta(clienteId)
  if (crmAtivo) return true

  const { count, error } = await db()
    .from('quadros')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clienteId)

  // Erro aqui devolve `mostraCrm` com `temQuadro: false`, que é o valor gravado:
  // respeitar o que a conta escolheu é melhor do que mostrar por não ter lido.
  if (error) return mostraCrm({ ligado: false, temQuadro: false })
  return mostraCrm({ ligado: false, temQuadro: (count ?? 0) > 0 })
}

/** O `crm_ativo` que uma conta nova recebe, pelo objetivo escolhido. */
export function crmAoCriar(objetivo: Objetivo): boolean {
  return nasceComCrm(objetivo)
}
