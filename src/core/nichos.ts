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

export const NICHOS = ['aulas', 'ecommerce', 'restaurante', 'comercio'] as const

export type Nicho = (typeof NICHOS)[number]

export function ehNicho(valor: unknown): valor is Nicho {
  return typeof valor === 'string' && (NICHOS as readonly string[]).includes(valor)
}

/** O desenho da seção Comércio. Nome e não SVG: o desenho mora na barra. */
export type IconeDoComercio = 'sacola' | 'talheres' | 'vitrine'

/**
 * Os lugares da barra lateral que um ramo pode renomear ou esconder: a chave
 * de uma seção ou o `id` de um subitem (`components/design/secoes-do-cliente.tsx`).
 * A lista mora aqui, e não lá, para o núcleo não depender de componente;
 * `secoes-do-cliente.test.ts` confere que cada um existe de verdade na barra.
 *
 * Início, Conversas, Automações e Configurações ficam de fora de propósito:
 * são o mesmo trabalho em todo ramo, e é por eles que o suporte explica o
 * sistema.
 */
export const LUGARES_DA_BARRA = [
  'crm',
  'contatos',
  'segmentos',
  'etiquetas',
  'negocios',
  'atividades',
  'loja',
  'catalogo',
  'conectar-loja',
  'analise',
  'vendas',
] as const

export type LugarDaBarra = (typeof LUGARES_DA_BARRA)[number]

export type PacoteDoNicho = {
  /** Como o cartão do onboarding e a tela de recursos chamam o ramo. */
  nome: string
  /** Uma linha de exemplo, para a pessoa se reconhecer. */
  exemplos: string
  /** O objetivo que já vem marcado. O dono pode trocar. */
  objetivoSugerido: Objetivo
  /**
   * Os nomes que o ramo dá a seções e subitens da barra. O que não está aqui
   * fica com o nome de sempre. A mesma palavra vale no título da tela e na
   * tela de sem acesso (`rotuloNaBarra`).
   */
  rotulos: Partial<Record<LugarDaBarra, string>>
  /**
   * Subitens que não fazem sentido no ramo. Somem do menu, mas a rota direta
   * continua abrindo e o dado continua lá (PLANO-NICHOS 1.6). Seção que fica
   * sem subitem some inteira, como já acontecia com a permissão.
   */
  ocultos: LugarDaBarra[]
  iconeComercio: IconeDoComercio
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
   * ordem em que aparecem. A conta com ramo vê só estes e os de qualquer
   * negócio (`MODELOS_DE_QUALQUER_RAMO`): decisão do Gabriel em 26/set, "não
   * faz sentido uma automação de e-commerce para um lugar que não vende isso".
   * São também os que o preparo da conta vai instalar (PLANO-NICHOS 4.4).
   */
  modelosDeFluxo: string[]
  /** O modelo de funil do ramo, pelo id de `core/quadros-modelos.ts`. */
  modeloDeFunil: string
}

/**
 * Os modelos que servem a qualquer negócio, e por isso aparecem em toda
 * galeria com ramo, sob "Para qualquer negócio". Recado, menu de dúvidas e
 * pesquisa de satisfação são o mesmo trabalho na pizzaria e no estúdio.
 */
export const MODELOS_DE_QUALQUER_RAMO = ['recado', 'recado-curto', 'menu-atendimento', 'pesquisa-nps'] as const

/** O funil que serve a qualquer negócio: organizar quem chega pelo WhatsApp. */
export const FUNIS_DE_QUALQUER_RAMO = ['atendimento'] as const

export const VISOES_DO_CATALOGO = ['grade', 'lista'] as const

export type VisaoDoCatalogo = (typeof VISOES_DO_CATALOGO)[number]

export const PACOTES: Record<Nicho, PacoteDoNicho> = {
  /*
   * Aulas e serviços com horário: a frente da MGM Pilates. As palavras são as
   * que os fluxos publicados da MGM já usam (medido em 26/set: "aula" 128
   * vezes, "aluno" 99, "matrícula" 10, "cliente" nenhuma). A agenda continua
   * no sistema do cliente, por integração: o AutoFluxos não vira gestão de
   * alunos, então não há catálogo nem loja para mostrar, e a seção Comércio
   * some inteira. O link direto continua abrindo.
   */
  aulas: {
    nome: 'Aulas e serviços com horário',
    exemplos: 'pilates, academia, estúdio, escola, clínica',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Alunos', negocios: 'Matrículas' },
    ocultos: ['catalogo', 'conectar-loja'],
    iconeComercio: 'vitrine',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para aulas e horários',
    modelosDeFluxo: ['agendamento', 'reagendamento', 'nao-comparecimento', 'lembrete', 'aluno-inativo'],
    modeloDeFunil: 'agendamento',
  },
  ecommerce: {
    nome: 'Loja virtual',
    exemplos: 'loja no site, Magento, Nuvemshop',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Clientes', loja: 'Loja' },
    ocultos: [],
    iconeComercio: 'sacola',
    visaoDoCatalogo: 'lista',
    materiais: false,
    tituloDosModelos: 'Para lojas virtuais',
    modelosDeFluxo: ['carrinho-abandonado', 'status-do-pedido', 'cobranca-amigavel'],
    modeloDeFunil: 'comercial',
  },
  restaurante: {
    nome: 'Restaurante, lanchonete, delivery',
    exemplos: 'pizzaria, hamburgueria, marmitaria',
    objetivoSugerido: 'vender',
    rotulos: { contatos: 'Clientes', negocios: 'Pedidos', loja: 'Cardápio', catalogo: 'Pratos' },
    ocultos: [],
    iconeComercio: 'talheres',
    visaoDoCatalogo: 'grade',
    materiais: true,
    tituloDosModelos: 'Para restaurantes',
    modelosDeFluxo: ['cardapio-botoes', 'atendente-ia-restaurante', 'horario-e-local'],
    modeloDeFunil: 'pedidos',
  },
  comercio: {
    nome: 'Loja física, comércio',
    exemplos: 'loja de bairro, papelaria, pet shop',
    objetivoSugerido: 'atender',
    rotulos: { contatos: 'Clientes', loja: 'Produtos', catalogo: 'Produtos e serviços' },
    // Integração é com loja on-line; quem vende no balcão não tem o que ligar.
    ocultos: ['conectar-loja'],
    iconeComercio: 'vitrine',
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
 * O nome de um lugar da barra no ramo: o do pacote, se ele renomeia, senão o
 * de sempre. É a mesma palavra na barra, no título da tela e na tela de sem
 * acesso, para a pessoa não ler "Pratos" no menu e "Produtos" na página.
 */
export function rotuloNaBarra(pacote: PacoteDoNicho | null, lugar: LugarDaBarra, padrao: string): string {
  return pacote?.rotulos[lugar] ?? padrao
}

/** Este lugar da barra some no ramo? Sem ramo, nada some. */
export function ocultoNaBarra(pacote: PacoteDoNicho | null, lugar: string): boolean {
  return !!pacote && (pacote.ocultos as readonly string[]).includes(lugar)
}

/**
 * A galeria de uma conta com ramo: o título do bloco do ramo, os ids dele na
 * ordem do pacote, e os de qualquer negócio. `null` para a conta sem ramo, que
 * vê a galeria de sempre, inteira.
 *
 * Duas galerias usam isto, a de fluxos e a de funis, e a tela não decide nada:
 * ela recebe o destaque pronto e só desenha (PLANO-NICHOS 1.6).
 */
export type DestaqueDoRamo = { titulo: string; ids: readonly string[]; tambem: readonly string[] }

export function destaqueDeFluxos(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote
    ? { titulo: pacote.tituloDosModelos, ids: pacote.modelosDeFluxo, tambem: MODELOS_DE_QUALQUER_RAMO }
    : null
}

export function destaqueDeFunis(pacote: PacoteDoNicho | null): DestaqueDoRamo | null {
  return pacote
    ? { titulo: pacote.tituloDosModelos, ids: [pacote.modeloDeFunil], tambem: FUNIS_DE_QUALQUER_RAMO }
    : null
}

/**
 * Separa uma lista de modelos em "do ramo" e "de qualquer negócio"; o resto
 * não entra.
 *
 * Os do ramo saem na ordem do destaque, e não na da lista, porque a ordem do
 * pacote é a da recomendação; os de qualquer negócio mantêm a ordem de
 * sempre. Um id que está nos dois grupos fica só no do ramo. Id que não existe
 * na lista é ignorado: um modelo que saiu do código não pode virar cartão
 * vazio. Sem destaque, tudo é "outros", que é a galeria de hoje, inteira.
 */
export function separarPeloRamo<T extends { id: string }>(
  modelos: readonly T[],
  destaque: DestaqueDoRamo | null,
): { doRamo: T[]; outros: T[] } {
  if (!destaque) return { doRamo: [], outros: [...modelos] }
  const doRamo = destaque.ids.flatMap((id) => modelos.filter((modelo) => modelo.id === id))
  const outros = modelos.filter((modelo) => destaque.tambem.includes(modelo.id) && !destaque.ids.includes(modelo.id))
  return { doRamo, outros }
}
