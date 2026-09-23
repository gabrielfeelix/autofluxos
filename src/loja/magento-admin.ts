import 'server-only'
import { chamarHttp, type CredencialDaChamada } from '@/server/efeitos/http'
import type { ResultadoDaLoja, ViaDeEstoque } from './types'

/**
 * Magento pela REST: foto real (sem credencial) e estoque exato (com o token).
 *
 * A foto sai **sem** o token, de propósito: é dado público do catálogo, e na
 * PCYES `GET /V1/products/{sku}` responde sem autenticação (23/set/2026).
 * Mandar o token onde ele não é preciso só aumenta onde ele circula. Loja que
 * fecha a REST para anônimo responde 401, e aí, havendo token, a foto é pedida
 * de novo com ele; sem token, o card sai como texto.
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
  /**
   * O produto, pela galeria (`media_gallery_entries`). Não `/media`: na PCYES
   * o arquivo da foto é a URL inteira do CDN, e `/media` tenta ler esse
   * "arquivo" do disco e responde 400, com ou sem token (23/set/2026).
   */
  produto: (sku: string) => `/rest/V1/products/${encodeURIComponent(sku)}`,
} as const

/** SKU que não existe, para conferir o token no caminho legado: 404 é token bom. */
const SKU_DE_CONFERENCIA = 'autofluxos-conferencia-de-token'

type Chamar = typeof chamarHttp

function statusDe(motivo: string): number | null {
  const achado = /respondeu (\d{3})/.exec(motivo)
  return achado ? Number(achado[1]) : null
}

function inteiroNaoNegativo(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null
}

export function lojaAdmin(
  dados: { endereco: string; credencial: CredencialDaChamada | null },
  chamar: Chamar = chamarHttp,
) {
  async function ler(
    caminho: string,
    { comToken = true }: { comToken?: boolean } = {},
  ): Promise<ResultadoDaLoja<unknown> & { status?: number | null }> {
    if (comToken && !dados.credencial) return { ok: false, motivo: 'sem token conectado', status: null }
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
      { deTeste: false, credencial: comToken ? dados.credencial : null, comJson: true },
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
     * O token ainda vale? `recusado` só com 401/403; loja fora do ar é
     * `sem_resposta`, e quem mostra isso não pode dizer que o token caiu.
     */
    async conferir(via: ViaDeEstoque): Promise<'ok' | 'recusado' | 'sem_resposta'> {
      // Pelo caminho de estoque, que é o que exige o token: o catálogo pode
      // estar aberto a anônimo (a PCYES está) e responderia 200 com token
      // revogado. O Magento confere a permissão antes de procurar o produto,
      // então no legado um SKU inexistente devolve 404 com token bom e 401 sem.
      const r = await ler(via === 'msi' ? CAMINHOS.estoqueDoSite() : CAMINHOS.legado(SKU_DE_CONFERENCIA))
      if (r.ok || (via === 'legado' && r.status === 404)) return 'ok'
      return r.status === 401 || r.status === 403 ? 'recusado' : 'sem_resposta'
    },

    /**
     * A foto principal do produto: a ativa com o papel `image`, ou a primeira
     * ativa se nenhuma tiver o papel. Vídeo fica de fora.
     *
     * Sem foto ativa devolve `null`, e não placeholder: quem monta o card
     * troca por texto com link, que é melhor do que um quadrado cinza com a
     * marca da loja no WhatsApp do cliente.
     */
    async foto(sku: string): Promise<ResultadoDaLoja<string | null>> {
      let r = await ler(CAMINHOS.produto(sku), { comToken: false })
      if (!r.ok && (r.status === 401 || r.status === 403) && dados.credencial) r = await ler(CAMINHOS.produto(sku))
      if (!r.ok) return { ok: false, motivo: r.motivo }
      const galeria = (r.valor as { media_gallery_entries?: unknown } | null)?.media_gallery_entries
      const lista = Array.isArray(galeria) ? (galeria as Record<string, unknown>[]) : []
      const ativas = lista.filter(
        (m) => m && m.disabled !== true && m.media_type === 'image' && typeof m.file === 'string' && m.file !== '',
      )
      const principal =
        ativas.find((m) => Array.isArray(m.types) && (m.types as unknown[]).includes('image')) ?? ativas[0]
      if (!principal) return { ok: true, valor: null }
      const arquivo = String(principal.file)
      // Absoluta quando a loja guarda a foto num CDN (PCYES). Só `https`: o
      // WhatsApp busca a imagem do cabeçalho, e endereço sem TLS é recusado.
      if (/^[a-z]+:\/\//i.test(arquivo)) return { ok: true, valor: arquivo.startsWith('https://') ? arquivo : null }
      return {
        ok: true,
        valor: `${dados.endereco}/media/catalog/product${arquivo.startsWith('/') ? '' : '/'}${arquivo}`,
      }
    },
  }
}

export type LojaAdmin = ReturnType<typeof lojaAdmin>
