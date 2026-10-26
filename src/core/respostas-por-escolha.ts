import { FORMATO_VARIAVEL, type Fluxo, type No } from './flow/schema'
import { variaveisDoFluxo } from './flow/variaveis'

/**
 * O resumo das perguntas de escolha e o filtro por resposta da tela Respostas.
 *
 * ---------------------------------------------------------------------------
 * Por que as categorias vêm do desenho, e não do que foi gravado
 * ---------------------------------------------------------------------------
 *
 * "Frete: 64% Bom preço e opções · 22% Achei caro · 14% Poucas opções" só se
 * lê se as três aparecem sempre, inclusive a que ninguém escolheu ainda: uma
 * opção com 0% é informação ("ninguém achou poucas opções"), e sumir com ela
 * faria a pessoa achar que a pergunta tem duas. Os botões do bloco `pergunta`
 * são a lista fechada do que a variável pode valer, a mesma que o editor já
 * usa para a condição (ver `variaveisDoFluxo`).
 *
 * O que foi gravado e não é opção (texto livre digitado no lugar do botão,
 * opção removida numa republicação) soma em **Outras**, para o total fechar.
 *
 * Pergunta aberta (o comentário) não entra: texto livre não tem categoria, e
 * ela continua aparecendo como coluna da tabela, ao lado da escolha.
 *
 * Puro, sem banco: a tela, o CSV e o teste chamam os mesmos.
 */

export type PerguntaDeEscolha = {
  variavel: string
  /** O texto da pergunta, para a dica. O título do cartão é o rótulo da variável. */
  texto: string
  opcoes: string[]
}

export type ContagemDaOpcao = { rotulo: string; total: number; percentual: number }

export type ResumoDaPergunta = PerguntaDeEscolha & {
  /** Quantas passagens responderam esta pergunta (a base do percentual). */
  respondidas: number
  contagens: ContagemDaOpcao[]
  /** Valor gravado que não é opção desenhada. Zerado, a linha não aparece. */
  outras: ContagemDaOpcao
}

/**
 * As perguntas de escolha de um desenho, na ordem dos blocos.
 *
 * Duas perguntas que guardam na mesma variável viram uma só, com as opções
 * somadas: é o mesmo dado colhido em dois lugares, e o selo do editor já conta
 * assim (`contarRespostasPorVariavel`). Pergunta com opções vindas de API
 * (`opcoesDe`) fica de fora, porque as opções dela só existem na conversa.
 */
export function perguntasDeEscolha(grafo: Fluxo): PerguntaDeEscolha[] {
  const porVariavel = new Map<string, PerguntaDeEscolha>()

  for (const no of grafo.nodes as No[]) {
    if (no.type !== 'pergunta' || !no.data.salvarEm || no.data.opcoesDe) continue
    const rotulos = no.data.opcoes.map((o) => o.rotulo).filter((r) => r !== '')
    if (rotulos.length === 0) continue

    const atual = porVariavel.get(no.data.salvarEm)
    if (!atual) {
      porVariavel.set(no.data.salvarEm, {
        variavel: no.data.salvarEm,
        texto: no.data.texto,
        opcoes: [...new Set(rotulos)],
      })
      continue
    }
    for (const rotulo of rotulos) if (!atual.opcoes.includes(rotulo)) atual.opcoes.push(rotulo)
  }

  return [...porVariavel.values()]
}

/**
 * A variável vinda do endereço, se ela é mesmo uma variável deste desenho.
 *
 * Ela vira caminho JSON na consulta (`vars->>frete`), então duas barreiras:
 * o formato de nome de variável, que é o mesmo que o editor exige, e a lista
 * de variáveis que o fluxo guarda. Um `?resposta=` inventado responde como
 * filtro nenhum, e nunca chega ao banco.
 */
export function variavelDoFiltro(bruta: string, grafo: Fluxo | null): string | null {
  if (!grafo || !FORMATO_VARIAVEL.test(bruta)) return null
  return variaveisDoFluxo(grafo).nomes.includes(bruta) ? bruta : null
}

/**
 * Conta as escolhas de cada pergunta sobre as `vars` das passagens.
 *
 * A comparação é **exata**, sem `trim` nem caixa, de propósito: clicar numa
 * opção filtra no banco por igualdade, e o número do resumo tem de ser o
 * número de linhas que o clique mostra.
 */
export function resumirEscolhas(
  perguntas: PerguntaDeEscolha[],
  linhas: (Record<string, unknown> | null)[],
): ResumoDaPergunta[] {
  return perguntas.map((pergunta) => {
    const totais = new Map(pergunta.opcoes.map((o) => [o, 0]))
    let outras = 0
    let respondidas = 0

    for (const vars of linhas) {
      const valor = vars?.[pergunta.variavel]
      if (valor === null || valor === undefined || valor === '') continue
      respondidas++
      const texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
      if (totais.has(texto)) totais.set(texto, (totais.get(texto) ?? 0) + 1)
      else outras++
    }

    const percentuais = percentuaisQueSomamCem([...totais.values(), outras], respondidas)
    return {
      ...pergunta,
      respondidas,
      contagens: pergunta.opcoes.map((rotulo, i) => ({
        rotulo,
        total: totais.get(rotulo) ?? 0,
        percentual: percentuais[i] ?? 0,
      })),
      outras: { rotulo: 'Outras', total: outras, percentual: percentuais[pergunta.opcoes.length] ?? 0 },
    }
  })
}

/**
 * Percentuais inteiros que fecham em 100 (maior resto).
 *
 * Arredondar cada um sozinho dá 33 + 33 + 33 = 99 numa divisão em três, e o
 * resumo de uma pesquisa que não soma 100 é a primeira coisa que alguém
 * aponta numa reunião.
 */
export function percentuaisQueSomamCem(totais: number[], base: number): number[] {
  if (base <= 0) return totais.map(() => 0)
  const exatos = totais.map((t) => (t / base) * 100)
  const inteiros = exatos.map(Math.floor)
  let faltam = 100 - inteiros.reduce((a, b) => a + b, 0)
  const porResto = exatos
    .map((e, i) => ({ i, resto: e - Math.floor(e) }))
    .filter(({ resto }) => resto > 0)
    .sort((a, b) => b.resto - a.resto)
  for (const { i } of porResto) {
    if (faltam <= 0) break
    inteiros[i] = (inteiros[i] ?? 0) + 1
    faltam--
  }
  return inteiros
}
