/**
 * Juntar reações às mensagens que elas comentam.
 *
 * Mora em `core/` e não no repo pela mesma razão que `channels/janela.ts`: é
 * uma regra sobre dados, sem banco e sem rede, e regra assim tem que dar para
 * testar sem subir nada. O repo passa as linhas que leu; aqui só se decide
 * quais reações sobrevivem e onde cada uma gruda.
 *
 * A regra que este arquivo carrega inteira: **uma reação por lado, a mais
 * recente, e a remoção apaga em vez de acrescentar.** Ela parece detalhe e não
 * é — sem ela, quem troca de "👍" para "❤️" fica com os dois pendurados na
 * mesma frase para sempre, porque a Meta manda troca como mensagem nova, não
 * como edição.
 */

/**
 * Só o que o casamento precisa saber de uma linha de mensagem.
 *
 * `Lado` é genérico porque quem chama é que sabe o que é uma direção — no repo
 * é `'entrada' | 'saida'`. `core/` não importa tipo de `server/`, e fixar
 * `string` aqui obrigaria quem chama a reafirmar o tipo depois, na mão, em
 * cima de um dado que ele já tinha certo.
 */
export type LinhaDeReacao<Lado extends string = string> = {
  id: string
  direcao: Lado
  /** O `wa_message_id` da mensagem reagida. `null` = esta linha não é reação. */
  reagiu_a: string | null
  /** O emoji. String vazia = a pessoa **removeu** a reação que estava lá. */
  reacao: string | null
}

export type ReacaoCasada<Lado extends string = string> = {
  emoji: string
  de: Lado
  /** O id nosso da linha da reação. */
  id: string
}

/**
 * As reações vivas, agrupadas por `wa_message_id` da mensagem comentada.
 *
 * Recebe as linhas **em ordem cronológica** — a última de cada lado é a que
 * vale. É como `lerConversa` já as tem depois de inverter, então não há
 * ordenação escondida aqui: passar fora de ordem devolve a reação errada, e é
 * por isso que este parágrafo existe.
 */
export function casarReacoes<Lado extends string>(
  linhas: LinhaDeReacao<Lado>[],
): Map<string, ReacaoCasada<Lado>[]> {
  /** alvo → lado → reação daquele lado. O mapa interno é o que faz a troca. */
  const porAlvo = new Map<string, Map<Lado, ReacaoCasada<Lado>>>()

  for (const linha of linhas) {
    if (linha.reagiu_a === null) continue

    const porLado = porAlvo.get(linha.reagiu_a) ?? new Map<Lado, ReacaoCasada<Lado>>()
    porAlvo.set(linha.reagiu_a, porLado)

    /*
     * Remoção apaga o que estava e não entra no lugar. `null` cai aqui junto
     * com a string vazia porque uma linha marcada como reação sem emoji não
     * tem o que mostrar — e mostrar nada é exatamente o que "removeu" quer
     * dizer.
     */
    if (linha.reacao === null || linha.reacao === '') {
      porLado.delete(linha.direcao)
      continue
    }

    porLado.set(linha.direcao, { emoji: linha.reacao, de: linha.direcao, id: linha.id })
  }

  const saida = new Map<string, ReacaoCasada<Lado>[]>()
  for (const [alvo, porLado] of porAlvo) {
    const lista = [...porLado.values()]
    if (lista.length > 0) saida.set(alvo, lista)
  }
  return saida
}
