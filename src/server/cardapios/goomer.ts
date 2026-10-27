import 'server-only'
import { conectorOpenDelivery, ENDERECO_DA_GOOMER, lojaDoOpenDelivery, type EventoOpenDelivery } from '@/cardapios/opendelivery'
import { alertar } from '../alertar'
import { receberPedidoDeFora } from '../receber-pedido-de-fora'
import { cardapioDaConta, marcarPedidosLidos, salvarCardapio, type CardapioConectado } from '../repos/cardapios'
import { apagarConexao, criarConexao, lerCredencial, trocarValor } from '../repos/conexoes'

/**
 * A Goomer ligada à conta, pelo Open Delivery dela: o lojista gera o Client
 * Id e o Client Secret no Painel Goomer e cola aqui. O secret mora em
 * `connections` (cofre); o Client Id, que não é segredo, em
 * `id_na_plataforma`. A Goomer não empurra evento para nós: tudo entra pela
 * passada de 10 minutos, que lê a fila e confirma o que gravou.
 */

const NOME_DA_CONEXAO = 'Goomer (cardápio)'
const PEDIDOS_POR_PASSADA = 60

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

/**
 * A passada: lê a fila de eventos, relê cada pedido, grava e só então
 * confirma. Evento anterior à ligação, pedido sumido e pedido de mesa são
 * confirmados sem virar nada, para não travar a fila. Se a leitura de um
 * pedido falhar, o que sobrou fica na fila para a próxima volta.
 */
export async function passadaDaGoomer(cardapio: CardapioConectado, agora = new Date()): Promise<number> {
  const conector = await conectorDa(cardapio)
  if (!conector) return 0
  const desde = new Date((cardapio.pedidosLidosAte ? new Date(cardapio.pedidosLidosAte).getTime() : agora.getTime()) - 120_000)
  const eventos = await conector.lerEventos()
  if (!eventos.ok) {
    await alertar('A passada da Goomer falhou', eventos.motivo, { clienteId: cardapio.clienteId })
    return 0
  }

  const porPedido = new Map<string, EventoOpenDelivery[]>()
  const aConfirmar: EventoOpenDelivery[] = []
  for (const evento of eventos.valor) {
    if (evento.criadoEm && evento.criadoEm < desde) {
      aConfirmar.push(evento)
      continue
    }
    porPedido.set(evento.pedidoId, [...(porPedido.get(evento.pedidoId) ?? []), evento])
  }

  let gravados = 0
  let parou = false
  for (const [pedidoId, doPedido] of [...porPedido].slice(0, PEDIDOS_POR_PASSADA)) {
    const lido = await conector.lerPedido(pedidoId)
    if (!lido.ok) {
      await alertar('O pedido da Goomer não foi lido', lido.motivo, { clienteId: cardapio.clienteId, pedido: pedidoId })
      parou = true
      break
    }
    if (lido.valor) {
      await receberPedidoDeFora(cardapio.clienteId, lido.valor, { avisarCliente: cardapio.avisarCliente })
      gravados++
    }
    aConfirmar.push(...doPedido)
  }

  if (aConfirmar.length > 0) {
    const confirmado = await conector.confirmar(aConfirmar)
    if (!confirmado.ok) await alertar('A Goomer não aceitou a confirmação dos eventos', confirmado.motivo, { clienteId: cardapio.clienteId })
  }
  // Volta interrompida não avança o relógio: o que ficou na fila seria tomado por antigo e confirmado sem gravar.
  if (!parou && porPedido.size <= PEDIDOS_POR_PASSADA) await marcarPedidosLidos(cardapio.id, agora)
  return gravados
}
