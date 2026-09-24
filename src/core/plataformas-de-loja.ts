/**
 * As plataformas de loja on-line da tela Loja > Conectar loja (plano de
 * navegação e CRM, 5.6).
 *
 * Sem I/O: a lista, a ordem dos cartões e a regra de quando a Loja aparece no
 * menu. Quem lê o banco é `server/repos/lojas.ts` e `server/repos/recursos.ts`.
 *
 * **A lista é fechada e espelha dois `check` da 0103**
 * (`lojas_integradas.plataforma` para as que conectam, `pedidos_de_loja`
 * para todas). Plataforma nova entra aqui e numa migration, nunca só aqui.
 */

export const PLATAFORMAS_DE_LOJA = [
  'nuvemshop',
  'tray',
  'loja_integrada',
  'vtex',
  'woocommerce',
  'shopify',
  'magento',
] as const

export type PlataformaDeLoja = (typeof PLATAFORMAS_DE_LOJA)[number]

export type FichaDaPlataforma = {
  id: PlataformaDeLoja
  nome: string
  /** Uma linha, dita para o lojista: quem costuma usar. */
  resumo: string
  brasileira: boolean
  /**
   * Onde a conexão se faz, quando já existe. Sem `href` o cartão é "Em breve"
   * e oferece o "Quero esta".
   */
  href: string | null
}

export const FICHAS: Record<PlataformaDeLoja, FichaDaPlataforma> = {
  nuvemshop: {
    id: 'nuvemshop',
    nome: 'Nuvemshop',
    resumo: 'A mais usada por loja pequena e média no Brasil.',
    brasileira: true,
    href: null,
  },
  tray: {
    id: 'tray',
    nome: 'Tray',
    resumo: 'Comum em loja que também vende em marketplace.',
    brasileira: true,
    href: null,
  },
  loja_integrada: {
    id: 'loja_integrada',
    nome: 'Loja Integrada',
    resumo: 'Muito usada por quem está começando a vender on-line.',
    brasileira: true,
    href: null,
  },
  vtex: {
    id: 'vtex',
    nome: 'VTEX',
    resumo: 'Nascida no Brasil, usada por marcas e varejo grande.',
    brasileira: true,
    href: null,
  },
  woocommerce: {
    id: 'woocommerce',
    nome: 'WooCommerce',
    resumo: 'A loja dentro do WordPress, sem mensalidade de plataforma.',
    brasileira: false,
    href: null,
  },
  shopify: {
    id: 'shopify',
    nome: 'Shopify',
    resumo: 'A maior do mundo, com loja de apps própria.',
    brasileira: false,
    href: null,
  },
  magento: {
    id: 'magento',
    nome: 'Magento / Adobe Commerce',
    resumo: 'Loja própria, de porte maior, com equipe técnica.',
    brasileira: false,
    href: '/loja/magento',
  },
}

export function ehPlataformaDeLoja(valor: unknown): valor is PlataformaDeLoja {
  return typeof valor === 'string' && (PLATAFORMAS_DE_LOJA as readonly string[]).includes(valor)
}

export type EstadoDaPlataforma = 'conectada' | 'configurada' | 'disponivel' | 'em_breve'

/**
 * O estado de cada cartão, a partir do que a conta tem.
 *
 * `configurada` é a loja cadastrada e desligada: o endereço está lá, o bot não
 * consulta. Mostrar como "conectada" mentiria sobre o que o bot faz.
 */
export function estadoDaPlataforma(
  ficha: FichaDaPlataforma,
  loja: { ativa: boolean } | null,
): EstadoDaPlataforma {
  if (!ficha.href) return 'em_breve'
  if (!loja) return 'disponivel'
  return loja.ativa ? 'conectada' : 'configurada'
}

const PESO: Record<EstadoDaPlataforma, number> = {
  conectada: 0,
  configurada: 1,
  disponivel: 2,
  em_breve: 3,
}

/**
 * A ordem dos cartões: o que a conta usa primeiro, depois o que dá para
 * conectar hoje, depois o "Em breve". Dentro de cada grupo, **Brasil
 * primeiro** (decisão do plano) e, fora isso, a ordem de `PLATAFORMAS_DE_LOJA`.
 */
export function ordenarPlataformas<T extends { ficha: FichaDaPlataforma; estado: EstadoDaPlataforma }>(
  cartoes: readonly T[],
): T[] {
  const posicao = (id: PlataformaDeLoja) => PLATAFORMAS_DE_LOJA.indexOf(id)
  return [...cartoes].sort(
    (a, b) =>
      PESO[a.estado] - PESO[b.estado] ||
      Number(b.ficha.brasileira) - Number(a.ficha.brasileira) ||
      posicao(a.ficha.id) - posicao(b.ficha.id),
  )
}

/**
 * A Loja aparece no menu desta conta?
 *
 * - quem ligou em Objetivo e recursos vê;
 * - **loja conectada aparece sempre**: o bot está consultando aquela loja, e
 *   esconder o único lugar de desligá-la seria deixar a conta sem controle;
 * - quem desligou não vê;
 * - quem nunca escolheu (`null`) segue a regra de antes do interruptor:
 *   objetivo de vender, loja cadastrada (mesmo desligada) ou catálogo com
 *   item. Estúdio de pilates não vê.
 */
export function mostraLoja({
  escolha,
  vende,
  lojaConectada,
  lojaCadastrada,
  temCatalogo,
}: {
  escolha: boolean | null
  vende: boolean
  lojaConectada: boolean
  lojaCadastrada: boolean
  temCatalogo: boolean
}): boolean {
  if (escolha === true || lojaConectada) return true
  if (escolha === false) return false
  return vende || lojaCadastrada || temCatalogo
}
