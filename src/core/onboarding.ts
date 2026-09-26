import { z } from 'zod'
import { cobra, type Objetivo } from './objetivo-da-conta'
import { NICHOS, PACOTES, pacoteDo, type Nicho } from './nichos'

/**
 * Os chatbots e funis que o assistente pode criar. Lista fechada: o navegador
 * escolhe um id, e o servidor nunca aceita modelo ou grafo que não esteja aqui.
 *
 * **Hoje são só os que a função `preparar_onboarding` da 0089 aceita**: ela
 * confere a lista no banco e recusaria o modelo de uma frente. A migration
 * 0109 abre a conferência para os modelos das frentes; depois dela aplicada,
 * estas listas passam a incluir `PACOTES[*].modelosDeFluxo` e o funil de cada
 * frente, e `CHATBOTS_DAS_FRENTES` e `FUNIS_DAS_FRENTES` entram aqui.
 */
export const CHATBOTS_DO_ONBOARDING: readonly string[] = ['recado', 'menu-atendimento']
export const FUNIS_DO_ONBOARDING = ['comercial', 'agendamento', 'pos-venda'] as const

/** Os modelos das frentes, que entram no assistente quando a 0109 estiver aplicada. */
export const CHATBOTS_DAS_FRENTES: readonly string[] = [...new Set(NICHOS.flatMap((nicho) => PACOTES[nicho].modelosDeFluxo))]
export const FUNIS_DAS_FRENTES: readonly string[] = [...new Set(NICHOS.map((nicho) => PACOTES[nicho].modeloDeFunil))]

export const respostasOnboardingSchema = z.object({
  /**
   * A primeira pergunta: qual é o negócio (PLANO-NICHOS 1.1). Opcional porque
   * a preparação salva antes desta pergunta existir não a tem; `outro` é o
   * caminho de sempre, sem frente.
   */
  nicho: z.enum([...NICHOS, 'outro']).optional(),
  objetivo: z.enum(['atendimento', 'vendas', 'ambos']),
  atendimento: z.enum(['equipe', 'hibrido', 'depois']),
  canal: z.enum(['whatsapp', 'instagram']),
  funil: z.enum(['nenhum', ...FUNIS_DO_ONBOARDING]),
  chatbot: z.string().refine((id) => id === 'nenhum' || CHATBOTS_DO_ONBOARDING.includes(id)),
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

/** A frente escolhida no assistente, ou `null` para "outro" e para quem não respondeu. */
export function nichoDoOnboarding(respostas: RespostasOnboarding): Nicho | null {
  return respostas.nicho && respostas.nicho !== 'outro' ? respostas.nicho : null
}

/**
 * O que escolher a frente já deixa marcado (PLANO-NICHOS 1.1): o objetivo que
 * ela sugere, o funil dela e o primeiro chatbot dela, entre os que o assistente
 * já pode criar. É só a marca inicial: a pessoa troca nas etapas seguintes.
 */
export function marcadoPelaFrente(respostas: RespostasOnboarding, nicho: Nicho | 'outro'): RespostasOnboarding {
  const pacote = pacoteDo(nicho === 'outro' ? null : nicho)
  if (!pacote) return { ...respostas, nicho }
  const objetivo = pacote.objetivoSugerido === 'vender' ? 'ambos' : 'atendimento'
  const funil = funilDaFrente(nicho)
  const chatbot = pacote.modelosDeFluxo.find((id) => CHATBOTS_DO_ONBOARDING.includes(id)) ?? 'recado'
  return { ...respostas, nicho, objetivo, funil: objetivo === 'atendimento' ? 'nenhum' : funil, atendimento: 'hibrido', chatbot }
}

/** O funil que a frente sugere, entre os que o assistente cria; `comercial` sem frente. */
export function funilDaFrente(nicho: Nicho | 'outro' | undefined): Exclude<RespostasOnboarding['funil'], 'nenhum'> {
  const doPacote = pacoteDo(nicho && nicho !== 'outro' ? nicho : null)?.modeloDeFunil
  return doPacote && (FUNIS_DO_ONBOARDING as readonly string[]).includes(doPacote)
    ? (doPacote as (typeof FUNIS_DO_ONBOARDING)[number])
    : 'comercial'
}
