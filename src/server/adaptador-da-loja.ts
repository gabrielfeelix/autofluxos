import 'server-only'
import { enriquecer, type Complemento } from '@/loja/enriquecer'
import { lojaMagento } from '@/loja/magento'
import { lojaAdmin } from '@/loja/magento-admin'
import type { Loja } from '@/loja/types'
import { alertar } from './alertar'
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
 * **Por cima da busca pública, e só por cima** (ver `loja/enriquecer.ts`):
 *
 *  - foto real no card (`lerPorSku`), com ou sem token: a foto sai da REST
 *    sem credencial. Loja que fecha a REST para anônimo fica sem foto;
 *  - quantidade exata na busca e no card, só com token.
 *
 * Token que não lê do cofre, que a loja recusa, ou loja lenta: o bot responde
 * com a fase 1 intacta.
 */
export async function lojaAtivaDaConta(clienteId: string): Promise<Loja | null> {
  const loja = await lojaDaConta(clienteId)
  if (!loja || !loja.ativa) return null

  const publica = lojaMagento({ endereco: loja.endereco, codigoDaLoja: loja.codigoDaLoja, sufixo: loja.sufixo })

  let credencial = null
  if (loja.estoqueExato !== 'desligado' && loja.conexaoId) {
    try {
      credencial = await lerCredencial(loja.conexaoId, clienteId)
    } catch {
      credencial = null
    }
  }

  const admin = avisandoRecusa(lojaAdmin({ endereco: loja.endereco, credencial }), clienteId)
  const via = credencial && loja.estoqueExato !== 'desligado' ? loja.estoqueExato : null
  const naBusca = { via, estoqueId: loja.estoqueId, prazoMs: PRAZO_DO_TOKEN_MS, comFoto: false }
  const noCard = { ...naBusca, comFoto: true }

  return {
    ...publica,
    async buscar(termo) {
      const r = await publica.buscar(termo)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, naBusca) } : r
    },
    async combinaCom(sku) {
      const r = await publica.combinaCom(sku)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, naBusca) } : r
    },
    async lerPorSku(skus) {
      const r = await publica.lerPorSku(skus)
      return r.ok ? { ok: true, valor: await enriquecer(r.valor, admin, noCard) } : r
    },
  }
}

export type EstadoDoToken = 'sem_token' | 'ok' | 'recusado' | 'sem_resposta'

/**
 * O token ainda vale? Para a tela, que antes mostrava "conectado" pelo estado
 * salvo mesmo depois de o lojista revogar.
 *
 * Com teto: a tela não pode ficar presa numa loja lenta, e sem resposta a tela
 * não afirma nada. Só `recusado` vira aviso.
 */
export async function estadoDoToken(clienteId: string): Promise<EstadoDoToken> {
  const loja = await lojaDaConta(clienteId)
  if (!loja?.conexaoId || loja.estoqueExato === 'desligado') return 'sem_token'

  let credencial = null
  try {
    credencial = await lerCredencial(loja.conexaoId, clienteId)
  } catch {
    return 'sem_resposta'
  }
  if (!credencial) return 'sem_resposta'

  const conferencia = lojaAdmin({ endereco: loja.endereco, credencial }).conferir(loja.estoqueExato)
  const teto = new Promise<'sem_resposta'>((resolve) => setTimeout(() => resolve('sem_resposta'), PRAZO_DO_TOKEN_MS))
  return Promise.race([conferencia.catch(() => 'sem_resposta' as const), teto])
}

/** Conta e dia do último aviso. Por instância: basta para não inundar o canal. */
const avisadoEm = new Map<string, string>()

/**
 * Token recusado no meio da conversa vira alerta, uma vez por conta por dia.
 *
 * O bot já segue com a fase 1 sem ninguém notar, e é por isso que alguém
 * precisa notar: o lojista revogou, ou o token expirou, e a foto sumiu dos
 * cards. O alerta leva a conta, nunca o token.
 */
function avisandoRecusa(admin: Complemento, clienteId: string): Complemento {
  function conferir<T>(r: { ok: true; valor: T } | { ok: false; motivo: string }) {
    if (!r.ok && r.motivo === 'o token foi recusado pela loja') {
      const hoje = new Date().toISOString().slice(0, 10)
      if (avisadoEm.get(clienteId) !== hoje) {
        avisadoEm.set(clienteId, hoje)
        void alertar('a loja recusou o token de administrador do Magento', r.motivo, { cliente: clienteId })
      }
    }
    return r
  }
  return {
    quantidade: async (sku, via, estoqueId) => conferir(await admin.quantidade(sku, via, estoqueId)),
    foto: async (sku) => conferir(await admin.foto(sku)),
  }
}
