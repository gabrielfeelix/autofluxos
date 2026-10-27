import 'server-only'
import { eventoDaEtapa, podeAvancar, telefoneDoPedido, type PedidoDeFora } from '@/core/pedidos-de-fora'
import { alertar } from './alertar'
import { avisarEtapaDoPedido } from './avisar-etapa'
import { tratarEvento } from './receber-evento'
import { acharContatoPeloTelefone } from './repos/contato-por-telefone'
import { criarContato } from './repos/leads'
import { completarPedidoDeFora, gravarPedidoDeFora, mudarStatusDoPedido, type Pedido } from './repos/pedidos'

export type PedidoRecebido = 'novo' | 'andou' | 'igual' | 'ignorado'

/**
 * Um pedido de fora (cardápio digital, delivery próprio) até o quadro de
 * Pedidos. Toda plataforma chega aqui, pelo webhook ou pela passada de 10
 * minutos, e as duas podem trazer o mesmo pedido: o índice único
 * `pedidos_de_fora` faz dele uma linha só, e a etapa só anda para a frente.
 *
 * Quando a etapa muda: o aviso ao cliente (`avisar-etapa.ts`, se a conexão
 * pede) e o evento `pedido.<status>`, que abre o fluxo do lojista.
 *
 * O contato só nasce do telefone com o aviso ligado: é o aceite de quem deu o
 * telefone para saber daquele pedido. Telefone de central não vira contato.
 *
 * **Nada aqui estoura**: quem chama já respondeu 200 à plataforma.
 */
export async function receberPedidoDeFora(
  clienteId: string,
  p: PedidoDeFora,
  opcoes: { avisarCliente: boolean },
  agora: Date = new Date(),
): Promise<PedidoRecebido> {
  try {
    const telefone = telefoneDoPedido(p.telefone)
    const contatoId = telefone ? await contatoDoPedido(clienteId, telefone, p.nome, opcoes.avisarCliente) : null
    const { pedido, antes } = await gravarPedidoDeFora(clienteId, { ...p, telefone }, contatoId, agora)

    if (antes === null) {
      await etapaMudou(clienteId, pedido, telefone, opcoes)
      return 'novo'
    }

    const faltaContato = !pedido.contatoId && contatoId
    const rastreioNovo = p.rastreioUrl && p.rastreioUrl !== pedido.rastreioUrl
    if (faltaContato || rastreioNovo) {
      await completarPedidoDeFora(clienteId, pedido.id, {
        ...(faltaContato ? { contatoId } : {}),
        ...(rastreioNovo ? { rastreioUrl: p.rastreioUrl } : {}),
      })
    }

    if (!podeAvancar(antes, p.status)) return antes === p.status ? 'igual' : 'ignorado'
    const movido = await mudarStatusDoPedido(clienteId, pedido.id, [antes], p.status, agora)
    // Outra chamada moveu no meio: foi ela quem avisou.
    if (!movido) return 'igual'
    await etapaMudou(clienteId, movido, telefone, opcoes)
    return 'andou'
  } catch (erro) {
    await alertar('Pedido de fora não entrou no quadro', erro, { clienteId, plataforma: p.plataforma, pedido: p.idExterno })
    return 'ignorado'
  }
}

async function contatoDoPedido(clienteId: string, telefone: string, nome: string | null, criar: boolean): Promise<string | null> {
  const achado = await acharContatoPeloTelefone(clienteId, telefone)
  if (achado || !criar) return achado
  const criado = await criarContato(clienteId, { nome: nome?.trim().slice(0, 120) || 'Cliente', telefone })
  // Outro pedido criou o mesmo contato no meio: relê.
  return criado.ok ? criado.contatoId : acharContatoPeloTelefone(clienteId, telefone)
}

async function etapaMudou(
  clienteId: string,
  pedido: Pedido,
  telefone: string | null,
  opcoes: { avisarCliente: boolean },
): Promise<void> {
  if (opcoes.avisarCliente && pedido.contatoId) await avisarEtapaDoPedido(clienteId, pedido, null)
  if (!telefone) return
  await tratarEvento({
    clienteId,
    evento: eventoDaEtapa(pedido.status),
    telefone,
    dados: { pedido: pedido.numeroExibido ?? String(pedido.numero), nome: pedido.nomeCliente, plataforma: pedido.plataforma },
  })
}
