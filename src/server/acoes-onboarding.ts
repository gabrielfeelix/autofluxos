'use server'

import { revalidatePath } from 'next/cache'
import { respostasOnboardingSchema, objetivoDoOnboarding, lerOnboarding, nichoDoOnboarding, type EstadoOnboarding } from '@/core/onboarding'
import { MODELOS_DE_QUADRO } from '@/core/quadros-modelos'
import { acharModelo } from '@/exemplos/modelos'
import { fluxoSchema } from '@/core/flow/schema'
import { exigirCapacidade, recusou } from './permissoes'
import { db } from './db'
import { definirNicho, nichoDaConta } from './repos/recursos'
import { registrar } from './repos/auditoria'

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
    if (acao === 'concluir') await gravarFrente(clienteId, nichoDoOnboarding(dados), acesso)
    revalidatePath(`/clientes/${clienteId}`, 'layout')
    return { ok: true, estado }
  } catch {
    return { ok: false, erro: 'Não foi possível salvar agora. Confira sua conexão e tente novamente.' }
  }
}

/**
 * Grava a frente escolhida no assistente (PLANO-NICHOS 4.4), depois do resto
 * preparado. "Outro" não mexe: a conta fica como estava.
 *
 * Nunca derruba a preparação: funil e chatbot já foram criados, e a frente se
 * troca depois em Objetivo e recursos. A troca vai para a auditoria, como a
 * de lá.
 */
async function gravarFrente(
  clienteId: string,
  nicho: ReturnType<typeof nichoDoOnboarding>,
  acesso: { sessao?: { usuario: { id: string; email: string }; impersonadoPor?: string | null } },
) {
  if (!nicho) return
  try {
    const anterior = await nichoDaConta(clienteId)
    if (anterior === nicho) return
    const r = await definirNicho(clienteId, nicho)
    if (!r.ok) {
      console.error('[onboarding] não deu para gravar a frente:', r.motivo)
      return
    }
    await registrar({
      acao: 'trocou_tipo_de_negocio',
      autorId: acesso.sessao?.usuario.id ?? null,
      autorEmail: acesso.sessao?.usuario.email ?? '',
      contaId: clienteId,
      alvoTipo: 'client',
      alvoId: clienteId,
      detalhes: { de: anterior ?? '', para: nicho, pelo: 'onboarding' },
      impersonadoPor: acesso.sessao?.impersonadoPor ?? null,
    })
  } catch (erro) {
    console.error('[onboarding] não deu para gravar a frente:', erro)
  }
}
