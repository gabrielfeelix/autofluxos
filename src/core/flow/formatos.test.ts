import { describe, expect, it } from 'vitest'
import { formatarValor } from './formatos'

describe('formatarValor — o dado do sistema virando texto de conversa', () => {
  it('data ISO vira data brasileira', () => {
    expect(formatarValor('2026-09-01', 'data')).toBe('01/09/2026')
  })

  it('não desloca o dia (o bug clássico de tratar data como UTC)', () => {
    expect(formatarValor('2026-01-01', 'data')).toBe('01/01/2026')
  })

  it('data já brasileira atravessa intacta', () => {
    expect(formatarValor('01/09/2026', 'data')).toBe('01/09/2026')
  })

  it('hora perde os segundos', () => {
    expect(formatarValor('07:00:00', 'hora')).toBe('07:00')
    expect(formatarValor('7:05', 'hora')).toBe('07:05')
  })

  it('data e hora juntas, nos dois separadores', () => {
    expect(formatarValor('2026-09-01T07:30:00', 'data_hora')).toBe('01/09/2026 07:30')
    expect(formatarValor('2026-09-01 07:30', 'data_hora')).toBe('01/09/2026 07:30')
  })

  it('dinheiro fica com ponto de milhar e vírgula decimal', () => {
    expect(formatarValor('4200.5', 'dinheiro')).toBe('4.200,50')
  })

  it('formata cada item da lista, e mantém a lista', () => {
    expect(formatarValor('2026-09-01; 2026-09-02', 'data')).toBe('01/09/2026; 02/09/2026')
  })

  it('o que não casa com o formato passa cru — some com o dado é pior', () => {
    expect(formatarValor('quando der', 'data')).toBe('quando der')
  })

  it('sem formato escolhido, nada muda', () => {
    expect(formatarValor('2026-09-01')).toBe('2026-09-01')
  })
})

describe('nomes — a lista de quem atende vira frase', () => {
  it('cada nome uma vez só, na ordem em que apareceu', () => {
    expect(formatarValor('Carol;Carol;Carol;Márcia;Thalya;Thalya;Márcia', 'nomes')).toBe(
      'Carol, Márcia e Thalya',
    )
  })

  it('um nome só não ganha vírgula nem "e"', () => {
    expect(formatarValor('Carol;Carol;Carol', 'nomes')).toBe('Carol')
  })

  it('dois nomes ligam com "e", sem vírgula', () => {
    expect(formatarValor('Carol;Márcia', 'nomes')).toBe('Carol e Márcia')
  })

  it('só quem colide ganha sobrenome — a Márcia sozinha continua Márcia', () => {
    expect(formatarValor('Carol Silva;Carol Souza;Márcia Lima', 'nomes')).toBe(
      'Carol Silva, Carol Souza e Márcia',
    )
  })

  it('a mesma pessoa repetida por extenso conta uma vez, e não vira colisão', () => {
    expect(formatarValor('Carol Silva;Carol Silva;Márcia Lima', 'nomes')).toBe('Carol e Márcia')
  })

  it('sem colisão, o sobrenome não aparece — "Carol" basta', () => {
    expect(formatarValor('Carol Silva;Márcia Lima', 'nomes')).toBe('Carol e Márcia')
  })

  it('lista vazia vira vazio, e não " e "', () => {
    expect(formatarValor('', 'nomes')).toBe('')
    expect(formatarValor(';;', 'nomes')).toBe('')
  })

  it('espaço sobrando não inventa nome diferente', () => {
    expect(formatarValor(' Carol ;Carol;  Márcia', 'nomes')).toBe('Carol e Márcia')
  })
})
