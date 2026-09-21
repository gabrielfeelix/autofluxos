/**
 * De onde a pessoa veio, lido do que já está gravado no contato.
 *
 * ---------------------------------------------------------------------------
 * Por que existe
 * ---------------------------------------------------------------------------
 *
 * `atribuirOrigem` (em `receber-mensagem.ts`) grava a origem em
 * `contacts.campos` desde a primeira mensagem: `origem`, e, quando veio de
 * anúncio, `origem_anuncio` e `origem_titulo`. O dado está lá, com teste, e
 * **nenhuma tela o distingue**: ele cai no despejo genérico "O que o fluxo
 * coletou", entre `objetivo_aluno` e `plano_escolhido`, como se fosse mais uma
 * resposta que o bot colheu. Não é: é o contexto que faz a primeira frase do
 * atendimento ser outra.
 *
 * Este módulo é a leitura desse dado, e só. Puro, sem banco e sem
 * `server-only`, porque quem precisa dele são componentes de tela, a mesma
 * razão de {@link rotuloDoCampo} ser puro.
 *
 * ---------------------------------------------------------------------------
 * Por que uma lista de chaves, e não `campos.origem` direto
 * ---------------------------------------------------------------------------
 *
 * Porque a mesma decisão aparece em dois lugares que divergem em silêncio:
 * o painel precisa **mostrar** a origem em destaque, e o despejo de campos
 * precisa **não repetir** o que o painel já mostrou. Se cada lado tiver a sua
 * lista, um dia entra uma chave nova num e não no outro, e a tela passa a
 * dizer a mesma coisa duas vezes sem ninguém notar.
 */

/**
 * As chaves que `atribuirOrigem` escreve.
 *
 * É a única fonte da verdade: quem mostra lê daqui, quem esconde esconde daqui.
 */
export const CHAVES_DE_ORIGEM = [
  'origem',
  'origem_anuncio',
  'origem_titulo',
  'origem_texto',
  'origem_url',
  'origem_midia',
  'origem_clique',
] as const

const CHAVES = new Set<string>(CHAVES_DE_ORIGEM)

/**
 * A origem como a tela precisa dela.
 *
 * `titulo` é o `headline` do anúncio, "Filme institucional para sua empresa" ,
 * e é a parte que responde sozinha. O `anuncio` é o `source_id`, um número de
 * 16 dígitos: guardado sempre, mostrado só quando não há título, porque número
 * cru na tela é exatamente a queixa que `rotuloDoCampo` existe para resolver.
 */
export type OrigemDoContato = {
  /** `Anúncio` ou `Direto`, como foi gravado. */
  rotulo: string
  /** Veio de anúncio? Decide o destaque na tela. */
  deAnuncio: boolean
  /** O `headline` do anúncio. Vazio quando não veio ou não foi guardado. */
  titulo: string
  /** O `source_id`, que é o `ad_id` da Meta. Vazio quando não há. */
  anuncio: string
  /** O link do anúncio, quando a Meta mandou. */
  url: string
}

/**
 * Lê a origem dos campos do contato. `null` quando nunca foi gravada.
 *
 * **Contato antigo não tem.** `atribuirOrigem` só passou a existir depois de
 * muita conversa registrada, e ele não reescreve o passado de propósito, a
 * origem é da primeira mensagem, e inventar uma agora seria afirmar o que
 * ninguém mediu. Quem não tem o campo devolve `null`, e a tela não mostra
 * linha nenhuma. Isso é diferente de mostrar "Direto", que seria mentira.
 */
export function origemDoContato(campos: Record<string, string>): OrigemDoContato | null {
  const rotulo = (campos.origem ?? '').trim()
  if (rotulo === '') return null

  const titulo = (campos.origem_titulo ?? '').trim()
  const anuncio = (campos.origem_anuncio ?? '').trim()

  return {
    rotulo,
    /*
     * O teste é o rótulo gravado, e não a presença de `origem_anuncio`.
     *
     * Um anúncio de WhatsApp Status chega **sem** `ctwa_clid` e pode chegar sem
     * `source_id`; o `referral` veio, então `atribuirOrigem` gravou "Anúncio".
     * Decidir por `anuncio !== ''` classificaria esse caso como orgânico, o
     * erro que a doc da Meta avisa e que dá para evitar de graça aqui.
     */
    deAnuncio: rotulo.toLowerCase() === 'anúncio',
    titulo,
    anuncio,
    url: (campos.origem_url ?? '').trim(),
  }
}

/**
 * Os campos que o fluxo coletou, sem os que a origem já mostrou.
 *
 * O painel do Inbox despeja `Object.entries(campos)`; sem este filtro, a origem
 * apareceria em cima **e** no meio da lista, e o teto de quatro campos visíveis
 * seria gasto repetindo o que já está na tela.
 */
export function camposSemOrigem(campos: [string, string][]): [string, string][] {
  return campos.filter(([chave]) => !CHAVES.has(chave))
}
