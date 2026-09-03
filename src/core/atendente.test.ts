import { describe, expect, it } from 'vitest'
import { assinar, avisoDeEntrada } from './atendente'

describe('assinar — quem recebe precisa saber que virou gente', () => {
  it('põe o primeiro nome em negrito, numa linha só dele', () => {
    expect(assinar('não consigo', 'Leinara')).toBe('*Leinara:*\nnão consigo')
  })

  it('sobrenome fica de fora — é como alguém se apresenta no balcão', () => {
    expect(assinar('oi', 'Leinara Souza Prado')).toBe('*Leinara:*\noi')
  })

  it('sem nome, vai sem assinatura — "*:*" seria pior que nada', () => {
    expect(assinar('oi', null)).toBe('oi')
    expect(assinar('oi', '')).toBe('oi')
    expect(assinar('oi', '   ')).toBe('oi')
  })

  it('não mexe no corpo da mensagem, nem em quebra de linha', () => {
    expect(assinar('linha 1\nlinha 2', 'Ana')).toBe('*Ana:*\nlinha 1\nlinha 2')
  })
})

describe('avisoDeEntrada', () => {
  it('diz quem entrou, pelo primeiro nome', () => {
    expect(avisoDeEntrada('Leinara Souza')).toBe(
      'Leinara entrou na conversa e vai te atender por aqui. 👋',
    )
  })

  it('sem nome não manda aviso nenhum', () => {
    expect(avisoDeEntrada(null)).toBeNull()
    expect(avisoDeEntrada('  ')).toBeNull()
  })
})
