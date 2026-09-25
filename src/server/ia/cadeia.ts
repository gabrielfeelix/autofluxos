import 'server-only'
import type { Modelo, PedidoDeIa, Resposta } from './types'

/**
 * Vários provedores atrás de um `Modelo` só.
 *
 * Tenta na ordem e passa para o próximo **só quando o anterior falhou de
 * transporte** (`falhou: true`: cota, fora do ar, demora, chave errada). Um
 * `nao_sei` de escopo, "isso a empresa não informou", é resposta, e perguntar
 * de novo a outro modelo seria procurar um que invente.
 *
 * Se todos falharem, devolve a desistência do último, que continua sendo
 * `nao_sei` e continua virando uma pessoa assumindo.
 */
export function emCadeia(elos: readonly { nome: string; modelo: Modelo }[]): Modelo {
  return {
    async responder(pedido: PedidoDeIa): Promise<Resposta> {
      let ultima: Resposta = { tipo: 'nao_sei', motivo: 'nenhum modelo configurado', falhou: true }

      for (const [i, elo] of elos.entries()) {
        ultima = await elo.modelo.responder(pedido)
        if (ultima.tipo !== 'nao_sei' || !ultima.falhou) return ultima

        const proximo = elos[i + 1]
        if (proximo) console.warn(`[ia] ${elo.nome}: ${ultima.motivo}; tentando ${proximo.nome}`)
      }

      return ultima
    },
  }
}
