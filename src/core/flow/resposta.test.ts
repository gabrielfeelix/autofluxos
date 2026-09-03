import { describe, expect, it } from 'vitest'
import { conferirResposta } from './resposta'

const padrao = (formato: Parameters<typeof conferirResposta>[0], texto: string) => {
  const r = conferirResposta(formato, texto)
  return r.ok ? r.padrao : null
}

describe('sem formato', () => {
  it('aceita qualquer coisa — é o que a pergunta livre sempre fez', () => {
    expect(conferirResposta(undefined, '  qualquer coisa ')).toEqual({
      ok: true,
      valor: 'qualquer coisa',
      padrao: 'qualquer coisa',
    })
  })
})

describe('data', () => {
  it('é o caso do pedido: 21/08/2026', () => {
    expect(conferirResposta('data', '21/08/2026')).toEqual({
      ok: true,
      valor: '21/08/2026',
      padrao: '2026-08-21',
    })
  })

  it('aceita traço, ponto e a ordem que uma API usa', () => {
    expect(padrao('data', '21-08-2026')).toBe('2026-08-21')
    expect(padrao('data', '21.08.2026')).toBe('2026-08-21')
    expect(padrao('data', '2026-08-21')).toBe('2026-08-21')
    expect(padrao('data', '1/8/2026')).toBe('2026-08-01')
  })

  it('recusa o que não é data, que é o que motivou o campo', () => {
    expect(conferirResposta('data', 'amanhã').ok).toBe(false)
    expect(conferirResposta('data', 'sei lá').ok).toBe(false)
    expect(conferirResposta('data', '').ok).toBe(false)
  })

  // Sem o ano, "05/01" em dezembro é janeiro do ano que vem para a pessoa e
  // deste ano para o palpite — e o agendamento sai onze meses errado.
  it('exige o ano, em vez de adivinhar pelo relógio', () => {
    expect(conferirResposta('data', '21/08').ok).toBe(false)
    expect(conferirResposta('data', '21/08/26').ok).toBe(false)
  })

  it('confere o dia contra o mês, porque 31/02 casa com o padrão e não existe', () => {
    expect(conferirResposta('data', '31/02/2026').ok).toBe(false)
    expect(conferirResposta('data', '31/04/2026').ok).toBe(false)
    expect(padrao('data', '29/02/2028')).toBe('2028-02-29')
    expect(conferirResposta('data', '29/02/2027').ok).toBe(false)
  })
})

describe('hora', () => {
  it('aceita como se digita no Brasil', () => {
    expect(padrao('hora', '7h')).toBe('07:00')
    expect(padrao('hora', '7h00')).toBe('07:00')
    expect(padrao('hora', '07:00')).toBe('07:00')
    expect(padrao('hora', '19h30')).toBe('19:30')
  })

  it('recusa hora que não existe', () => {
    expect(conferirResposta('hora', '25:00').ok).toBe(false)
    expect(conferirResposta('hora', '07:70').ok).toBe(false)
    expect(conferirResposta('hora', 'de manhã').ok).toBe(false)
  })
})

describe('numero', () => {
  it('traduz a vírgula decimal para o que um JSON aceita', () => {
    expect(padrao('numero', '1.250,50')).toBe('1250.5')
    expect(padrao('numero', 'R$ 1.250')).toBe('1250')
    expect(padrao('numero', '1250.5')).toBe('1250.5')
    expect(padrao('numero', '42')).toBe('42')
  })

  it('recusa o que não é número', () => {
    expect(conferirResposta('numero', 'uns mil').ok).toBe(false)
  })
})

describe('email', () => {
  it('aceita e normaliza', () => {
    expect(padrao('email', ' Ana@Dominio.COM ')).toBe('ana@dominio.com')
  })

  it('pega o erro que a pessoa comete de verdade', () => {
    expect(conferirResposta('email', 'ana@dominio').ok).toBe(false)
    expect(conferirResposta('email', 'ana dominio.com').ok).toBe(false)
    expect(conferirResposta('email', '@dominio.com').ok).toBe(false)
  })
})

describe('telefone', () => {
  it('põe o país no que veio com DDD, que é o formato da Cloud API', () => {
    expect(padrao('telefone', '(44) 99888-7766')).toBe('5544998887766')
    expect(padrao('telefone', '4433334444')).toBe('554433334444')
    expect(padrao('telefone', '5544998887766')).toBe('5544998887766')
  })

  // Inventar DDD guarda um contato que ninguém alcança, e ninguém descobre até
  // precisar ligar.
  it('recusa número sem DDD em vez de inventar um', () => {
    expect(conferirResposta('telefone', '99888-7766').ok).toBe(false)
  })
})

describe('cpf', () => {
  it('aceita com e sem pontuação', () => {
    expect(padrao('cpf', '529.982.247-25')).toBe('52998224725')
    expect(padrao('cpf', '52998224725')).toBe('52998224725')
  })

  it('confere o dígito verificador, e não só a quantidade', () => {
    expect(conferirResposta('cpf', '529.982.247-26').ok).toBe(false)
    expect(conferirResposta('cpf', '111.111.111-11').ok).toBe(false)
    expect(conferirResposta('cpf', '1234567890').ok).toBe(false)
  })
})

describe('data_futura — a data que já passou não serve para marcar aula', () => {
  const HOJE = '2026-09-03'

  it('recusa data anterior a hoje', () => {
    // O caso real: em 03/09, o bot aceitou 01/09 e foi consultar a agenda de
    // um dia que não volta — e ainda ofereceu horários.
    expect(conferirResposta('data_futura', '01/09/2026', HOJE).ok).toBe(false)
  })

  it('aceita hoje — marcar para daqui a pouco é legítimo', () => {
    const r = conferirResposta('data_futura', '03/09/2026', HOJE)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.padrao).toBe('2026-09-03')
  })

  it('aceita data futura', () => {
    expect(conferirResposta('data_futura', '14/09/2026', HOJE).ok).toBe(true)
  })

  it('vira ano: 31/12 do ano passado é passado, 01/01 do que vem é futuro', () => {
    expect(conferirResposta('data_futura', '31/12/2025', HOJE).ok).toBe(false)
    expect(conferirResposta('data_futura', '01/01/2027', HOJE).ok).toBe(true)
  })

  it('data que não existe continua sendo recusada', () => {
    expect(conferirResposta('data_futura', '31/02/2027', HOJE).ok).toBe(false)
  })

  /*
   * Sem saber que dia é hoje, recusar seria chutar — e chutar contra a pessoa
   * é pior do que aceitar. Acontece só onde o contexto não é montado (o motor
   * é puro e recebe o dia de fora).
   */
  it('sem "hoje", se comporta como `data`', () => {
    expect(conferirResposta('data_futura', '01/09/2020').ok).toBe(true)
  })

  it('o formato `data` comum não passou a recusar nada', () => {
    expect(conferirResposta('data', '01/09/2020', HOJE).ok).toBe(true)
  })
})
