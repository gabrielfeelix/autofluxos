'use server'

import { revalidatePath } from 'next/cache'
import { respostasOnboardingSchema, objetivoDoOnboarding, lerOnboarding, type EstadoOnboarding } from '@/core/onboarding'
import { MODELOS_DE_QUADRO } from '@/core/quadros-modelos'
import { acharModelo } from '@/exemplos/modelos'
import { fluxoSchema } from '@/core/flow/schema'
import { exigirCapacidade, recusou } from './permissoes'
import { db } from './db'

export async function acaoPrepararConta(clienteId: string, respostas: unknown, acao: 'salvar' | 'adiar' | 'concluir'): Promise<{ ok: true; estado: EstadoOnboarding } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'Você não pode configurar esta empresa.' }
  const analise = respostasOnboardingSchema.safeParse(respostas)
  if (!analise.success || !['salvar', 'adiar', 'concluir'].includes(acao)) return { ok: false, erro: 'Confira as opções antes de continuar.' }
  const dados = analise.data
  const quadro = MODELOS_DE_QUADRO.find((modelo) => modelo.id === dados.funil)
  const fluxo = acharModelo(dados.chatbot)
  try {
    const { data, error } = await db().rpc('preparar_onboarding', {
      p_cliente: clienteId, p_respostas: dados, p_acao: acao,
      p_objetivo: objetivoDoOnboarding(dados),
      p_quadro: acao === 'concluir' && quadro ? { nome: quadro.nome, finalidade: quadro.finalidade, etapas: quadro.etapas } : null,
      p_fluxo: acao === 'concluir' && fluxo ? { nome: fluxo.nome, grafo: fluxoSchema.parse(fluxo.grafo) } : null,
    })
    if (error) return { ok: false, erro: 'Não foi possível salvar a preparação. Suas escolhas continuam nesta tela; tente novamente.' }
    const estado = lerOnboarding(data)
    if (!estado) return { ok: false, erro: 'Não foi possível confirmar o resultado. Recarregue para conferir a preparação.' }
    revalidatePath(`/clientes/${clienteId}`, 'layout')
    return { ok: true, estado }
  } catch {
    return { ok: false, erro: 'Não foi possível salvar agora. Confira sua conexão e tente novamente.' }
  }
}
