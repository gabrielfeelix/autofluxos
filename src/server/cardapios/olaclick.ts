import 'server-only'
import { randomBytes } from 'node:crypto'
import {
  apagarWebhookDaOlaClick,
  assinaturaDaOlaClick,
  conectorOlaClick,
  lojaDaOlaClick,
  registrarWebhookDaOlaClick,
} from '@/cardapios/olaclick'
import { alertar } from '../alertar'
import { apagarDoCofre, guardarNoCofre, lerDoCofre } from '../cofre'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'

/**
 * A OlaClick ligada à conta: conectar com a chave do lojista, o pedido do
 * webhook e a passada de 10 minutos. A chave mora em `connections` (cofre); o
 * segredo com que a OlaClick assina o webhook, no Vault (`segredo_id`); e
 * `id_na_plataforma` guarda o id do webhook que registramos lá, para apagá-lo
 * ao desligar. Sem webhook (chave sem `webhooks:write`), só a passada.
 */

const NOME_DA_CONEXAO = 'OlaClick (cardápio)'

export const ENDERECO_DO_WEBHOOK_DA_OLACLICK = 'https://dialogon.com.br/api/webhook/olaclick/'

export type OlaClickConectada =
  | { ok: true; loja: string; webhook: true }
  | { ok: true; loja: string; webhook: false; motivo: string }
  | { ok: false; erro: string }

/** Testa a chave na API antes de guardar e registra o webhook lá: o lojista não cola nada no painel da OlaClick. */
export async function conectarOlaClick(clienteId: string, chave: string, avisarCliente: boolean): Promise<OlaClickConectada> {
  const limpa = chave.trim()
  if (!limpa) return { ok: false, erro: 'Cole a chave de API da OlaClick.' }
  const loja = await lojaDaOlaClick(limpa)
  if (!loja.ok) return { ok: false, erro: loja.motivo }

  const anterior = await cardapioDaConta(clienteId, 'olaclick')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, limpa)
  } else {
    const conexao = await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'bearer', valor: limpa })
    conexaoId = conexao.id
  }

  const webhook = await registrarWebhookDaOlaClick(limpa, `${ENDERECO_DO_WEBHOOK_DA_OLACLICK}${clienteId}`, clienteId)
  const segredoId = webhook.ok
    ? await guardarNoCofre(webhook.valor.segredo, `olaclick-webhook:${randomBytes(6).toString('hex')}`)
    : null
  try {
    await salvarCardapio({
      clienteId,
      plataforma: 'olaclick',
      conexaoId,
      idNaPlataforma: webhook.ok ? webhook.valor.id : null,
      segredoId,
      avisarCliente,
      importarCatalogo: false,
      ativo: true,
    })
  } catch (erro) {
    // Segredo no cofre sem linha que aponte para ele é segredo órfão.
    if (segredoId) await apagarDoCofre(segredoId)
    throw erro
  }
  if (anterior?.segredoId) await apagarDoCofre(anterior.segredoId)

  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'olaclick')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())

  const nome = loja.valor.nome || 'Loja da OlaClick'
  return webhook.ok ? { ok: true, loja: nome, webhook: true } : { ok: true, loja: nome, webhook: false, motivo: webhook.motivo }
}

/** Desliga: apaga o webhook lá, o segredo e a chave. Os pedidos que já entraram ficam no quadro. */
export async function desligarOlaClick(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'olaclick')
  if (!atual) return
  const credencial = atual.conexaoId ? await lerCredencial(atual.conexaoId, clienteId) : null
  if (credencial && atual.idNaPlataforma) {
    const apagado = await apagarWebhookDaOlaClick(credencial.valor, atual.idNaPlataforma)
    if (!apagado.ok) await alertar('O webhook da OlaClick não foi apagado ao desligar', apagado.motivo, { clienteId })
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'olaclick',
    conexaoId: null,
    idNaPlataforma: null,
    segredoId: null,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.segredoId) await apagarDoCofre(atual.segredoId)
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

async function conectorDa(cardapio: CardapioConectado) {
  if (!cardapio.conexaoId) return null
  const credencial = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  return credencial ? conectorOlaClick(credencial.valor) : null
}

/**
 * A entrega do webhook é desta conta? Confere a assinatura com o segredo que
 * a OlaClick devolveu ao registrar. Conta desligada ou sem segredo recusa.
 */
export async function webhookDaOlaClickAutentico(clienteId: string, corpoCru: string, assinatura: string | null): Promise<boolean> {
  const cardapio = await cardapioDaConta(clienteId, 'olaclick')
  if (!cardapio?.ativo || !cardapio.segredoId) return false
  return assinaturaDaOlaClick(corpoCru, await lerDoCofre(cardapio.segredoId), assinatura)
}

/** O pedido do webhook, relido na API: o `data` da entrega é aviso, não fonte. */
export async function pedidoDoWebhookOlaClick(clienteId: string, pedidoId: string): Promise<void> {
  const cardapio = await cardapioDaConta(clienteId, 'olaclick')
  if (!cardapio?.ativo) return
  const conector = await conectorDa(cardapio)
  if (!conector) return
  const lido = await conector.lerPedido(pedidoId)
  if (!lido.ok) {
    await alertar('O pedido da OlaClick não foi lido', lido.motivo, { clienteId, pedido: pedidoId })
    return
  }
  if (lido.valor) await receberPedidoDeFora(clienteId, lido.valor, { avisarCliente: cardapio.avisarCliente })
}

/**
 * A passada de 10 minutos, rede de segurança do webhook: a OlaClick não
 * reenvia o que esgotou as retentativas. Lê o que mudou desde a última volta,
 * com 2 minutos de folga para o relógio de lá.
 */
export async function passadaDaOlaClick(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  if (!conector) return 0
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const lidos = await conector.pedidosDesde(desde)
  if (!lidos.ok) {
    await alertar('A passada da OlaClick falhou', lidos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }
  for (const pedido of lidos.valor) {
    await receberPedidoDeFora(cardapio.clienteId, pedido, { avisarCliente: cardapio.avisarCliente })
  }
  await marcarPedidosLidos(cardapio.id, agora)
  return lidos.valor.length
}
