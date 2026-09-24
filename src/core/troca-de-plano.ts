/**
 * O que acontece quando uma organização troca de plano, antes de trocar.
 *
 * É a pergunta que o modal de troca responde, e a mesma regra vale para quem
 * pede (a organização) e para quem aplica (a administração), para as duas
 * telas nunca discordarem.
 *
 * Três tipos de consequência, do mais duro ao mais leve:
 *
 * - **bloqueio**: a troca não pode acontecer como a organização está hoje.
 *   É só o número de WhatsApp: com três números conectados, "descer para um"
 *   deixaria dois canais num plano que não os comporta, e escolher qual cai
 *   é decisão de quem usa, não da 4YU. Desconecta primeiro, troca depois.
 * - **perda**: recurso que sai do plano. Com uso medido, a tela diz o que está
 *   em uso ("3 fluxos respondem com IA") e pede ciência antes de confirmar.
 * - **aviso**: o mês já passou da faixa de conversas do plano de destino.
 *   Não bloqueia, pelo mesmo motivo de `repos/plano.ts`: medir vem antes de
 *   travar.
 *
 * Puro, sem banco: o uso chega medido de `repos/plano.ts`.
 */
import { RECURSOS_DO_PLANO, type Plano, type RecursoDoPlano } from './planos'

/** O que a organização usa hoje, medido no banco. */
export type UsoDaOrganizacao = {
  /** Conversas no mês corrente (a regra da 0066). */
  conversas: number
  /** Números de WhatsApp conectados (sem o Instagram). */
  numeros: number
  /** Fluxos ativos com IA ligada. */
  fluxosComIa: number
  /** Áudios transcritos no mês corrente. */
  transcricoes: number
  /** Transmissões agendadas ou enviando. */
  transmissoes: number
  /** Conexões com outros sistemas. */
  conexoes: number
  /** Webhooks de entrada ligados. */
  webhooks: number
  /** Chave de IA própria configurada. */
  chavePropria: boolean
}

export type PerdaDeRecurso = {
  recurso: RecursoDoPlano
  rotulo: string
  /** O que está em uso e deixa de estar incluído. Nulo = não está em uso. */
  emUso: string | null
}

export type ImpactoDaTroca = {
  sentido: 'sobe' | 'desce' | 'igual'
  /** Destino menos origem, em reais por mês. */
  diferenca: number
  ganha: string[]
  perde: PerdaDeRecurso[]
  bloqueios: string[]
  avisos: string[]
  /** Há algo em uso que sai: o modal pede "entendi" antes de confirmar. */
  exigeCiencia: boolean
}

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`

function usoDoRecurso(recurso: RecursoDoPlano, uso: UsoDaOrganizacao): string | null {
  switch (recurso) {
    case 'ia':
      return uso.fluxosComIa > 0 ? `${plural(uso.fluxosComIa, 'fluxo responde', 'fluxos respondem')} com IA` : null
    case 'transcricao':
      return uso.transcricoes > 0 ? `${plural(uso.transcricoes, 'áudio transcrito', 'áudios transcritos')} neste mês` : null
    case 'transmissoes':
      return uso.transmissoes > 0 ? `${plural(uso.transmissoes, 'transmissão agendada', 'transmissões agendadas')}` : null
    case 'integracoes':
      return uso.conexoes > 0 ? `${plural(uso.conexoes, 'conexão ligada', 'conexões ligadas')}` : null
    case 'webhook':
      return uso.webhooks > 0 ? `${plural(uso.webhooks, 'webhook de entrada ligado', 'webhooks de entrada ligados')}` : null
    case 'chave_propria':
      return uso.chavePropria ? 'chave de IA própria configurada' : null
    case 'varios_numeros':
      return uso.numeros > 1 ? `${plural(uso.numeros, 'número conectado', 'números conectados')}` : null
    case 'crm':
      return 'fluxos, Inbox e CRM em uso'
  }
}

export function impactoDaTroca(de: Plano, para: Plano, uso: UsoDaOrganizacao): ImpactoDaTroca {
  const rotulo = new Map<string, string>(RECURSOS_DO_PLANO.map((r) => [r.chave, r.rotulo]))
  const ganha = para.recursos.filter((r) => !de.recursos.includes(r)).map((r) => rotulo.get(r) ?? r)
  if (para.conversas > de.conversas) ganha.unshift(`Até ${para.conversas.toLocaleString('pt-BR')} conversas por mês`)
  if (para.numeros > de.numeros && de.recursos.includes('varios_numeros')) ganha.push(plural(para.numeros, 'número de WhatsApp', 'números de WhatsApp'))

  const perde: PerdaDeRecurso[] = de.recursos
    .filter((r) => !para.recursos.includes(r))
    .map((r) => ({ recurso: r, rotulo: rotulo.get(r) ?? r, emUso: usoDoRecurso(r, uso) }))

  const bloqueios: string[] = []
  if (uso.numeros > para.numeros) {
    const sobra = uso.numeros - para.numeros
    bloqueios.push(
      `A organização tem ${plural(uso.numeros, 'número conectado', 'números conectados')} e o ${para.nome} comporta ${para.numeros}. Desconecte ${plural(sobra, 'número', 'números')} antes de trocar.`,
    )
  }

  const avisos: string[] = []
  if (uso.conversas > para.conversas) {
    avisos.push(
      `Este mês já teve ${plural(uso.conversas, 'conversa', 'conversas')} e o ${para.nome} comporta ${para.conversas.toLocaleString('pt-BR')} por mês. Nada é bloqueado, mas a organização fica acima do plano.`,
    )
  }

  const diferenca = para.preco - de.preco
  const sentido = de.id === para.id ? 'igual' : diferenca > 0 || (diferenca === 0 && para.conversas > de.conversas) ? 'sobe' : 'desce'

  return {
    sentido,
    diferenca,
    ganha,
    perde,
    bloqueios,
    avisos,
    exigeCiencia: perde.some((p) => p.emUso !== null) || avisos.length > 0,
  }
}
