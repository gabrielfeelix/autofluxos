import { describe, expect, it } from 'vitest'
import { acharPlano } from './planos'
import { impactoDaTroca, type UsoDaOrganizacao } from './troca-de-plano'

const PARADO: UsoDaOrganizacao = {
  conversas: 0,
  numeros: 1,
  fluxosComIa: 0,
  transcricoes: 0,
  transmissoes: 0,
  conexoes: 0,
  webhooks: 0,
  chavePropria: false,
}

const essencial = acharPlano('essencial')
const operacao = acharPlano('operacao')
const escala = acharPlano('escala')

describe('impactoDaTroca', () => {
  it('subir mostra o que ganha e não pede ciência', () => {
    const r = impactoDaTroca(essencial, operacao, PARADO)
    expect(r.sentido).toBe('sobe')
    expect(r.diferenca).toBe(300)
    expect(r.ganha).toContain('Respostas com IA')
    expect(r.perde).toEqual([])
    expect(r.exigeCiencia).toBe(false)
  })

  it('subir para vários números não repete a linha de números', () => {
    const r = impactoDaTroca(operacao, escala, PARADO)
    expect(r.ganha).toContain('Vários números e unidades')
    expect(r.ganha.some((g) => g.includes('números de WhatsApp'))).toBe(false)
  })

  it('descer sem nada em uso lista o que sai e não pede ciência', () => {
    const r = impactoDaTroca(operacao, essencial, PARADO)
    expect(r.sentido).toBe('desce')
    expect(r.perde.map((p) => p.recurso)).toEqual(['ia', 'transcricao', 'transmissoes', 'integracoes'])
    expect(r.perde.every((p) => p.emUso === null)).toBe(true)
    expect(r.bloqueios).toEqual([])
    expect(r.exigeCiencia).toBe(false)
  })

  it('descer com recurso em uso diz o que está em uso e pede ciência', () => {
    const r = impactoDaTroca(operacao, essencial, { ...PARADO, fluxosComIa: 3, transmissoes: 1 })
    expect(r.perde.find((p) => p.recurso === 'ia')?.emUso).toBe('3 fluxos respondem com IA')
    expect(r.perde.find((p) => p.recurso === 'transmissoes')?.emUso).toBe('1 transmissão agendada')
    expect(r.exigeCiencia).toBe(true)
  })

  it('mais números conectados do que o destino comporta bloqueia', () => {
    const r = impactoDaTroca(escala, operacao, { ...PARADO, numeros: 3 })
    expect(r.bloqueios).toHaveLength(1)
    expect(r.bloqueios[0]).toContain('Desconecte 2 números')
  })

  it('números no limite do destino não bloqueiam', () => {
    expect(impactoDaTroca(escala, operacao, { ...PARADO, numeros: 1 }).bloqueios).toEqual([])
  })

  it('conversas acima da faixa do destino avisam sem bloquear', () => {
    const r = impactoDaTroca(operacao, essencial, { ...PARADO, conversas: 1500 })
    expect(r.bloqueios).toEqual([])
    expect(r.avisos[0]).toContain('1.500 conversas')
    expect(r.exigeCiencia).toBe(true)
  })

  it('conversas abaixo da faixa do destino não avisam', () => {
    expect(impactoDaTroca(operacao, essencial, { ...PARADO, conversas: 900 }).avisos).toEqual([])
  })
})
