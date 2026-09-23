import 'server-only'
import { enriquecer } from '@/loja/enriquecer'
import { lojaMagento } from '@/loja/magento'
import { lojaAdmin } from '@/loja/magento-admin'
import type { Loja } from '@/loja/types'
import { lerCredencial } from './repos/conexoes'
import { lojaDaConta } from './repos/lojas'

/** Quanto a foto e o estoque exato podem atrasar uma resposta, somados. */
export const PRAZO_DO_TOKEN_MS = 3_000

/**
 * Qual adaptador fala com a loja desta conta, no desenho de
 * `adaptador-do-canal.ts`: um lugar só escolhe, e quem usa recebe `Loja`.
 *
 * `null` quando a conta não tem loja ou ela está desligada. Quem chama trata
 * isso como "a loja desta conta não está ligada", e o bot passa para pessoa em
 * vez de inventar catálogo.
 *
 * **Com token, a busca pública ganha foto e quantidade por cima**, e só por
 * cima: token que não lê do cofre, que a loja recusa, ou loja lenta, e o bot
 * responde com a fase 1 intacta. Ver `loja/enriquecer.ts`.
 */
export async function lojaAtivaDaConta(clienteId: string): Promise<Loja | null> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return null

  const publica = lojaMagento({ endereco: loja.endereco, codigoDaLoja: loja.codigoDaLoja, sufixo: loja.sufixo })
  if (loja.estoqueExato === 'desligado' || !loja.conexaoId) return publica

  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    credencial = null
  }
  if (!credencial) return publica

  const admin = lojaAdmin({ endereco: loja.endereco, credencial })
  const opcoes = { via: loja.estoqueExato, estoqueId: loja.estoqueId, prazoMs: PRAZO_DO_TOKEN_MS }

  return {
    ...publica,
    async buscar(termo) {
      const r = await publica.buscar(termo)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, opcoes) } : r
    },
    async combinaCom(sku) {
      const r = await publica.combinaCom(sku)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, opcoes) } : r
    },
    async lerPorSku(skus) {
      const r = await publica.lerPorSku(skus)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, opcoes) } : r
    },
  }
}
