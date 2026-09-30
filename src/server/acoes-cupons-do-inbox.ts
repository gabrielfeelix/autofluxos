'use server'

import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { mensagemDoCupom, type CupomDaLoja } from '@/loja/magento-cupons'
import { cuponsDaConta } from './adaptador-da-loja'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { podeResponderAgora } from './distribuir-atendimento'
import {
  atribuirSeSemDono,
  confirmarEntrega,
  contextoDeResposta,
  definirStatusDaSessao,
  registrarSaida,
} from './repos/conversas'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * Cupom pela Inbox (pedido do dono da PCYES em 30/set/2026): o ícone abre os
 * cupons ativos da loja, quem atende clica e o cupom sai numa mensagem curta.
 * Um clique, sem prévia: diferente do pedido, cupom não é dado de ninguém.
 */

export type CupomNaTela = CupomDaLoja & { mensagem: string }

export async function acaoListarCuponsDoInbox(
  clienteId: string,
): Promise<{ ok: true; cupons: CupomNaTela[] } | { ok: false; erro: string }> {
  await exigirAcessoAoCliente(clienteId)
  const r = await cuponsDaConta(clienteId)
  if (!r.ok) return { ok: false, erro: r.motivo }
  return { ok: true, cupons: r.valor.map((c) => ({ ...c, mensagem: mensagemDoCupom(c) })) }
}

export async function acaoEnviarCupomDoInbox(
  clienteId: string,
  contatoId: string,
  codigo: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)

  const trava = await podeResponderAgora(clienteId, contatoId, acesso.sessao.usuario.id)
  if (!trava.ok) return trava

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }
  if (!dentroDaJanela(contexto)) {
    return { ok: false, erro: 'a janela de 24h está fechada; agora só por modelo aprovado' }
  }

  // Relê na hora de mandar: o cupom pode ter vencido ou esgotado desde a lista.
  const r = await cuponsDaConta(clienteId)
  if (!r.ok) return { ok: false, erro: r.motivo }
  const cupom = r.valor.find((c) => c.codigo === codigo)
  if (!cupom) return { ok: false, erro: 'este cupom não está mais ativo na loja' }
  const texto = mensagemDoCupom(cupom)

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }
  const quemResponde = await sessaoAtual()

  const registro = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto,
    payload: { cupom: cupom.codigo },
    autor: autorDaPessoa(quemResponde?.usuario),
  })

  let waMessageId: string | null
  try {
    waMessageId = await canal.enviarTexto(contexto.waId, texto)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para enviar' }
  }

  await confirmarEntrega(registro, waMessageId)
  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')
  if (quemResponde) {
    await atribuirSeSemDono(clienteId, contatoId, quemResponde.usuario.id).catch(() => undefined)
  }
  return { ok: true }
}
