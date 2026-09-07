import { describe, expect, it } from 'vitest'
import { VARIAVEIS_DO_ATENDIMENTO, varsDoAtendimento } from './vars-do-atendimento'
import { VARIAVEIS_NATIVAS } from './contatos/vars-iniciais'

describe('varsDoAtendimento', () => {
  it('aberto vira "sim", fechado vira "nao"', () => {
    expect(varsDoAtendimento({ atendimentoAberto: true, proximaAbertura: null })).toMatchObject({
      atendimento_aberto: 'sim',
    })
    expect(varsDoAtendimento({ atendimentoAberto: false, proximaAbertura: null })).toMatchObject({
      atendimento_aberto: 'nao',
    })
  })

  /*
   * `sim`/`nao` e não `true`/`false`: quem digita o valor no campo da condição
   * é quem desenha o fluxo, e não é programador.
   */
  it('é palavra em português, porque é a pessoa que escreve o valor comparado', () => {
    const vars = varsDoAtendimento({ atendimentoAberto: true, proximaAbertura: null })
    expect(vars.atendimento_aberto).not.toBe('true')
  })

  it('leva a frase da próxima abertura, para a mensagem não repetir o horário à mão', () => {
    expect(
      varsDoAtendimento({ atendimentoAberto: false, proximaAbertura: 'amanhã a partir das 08:00' })
        .proxima_abertura,
    ).toBe('amanhã a partir das 08:00')
  })

  // Conta sem horário configurado atende sempre: não existe "próxima abertura",
  // e "sempre aberto" no meio de "voltamos {{proxima_abertura}}" sairia errado.
  it('sem previsão, a frase é vazia em vez de inventada', () => {
    expect(
      varsDoAtendimento({ atendimentoAberto: true, proximaAbertura: null }).proxima_abertura,
    ).toBe('')
  })

  /*
   * Sem isto, o validador acusaria "variável não existe" num nome que o próprio
   * produto injeta, e o editor não a ofereceria no seletor — ela funcionaria
   * escondida, que é o mesmo que não existir para quem desenha.
   */
  it('as duas são nativas: o validador e o editor as conhecem', () => {
    for (const nome of VARIAVEIS_DO_ATENDIMENTO) {
      expect(VARIAVEIS_NATIVAS, `${nome} precisa ser nativa`).toContain(nome)
    }
  })
})
