'use server'

import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { linkDoRastreio, mensagemDoPedido } from '@/core/pedido-na-conversa'
import type { PedidoDaLoja } from '@/loja/magento-pedido'
import { consultarPedidoDaConta, listarPedidosDaConta } from './adaptador-da-loja'
import type { PedidoNaLista } from '@/loja/magento-pedido'
import { acharLead } from './repos/leads'
import { exigirCapacidade, meuAlcance, recusou, exigirLeitura } from './permissoes'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { podeResponderAgora } from './distribuir-atendimento'
import {
  atribuirSeSemDono,
  confirmarEntrega,
  contextoDeResposta,
  definirStatusDaSessao,
  registrarSaida,
} from './repos/conversas'
import { lojaDaConta } from './repos/lojas'
import { sessaoAtual } from './sessao'

/**
 * Status do pedido pela Inbox (pedido do dono da PCYES em 30/set/2026): quem
 * atende digita o número, confere o que achou e manda numa mensagem só, com o
 * botão para a página de pedidos da loja, como o bot faria.
 *
 * A consulta é a **mesma** do bot (`consultarPedidoDaConta`: Magento e Frete
 * Rápido), com uma diferença: acha pelo número mesmo que o telefone do pedido
 * não seja o da conversa, e diz isso na tela (`confere`) junto do nome de quem
 * comprou. Quem decide mandar é a pessoa; o bot, sem ninguém olhando, continua
 * exigindo que o telefone ou o CPF confira.
 *
 * As três são do Inbox, então a porta é `atender`, a mesma de responder.
 */

export type RespostaDoPedido =
  | { ok: true; pedido: PedidoDaLoja; confere: boolean; previa: string; rastreio: string | null }
  | { ok: false; erro: string }

async function buscar(clienteId: string, contatoId: string, numero: string): Promise<RespostaDoPedido> {
  const limpo = numero.replace(/^#/, '').trim()
  if (!/^\d{3,20}$/.test(limpo)) return { ok: false, erro: 'digite o número do pedido, só os dígitos' }

  const contexto = await contextoDeResposta(clienteId, contatoId)
  const consultar = (n: string) =>
    consultarPedidoDaConta(clienteId, { numero: n, telefone: contexto?.waId ?? '', daEquipe: true })
  let r = await consultar(limpo)
  // O Magento numera com zeros à esquerda ("000001955"), e quem atende digita
  // "1955". Tenta o número completo antes de dizer que não existe.
  if (r.ok && !r.valor.encontrado && limpo.length < 9) r = await consultar(limpo.padStart(9, '0'))
  if (!r.ok) return { ok: false, erro: r.motivo }
  if (!r.valor.encontrado) return { ok: false, erro: `não achei o pedido ${limpo} na loja` }
  return {
    ok: true,
    pedido: r.valor.pedido,
    confere: r.valor.confere ?? false,
    previa: mensagemDoPedido(r.valor.pedido),
    rastreio: linkDoRastreio(r.valor.pedido),
  }
}

export async function acaoBuscarPedidoDoInbox(
  clienteId: string,
  contatoId: string,
  numero: string,
): Promise<RespostaDoPedido> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso
  return buscar(clienteId, contatoId, numero)
}

export type PedidosDoContato =
  | { ok: true; pedidos: PedidoNaLista[]; semChave: boolean }
  | { ok: false; erro: string }

/** A primeira chave da ficha que parece com o que se procura (`cpf`, `cpf_cnpj`, `email`...). */
function campoDaFicha(campos: Record<string, string>, padrao: RegExp): string | undefined {
  const chave = Object.keys(campos).find((nome) => padrao.test(nome))
  return chave ? campos[chave] : undefined
}

/**
 * Os pedidos de quem está nesta conversa, para "Status do pedido" abrir com a
 * lista em vez de pedir o número. Primeiro pelo telefone da conversa (via
 * cadastro da loja), depois pelo CPF ou e-mail da ficha; `semChave` diz que
 * não há nem telefone nem ficha, e a tela pede o número.
 */
export async function acaoListarPedidosDoContato(clienteId: string, contatoId: string): Promise<PedidosDoContato> {
  const acesso = await exigirLeitura(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return { ok: false, erro: 'contato não encontrado' }
  const documento = campoDaFicha(lead.campos, /^(cpf|cnpj|cpf_cnpj|documento)$/i)
  const email = campoDaFicha(lead.campos, /^e-?mail$/i)
  if (!lead.waId && !documento && !email) return { ok: true, pedidos: [], semChave: true }
  const r = await listarPedidosDaConta(clienteId, { telefone: lead.waId, documento, email })
  if (!r.ok) return { ok: false, erro: r.motivo }
  return { ok: true, pedidos: r.valor, semChave: false }
}

export async function acaoEnviarPedidoDoInbox(
  clienteId: string,
  contatoId: string,
  numero: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  const trava = await podeResponderAgora(clienteId, contatoId, acesso.sessao.usuario.id)
  if (!trava.ok) return trava

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }
  if (!dentroDaJanela(contexto)) {
    return { ok: false, erro: 'passaram mais de 24h desde a última mensagem dela; agora só por modelo aprovado' }
  }

  // Relê na hora de mandar: entre a busca e o clique a entrega pode ter andado.
  const achado = await buscar(clienteId, contatoId, numero)
  if (!achado.ok) return achado
  const texto = achado.previa

  // O rastreio da Frete Rápido quando o envio traz o código; senão a página
  // de pedidos da loja, que pede login.
  const rastreio = linkDoRastreio(achado.pedido)
  const loja = rastreio ? null : await lojaDaConta(clienteId)
  const paginaDePedidos =
    rastreio ?? (loja?.endereco ? `${loja.endereco.replace(/\/+$/, '')}/sales/order/history/` : null)
  const rotulo = rastreio ? 'Rastrear entrega' : 'Ver meus pedidos'

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }
  const comBotao = paginaDePedidos ? canal.enviarBotaoDeLink?.bind(canal) : undefined
  const quemResponde = await sessaoAtual()

  const registro = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto: comBotao || !paginaDePedidos ? texto : `${texto}\n\nAcompanhe em ${paginaDePedidos}`,
    // O botão vai junto no registro, para o Inbox desenhá-lo como o cliente viu.
    payload: { pedido: achado.pedido.numero, ...(comBotao ? { botao: { rotulo, url: paginaDePedidos! } } : {}) },
    autor: autorDaPessoa(quemResponde?.usuario),
  })

  let waMessageId: string | null
  try {
    waMessageId = comBotao
      ? await comBotao(contexto.waId, texto, rotulo, paginaDePedidos!)
      : await canal.enviarTexto(
          contexto.waId,
          paginaDePedidos ? `${texto}\n\nAcompanhe em ${paginaDePedidos}` : texto,
        )
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
