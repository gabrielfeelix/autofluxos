import type { Objetivo } from './objetivo-da-conta'

/**
 * O ramo da conta, e o que ele muda na tela (docs/NICHOS.md, docs/PLANO-NICHOS.md).
 *
 * ---------------------------------------------------------------------------
 * O ramo é um pacote de configuração, não um produto à parte
 * ---------------------------------------------------------------------------
 *
 * O código é um só. O banco continua dizendo "produto"; a tela diz Pratos,
 * Produtos ou Produtos e serviços conforme o ramo. Todo comportamento que muda
 * por ramo sai **deste arquivo**, de um objeto `PacoteDoNicho`, e nunca de um
 * `if` com o nome do ramo espalhado pelo código. `nichos.test.ts` varre `src/`
 * e falha se achar um.
 *
 * O pacote muda palavra, ícone e sugestão. **Não** muda permissão, cobrança
 * nem regra de negócio: permissão depende da função da pessoa, não do ramo
 * (PROPOSTA-19-SET, §1.1).
 *
 * ---------------------------------------------------------------------------
 * Sem ramo é o sistema de hoje
 * ---------------------------------------------------------------------------
 *
 * `clients.nicho` nulo quer dizer "geral": nenhum rótulo muda, nenhuma aba
 * some. Todas as contas que existiam antes do ramo continuam iguais, e é o que
 * `pacoteDo(null)` devolve.
 *
 * Puro, sem banco e sem React, como `core/planos.ts` e `core/objetivo-da-conta.ts`.
 */

export const NICHOS = ['restaurante', 'ecommerce', 'comercio'] as const

export type Nicho = (typeof NICHOS)[number]

export function ehNicho(valor: unknown): valor is Nicho {
  return typeof valor === 'string' && (NICHOS as readonly string[]).includes(valor)
}

/** O desenho da seção Comércio. Nome e não SVG: o desenho mora na barra. */
export type IconeDoComercio = 'sacola' | 'talheres' | 'vitrine'

export type PacoteDoNicho = {
  /** Como o cartão do onboarding e a tela de recursos chamam o ramo. */
  nome: string
  /** Uma linha de exemplo, para a pessoa se reconhecer. */
  exemplos: string
  /** O objetivo que já vem marcado. O dono pode trocar. */
  objetivoSugerido: Objetivo
  /** O nome da seção Comércio (chave `loja`). */
  secaoComercio: string
  iconeComercio: IconeDoComercio
  /** O nome de cada subitem da seção, pelo `id` do subitem. */
  itensComercio: Partial<Record<'catalogo' | 'conectar-loja', string>>
  /** Subitens que não fazem sentido no ramo. Só da seção Comércio. */
  itensOcultos: ('catalogo' | 'conectar-loja')[]
}

export const PACOTES: Record<Nicho, PacoteDoNicho> = {
  restaurante: {
    nome: 'Restaurante, lanchonete, delivery',
    exemplos: 'pizzaria, hamburgueria, marmitaria',
    objetivoSugerido: 'vender',
    secaoComercio: 'Cardápio',
    iconeComercio: 'talheres',
    itensComercio: { catalogo: 'Pratos' },
    itensOcultos: [],
  },
  ecommerce: {
    nome: 'Loja virtual',
    exemplos: 'loja no site, Magento, Nuvemshop',
    objetivoSugerido: 'vender',
    secaoComercio: 'Loja',
    iconeComercio: 'sacola',
    itensComercio: {},
    itensOcultos: [],
  },
  comercio: {
    nome: 'Loja física, comércio',
    exemplos: 'loja de bairro, papelaria, pet shop',
    objetivoSugerido: 'atender',
    secaoComercio: 'Produtos',
    iconeComercio: 'vitrine',
    itensComercio: { catalogo: 'Produtos e serviços' },
    // Integração é com loja on-line; quem vende no balcão não tem o que ligar.
    itensOcultos: ['conectar-loja'],
  },
}

/** O pacote do ramo, ou `null` para a conta sem ramo (o sistema de hoje). */
export function pacoteDo(nicho: Nicho | null | undefined): PacoteDoNicho | null {
  return nicho ? PACOTES[nicho] : null
}
