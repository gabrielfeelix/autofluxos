import { describe, expect, it } from 'vitest'
import { condutaPara } from './templates'
import {
  cabemHoje,
  decidir,
  diasNecessarios,
  esperaMs,
  ESPERA_POR_USUARIO_MS,
  intervaloMs,
  RITMO_EM_COEXISTENCIA,
  RITMO_INICIAL,
  TENTATIVAS_MAXIMAS,
  TETO_DO_BACKOFF_MS,
  podeTransmitir,
} from './disparo'

describe('o ritmo', () => {
  it('converte mensagens por segundo em intervalo', () => {
    expect(intervaloMs(20)).toBe(50)
    expect(intervaloMs(80)).toBe(13)
  })

  it('não divide por zero', () => {
    expect(intervaloMs(0)).toBe(1_000)
    expect(intervaloMs(-5)).toBe(1_000)
  })

  /*
   * Coexistência é o nosso caminho principal e tem UM QUARTO do throughput
   * padrão. Dimensionar pelo número grande é descobrir isso no meio de uma
   * campanha, como enxurrada de 130429.
   */
  it('começa no ritmo da coexistência, não no do número comum', () => {
    expect(RITMO_INICIAL).toBeLessThanOrEqual(RITMO_EM_COEXISTENCIA)
  })
})

describe('o teto de 24h', () => {
  it('diz quantos ainda cabem hoje', () => {
    expect(cabemHoje(2_000, 500)).toBe(1_500)
  })

  it('não devolve número negativo quando já estourou', () => {
    expect(cabemHoje(250, 400)).toBe(0)
  })

  it('fatia a campanha em dias', () => {
    // 5.000 no tier de 2.000 = 3 dias. A pessoa tem que saber ANTES de clicar.
    expect(diasNecessarios(5_000, 2_000)).toBe(3)
    expect(diasNecessarios(2_000, 2_000)).toBe(1)
    expect(diasNecessarios(1, 2_000)).toBe(1)
  })
})

describe('a espera entre tentativas', () => {
  it('cresce exponencialmente', () => {
    // Sem jitter (aleatorio = 0.5 dá fator 1.0).
    expect(esperaMs(1, 0.5)).toBe(1_000)
    expect(esperaMs(2, 0.5)).toBe(2_000)
    expect(esperaMs(3, 0.5)).toBe(4_000)
  })

  it('para no teto', () => {
    expect(esperaMs(50, 0.5)).toBe(TETO_DO_BACKOFF_MS)
  })

  /*
   * Sem jitter, mil mensagens que tomaram 130429 no mesmo segundo voltam
   * juntas no mesmo segundo — o mesmo pico que causou o erro. É o thundering
   * herd, e ele transforma um soluço num apagão.
   */
  it('espalha com jitter de ±25%', () => {
    expect(esperaMs(2, 0)).toBe(1_500)
    expect(esperaMs(2, 1)).toBe(2_500)
  })
})

describe('a decisão depois de um erro', () => {
  const primeira = { tentativas: 0, codigo: null }

  it('repete o transitório, com espera', () => {
    const d = decidir('repetir', primeira, 0.5)
    expect(d).toEqual({ acao: 'esperar', ms: 1_000 })
  })

  it('desiste depois de tentar demais', () => {
    const d = decidir('repetir', { tentativas: TENTATIVAS_MAXIMAS, codigo: 130429 })
    expect(d.acao).toBe('desistir')
  })

  it('desiste na hora de quem não recebe', () => {
    // 131026: não é usuário, bloqueou, ou app velho. Repetir queima o número.
    expect(decidir('desistir', primeira).acao).toBe('desistir')
  })

  /*
   * A armadilha que mais custa: repetir antes das 24h SUSPENDE o destinatário
   * por MAIS 24h. A tentativa extra não é neutra — ela piora o caso.
   */
  it('espera 24h inteiras no limite por usuário, e não um backoff curto', () => {
    const d = decidir('esperar_24h', primeira)
    expect(d).toEqual({ acao: 'esperar', ms: ESPERA_POR_USUARIO_MS })
  })

  it('para tudo quando o template morreu', () => {
    // Tentar outro destinatário só produz o mesmo erro 5.000 vezes, e cada uma
    // conta contra a nota de qualidade do número.
    const d = decidir('template_pausado', primeira)
    expect(d.acao).toBe('parar_tudo')
  })

  it('para tudo quando o payload está errado', () => {
    // Se está errado para um, está errado para todos. Retry repete o erro.
    const d = decidir('corrigir_codigo', primeira)
    expect(d.acao).toBe('parar_tudo')
  })

  /*
   * As cinco classes são incompatíveis: misturá-las numa política só é o jeito
   * mais rápido de queimar a nota de qualidade. Este teste amarra os códigos
   * reais da Meta às decisões, passando por `condutaPara`.
   */
  it('liga cada código da Meta à decisão certa, de ponta a ponta', () => {
    const acaoDe = (codigo: number) => decidir(condutaPara(codigo), primeira, 0.5).acao

    expect(acaoDe(130429)).toBe('esperar') // throughput
    expect(acaoDe(131026)).toBe('desistir') // não recebe
    expect(acaoDe(131049)).toBe('esperar') // limite por usuário
    expect(acaoDe(132000)).toBe('parar_tudo') // payload errado
    expect(acaoDe(132015)).toBe('parar_tudo') // template pausado
  })

  it('separa as duas esperas, que têm ordens de grandeza diferentes', () => {
    const transitorio = decidir(condutaPara(130429), primeira, 0.5)
    const porUsuario = decidir(condutaPara(131049), primeira, 0.5)

    expect(transitorio).toEqual({ acao: 'esperar', ms: 1_000 })
    expect(porUsuario).toEqual({ acao: 'esperar', ms: ESPERA_POR_USUARIO_MS })
  })
})

describe('dá para transmitir agora?', () => {
  const base = { statusDoTemplate: 'aprovado', publico: 100, limiteDiario: 2_000, jaEnviadasHoje: 0 }

  it('deixa quando está tudo certo, sem recado', () => {
    expect(podeTransmitir(base)).toEqual({ pode: true, recado: null })
  })

  it('barra modelo que não está aprovado', () => {
    // `pausado` engana por parecer temporário, mas envio falha enquanto durar.
    const r = podeTransmitir({ ...base, statusDoTemplate: 'pausado' })
    expect(r.pode).toBe(false)
    expect(r.recado).toMatch(/não está aprovado/)
  })

  it('barra público vazio', () => {
    expect(podeTransmitir({ ...base, publico: 0 }).pode).toBe(false)
  })

  it('barra quando o limite do dia já foi todo usado', () => {
    const r = podeTransmitir({ ...base, limiteDiario: 250, jaEnviadasHoje: 250 })
    expect(r.pode).toBe(false)
    expect(r.recado).toMatch(/agendar para amanhã/)
  })

  /*
   * Campanha maior que o teto não é erro — é campanha que leva mais de um dia.
   * Barrar seria errado; deixar sem avisar seria pior.
   */
  it('deixa passar a campanha grande, avisando em quantos dias ela cabe', () => {
    const r = podeTransmitir({ ...base, publico: 5_000, limiteDiario: 2_000 })
    expect(r.pode).toBe(true)
    expect(r.recado).toMatch(/Cabem 2000 hoje/)
    expect(r.recado).toMatch(/3 dias/)
  })
})
