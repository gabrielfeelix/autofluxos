import 'server-only'
import { dentroDaJanela } from '@/channels/janela'
import type { AutorDaSaida } from '@/core/autor-da-mensagem'
import { fimDoRastreio, MODELO_DE_RASTREIO, modeloDaEtapa, valoresDoAviso } from '@/core/modelos-do-pedido'
import { avisoDoStatus } from '@/core/pedidos'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { modeloComClique } from './link-do-clique'
import { acharContato, confirmarEntrega, contextoDeResposta, registrarSaida } from './repos/conversas'
import { marcarClienteAvisado, type Pedido } from './repos/pedidos'
import { nichoDaConta } from './repos/recursos'
import { listarTemplatesAprovados } from './repos/templates'

export type AvisoDaEtapa = 'na_janela' | 'por_modelo' | 'sem_modelo' | 'sem_contato' | 'sem_aviso'

/**
 * Avisa o cliente da etapa em que o pedido acabou de entrar.
 *
 * Dentro das 24 horas, o texto de `avisoDoStatus` na conversa. Fora delas, o
 * modelo aprovado da etapa (`MODELOS_DO_PEDIDO`): é o que faz o "saiu para
 * entrega" chegar a quem pediu pelo cardápio e nunca abriu conversa. Sem
 * modelo aprovado, nada sai, e `cliente_avisado_em` fica nulo: a tela mostra
 * "cliente não avisado" em vez de fingir.
 *
 * Bot pausado vale para o modelo também: quem pausou pediu silêncio.
 */
export async function avisarEtapaDoPedido(
  clienteId: string,
  pedido: Pedido,
  autor: AutorDaSaida | null,
): Promise<AvisoDaEtapa> {
  const nicho = await nichoDaConta(clienteId)
  const numero = pedido.numeroExibido ?? String(pedido.numero)
  const doStatus = avisoDoStatus(pedido.status, numero, nicho, pedido.entrega)
  if (!doStatus) return 'sem_aviso'
  // O link do entregador só vale enquanto ele está a caminho.
  const rastreio = pedido.status === 'saiu' && pedido.entrega === 'entrega' ? fimDoRastreio(pedido.rastreioUrl) : null
  const texto = rastreio ? `${doStatus}\n\nAcompanhe o entregador: ${pedido.rastreioUrl}` : doStatus
  if (!pedido.contatoId) return 'sem_contato'

  try {
    const contexto = await contextoDeResposta(clienteId, pedido.contatoId)
    if (!contexto) return 'sem_contato'
    const canal = await adaptadorDoCanal(contexto.canal)

    if (dentroDaJanela(contexto)) {
      const saida = await registrarSaida({
        contatoId: pedido.contatoId,
        sessaoId: contexto.sessaoId,
        texto,
        payload: { pedido_aviso: true },
        autor,
      })
      await confirmarEntrega(saida, await canal.enviarTexto(contexto.waId, texto))
      await marcarClienteAvisado(clienteId, pedido.id, new Date())
      return 'na_janela'
    }

    const [aprovados, contato] = await Promise.all([listarTemplatesAprovados(clienteId), acharContato(pedido.contatoId)])
    const comRastreio = rastreio ? aprovados.find((t) => t.nome === MODELO_DE_RASTREIO.nome) : undefined
    const modelo = comRastreio ? MODELO_DE_RASTREIO : modeloDaEtapa(pedido.status, pedido.entrega)
    const aprovado = comRastreio ?? (modelo ? aprovados.find((t) => t.nome === modelo.nome) : undefined)
    const valores = valoresDoAviso(numero)
    if (!modelo || !aprovado || !valores || !contato?.automacaoAtiva || !canal.enviarTemplate) return 'sem_modelo'

    const corpo = valores.reduce((t, v, i) => t.replace(`{{${i + 1}}}`, v), modelo.corpo)
    const saida = await registrarSaida({
      contatoId: pedido.contatoId,
      sessaoId: contexto.sessaoId,
      texto: corpo,
      payload: { pedido_aviso: true, modelo: aprovado.nome },
      autor,
    })
    const envio = await canal.enviarTemplate(
      contexto.waId,
      modeloComClique(
        {
          nome: aprovado.nome,
          idioma: aprovado.idioma,
          valores: { corpo: valores, ...(comRastreio && rastreio ? { botoes: [{ indice: 0, texto: rastreio }] } : {}) },
        },
        aprovado,
      ),
    )
    if (envio.situacao === 'falhou') return 'sem_modelo'
    await confirmarEntrega(saida, envio.wamid)
    await marcarClienteAvisado(clienteId, pedido.id, new Date())
    return 'por_modelo'
  } catch (erro) {
    console.error('[pedidos] o aviso da etapa não saiu', erro)
    return 'sem_modelo'
  }
}
