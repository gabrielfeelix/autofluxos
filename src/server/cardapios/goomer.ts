import 'server-only'
import { conectorOpenDelivery, ENDERECO_DA_GOOMER, lojaDoOpenDelivery } from '@/cardapios/opendelivery'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'
import { passadaDaFila } from './fila-open-delivery'

/**
 * A Goomer ligada à conta, pelo Open Delivery dela: o lojista gera o Client
 * Id e o Client Secret no Painel Goomer e cola aqui. O secret mora em
 * `connections` (cofre); o Client Id, que não é segredo, em
 * `id_na_plataforma`. A Goomer não empurra evento para nós: tudo entra pela
 * passada de 10 minutos, que lê a fila e confirma o que gravou.
 */

const NOME_DA_CONEXAO = 'Goomer (cardápio)'

export type GoomerConectada = { ok: true; loja: string } | { ok: false; erro: string }

export async function conectarGoomer(
  clienteId: string,
  clientId: string,
  clientSecret: string,
  avisarCliente: boolean,
): Promise<GoomerConectada> {
  const id = clientId.trim()
  const segredo = clientSecret.trim()
  if (!/^\d{1,20}$/.test(id)) return { ok: false, erro: 'O Client Id da Goomer é só número. Copie de novo no Painel Goomer.' }
  if (!segredo) return { ok: false, erro: 'Cole o Client Secret da Goomer.' }
  const loja = await lojaDoOpenDelivery({ base: ENDERECO_DA_GOOMER, clientId: id, clientSecret: segredo })
  if (!loja.ok) return { ok: false, erro: loja.motivo }

  const anterior = await cardapioDaConta(clienteId, 'goomer')
  let conexaoId = anterior?.conexaoId ?? null
  if (conexaoId) {
    await trocarValor(conexaoId, clienteId, segredo)
  } else {
    const conexao = await criarConexao({ clienteId, nome: NOME_DA_CONEXAO, tipo: 'bearer', valor: segredo })
    conexaoId = conexao.id
  }
  await salvarCardapio({
    clienteId,
    plataforma: 'goomer',
    conexaoId,
    idNaPlataforma: id,
    avisarCliente,
    importarCatalogo: false,
    ativo: true,
  })
  // Ligar agora: o histórico de ontem não vira aviso hoje.
  const ligado = await cardapioDaConta(clienteId, 'goomer')
  if (ligado && !anterior?.ativo) await marcarPedidosLidos(ligado.id, new Date())
  return { ok: true, loja: loja.valor.nome || 'Loja da Goomer' }
}

/** Desliga e apaga o secret do cofre. Os pedidos que já entraram ficam no quadro. */
export async function desligarGoomer(clienteId: string): Promise<void> {
  const atual = await cardapioDaConta(clienteId, 'goomer')
  if (!atual) return
  await salvarCardapio({
    clienteId,
    plataforma: 'goomer',
    conexaoId: null,
    idNaPlataforma: atual.idNaPlataforma,
    avisarCliente: atual.avisarCliente,
    importarCatalogo: false,
    ativo: false,
  })
  if (atual.conexaoId) await apagarConexao(atual.conexaoId, clienteId)
}

async function conectorDa(cardapio: CardapioConectado) {
  if (!cardapio.conexaoId || !cardapio.idNaPlataforma) return null
  const credencial = await lerCredencial(cardapio.conexaoId, cardapio.clienteId)
  if (!credencial) return null
  return conectorOpenDelivery(
    { base: ENDERECO_DA_GOOMER, clientId: cardapio.idNaPlataforma, clientSecret: credencial.valor },
    'goomer',
  )
}

/** A passada de 10 minutos: a Goomer não empurra evento, então é ela que traz os pedidos. */
export async function passadaDaGoomer(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  return conector ? passadaDaFila(cardapio, conector, 'Goomer', agora) : 0
}
