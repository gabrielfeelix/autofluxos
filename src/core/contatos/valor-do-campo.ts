/**
 * O que **é** o valor que o fluxo guardou, antes de decidir como desenhá-lo.
 *
 * A queixa é literal: *"o cliente jamais vai entender isso"*. A ficha mostrava
 * tudo como uma linha de texto, e a linha vinha do jeito que o motor gravou.
 * Uma escolha múltipla vira
 * `Drenagem linfática;Fisioterapia;Liberação Miofacial;Massagem Relaxante`,
 * um horário vira `07:00 · Márcia;08:00 · Márcia;12:00 · Thalya`, e um campo
 * de apoio vira seis UUIDs colados por ponto e vírgula. Tudo com o mesmo peso,
 * na mesma cor, sem espaço entre um item e o outro.
 *
 * O ponto e vírgula não é decoração: é como a ação de salvar campo junta lista
 * em texto. Aqui ele é desfeito, e cada tipo de valor ganha o desenho que a
 * pessoa consegue ler: item vira ficha, `07:00 · Márcia` vira hora em negrito
 * com o nome ao lado, link vira link, sim/não vira selo.
 *
 * Puro e sem React de propósito: é a parte que erra em silêncio (um item a
 * mais, um UUID tratado como nome de serviço) e a que vale testar sozinha.
 */

/** Um item de lista, já separado do seu detalhe: `07:00 · Márcia`. */
export type ItemDoCampo = { principal: string; detalhe: string | null }

export type ValorDoCampo =
  | { tipo: 'vazio' }
  | { tipo: 'lista'; itens: ItemDoCampo[] }
  | { tipo: 'identificador'; itens: string[] }
  | { tipo: 'sim-nao'; sim: boolean; texto: string }
  | { tipo: 'link'; url: string }
  | { tipo: 'texto'; texto: string; longo: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Onde o texto deixa de caber numa linha de ficha.
 *
 * Acima disso o valor é parágrafo, e ganha altura de linha de leitura em vez
 * da entrelinha apertada que serve para um nome ou um horário.
 */
const LIMITE_DE_LINHA = 90

/** `a;b ; ;c` → `['a','b','c']`. O separador é o que o motor usa ao juntar. */
export function partesDoValor(valor: string): string[] {
  return valor
    .split(';')
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
}

/**
 * `07:00 · Márcia` → hora e professora. `Pilates solo` → só principal.
 *
 * O `·` é o que o fluxo usa para emendar duas informações num item, e chega
 * com ou sem espaço em volta. Item que termina no separador (`14:00 ·`) fica
 * sem detalhe em vez de ganhar um detalhe vazio.
 */
export function itemDoCampo(parte: string): ItemDoCampo {
  const corte = parte.indexOf('·')
  if (corte === -1) return { principal: parte, detalhe: null }

  const principal = parte.slice(0, corte).trim()
  const detalhe = parte.slice(corte + 1).trim()
  if (principal === '') return { principal: detalhe, detalhe: null }
  return { principal, detalhe: detalhe === '' ? null : detalhe }
}

/** Classifica o valor cru gravado pelo fluxo. */
export function lerValorDoCampo(valor: string): ValorDoCampo {
  const limpo = (valor ?? '').trim()
  if (limpo === '') return { tipo: 'vazio' }

  const partes = partesDoValor(limpo)

  /*
    UUID primeiro, e antes de virar lista.

    `Horarios id` chega com seis deles emendados. Como lista viraria seis
    fichas ilegíveis ocupando meia tela; como identificador some atrás de um
    "Dados técnicos" fechado, que é o lugar dele.
  */
  if (partes.length > 0 && partes.every((parte) => UUID.test(parte))) {
    return { tipo: 'identificador', itens: partes }
  }

  if (partes.length > 1) return { tipo: 'lista', itens: partes.map(itemDoCampo) }

  if (/^https?:\/\/\S+$/i.test(limpo)) return { tipo: 'link', url: limpo }

  if (/^(sim|s|não|nao|n|true|false|yes|no)$/i.test(limpo)) {
    return { tipo: 'sim-nao', sim: /^(sim|s|true|yes)$/i.test(limpo), texto: limpo }
  }

  /*
    Um item só com `·` continua sendo lista de um.

    `Aula experimental · quarta` é o mesmo formato de par que a lista traz, e
    tratá-lo como texto corrido devolveria o ponto do meio para a tela.
  */
  if (limpo.includes('·')) return { tipo: 'lista', itens: [itemDoCampo(limpo)] }

  return { tipo: 'texto', texto: limpo, longo: limpo.length > LIMITE_DE_LINHA }
}

/**
 * Se o campo é de apoio do fluxo, e não resposta da pessoa.
 *
 * `Horarios id`, `Pessoa id`, `Sessao id`: guardados para o fluxo reencontrar
 * um registro no outro sistema, sem nada a dizer a quem lê a ficha. Não são
 * apagados, ficam atrás de "Dados técnicos": esconder não é perder, e o dia em
 * que alguém precisa depurar um agendamento é o dia em que eles salvam a
 * conversa.
 *
 * Decide pela chave **e** pelo valor: chave terminada em `id` pega
 * `horarios_id`, e o valor em UUID pega o campo que alguém nomeou de outro
 * jeito.
 */
export function ehCampoTecnico(chave: string, valor: string): boolean {
  if (/(^|[\s_\-.])ids?$/i.test(chave.trim())) return true
  return lerValorDoCampo(valor).tipo === 'identificador'
}
