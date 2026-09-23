import 'server-only'
import { lojaMagento } from '@/loja/magento'
import type { Loja } from '@/loja/types'
import { lojaDaConta } from './repos/lojas'

/**
 * Qual adaptador fala com a loja desta conta, no desenho de
 * `adaptador-do-canal.ts`: um lugar só escolhe, e quem usa recebe `Loja`.
 *
 * `null` quando a conta não tem loja ou ela está desligada. Quem chama trata
 * isso como "a loja desta conta não está ligada", e o bot passa para pessoa em
 * vez de inventar catálogo.
 */
export async function lojaAtivaDaConta(clienteId: string): Promise<Loja | null> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return null

  return lojaMagento({ endereco: loja.endereco, codigoDaLoja: loja.codigoDaLoja, sufixo: loja.sufixo })
}
