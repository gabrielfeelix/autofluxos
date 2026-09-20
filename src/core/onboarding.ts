import { z } from 'zod'
import { cobra, type Objetivo } from './objetivo-da-conta'

export const respostasOnboardingSchema = z.object({
  objetivo: z.enum(['atendimento', 'vendas', 'ambos']),
  atendimento: z.enum(['equipe', 'hibrido', 'depois']),
  canal: z.enum(['whatsapp', 'instagram']),
  funil: z.enum(['nenhum', 'comercial', 'agendamento', 'pos-venda']),
  chatbot: z.enum(['nenhum', 'recado', 'menu-atendimento']),
  etapa: z.number().int().min(0).max(3),
}).strict().transform((respostas) => ({
  ...respostas,
  funil: respostas.objetivo === 'atendimento' ? 'nenhum' as const : respostas.funil,
  chatbot: respostas.atendimento !== 'hibrido' ? 'nenhum' as const : respostas.chatbot,
}))

export type RespostasOnboarding = z.infer<typeof respostasOnboardingSchema>
export const RESPOSTAS_INICIAIS: RespostasOnboarding = {
  objetivo: 'atendimento', atendimento: 'equipe', canal: 'whatsapp',
  funil: 'nenhum', chatbot: 'nenhum', etapa: 0,
}
export type EstadoOnboarding = {
  status: 'rascunho' | 'adiado' | 'concluido'
  respostas: RespostasOnboarding
  quadroId?: string | null
  fluxoId?: string | null
  atualizadoEm?: string
}

export function objetivoDoOnboarding(respostas: RespostasOnboarding): Objetivo {
  if (respostas.objetivo !== 'atendimento') return 'vender'
  return respostas.atendimento === 'hibrido' ? 'automatizar' : 'atender'
}

export function lerOnboarding(valor: unknown): EstadoOnboarding | null {
  const resultado = z.object({
    status: z.enum(['rascunho', 'adiado', 'concluido']),
    respostas: respostasOnboardingSchema,
    quadroId: z.string().uuid().nullable().optional(),
    fluxoId: z.string().uuid().nullable().optional(),
    atualizadoEm: z.string().optional(),
  }).safeParse(valor)
  return resultado.success ? resultado.data : null
}

/** A escolha explícita do assistente vale até o objetivo ser trocado nas configurações. */
export function passosDoOnboarding(objetivo: Objetivo, estado: EstadoOnboarding | null) {
  if (estado?.status === 'concluido' && objetivoDoOnboarding(estado.respostas) === objetivo) {
    return { automacao: estado.respostas.chatbot !== 'nenhum', funil: estado.respostas.funil !== 'nenhum' }
  }
  return { automacao: cobra(objetivo, 'automacao'), funil: cobra(objetivo, 'funil') }
}
