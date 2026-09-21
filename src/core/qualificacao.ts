/**
 * A avaliação de qualificação: quatro resultados, e a diferença entre falso e
 * desconhecido.
 *
 * ---------------------------------------------------------------------------
 * Por que quatro, e não "qualificado sim ou não"
 * ---------------------------------------------------------------------------
 *
 * Porque um booleano não sabe dizer **"ainda não perguntei"**, e é exatamente
 * essa a diferença que muda o que a equipe faz. Quem não atende aos critérios
 * recebe material; quem tem dados faltando recebe uma pergunta. Um sistema que
 * chama as duas de "não qualificado" manda material para quem estava só a uma
 * resposta de virar cliente.
 *
 * Os quatro são os da seção 7.3 da proposta: `nao_avaliado`, `incompleto`,
 * `atende`, `nao_atende`.
 *
 * ---------------------------------------------------------------------------
 * A regra que separa falso de desconhecido
 * ---------------------------------------------------------------------------
 *
 * "Em **todas**, uma condição falsa já determina que não atende; em
 * **qualquer**, uma verdadeira já determina que atende. Só indicar dados
 * incompletos quando os dados ausentes puderem mudar o resultado."
 *
 * É lógica de três valores, e a última frase é o ponto: com quatro condições em
 * "todas" e uma delas comprovadamente falsa, não importa que as outras três
 * estejam em branco, a resposta já é não. Pedir os três dados faltantes seria
 * fazer a pessoa trabalhar para chegar à mesma conclusão.
 *
 * ---------------------------------------------------------------------------
 * E por que a avaliação é gravada com a versão dos critérios
 * ---------------------------------------------------------------------------
 *
 * Porque "alterar critérios não reescreve avaliações passadas". Uma avaliação é
 * o que a regra **daquele dia** respondeu sobre os dados **daquele dia**. Sem a
 * versão junto, mudar o critério faria o histórico inteiro passar a mentir, e
 * ninguém teria como explicar por que um lead foi recusado em março.
 */

import type { ValorDeCampo } from './campos'

export type ResultadoDaAvaliacao = 'nao_avaliado' | 'incompleto' | 'atende' | 'nao_atende'

export type Operador = 'igual' | 'diferente' | 'maior' | 'menor' | 'preenchido' | 'contem'

export type Condicao = {
  /** A chave estável do campo, nunca o rótulo. */
  campo: string
  operador: Operador
  valor?: string
}

export type Criterios = {
  /** A identidade dos critérios. A avaliação guarda isto, não o conteúdo. */
  id: string
  /**
   * A versão, que sobe a cada publicação.
   *
   * Gravada junto da avaliação: é o que permite dizer "isto foi avaliado pela
   * regra v3" quando a conta já está na v7.
   */
  versao: number
  /** O objetivo a que estes critérios servem: um por processo/finalidade. */
  objetivo: string
  modo: 'todas' | 'qualquer'
  condicoes: Condicao[]
}

/** Uma condição pode ser verdadeira, falsa, ou indecidível por falta de dado. */
type Tri = true | false | 'desconhecido'

function avaliarCondicao(condicao: Condicao, campos: Record<string, ValorDeCampo>): Tri {
  const bruto = campos[condicao.campo]?.valor
  const vazio = bruto === undefined || bruto.trim() === ''

  /*
   * `preenchido` é a única que responde sobre a **ausência**, então ela decide
   * mesmo sem dado. As outras não podem: comparar um campo em branco com "500"
   * e responder `false` afirmaria que a pessoa tem menos de 500, quando ela só
   * não respondeu ainda.
   */
  if (condicao.operador === 'preenchido') return !vazio
  if (vazio) return 'desconhecido'

  const valor = bruto.trim()
  const alvo = (condicao.valor ?? '').trim()

  switch (condicao.operador) {
    case 'igual':
      return valor.toLowerCase() === alvo.toLowerCase()
    case 'diferente':
      return valor.toLowerCase() !== alvo.toLowerCase()
    case 'contem':
      return valor.toLowerCase().includes(alvo.toLowerCase())
    case 'maior':
    case 'menor': {
      const n = Number(valor.replace(',', '.'))
      const m = Number(alvo.replace(',', '.'))
      /*
       * Texto onde se esperava número é `desconhecido`, e não `false`. "não
       * sei" e "é menor" levam a ações diferentes: uma pede a pergunta de novo,
       * a outra descarta o lead.
       */
      if (Number.isNaN(n) || Number.isNaN(m)) return 'desconhecido'
      return condicao.operador === 'maior' ? n > m : n < m
    }
  }
}

export type Avaliacao = {
  resultado: ResultadoDaAvaliacao
  /** Por que, em texto que a equipe lê. Vazio quando `nao_avaliado`. */
  motivos: string[]
  /** As chaves que faltam, e só as que **podem mudar** o resultado. */
  faltam: string[]
  criteriosId: string
  criteriosVersao: number
  objetivo: string
}

/**
 * Avalia os critérios contra os campos do contato.
 *
 * Critérios sem condição nenhuma respondem `nao_avaliado`: uma regra vazia não
 * aprova ninguém. Aprovar seria o pior default possível, porque uma conta que
 * ainda não configurou nada passaria a qualificar todo mundo.
 */
export function avaliar(
  criterios: Criterios,
  campos: Record<string, ValorDeCampo>,
): Avaliacao {
  const base = {
    criteriosId: criterios.id,
    criteriosVersao: criterios.versao,
    objetivo: criterios.objetivo,
  }

  if (criterios.condicoes.length === 0) {
    return { resultado: 'nao_avaliado', motivos: [], faltam: [], ...base }
  }

  const avaliadas = criterios.condicoes.map((c) => ({ condicao: c, valor: avaliarCondicao(c, campos) }))
  const faltam = avaliadas.filter((a) => a.valor === 'desconhecido').map((a) => a.condicao.campo)

  if (criterios.modo === 'todas') {
    /*
     * Uma falsa já decide, **mesmo com outras em branco**. É a última frase da
     * regra: só indicar dados incompletos quando os ausentes puderem mudar o
     * resultado, e aqui eles não podem.
     */
    const falsas = avaliadas.filter((a) => a.valor === false)
    if (falsas.length > 0) {
      return {
        resultado: 'nao_atende',
        motivos: falsas.map((a) => descrever(a.condicao, campos)),
        faltam: [],
        ...base,
      }
    }
    if (faltam.length > 0) {
      return { resultado: 'incompleto', motivos: [], faltam, ...base }
    }
    return { resultado: 'atende', motivos: [], faltam: [], ...base }
  }

  // `qualquer`: uma verdadeira já decide, pelo mesmo motivo espelhado.
  const verdadeiras = avaliadas.filter((a) => a.valor === true)
  if (verdadeiras.length > 0) {
    return { resultado: 'atende', motivos: [], faltam: [], ...base }
  }
  if (faltam.length > 0) {
    return { resultado: 'incompleto', motivos: [], faltam, ...base }
  }
  return {
    resultado: 'nao_atende',
    motivos: avaliadas.map((a) => descrever(a.condicao, campos)),
    faltam: [],
    ...base,
  }
}

/** O motivo em texto, com o valor que de fato estava lá. */
function descrever(condicao: Condicao, campos: Record<string, ValorDeCampo>): string {
  const valor = campos[condicao.campo]?.valor ?? 'não informado'
  const alvo = condicao.valor ?? ''

  switch (condicao.operador) {
    case 'igual':
      return `${condicao.campo} é "${valor}", e o critério pede "${alvo}"`
    case 'diferente':
      return `${condicao.campo} é "${valor}", e o critério pede diferente de "${alvo}"`
    case 'maior':
      return `${condicao.campo} é ${valor}, e o critério pede mais que ${alvo}`
    case 'menor':
      return `${condicao.campo} é ${valor}, e o critério pede menos que ${alvo}`
    case 'contem':
      return `${condicao.campo} é "${valor}", e o critério pede algo com "${alvo}"`
    case 'preenchido':
      return `${condicao.campo} não foi informado`
  }
}

/**
 * Pedir para falar com uma pessoa **não** qualifica ninguém (RB-21).
 *
 * Existe como função, e não como ausência de código, porque "não" precisa de um
 * lugar onde esteja escrito e testado. O modelo SDR fazia exatamente isto: o
 * caminho "quero falar com alguém" caía no mesmo nó de handoff rotulado
 * `lead qualificado`, então quem pediu ajuda saía marcado como qualificado sem
 * nenhum critério ter sido conferido.
 *
 * A passagem ao humano pode acontecer em qualquer resultado, inclusive
 * `nao_atende` e `incompleto`, e não altera nenhum deles.
 */
export function passarAoHumano(avaliacao: Avaliacao): Avaliacao {
  return avaliacao
}

/**
 * Critérios estão prontos para publicar? (RB-22)
 *
 * "Campos, valores mínimos e restrições precisam estar preenchidos antes de
 * publicar a regra; valores de demonstração não podem virar política real."
 *
 * É o que impede o `orcamento > 499` do modelo SDR de virar a política de uma
 * empresa que nunca escolheu esse número.
 */
export type ProntidaoDosCriterios =
  | { pronto: true }
  | { pronto: false; problemas: string[] }

export function prontoParaPublicar(criterios: Criterios): ProntidaoDosCriterios {
  const problemas: string[] = []

  if (criterios.condicoes.length === 0) {
    problemas.push('a regra não tem nenhuma condição')
  }

  for (const condicao of criterios.condicoes) {
    if (condicao.campo.trim() === '') {
      problemas.push('há uma condição sem campo escolhido')
      continue
    }
    /*
     * `preenchido` não precisa de valor: ela pergunta sobre a existência. As
     * outras precisam, e uma condição sem valor comparado não decide nada ,
     * ela responderia `desconhecido` para sempre.
     */
    if (condicao.operador !== 'preenchido' && (condicao.valor ?? '').trim() === '') {
      problemas.push(`a condição de "${condicao.campo}" está sem valor`)
    }
    if (
      (condicao.operador === 'maior' || condicao.operador === 'menor') &&
      Number.isNaN(Number((condicao.valor ?? '').replace(',', '.')))
    ) {
      problemas.push(`a condição de "${condicao.campo}" compara com algo que não é número`)
    }
  }

  return problemas.length === 0 ? { pronto: true } : { pronto: false, problemas }
}
