'use server'

import { z } from 'zod'
import { apagarAssinatura, guardarAssinatura } from './repos/assinaturas-de-push'
import { papelNaConta } from './repos/usuarios'
import { sessaoAtual } from './sessao'

/**
 * Ligar e desligar o aviso de handoff naquele navegador.
 *
 * Separado de `acoes.ts` e de `acoes-conta.ts` porque é o único par de ações
 * que o **navegador** aciona sozinho, sem formulário: quem chama é o
 * componente que negocia a permissão com o `PushManager`.
 */

/**
 * O que o `PushSubscription` entrega, conferido antes de virar linha.
 *
 * Isto chega de uma Server Action, ou seja, de um corpo que quem chama
 * escolhe. Conferir formato aqui é a mesma regra do webhook de entrada: nada
 * que vem de fora entra no banco sem passar por um schema.
 */
const assinaturaSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
})

export async function acaoAssinarAvisos(
  clienteId: string,
  bruta: unknown,
): Promise<{ ok: boolean }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false }

  /*
   * **Pertencer à conta, e não apenas estar logado.**
   *
   * Sem esta conferência, qualquer pessoa com sessão válida assinaria os avisos
   * de qualquer cliente cujo id ela adivinhasse — e o handoff de um cliente
   * chegaria, com nome do contato, no telefone de um estranho. O id vem da URL,
   * que é adivinhável; é a mesma regra que toda leitura por aqui já segue.
   */
  const papel = await papelNaConta(clienteId, sessao.usuario.id)
  if (!papel) return { ok: false }

  const conferida = assinaturaSchema.safeParse(bruta)
  if (!conferida.success) return { ok: false }

  await guardarAssinatura(clienteId, sessao.usuario.id, conferida.data)
  return { ok: true }
}

/**
 * Desligar não exige papel na conta.
 *
 * Quem já não pertence mais ao cliente ainda precisa conseguir parar de receber
 * — e o endpoint é do navegador de quem está chamando. Exigir papel aqui
 * deixaria alguém removido da conta recebendo aviso para sempre.
 */
export async function acaoCancelarAvisos(endpoint: unknown): Promise<{ ok: boolean }> {
  const sessao = await sessaoAtual()
  if (!sessao) return { ok: false }

  const conferido = z.string().url().max(2000).safeParse(endpoint)
  if (!conferido.success) return { ok: false }

  await apagarAssinatura(conferido.data)
  return { ok: true }
}
