import { describe, it, expect } from 'vitest'
import { respostasOnboardingSchema, RESPOSTAS_INICIAIS, objetivoDoOnboarding, lerOnboarding, passosDoOnboarding } from './onboarding'
import { acharModelo } from '@/exemplos/modelos'
import { fluxoSchema } from './flow/schema'

describe('preparação da empresa', () => {
  it('vendas não obriga automação e atendimento não cria funil escondido', () => {
    const manual = respostasOnboardingSchema.parse({ ...RESPOSTAS_INICIAIS, objetivo: 'vendas', chatbot: 'recado' })
    expect(manual.chatbot).toBe('nenhum')
    expect(objetivoDoOnboarding(manual)).toBe('vender')
    expect(respostasOnboardingSchema.parse({ ...RESPOSTAS_INICIAIS, funil: 'comercial' }).funil).toBe('nenhum')
  })
  it('permite atendimento híbrido e funil independentemente', () => {
    const escolhas = respostasOnboardingSchema.parse({ ...RESPOSTAS_INICIAIS, objetivo: 'ambos', atendimento: 'hibrido', funil: 'comercial', chatbot: 'recado' })
    expect(escolhas.funil).toBe('comercial')
    expect(escolhas.chatbot).toBe('recado')
    expect(objetivoDoOnboarding(escolhas)).toBe('vender')
    expect(objetivoDoOnboarding({ ...escolhas, objetivo: 'atendimento' })).toBe('automatizar')
  })
  it('recusa modelos, etapas e campos não autorizados', () => {
    for (const patch of [{ chatbot: 'cobranca' }, { etapa: 4 }, { etapa: -1 }, { canal: 'telegram' }, { grafo: {} }]) {
      expect(respostasOnboardingSchema.safeParse({ ...RESPOSTAS_INICIAIS, ...patch }).success).toBe(false)
    }
  })
  it('recupera progresso válido e não inventa conclusão em estado inválido', () => {
    expect(lerOnboarding(null)).toBeNull()
    expect(lerOnboarding({ status: 'concluido' })).toBeNull()
    expect(lerOnboarding({ status: 'adiado', respostas: { ...RESPOSTAS_INICIAIS, etapa: 2 } })?.respostas.etapa).toBe(2)
  })
  it('o checklist respeita modelos adiados e a escolha independente de bot', () => {
    const estado = { status: 'concluido' as const, respostas: { ...RESPOSTAS_INICIAIS, objetivo: 'vendas' as const, funil: 'comercial' as const } }
    expect(passosDoOnboarding('vender', estado)).toEqual({ automacao: false, funil: true })
    expect(passosDoOnboarding('vender', { ...estado, respostas: { ...estado.respostas, funil: 'nenhum' } })).toEqual({ automacao: false, funil: false })
    expect(passosDoOnboarding('vender', { ...estado, respostas: { ...estado.respostas, atendimento: 'hibrido', chatbot: 'recado' } })).toEqual({ automacao: true, funil: true })
    expect(passosDoOnboarding('automatizar', estado)).toEqual({ automacao: true, funil: false })
  })
  it('usa modelos reais com grafos válidos', () => {
    for (const id of ['recado', 'menu-atendimento']) expect(fluxoSchema.safeParse(acharModelo(id)?.grafo).success).toBe(true)
  })
})
