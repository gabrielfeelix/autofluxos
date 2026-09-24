/**
 * As plataformas de loja on-line da tela Comércio > Integrações (plano de
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
    href: '/loja/nuvemshop',
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
 *
 * `liberada: false` é a plataforma com tela pronta e credencial do app ainda
 * não posta (a Nuvemshop sem `NUVEMSHOP_APP_ID`): continua "Em breve", com o
 * "Quero esta", em vez de um botão que leva a uma tela que não conecta.
 */
export function estadoDaPlataforma(
  ficha: FichaDaPlataforma,
  loja: { ativa: boolean } | null,
  liberada = true,
): EstadoDaPlataforma {
  if (!ficha.href || (!liberada && !loja)) return 'em_breve'
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
 * O Comércio aparece no menu desta conta?
 *
 * - **loja conectada aparece sempre**: o bot está consultando aquela loja, e
 *   esconder o único lugar de desligá-la seria deixar a conta sem controle;
 * - quem desligou em Objetivo e recursos não vê;
 * - o resto vê, **inclusive quem nunca escolheu** (`null`). Até 24/set a
 *   regra escondia de quem não vendia, e isso escondia a seção das seis
 *   contas de produção; o Gabriel pediu a seção à vista. Quem não vende
 *   desliga no interruptor.
 */
export function mostraLoja({ escolha, lojaConectada }: { escolha: boolean | null; lojaConectada: boolean }): boolean {
  return lojaConectada || escolha !== false
}
