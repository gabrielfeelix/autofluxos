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
export type Loja = {
  buscar(termo: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  combinaCom(sku: string): Promise<ResultadoDaLoja<ProdutoDaLoja[]>>
  lerConfig(): Promise<ResultadoDaLoja<ConfigDaLoja>>
}
export type DadosDaLoja = { endereco: string; codigoDaLoja: string | null; sufixo: string }
