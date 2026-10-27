/**
 * As plataformas de cardápio digital e delivery da tela Comércio >
 * Integrações > Cardápio e delivery (docs/PLANO-INTEGRACOES-CARDAPIO.md).
 *
 * Sem I/O. **A lista é fechada e espelha o check de `pedidos_de_loja` (0155)**,
 * onde mora o "Solicitar integração"; quem conecta de fato fica em
 * `cardapios_conectados` (0154). Foody é rastreio do motoboy, não cardápio:
 * entra aqui para ser solicitada, e não vira plataforma de pedido.
 */

export const PLATAFORMAS_DE_CARDAPIO = [
  'cardapio_web',
  'olaclick',
  'goomer',
  'delivery_direto',
  'foody',
  'neemo',
  'opendelivery',
] as const

export type PlataformaDeCardapio = (typeof PLATAFORMAS_DE_CARDAPIO)[number]

export type FichaDoCardapio = {
  id: PlataformaDeCardapio
  nome: string
  /** Uma linha, dita para o lojista: o que a conexão traz. */
  resumo: string
  arquivoDaMarca: string
  /** Onde a conexão se faz, quando já existe. Sem `href`, "Em breve". */
  href: string | null
}

export const FICHAS_DE_CARDAPIO: Record<PlataformaDeCardapio, FichaDoCardapio> = {
  cardapio_web: {
    id: 'cardapio_web',
    nome: 'Cardápio Web',
    resumo: 'Cada pedido entra no quadro, e o cliente é avisado de cada etapa.',
    arquivoDaMarca: 'cardapio_web.png',
    href: '/loja/cardapios/cardapio-web',
  },
  olaclick: {
    id: 'olaclick',
    nome: 'OlaClick',
    resumo: 'Cada pedido entra no quadro, e o cliente é avisado de cada etapa.',
    arquivoDaMarca: 'olaclick.svg',
    href: '/loja/cardapios/olaclick',
  },
  goomer: {
    id: 'goomer',
    nome: 'Goomer',
    resumo: 'Avisa o cliente de cada etapa, o que a Goomer não faz sozinha.',
    arquivoDaMarca: 'goomer.png',
    href: null,
  },
  delivery_direto: {
    id: 'delivery_direto',
    nome: 'Delivery Direto',
    resumo: 'Catálogo completo e mudança de status dos pedidos.',
    arquivoDaMarca: 'delivery_direto.png',
    href: null,
  },
  foody: {
    id: 'foody',
    nome: 'Foody Delivery',
    resumo: 'Rastreio do entregador: link do mapa e aviso de chegada.',
    arquivoDaMarca: 'foody.png',
    href: null,
  },
  neemo: {
    id: 'neemo',
    nome: 'Neemo',
    resumo: 'Status dos pedidos do delivery próprio.',
    arquivoDaMarca: 'neemo.png',
    href: null,
  },
  opendelivery: {
    id: 'opendelivery',
    nome: 'Open Delivery',
    resumo: 'O padrão da Abrasel, aceito por vários sistemas de pedido.',
    arquivoDaMarca: 'opendelivery.webp',
    href: null,
  },
}

export function ehPlataformaDeCardapio(valor: unknown): valor is PlataformaDeCardapio {
  return typeof valor === 'string' && (PLATAFORMAS_DE_CARDAPIO as readonly string[]).includes(valor)
}
