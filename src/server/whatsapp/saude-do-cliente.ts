import 'server-only'
import { alertar } from '../alertar'
import { lerTokenDoCanal, listarCanais } from '../repos/conversas'
import { coexistenciaDoCliente } from '../repos/coexistencia'
import { saudeDaWaba } from './conexao'
import type { SaudeDaMeta } from '@/core/pendencias-da-meta'

/**
 * O que a Meta diz sobre a conta deste cliente, para a tela poder avisar.
 *
 * **Nunca estoura.** Isto enfeita duas telas que precisam abrir de qualquer
 * jeito: se a Meta não responder, o Inbox e a tela do número continuam
 * funcionando como funcionavam antes de existir este arquivo. Falha vira
 * `null`, e `pendenciasDaMeta(null)` devolve lista vazia — silêncio, nunca uma
 * acusação de que o cliente está devendo algo.
 *
 * Só pergunta por canal coexistente com WABA: número de Cloud API pura não tem
 * essa conta, e perguntar seria uma ida à rede para receber erro.
 */
export async function saudeDoCliente(clienteId: string): Promise<SaudeDaMeta | null> {
  try {
    const [canais, coexistencia] = await Promise.all([
      listarCanais(clienteId),
      coexistenciaDoCliente(clienteId),
    ])

    const canal = canais.find((c) => {
      const estado = coexistencia[c.id]
      return estado?.isOnBizApp === true && estado.wabaId && c.tokenRef
    })

    const wabaId = canal ? coexistencia[canal.id]?.wabaId : null
    if (!canal || !wabaId) return null

    const token = await lerTokenDoCanal(canal)
    const saude = await saudeDaWaba(wabaId, token)

    return { ...saude, wabaId }
  } catch (erro) {
    /*
     * Alerta e segue. Não saber o estado da conta é bem menos grave que não
     * abrir a tela — e um alerta aqui é o que permite descobrir que o token do
     * cliente venceu antes de alguém reclamar que o aviso sumiu.
     */
    await alertar('não deu para ler a saúde da conta do cliente na Meta', erro, {
      cliente: clienteId,
    })
    return null
  }
}
