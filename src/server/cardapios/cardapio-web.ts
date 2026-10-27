import 'server-only'
import { conectorCardapioWeb, lojaDoCardapioWeb } from '@/cardapios/cardapio-web'
import { alertar } from '../alertar'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'

/**
 * O Cardápio Web ligado à conta: conectar com a chave do lojista, o pedido do
 * webhook e a passada de 10 minutos. A chave mora em `connections` (cofre),
 * como toda credencial; a linha de `cardapios_conectados` guarda o
 * `merchant_id`, que é como o webhook diz de qual loja é o pedido.
 */

const NOME_DA_CONEXAO = 'Cardápio Web'

export type CardapioWebConectado = { ok: true; loja: string } | { ok: false; erro: string }

/** Testa a chave na API antes de guardar: chave errada não vira conexão "ligada" que nunca lê nada. */
export async function conectarCardapioWeb(clienteId: string, chave: string, avisarCliente: boolean): Promise<CardapioWebConectado> {
  const limpa = chave.trim()
  if (!limpa) return { ok: false, erro: 'Cole a chave de API do Cardápio Web.' }
  const loja = await lojaDoCardapioWeb(limpa)
  if (!loja.ok) return { ok: false, erro: loja.motivo }

  const anterior = await cardapioDaConta(clienteId, 'cardapio_web')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, limpa)
  } else {
    const conexao = await criarConexao({
      clienteId,
      nome: `${NOME_DA_CONEXAO} ${loja.valor.id}`,
      tipo: 'cabecalho',
      campo: 'X-API-KEY',
      valor: limpa,
    })
    conexaoId = conexao.id
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'cardapio_web',
    conexaoId,
    idNaPlataforma: loja.valor.id,
    avisarCliente,
    importarCatalogo: false,
    ativo: true,
  })
  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'cardapio_web')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())
  return { ok: true, loja: loja.valor.nome || `Loja ${loja.valor.id}` }
}

/** Desliga e apaga a chave do cofre. Os pedidos que já entraram ficam no quadro. */
export async function desligarCardapioWeb(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'cardapio_web')
  if (!atual) return
  await salvarCardapio({
    clienteId,
    plataforma: 'cardapio_web',
    conexaoId: null,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

async function conectorDa(cardapio: CardapioConectado) {
  if (!cardapio.conexaoId) return null
  const credencial = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  return credencial ? conectorCardapioWeb(credencial.valor) : null
}

/**
 * O aviso do webhook: o payload traz só o id, e o pedido é relido na API com
 * a chave da conta. `merchant_id` de outra loja é recusado: o token é da
 * conta, mas a chave guardada é de uma loja só.
 */
export async function pedidoDoWebhookCardapioWeb(clienteId: string, pedidoId: string, lojaId: string | null): Promise<void> {
  const cardapio = await cardapioDaConta(clienteId, 'cardapio_web')
  if (!cardapio?.ativo) return
  if (lojaId && cardapio.idNaPlataforma && lojaId !== cardapio.idNaPlataforma) {
    await alertar('Webhook do Cardápio Web de outra loja', null, { clienteId, loja: lojaId })
    return
  }
  const conector = await conectorDa(cardapio)
  if (!conector) return
  const lido = await conector.lerPedido(pedidoId)
  if (!lido.ok) {
    await alertar('O pedido do Cardápio Web não foi lido', lido.motivo, { clienteId, pedido: pedidoId })
    return
  }
  if (lido.valor) await receberPedidoDeFora(clienteId, lido.valor, { avisarCliente: cardapio.avisarCliente })
}

/**
 * A passada de 10 minutos, rede de segurança do webhook (pausado depois de 15
 * falhas, token não colado, Portal sem webhook). Lê o que mudou desde a
 * última volta, com 2 minutos de folga para o relógio de lá.
 */
export async function passadaDoCardapioWeb(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  if (!conector) return 0
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const lidos = await conector.pedidosDesde(desde)
  if (!lidos.ok) {
    await alertar('A passada do Cardápio Web falhou', lidos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }
  for (const pedido of lidos.valor) {
    await receberPedidoDeFora(cardapio.clienteId, pedido, { avisarCliente: cardapio.avisarCliente })
  }
  await marcarPedidosLidos(cardapio.id, agora)
  return lidos.valor.length
}
