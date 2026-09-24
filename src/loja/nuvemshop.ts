import 'server-only'
import { LIMITE_DE_CARDS, type ProdutoDaLoja } from '@/core/loja'
import {
  PREFIXO_SEM_SKU,
  enderecoDaLojaNuvemshop,
  linkDaBuscaNuvemshop,
  traduzirListaNuvemshop,
  traduzirProdutoNuvemshop,
} from '@/core/nuvemshop'
import type { Loja, ResultadoDaLoja } from './types'

/**
 * Nuvemshop pela API REST, com o token do OAuth (fontes em
 * `docs/INTEGRACAO-MAGENTO-23-SET.md`, seção Nuvemshop).
 *
 * `fetch` direto, e não `chamarHttp`: o endereço é o da API da Nuvemshop,
 * fixo aqui, e nunca vem do lojista, então não há rede interna a conferir. O
 * token vai só no cabeçalho, nunca em URL nem em log.
 */

const API = 'https://api.nuvemshop.com.br/2025-03'

/** Obrigatório pela Nuvemshop: sem nome do app e contato, a API responde 400. */
export const USER_AGENT = 'AutoFluxos (https://autofluxos.4yu.com.br)'

const PRAZO_MS = 6_000

export type DadosDaNuvemshop = { endereco: string; storeId: string; token: string }

type Buscar = typeof fetch

/** Uma chamada à API da loja. `null` no corpo é 404 (produto não existe). */
export async function chamarNuvemshop(
  dados: { storeId: string; token: string },
  caminho: string,
  buscar: Buscar = fetch,
  init: { metodo?: 'GET' | 'POST'; corpo?: unknown } = {},
): Promise<ResultadoDaLoja<unknown>> {
  let resposta: Response
  try {
    resposta = await buscar(`${API}/${dados.storeId}${caminho}`, {
      method: init.metodo ?? 'GET',
      headers: {
        // A doc de 2025 usa `Authorization`; a antiga, `Authentication`. Os dois.
        Authorization: `Bearer ${dados.token}`,
        Authentication: `bearer ${dados.token}`,
        'User-Agent': USER_AGENT,
        ...(init.corpo === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
      },
      body: init.corpo === undefined ? undefined : JSON.stringify(init.corpo),
      signal: AbortSignal.timeout(PRAZO_MS),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, motivo: 'a Nuvemshop não respondeu' }
  }
  if (resposta.status === 401 || resposta.status === 403) {
    return { ok: false, motivo: 'a Nuvemshop recusou o acesso; conecte a loja de novo' }
  }
  if (resposta.status === 404) return { ok: true, valor: null }
  if (resposta.status === 429) return { ok: false, motivo: 'a Nuvemshop pediu para esperar (limite de chamadas)' }
  if (!resposta.ok) return { ok: false, motivo: `a Nuvemshop respondeu ${resposta.status}` }
  try {
    return { ok: true, valor: await resposta.json() }
  } catch {
    return { ok: false, motivo: 'a Nuvemshop respondeu algo que não é JSON' }
  }
}

/** A loja em si: endereço público, nome e moeda (`GET /store`). */
export async function lerLojaNuvemshop(
  dados: { storeId: string; token: string },
  buscar: Buscar = fetch,
): Promise<ResultadoDaLoja<{ endereco: string; nome: string | null; moeda: string }>> {
  const r = await chamarNuvemshop(dados, '/store?fields=name,domains,original_domain,main_currency', buscar)
  if (!r.ok) return r
  const endereco = enderecoDaLojaNuvemshop(r.valor)
  if (!endereco) return { ok: false, motivo: 'a Nuvemshop não informou o endereço da loja' }
  const loja = r.valor as { name?: unknown; main_currency?: unknown }
  const nome =
    typeof loja.name === 'string'
      ? loja.name
      : loja.name && typeof loja.name === 'object'
        ? (Object.values(loja.name as Record<string, unknown>).find((v) => typeof v === 'string') as string | undefined) ?? null
        : null
  return { ok: true, valor: { endereco, nome, moeda: typeof loja.main_currency === 'string' ? loja.main_currency : 'BRL' } }
}

export function lojaNuvemshop(dados: DadosDaNuvemshop, buscar: Buscar = fetch): Loja {
  async function lerUm(id: string): Promise<ResultadoDaLoja<ProdutoDaLoja | null>> {
    const caminho = id.startsWith(PREFIXO_SEM_SKU)
      ? `/products/${encodeURIComponent(id.slice(PREFIXO_SEM_SKU.length))}`
      : `/products/sku/${encodeURIComponent(id)}`
    const r = await chamarNuvemshop(dados, caminho, buscar)
    if (!r.ok) return r
    return { ok: true, valor: r.valor ? traduzirProdutoNuvemshop(r.valor, dados.endereco) : null }
  }

  return {
    async buscar(termo) {
      const limpo = termo.trim().slice(0, 80)
      if (!limpo) return { ok: true, valor: [] }
      const r = await chamarNuvemshop(
        dados,
        `/products?q=${encodeURIComponent(limpo)}&published=true&per_page=10`,
        buscar,
      )
      return r.ok ? { ok: true, valor: traduzirListaNuvemshop(r.valor, dados.endereco) } : r
    },
    // A Nuvemshop não tem "combina com" na API: responder vazio é a verdade.
    async combinaCom() {
      return { ok: true, valor: [] }
    },
    async lerPorSku(skus) {
      const pedidos = [...new Set(skus.map((s) => s.trim()).filter(Boolean))].slice(0, LIMITE_DE_CARDS)
      const lidos = await Promise.all(pedidos.map(lerUm))
      const falha = lidos.find((r) => !r.ok)
      if (falha && !falha.ok) return falha
      return {
        ok: true,
        valor: lidos.flatMap((r) => (r.ok && r.valor ? [r.valor] : [])),
      }
    },
    linkDaBusca(termo) {
      return linkDaBuscaNuvemshop(dados.endereco, termo)
    },
    async lerConfig() {
      const r = await lerLojaNuvemshop(dados, buscar)
      if (!r.ok) return r
      return { ok: true, valor: { codigoDaLoja: null, moeda: r.valor.moeda, sufixo: '' } }
    },
  }
}
