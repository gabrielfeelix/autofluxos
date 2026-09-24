'use server'

import { revalidatePath } from 'next/cache'
import type { Anotacao } from '@/core/anotacoes'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { registrarAnotacao } from './repos/eventos'
import { contatoEhDoCliente } from './repos/crm'
import { acharCartao, preverFechamento, trocarDeFunil } from './repos/quadros'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações da página do negócio (F2 do plano de 24/09).
 *
 * Arquivo próprio pelo mesmo motivo de `acoes-crm.ts`: `acoes.ts` passou de
 * 2.500 linhas e outro trabalho mexe nele. **Nenhuma revalida a página do
 * negócio**: a tela muda na hora e o servidor grava por trás. Revalidam o
 * funil, que não está aberto, para ele não mostrar dado velho na volta.
 */

function funil(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/quadros`)
}

/** `YYYY-MM-DD` ou vazio, que apaga a previsão. */
export async function acaoPreverFechamento(
  clienteId: string,
  cartaoId: string,
  data: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const r = await preverFechamento(clienteId, cartaoId, data.trim() || null)
  if (!r.ok) return { ok: false, erro: r.motivo }
  funil(clienteId)
  return { ok: true }
}

export async function acaoTrocarDeFunil(
  clienteId: string,
  cartaoId: string,
  quadroId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'criar_oportunidade', 'proprios')
  if (recusou(acesso)) return acesso

  const quem = await sessaoAtual()
  const r = await trocarDeFunil(clienteId, cartaoId, quadroId, quem?.usuario.nome ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }
  funil(clienteId)
  return { ok: true }
}

/**
 * Anotação feita na página do negócio: vai para o diário da pessoa, como as
 * outras, e leva o `cartaoId` para aparecer no histórico deste negócio.
 */
export async function acaoAnotarNoNegocio(
  clienteId: string,
  contatoId: string,
  cartaoId: string,
  texto: string,
): Promise<{ ok: true; anotacao: Anotacao } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const limpo = texto.trim().slice(0, LIMITE_DA_NOTA)
  if (limpo === '') return { ok: false, erro: 'escreva alguma coisa antes de anotar' }

  // O cartão precisa ser deste contato e desta conta: sem isso, um id de fora
  // penduraria a anotação no histórico de um negócio alheio.
  const [cartao, doCliente] = await Promise.all([
    acharCartao(clienteId, cartaoId),
    contatoEhDoCliente(clienteId, contatoId),
  ])
  if (!doCliente || !cartao || cartao.contatoId !== contatoId) {
    return { ok: false, erro: 'este negócio não existe mais' }
  }

  const quem = await sessaoAtual()
  try {
    const anotacao = await registrarAnotacao(
      clienteId,
      contatoId,
      limpo,
      quem?.usuario.nome ?? null,
      cartaoId,
    )
    return { ok: true, anotacao }
  } catch (erro) {
    console.error('[anotar no negócio]', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'não deu para guardar agora' }
  }
}
