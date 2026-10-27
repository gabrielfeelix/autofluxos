import 'server-only'
import { conectorDeliveryDireto, testarDeliveryDireto, type CredencialDoDeliveryDireto } from '@/cardapios/delivery-direto'
import { alertar } from '../alertar'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'

/**
 * O Delivery Direto ligado à conta. O lojista passa o ID da loja e o usuário
 * de API com a senha; os três moram juntos no cofre, como JSON numa conexão.
 * O `client_id` de integrador é nosso e vem do ambiente
 * (`DELIVERY_DIRETO_CLIENT_ID`, `DELIVERY_DIRETO_CLIENT_SECRET`): sem ele,
 * nada conecta. Só passada de 10 minutos, sem webhook (ver o conector).
 */

const NOME_DA_CONEXAO = 'Delivery Direto (cardápio)'

type DaLoja = Pick<CredencialDoDeliveryDireto, 'loja' | 'usuario' | 'senha'>

function doIntegrador(): Pick<CredencialDoDeliveryDireto, 'clientId' | 'clientSecret'> | null {
  const clientId = process.env.DELIVERY_DIRETO_CLIENT_ID?.trim()
  const clientSecret = process.env.DELIVERY_DIRETO_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function deliveryDiretoLiberado(): boolean {
  return doIntegrador() !== null
}

export type DeliveryDiretoConectado = { ok: true } | { ok: false; erro: string }

export async function conectarDeliveryDireto(clienteId: string, dados: DaLoja, avisarCliente: boolean): Promise<DeliveryDiretoConectado> {
  const integrador = doIntegrador()
  if (!integrador) return { ok: false, erro: 'A conexão com o Delivery Direto ainda não foi liberada.' }
  const daLoja: DaLoja = { loja: dados.loja.trim(), usuario: dados.usuario.trim(), senha: dados.senha }
  if (!/^\d{1,20}$/.test(daLoja.loja)) return { ok: false, erro: 'O ID da loja no Delivery Direto é só número.' }
  if (!daLoja.usuario || !daLoja.senha) return { ok: false, erro: 'Preencha o usuário e a senha de API.' }
  const teste = await testarDeliveryDireto({ ...daLoja, ...integrador })
  if (!teste.ok) return { ok: false, erro: teste.motivo }

  const valor = JSON.stringify(daLoja)
  const anterior = await cardapioDaConta(clienteId, 'delivery_direto')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, valor)
  } else {
    const conexao = await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'bearer', valor })
    conexaoId = conexao.id
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'delivery_direto',
    conexaoId,
    idNaPlataforma: daLoja.loja,
    avisarCliente,
    importarCatalogo: false,
    ativo: true,
  })
  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'delivery_direto')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())
  return { ok: true }
}

/** Desliga e apaga a credencial do cofre. Os pedidos que já entraram ficam no quadro. */
export async function desligarDeliveryDireto(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'delivery_direto')
  if (!atual) return
  await salvarCardapio({
    clienteId,
    plataforma: 'delivery_direto',
    conexaoId: null,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

async function conectorDa(cardapio: CardapioConectado) {
  const integrador = doIntegrador()
  if (!integrador || !cardapio.conexaoId) return null
  const lida = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  if (!lida) return null
  try {
    const daLoja = JSON.parse(lida.valor) as DaLoja
    return conectorDeliveryDireto({ ...daLoja, ...integrador })
  } catch {
    return null
  }
}

/** A passada de 10 minutos: lê o que mudou desde a última volta, com 2 minutos de folga. */
export async function passadaDoDeliveryDireto(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  if (!conector) return 0
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const lidos = await conector.pedidosDesde(desde)
  if (!lidos.ok) {
    await alertar('A passada do Delivery Direto falhou', lidos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }
  for (const pedido of lidos.valor) {
    await receberPedidoDeFora(cardapio.clienteId, pedido, { avisarCliente: cardapio.avisarCliente })
  }
  await marcarPedidosLidos(cardapio.id, agora)
  return lidos.valor.length
}
