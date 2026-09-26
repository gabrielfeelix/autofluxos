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
  /**
   * Como a tela do catálogo abre. `grade` é foto grande, agrupada por
   * categoria, que é como se lê um cardápio; `lista` é a tabela de sempre.
   * As duas continuam a um clique: isto só escolhe a primeira.
   */
  visaoDoCatalogo: VisaoDoCatalogo
  /**
   * A tela do catálogo mostra o bloco do cardápio em arquivo (PDF e imagem,
   * tabela `materiais`), que o bot manda quando pedem "o cardápio".
   */
  materiais: boolean
  /**
   * Como a galeria chama o grupo de modelos do ramo: "Para restaurantes". É
   * o título do bloco em destaque, na galeria de fluxos e na de funis.
   */
  tituloDosModelos: string
  /**
   * Os modelos de fluxo do ramo, pelo id de `src/exemplos/modelos.ts`, na
   * ordem em que aparecem. São os que a galeria mostra primeiro e os que o
   * preparo da conta vai instalar (PLANO-NICHOS 4.4). Os outros continuam a
   * um clique, em "Outros modelos": nada some da galeria.
   */
  modelosDeFluxo: string[]
  /** O modelo de funil do ramo, pelo id de `core/quadros-modelos.ts`. */
  modeloDeFunil: string
}

export const VISOES_DO_CATALOGO = ['grade', 'lista'] as const

export type VisaoDoCatalogo = (typeof VISOES_DO_CATALOGO)[number]

export const PACOTES: Record<Nicho, PacoteDoNicho> = {
  restaurante: {
    nome: 'Restaurante, lanchonete, delivery',
    exemplos: 'pizzaria, hamburgueria, marmitaria',
    objetivoSugerido: 'vender',
    secaoComercio: 'Cardápio',
    iconeComercio: 'talheres',
    itensComercio: { catalogo: 'Pratos' },
    itensOcultos: [],
    visaoDoCatalogo: 'grade',
    materiais: true,
    tituloDosModelos: 'Para restaurantes',
    modelosDeFluxo: ['cardapio-botoes', 'atendente-ia-restaurante'],
    modeloDeFunil: 'pedidos',
  },
  ecommerce: {
    nome: 'Loja virtual',
    exemplos: 'loja no site, Magento, Nuvemshop',
    objetivoSugerido: 'vender',
    secaoComercio: 'Loja',
    iconeComercio: 'sacola',
    itensComercio: {},
    itensOcultos: [],
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para lojas virtuais',
    modelosDeFluxo: ['carrinho-abandonado', 'status-do-pedido'],
    modeloDeFunil: 'comercial',
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
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para o seu comércio',
    modelosDeFluxo: ['voces-tem', 'horario-e-local'],
    // Quem vende no balcão atende mais do que negocia: a venda acontece na
    // loja, e o que o WhatsApp organiza é a pergunta de quem vai passar lá.
    modeloDeFunil: 'atendimento',
  },
}

/** O pacote do ramo, ou `null` para a conta sem ramo (o sistema de hoje). */
export function pacoteDo(nicho: Nicho | null | undefined): PacoteDoNicho | null {
  return nicho ? PACOTES[nicho] : null
}

/**
 * A visão do catálogo que vale para a tela: a pedida no endereço, se for uma
 * que existe, senão a do ramo, senão a lista (a conta sem ramo abre como
 * sempre abriu).
 */
export function visaoDoCatalogo(pacote: PacoteDoNicho | null, pedida?: string | null): VisaoDoCatalogo {
  if (pedida && (VISOES_DO_CATALOGO as readonly string[]).includes(pedida)) return pedida as VisaoDoCatalogo
  return pacote?.visaoDoCatalogo ?? 'lista'
}

/**
 * O destaque do ramo numa galeria de modelos: o título do bloco e os ids, na
 * ordem do pacote. `null` para a conta sem ramo, que vê a galeria de sempre.
 *
 * Duas galerias usam isto, a de fluxos e a de funis, e a tela não decide nada:
 * ela recebe o destaque pronto e só desenha (PLANO-NICHOS 1.6).
 */
export type DestaqueDoRamo = { titulo: string; ids: readonly string[] }

export function destaqueDeFluxos(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote ? { titulo: pacote.tituloDosModelos, ids: pacote.modelosDeFluxo } : null
}

export function destaqueDeFunis(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote ? { titulo: pacote.tituloDosModelos, ids: [pacote.modeloDeFunil] } : null
}

/**
 * Separa uma lista de modelos em "do ramo" e "outros".
 *
 * Os do ramo saem na ordem do destaque, e não na da lista, porque a ordem do
 * pacote é a da recomendação; os outros mantêm a ordem de sempre. Id do
 * destaque que não existe na lista é ignorado: um modelo que saiu do código
 * não pode virar cartão vazio. Sem destaque, tudo é "outros", que é a galeria
 * de hoje.
 */
export function separarPeloRamo<T extends { id: string }>(
  modelos: readonly T[],
  destaque: DestaqueDoRamo | null,
): { doRamo: T[]; outros: T[] } {
  if (!destaque) return { doRamo: [], outros: [...modelos] }
  const doRamo = destaque.ids.flatMap((id) => modelos.filter((modelo) => modelo.id === id))
  return { doRamo, outros: modelos.filter((modelo) => !destaque.ids.includes(modelo.id)) }
}
