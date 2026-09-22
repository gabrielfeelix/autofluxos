import { describe, expect, it } from 'vitest'
import {
  MENSAGEM_DE_RETOMADA_PADRAO,
  decidirRetomada,
  mensagemDaRetomada,
  minutosDaRetomada,
  type ConfigDaConta,
} from './retomada'

const LIGADA: ConfigDaConta = { ativo: true, minutos: 120, mensagem: null }
const DESLIGADA: ConfigDaConta = { ativo: false, minutos: 120, mensagem: null }

const AGORA = new Date('2026-09-22T14:00:00Z')
const haMinutos = (n: number) => new Date(AGORA.getTime() - n * 60_000)

describe('o interruptor da conta vence tudo', () => {
  it('desligada, nada volta, nem com prazo escrito no bloco', () => {
    expect(minutosDaRetomada(DESLIGADA, 30)).toBeNull()
    expect(decidirRetomada(DESLIGADA, 30, haMinutos(600), AGORA)).toEqual({ o: 'desligado' })
  })

  it('ligada sem nada no bloco, vale o prazo da conta', () => {
    expect(minutosDaRetomada(LIGADA, undefined)).toBe(120)
  })
})

describe('o prazo do bloco', () => {
  it('vence o da conta', () => {
    expect(minutosDaRetomada(LIGADA, 30)).toBe(30)
  })

  it('"nunca" não volta, mesmo com a conta ligada', () => {
    expect(minutosDaRetomada(LIGADA, 'nunca')).toBeNull()
  })

  it('não passa do teto da janela do WhatsApp', () => {
    expect(minutosDaRetomada(LIGADA, 5_000)).toBe(1_440)
  })
})

describe('o relógio conta da última fala da equipe', () => {
  it('vencido o prazo, retoma', () => {
    expect(decidirRetomada(LIGADA, undefined, haMinutos(121), AGORA)).toEqual({ o: 'retomar' })
  })

  it('no minuto exato, retoma', () => {
    expect(decidirRetomada(LIGADA, undefined, haMinutos(120), AGORA)).toEqual({ o: 'retomar' })
  })

  /**
   * A regra que separa um recurso que ajuda de um que atrapalha: quem acabou
   * de responder está atendendo, e atendimento em curso não se interrompe.
   */
  it('a equipe falou há pouco, espera o que falta', () => {
    const decisao = decidirRetomada(LIGADA, undefined, haMinutos(10), AGORA)
    expect(decisao).toEqual({ o: 'esperar', faltamMs: 110 * 60_000 })
  })
})

describe('a mensagem', () => {
  it('sai a do bloco quando ele escreveu uma', () => {
    expect(mensagemDaRetomada(LIGADA, 'volto já')).toBe('volto já')
  })

  it('sem a do bloco, sai a da conta', () => {
    expect(mensagemDaRetomada({ ...LIGADA, mensagem: 'da conta' }, undefined)).toBe('da conta')
  })

  it('texto em branco nunca vira mensagem em branco no WhatsApp de alguém', () => {
    expect(mensagemDaRetomada({ ...LIGADA, mensagem: '   ' }, '  ')).toBe(
      MENSAGEM_DE_RETOMADA_PADRAO,
    )
  })
})
