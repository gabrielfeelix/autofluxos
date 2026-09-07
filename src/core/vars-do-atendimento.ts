/**
 * O horário de atendimento como variável, para o fluxo poder desviar por ele.
 *
 * **O que faltava, e por que doía.** O produto sabe se está aberto desde a
 * `0022`: o bot já responde *"voltamos amanhã a partir das 08:00"* sozinho
 * quando desiste fora do expediente (`avisoDeForaDoHorario`). Mas quem desenha
 * o fluxo não tinha como **ramificar** por isso — os operadores da condição são
 * `igual`, `contem`, `vazio`… e nenhum fala de relógio. Então "de madrugada,
 * ofereça o formulário em vez de prometer atendente" era impossível de
 * desenhar, e a única saída era o handoff com a frase pronta.
 *
 * **Por que variável e não operador novo.** Um operador `dentro_do_horario`
 * pareceria mais direto e é pior: `OPERADORES` é usado em `avaliar`, no
 * validador, no editor e na ajuda, e um operador que ignora os campos
 * `variavel` e `valor` deixaria a tela oferecendo dois campos que não fazem
 * nada. Como variável, ela entra em **tudo que já existe** — condição,
 * interpolação numa mensagem, `salvar-campo`, corpo de um `http` — sem tocar
 * em nenhum dos quatro lugares.
 *
 * As duas seguem o molde de `varsDeData`: entram na sessão para a rodada e
 * **saem antes de gravar** (ver `semDatas`/`semVarsDeSistema` no resolvedor).
 * Guardá-las seria gravar na ficha do lead um "sim" que amanhã é mentira.
 */

import type { ContextoDoAtendimento } from './engine/executar'

/**
 * `sim` ou `nao`, escrito assim de propósito.
 *
 * A condição compara texto, e a pessoa que desenha escreve o valor à mão no
 * campo. `sim` é o que ela vai digitar; `true` é o que um programador
 * digitaria, e quem desenha fluxo aqui não é programador.
 */
export const VARIAVEIS_DO_ATENDIMENTO = ['atendimento_aberto', 'proxima_abertura'] as const

export type VariavelDoAtendimento = (typeof VARIAVEIS_DO_ATENDIMENTO)[number]

export function varsDoAtendimento(contexto: ContextoDoAtendimento): Record<string, string> {
  return {
    atendimento_aberto: contexto.atendimentoAberto ? 'sim' : 'nao',
    /*
     * A frase pronta, para a mensagem não precisar repetir o horário à mão.
     *
     * Vazia quando não há previsão — conta sem horário configurado atende
     * sempre, e aí não existe "próxima abertura". Vazia e não "sempre aberto"
     * porque o uso é interpolar dentro de uma frase: *"voltamos
     * {{proxima_abertura}}"* com "sempre aberto" no meio sairia errado, e
     * vazio deixa o desenhista perceber na hora de testar.
     */
    proxima_abertura: contexto.proximaAbertura ?? '',
  }
}
