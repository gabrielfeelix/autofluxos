import 'server-only'
import { chamarHttp, type CredencialDaChamada } from '@/server/efeitos/http'
import type { ResultadoDaLoja, ViaDeEstoque } from './types'

/**
 * Magento com o token de administrador do lojista: foto real e estoque exato.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo não sabe escrever
 * ---------------------------------------------------------------------------
 *
 * A ACL do Magento não separa ler de escrever na maior parte dos recursos:
 * quem libera "Produtos" para a integração libera alterar produto também. O
 * escopo do token, então, não protege a loja. O que protege é isto:
 *
 *   - não existe parâmetro de método em lugar nenhum: toda chamada escreve o
 *     literal 'GET', e o teste lê este fonte e falha se aparecer outro verbo;
 *   - os caminhos são uma lista fixa (`CAMINHOS`), com o SKU codificado, então
 *     um SKU com barra não sai do caminho previsto.
 *
 * Quem precisar escrever na loja um dia (pedido, reserva) escreve outro
 * arquivo, com outra revisão. Não acrescenta verbo aqui.
 *
 * Toda chamada passa por `chamarHttp`: trava de endereço interno, prazo e
 * reconferência de redirecionamento vêm junto, e o token só vai para a origem
 * da loja.
 */

const CAMINHOS = {
  /** Qual estoque atende o site padrão (MSI). */
  estoqueDoSite: () => `/rest/V1/inventory/stock-resolver/website/base`,
  /** O que sobra para vender, já descontadas as reservas de pedido (MSI). */
  vendavel: (sku: string, estoqueId: number) =>
    `/rest/V1/inventory/get-product-salable-quantity/${encodeURIComponent(sku)}/${estoqueId}`,
  /** Loja sem MSI. */
  legado: (sku: string) => `/rest/V1/stockItems/${encodeURIComponent(sku)}`,
  /** As fotos. Na PCYES o GraphQL público só devolve placeholder (23/set/2026). */
  midia: (sku: string) => `/rest/V1/products/${encodeURIComponent(sku)}/media`,
} as const

type Chamar = typeof chamarHttp

function statusDe(motivo: string): number | null {
  const achado = /respondeu (\d{3})/.exec(motivo)
  return achado ? Number(achado[1]) : null
}

function inteiroNaoNegativo(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null
}

export function lojaAdmin(
  dados: { endereco: string; credencial: CredencialDaChamada },
  chamar: Chamar = chamarHttp,
) {
  async function ler(caminho: string): Promise<ResultadoDaLoja<unknown> & { status?: number | null }> {
    const r = await chamar(
      {
        tipo: 'chamar_http',
        metodo: 'GET',
        url: `${dados.endereco}${caminho}`,
        cabecalhos: [],
        corpo: '',
        mapear: [],
        aoFalhar: 'humano',
      },
      { deTeste: false, credencial: dados.credencial, comJson: true },
    )
    if (r.ok) return { ok: true, valor: r.json }
    const status = statusDe(r.motivo)
    if (status === 401 || status === 403) return { ok: false, motivo: 'o token foi recusado pela loja', status }
    return { ok: false, motivo: `a loja não respondeu: ${r.motivo}`, status }
  }

  async function quantidade(
    sku: string,
    via: ViaDeEstoque,
    estoqueId: number | null,
  ): Promise<ResultadoDaLoja<number>> {
    if (via === 'msi') {
      const r = await ler(CAMINHOS.vendavel(sku, estoqueId ?? 1))
      if (!r.ok) return { ok: false, motivo: r.motivo }
      const n = inteiroNaoNegativo(r.valor)
      return n === null ? { ok: false, motivo: 'a loja devolveu uma quantidade ilegível' } : { ok: true, valor: n }
    }

    const r = await ler(CAMINHOS.legado(sku))
    if (!r.ok) return { ok: false, motivo: r.motivo }
    const n = inteiroNaoNegativo((r.valor as { qty?: unknown } | null)?.qty)
    return n === null ? { ok: false, motivo: 'a loja devolveu uma quantidade ilegível' } : { ok: true, valor: n }
  }

  return {
    /**
     * Qual caminho de estoque a loja tem. Roda uma vez, no teste da tela, e o
     * resultado fica gravado (`lojas_integradas.estoque_exato`).
     *
     * Tenta MSI primeiro; 404 ali quer dizer "sem MSI", e aí vale o legado.
     * Token recusado para na primeira resposta: tentar o outro caminho com o
     * mesmo token só produziria a mesma recusa.
     */
    async descobrir(sku: string): Promise<ResultadoDaLoja<{ via: ViaDeEstoque; estoqueId: number | null }>> {
      const site = await ler(CAMINHOS.estoqueDoSite())
      if (site.ok) {
        const estoqueId = inteiroNaoNegativo((site.valor as { stock_id?: unknown } | null)?.stock_id)
        if (estoqueId !== null && estoqueId > 0) {
          const q = await quantidade(sku, 'msi', estoqueId)
          if (q.ok) return { ok: true, valor: { via: 'msi', estoqueId } }
          if (q.motivo === 'o token foi recusado pela loja') return q
        }
      } else if (site.status === 401 || site.status === 403) {
        return { ok: false, motivo: site.motivo }
      }

      const legado = await quantidade(sku, 'legado', null)
      if (legado.ok) return { ok: true, valor: { via: 'legado', estoqueId: null } }
      return { ok: false, motivo: legado.motivo }
    },

    quantidade,

    /**
     * A foto principal do produto: a ativa com o papel `image`, ou a primeira
     * ativa se nenhuma tiver o papel. Vídeo fica de fora.
     *
     * Sem foto ativa devolve `null`, e não placeholder: quem monta o card
     * troca por texto com link, que é melhor do que um quadrado cinza com a
     * marca da loja no WhatsApp do cliente.
     */
    async foto(sku: string): Promise<ResultadoDaLoja<string | null>> {
      const r = await ler(CAMINHOS.midia(sku))
      if (!r.ok) return { ok: false, motivo: r.motivo }
      const lista = Array.isArray(r.valor) ? (r.valor as Record<string, unknown>[]) : []
      const ativas = lista.filter(
        (m) => m && m.disabled !== true && m.media_type === 'image' && typeof m.file === 'string' && m.file !== '',
      )
      const principal =
        ativas.find((m) => Array.isArray(m.types) && (m.types as unknown[]).includes('image')) ?? ativas[0]
      if (!principal) return { ok: true, valor: null }
      const arquivo = String(principal.file)
      return {
        ok: true,
        valor: `${dados.endereco}/media/catalog/product${arquivo.startsWith('/') ? '' : '/'}${arquivo}`,
      }
    },
  }
}

export type LojaAdmin = ReturnType<typeof lojaAdmin>
