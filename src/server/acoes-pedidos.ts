'use server'

import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { EXEMPLOS_DO_MODELO_DO_PEDIDO, MODELOS_DO_PEDIDO } from '@/core/modelos-do-pedido'
import { ehStatusDePedido, type StatusDePedido } from '@/core/pedidos'
import { acaoApagarTemplate, acaoCriarTemplate } from './acoes-transmissoes'
import { cancelarCobranca } from './cobrancas'
import { cartoesDosPedidos, moverPedido, type CartaoDePedido } from './pedidos'
import { exigirCapacidade, recusou } from './permissoes'
import { registrar } from './repos/auditoria'
import { acharCobranca } from './repos/cobrancas'
import { listarTemplates } from './repos/templates'

/**
 * A tela Pedidos (0146).
 *
 * Mover de etapa é de quem atende (`atender`): no restaurante é a cozinha e o
 * balcão que andam com o pedido. Cancelar pede `registrar_venda`, como
 * cancelar cobrança, porque desfaz uma venda.
 */

/** A lista de agora, para a tela se atualizar sozinha enquanto está aberta. */
export async function acaoListarPedidos(clienteId: string): Promise<CartaoDePedido[] | null> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return null
  // Pedido não tem dono: o total é de quem vê os valores da conta.
  const valores = await exigirCapacidade(clienteId, 'ler_valores', 'todos')
  return cartoesDosPedidos(clienteId, !recusou(valores))
}

export async function acaoMoverPedido(
  clienteId: string,
  pedidoId: string,
  para: string,
): Promise<{ ok: true; status: StatusDePedido; avisado: boolean } | { ok: false; erro: string }> {
  if (!ehStatusDePedido(para)) return { ok: false, erro: 'Etapa desconhecida.' }
  const acesso = await exigirCapacidade(clienteId, para === 'cancelado' ? 'registrar_venda' : 'atender', 'proprios')
  if (recusou(acesso)) {
    return { ok: false, erro: para === 'cancelado' ? 'Sua função não permite cancelar pedido.' : 'Sua função não permite mexer nos pedidos.' }
  }
  const autor = autorDaPessoa(acesso.sessao.usuario)
  const r = await moverPedido(clienteId, pedidoId, para, autor)
  if (!r.ok) return r

  // Cancelado antes de pagar: o Pix também deixa de valer.
  if (para === 'cancelado' && r.pedido.cobrancaId) {
    const cobranca = await acharCobranca(clienteId, r.pedido.cobrancaId)
    if (cobranca?.status === 'pendente') {
      await cancelarCobranca(clienteId, cobranca.id, acesso.sessao.usuario.nome?.trim() || null).catch(() => undefined)
    }
  }
  return { ok: true, status: r.pedido.status, avisado: r.avisado }
}

/**
 * Cria na Meta os quatro modelos de aviso de etapa (`MODELOS_DO_PEDIDO`), como
 * `acaoCriarModelosDaVerandi`: o aprovado e o em análise ficam, o recusado e o
 * rascunho são apagados e mandados de novo (o nome é único por conta).
 * Utilidade; a aprovação costuma levar minutos.
 */
export async function acaoCriarModelosDoPedido(clienteId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite criar modelo.' }
  const existentes = await listarTemplates(clienteId)
  for (const m of MODELOS_DO_PEDIDO) {
    const anterior = existentes.find((t) => t.nome === m.nome)
    if (anterior && anterior.status !== 'recusado' && anterior.status !== 'rascunho') continue
    if (anterior) {
      const apagado = await acaoApagarTemplate(clienteId, anterior.id)
      if (!apagado.ok) return { ok: false, erro: apagado.erro ?? 'A Meta não apagou o modelo recusado.' }
    }
    const r = await acaoCriarTemplate(clienteId, {
      nome: m.nome,
      categoria: 'UTILITY',
      componentes: { corpo: m.corpo },
      exemplos: EXEMPLOS_DO_MODELO_DO_PEDIDO,
    })
    if (!r.ok) return { ok: false, erro: r.erro ?? 'A Meta não aceitou agora.' }
  }
  await registrar({
    acao: 'criou_modelos_do_pedido',
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'integracao',
    alvoNome: 'Pedidos',
    impersonadoPor: acesso.sessao.impersonadoPor,
  }).catch(() => undefined)
  return { ok: true }
}
