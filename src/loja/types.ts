/**
 * A loja do cliente, vista pelo bot. Neutra: não sabe o que é Magento.
 *
 * Espelha `src/channels/types.ts`: uma interface, um adaptador por
 * plataforma, e quem escolhe é `server/adaptador-da-loja.ts`. Nuvemshop ou
 * Tray entram implementando `Loja`, sem mexer em quem a usa.
 */
import type { FichaDoProduto, OpcaoDeFrete, ProdutoDaLoja } from '@/core/loja'
import type { ArquivoDeDownload, ItemDeDownload } from '@/core/manuais'
export type ResultadoDaLoja<T> = { ok: true; valor: T } | { ok: false; motivo: string }
export type ConfigDaLoja = { codigoDaLoja: string | null; moeda: string; sufixo: string }
/**
 * Página da busca. Sem opções vale o que o bot usa: a primeira página com
 * `LIMITE_DE_PRODUTOS`. O seletor da conversa pede páginas maiores, porque
 * ali quem escolhe é uma pessoa rolando a lista, não a IA.
 */
export type OpcoesDaBusca = { pagina?: number; porPagina?: number; comFoto?: boolean; categoria?: string }
/**
 * O filtro por categoria (0106). Só o catálogo próprio tem categoria; as lojas
 * on-line ignoram o campo e respondem como sempre.
 */
export type FiltroDaLoja = { categoria?: string }
export type Loja = {
  buscar(termo: string, opcoes?: OpcoesDaBusca): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  combinaCom(sku: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  /** Relê pelo SKU, na ordem pedida, para o card sair com o preço de agora. */
  lerPorSku(skus: string[], filtro?: FiltroDaLoja): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  /**
   * Descrição e especificações de um produto. Opcional: só a Magento tem
   * página de produto com ficha; no catálogo próprio a descrição já vem na
   * busca. `null` = o SKU não existe mais.
   */
  ficha?(sku: string): Promise<ResultadoDaLoja<FichaDoProduto | null>>
  /** Opções de frete de um produto para um CEP, como o checkout calcularia. */
  frete?(sku: string, cep: string): Promise<ResultadoDaLoja<OpcaoDeFrete[]>>
  /**
   * Drivers e manuais pela página pública de downloads (`/drivers`, ver
   * `core/manuais.ts`). Opcional: só a Magento com esse módulo tem.
   */
  manuais?(termo: string): Promise<ResultadoDaLoja<{ itens: ItemDeDownload[]; busca: string }>>
  /** Os arquivos de um produto da página de downloads. `null` = id que não existe. */
  downloads?(manualId: string): Promise<
    ResultadoDaLoja<{ nome: string; pagina: string; arquivos: ArquivoDeDownload[] } | null>
  >
  /** A página de busca da loja para este termo. Sem rede. */
  linkDaBusca(termo: string): string
  lerConfig(): Promise<ResultadoDaLoja<ConfigDaLoja>>
}
export type DadosDaLoja = { endereco: string; codigoDaLoja: string | null; sufixo: string }

/** Qual caminho da REST respondeu pelo estoque: MSI (2.3+) ou o legado. */
export type ViaDeEstoque = 'msi' | 'legado'
