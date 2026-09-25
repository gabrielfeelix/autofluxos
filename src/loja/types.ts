/**
 * A loja do cliente, vista pelo bot. Neutra: não sabe o que é Magento.
 *
 * Espelha `src/channels/types.ts`: uma interface, um adaptador por
 * plataforma, e quem escolhe é `server/adaptador-da-loja.ts`. Nuvemshop ou
 * Tray entram implementando `Loja`, sem mexer em quem a usa.
 */
import type { ProdutoDaLoja } from '@/core/loja'
export type ResultadoDaLoja<T> = { ok: true; valor: T } | { ok: false; motivo: string }
export type ConfigDaLoja = { codigoDaLoja: string | null; moeda: string; sufixo: string }
/**
 * Página da busca. Sem opções vale o que o bot usa: a primeira página com
 * `LIMITE_DE_PRODUTOS`. O seletor da conversa pede páginas maiores, porque
 * ali quem escolhe é uma pessoa rolando a lista, não a IA.
 */
export type OpcoesDaBusca = { pagina?: number; porPagina?: number; comFoto?: boolean }
export type Loja = {
  buscar(termo: string, opcoes?: OpcoesDaBusca): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  combinaCom(sku: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  /** Relê pelo SKU, na ordem pedida, para o card sair com o preço de agora. */
  lerPorSku(skus: string[]): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  /** A página de busca da loja para este termo. Sem rede. */
  linkDaBusca(termo: string): string
  lerConfig(): Promise<ResultadoDaLoja<ConfigDaLoja>>
}
export type DadosDaLoja = { endereco: string; codigoDaLoja: string | null; sufixo: string }

/** Qual caminho da REST respondeu pelo estoque: MSI (2.3+) ou o legado. */
export type ViaDeEstoque = 'msi' | 'legado'
