import 'server-only'
import { alertar } from '../alertar'
import { cardapiosAtivos, type CardapioConectado } from '../repos/cardapios'
import { passadaDoCardapioWeb } from './cardapio-web'
import { passadaDaGoomer } from './goomer'
import { passadaDaOlaClick } from './olaclick'

/** A passada de cada plataforma. Plataforma sem conector ainda não entra. */
const PASSADAS: Partial<Record<CardapioConectado['plataforma'], (c: CardapioConectado) => Promise<number>>> = {
  cardapio_web: passadaDoCardapioWeb,
  olaclick: passadaDaOlaClick,
  goomer: passadaDaGoomer,
}

/**
 * Os cardápios ligados de todas as contas, na mesma rota de 10 minutos dos
 * pedidos da loja (`/api/manutencao/pedidos`): a rede de segurança do
 * webhook. Um cardápio fora do ar não cala os outros.
 */
export async function acompanharCardapios(): Promise<{ cardapios: number; pedidos: number }> {
  const ativos = await cardapiosAtivos()
  let pedidos = 0
  for (const cardapio of ativos) {
    const passada = PASSADAS[cardapio.plataforma]
    if (!passada) continue
    pedidos += await passada(cardapio).catch(async (erro) => {
      await alertar('A passada do cardápio falhou', erro, { cliente: cardapio.clienteId, plataforma: cardapio.plataforma })
      return 0
    })
  }
  return { cardapios: ativos.length, pedidos }
}
