import 'server-only'
import { conectorFoody, testarTokenDaFoody } from '@/cardapios/foody'
import { alertar } from '../alertar'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'

/**
 * A Foody Delivery ligada à conta: o token do lojista, o gatilho (webhook) que
 * ele cadastra na Foody com o nosso token, e a passada de 10 minutos. O token
 * mora em `connections` (cofre). Decisão de 27/out/2026: a Foody é mais uma
 * fonte de pedidos; a tela orienta não ligar junto o cardápio que já despacha
 * por ela, porque o mesmo pedido entraria duas vezes.
 */

const NOME_DA_CONEXAO = 'Foody Delivery'

export type FoodyConectada = { ok: true } | { ok: false; erro: string }

export async function conectarFoody(clienteId: string, token: string, avisarCliente: boolean): Promise<FoodyConectada> {
  const limpo = token.trim()
  if (!limpo) return { ok: false, erro: 'Cole o token da Foody.' }
  const teste = await testarTokenDaFoody(limpo)
  if (!teste.ok) return { ok: false, erro: teste.motivo }

  const anterior = await cardapioDaConta(clienteId, 'foody')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, limpo)
  } else {
    const conexao = await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'cabecalho', campo: 'Authorization', valor: limpo })
    conexaoId = conexao.id
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'foody',
    conexaoId,
    idNaPlataforma: null,
    avisarCliente,
    importarCatalogo: false,
    ativo: true,
  })
  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'foody')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())
  return { ok: true }
}

/** Desliga e apaga o token do cofre. Os pedidos que já entraram ficam no quadro. */
export async function desligarFoody(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'foody')
  if (!atual) return
  await salvarCardapio({
    clienteId,
    plataforma: 'foody',
    conexaoId: null,
    idNaPlataforma: null,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

async function conectorDa(cardapio: CardapioConectado) {
  if (!cardapio.conexaoId) return null
  const credencial = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  return credencial ? conectorFoody(credencial.valor) : null
}

/** O gatilho da Foody traz só o `uid`: o pedido é relido na API com o token da conta. */
export async function pedidoDoWebhookFoody(clienteId: string, pedidoId: string): Promise<void> {
  const cardapio = await cardapioDaConta(clienteId, 'foody')
  if (!cardapio?.ativo) return
  const conector = await conectorDa(cardapio)
  if (!conector) return
  const lido = await conector.lerPedido(pedidoId)
  if (!lido.ok) {
    await alertar('O pedido da Foody não foi lido', lido.motivo, { clienteId, pedido: pedidoId })
    return
  }
  if (lido.valor) await receberPedidoDeFora(clienteId, lido.valor, { avisarCliente: cardapio.avisarCliente })
}

/**
 * A passada de 10 minutos, rede de segurança do gatilho: a Foody tenta uma
 * vez de novo e desliga o gatilho depois de 10 erros seguidos.
 */
export async function passadaDaFoody(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  if (!conector) return 0
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const lidos = await conector.pedidosDesde(desde)
  if (!lidos.ok) {
    await alertar('A passada da Foody falhou', lidos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }
  for (const pedido of lidos.valor) {
    await receberPedidoDeFora(cardapio.clienteId, pedido, { avisarCliente: cardapio.avisarCliente })
  }
  await marcarPedidosLidos(cardapio.id, agora)
  return lidos.valor.length
}
