'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { mercadoPagoConfigurado, urlDeAutorizacao } from '@/channels/mercado-pago'
import { iniciarConexao } from './instagram/estado'
import { exigirCapacidade, recusou } from './permissoes'
import { recusaDoPlano } from './recursos-do-plano'
import { apagarConexaoDePagamento } from './repos/pagamentos'

/**
 * Ligar e desligar a conta do Mercado Pago do dono (cobrança no chat, etapa A).
 *
 * A porta é a das outras integrações: `configurar_operacao`, e o plano precisa
 * ter "Conexão com outros sistemas" (Operação para cima). O `state` é o
 * bilhete assinado do Instagram, com o cookie que só este navegador tem: um
 * link de conexão repassado não liga a conta do Mercado Pago de ninguém na
 * conta de outra pessoa.
 */

export async function acaoConectarMercadoPago(clienteId: string): Promise<void> {
  // Sem forma de devolver erro num `<form action>`: quem não pode não sai
  // daqui, e a tela já não mostra o botão nesses casos.
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return
  if (await recusaDoPlano(clienteId, 'integracoes')) return
  if (!mercadoPagoConfigurado()) return

  // A origem vem do cabeçalho, como no Facebook: o `redirect_uri` precisa
  // bater byte a byte com o cadastrado, em produção e em preview.
  const cabecalhos = await headers()
  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host')
  const protocolo = cabecalhos.get('x-forwarded-proto') ?? 'https'
  redirect(urlDeAutorizacao({ origem: `${protocolo}://${host}`, state: await iniciarConexao(clienteId) }))
}

/**
 * Desliga. As cobranças já feitas continuam na tela; só as novas deixam de
 * sair. O acesso no Mercado Pago continua autorizado lá até o dono revogar em
 * "Aplicações conectadas", e a tela diz isso.
 */
export async function acaoDesconectarMercadoPago(clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  await apagarConexaoDePagamento(clienteId, 'mercado_pago')
  return { ok: true }
}
