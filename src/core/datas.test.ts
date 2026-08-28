import { describe, expect, it } from 'vitest'
import { VARIAVEIS_DE_DATA, varsDeData } from './datas'

/**
 * As datas prontas do fluxo.
 *
 * O que precisa ser provado é o que ninguém confere olhando: virada de mês, de
 * ano, e o fuso. Um erro aqui não estoura — ele oferece um dia que já passou,
 * ou marca aula para a semana errada, e a mensagem sai bonita nos dois casos.
 */

const SP = 'America/Sao_Paulo'

/** Terça-feira, 01/09/2026, meio-dia em São Paulo. */
const TERCA = new Date('2026-09-01T15:00:00Z')

describe('a semana', () => {
  it('"esta semana" começa hoje, e não na segunda', () => {
    // Ninguém marca aula para anteontem. Começar na segunda traria dias que já
    // passaram, e o menu abriria com opções impossíveis.
    const v = varsDeData(SP, TERCA)

    expect(v.semana_de).toBe('2026-09-01')
    expect(v.semana_ate).toBe('2026-09-06') // domingo
  })

  it('"semana que vem" é segunda a domingo da semana seguinte', () => {
    const v = varsDeData(SP, TERCA)

    expect(v.prox_semana_de).toBe('2026-09-07')
    expect(v.prox_semana_ate).toBe('2026-09-13')
  })

  it('no domingo, "esta semana" é só o próprio domingo', () => {
    // O caso que quebra contas de semana escritas na mão: domingo é o fim, não
    // o começo. Um `getDay()` cru daria 0 e o intervalo sairia com oito dias.
    const domingo = new Date('2026-09-06T15:00:00Z')
    const v = varsDeData(SP, domingo)

    expect(v.semana_de).toBe('2026-09-06')
    expect(v.semana_ate).toBe('2026-09-06')
    expect(v.prox_semana_de).toBe('2026-09-07')
    expect(v.prox_semana_ate).toBe('2026-09-13')
  })

  it('na segunda, a semana inteira está pela frente', () => {
    const segunda = new Date('2026-09-07T15:00:00Z')
    const v = varsDeData(SP, segunda)

    expect(v.semana_de).toBe('2026-09-07')
    expect(v.semana_ate).toBe('2026-09-13')
  })
})

describe('o fuso da conta, e não o do servidor', () => {
  it('às 21h em São Paulo ainda é hoje, mesmo já sendo amanhã em UTC', () => {
    // O erro que isto existe para impedir: `new Date().toISOString()` num
    // servidor UTC vira o dia seguinte a partir das 21h em SP — que é
    // exatamente o horário em que se manda mensagem para marcar aula.
    const noiteEmSp = new Date('2026-09-02T00:30:00Z') // 21:30 do dia 1 em SP

    expect(varsDeData(SP, noiteEmSp).hoje).toBe('2026-09-01')
    expect(varsDeData('UTC', noiteEmSp).hoje).toBe('2026-09-02')
  })
})

describe('viradas', () => {
  it('atravessa a virada do mês', () => {
    const trintaEUm = new Date('2026-08-31T15:00:00Z') // segunda
    const v = varsDeData(SP, trintaEUm)

    expect(v.amanha).toBe('2026-09-01')
    expect(v.semana_ate).toBe('2026-09-06')
  })

  it('atravessa a virada do ano', () => {
    const reveillon = new Date('2026-12-31T15:00:00Z')
    const v = varsDeData(SP, reveillon)

    expect(v.hoje).toBe('2026-12-31')
    expect(v.amanha).toBe('2027-01-01')
    expect(v.amanha_br).toBe('01/01/2027')
  })
})

describe('formato', () => {
  it('entrega ISO para a API e br para a mensagem', () => {
    const v = varsDeData(SP, TERCA)

    // A rota da agenda só aceita ISO; uma mensagem com "2026-09-01" dentro
    // parece defeito para quem lê no WhatsApp.
    expect(v.hoje).toBe('2026-09-01')
    expect(v.hoje_br).toBe('01/09/2026')
  })

  it('devolve exatamente as variáveis declaradas, sem sobra nem falta', () => {
    // A lista é lida pelo editor, pelo validador e pelo resolvedor. Divergir
    // dela aqui produziria variável que aparece no autocompletar e chega vazia,
    // ou variável que chega e o validador acusa como desconhecida.
    expect(Object.keys(varsDeData(SP, TERCA)).sort()).toEqual([...VARIAVEIS_DE_DATA].sort())
  })
})
