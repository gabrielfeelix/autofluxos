import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { respostasOnboardingSchema, RESPOSTAS_INICIAIS, objetivoDoOnboarding, lerOnboarding, passosDoOnboarding, marcadoPelaFrente, nichoDoOnboarding, CHATBOTS_DO_ONBOARDING, CHATBOTS_DAS_FRENTES, FUNIS_DAS_FRENTES } from './onboarding'
import { NICHOS, PACOTES } from './nichos'
import { MODELOS_DE_QUADRO } from './quadros-modelos'
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
  it('preparação salva antes da pergunta da frente continua valendo, sem frente', () => {
    const antiga = lerOnboarding({ status: 'concluido', respostas: RESPOSTAS_INICIAIS })
    expect(antiga).not.toBeNull()
    expect(nichoDoOnboarding(antiga!.respostas)).toBeNull()
    expect(nichoDoOnboarding({ ...RESPOSTAS_INICIAIS, nicho: 'outro' })).toBeNull()
  })
  it('escolher a frente marca o objetivo, o funil e o chatbot dela, e tudo passa no schema', () => {
    for (const nicho of NICHOS) {
      const marcado = marcadoPelaFrente(RESPOSTAS_INICIAIS, nicho)
      const conferido = respostasOnboardingSchema.parse(marcado)
      expect(conferido.nicho).toBe(nicho)
      expect(conferido.chatbot, nicho).toBe(PACOTES[nicho].modelosDeFluxo[0])
      if (conferido.funil !== 'nenhum') expect(conferido.funil).toBe(PACOTES[nicho].modeloDeFunil)
      expect(nichoDoOnboarding(conferido)).toBe(nicho)
    }
  })
  it('todo chatbot e funil oferecido existe, com grafo válido', () => {
    for (const id of [...CHATBOTS_DO_ONBOARDING, ...CHATBOTS_DAS_FRENTES]) expect(fluxoSchema.safeParse(acharModelo(id)?.grafo).success, id).toBe(true)
    for (const id of FUNIS_DAS_FRENTES) expect(MODELOS_DE_QUADRO.map((m) => m.id)).toContain(id)
  })
  it('recusa frente que não existe', () => {
    expect(respostasOnboardingSchema.safeParse({ ...RESPOSTAS_INICIAIS, nicho: 'saude' }).success).toBe(false)
  })
  it('a 0109 aceita todo modelo e funil das frentes, e toda frente', () => {
    const sql = readFileSync(join(__dirname, '../../supabase/migrations/0109_onboarding_frentes.sql'), 'utf8')
    for (const id of [...CHATBOTS_DAS_FRENTES, ...FUNIS_DAS_FRENTES, ...NICHOS]) expect(sql, id).toContain(`'${id}'`)
  })
})
