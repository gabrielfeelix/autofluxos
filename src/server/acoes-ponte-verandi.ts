'use server'

import { revalidatePath } from 'next/cache'
import { registrar } from './repos/auditoria'
import { alunoNaVerandi, desligarAvisos, ligarAvisos, type AlunoNaVerandi, type ResultadoDaPonte } from './ponte-verandi'
import { exigirCapacidade, meuAlcance, recusou } from './permissoes'
import { acharLead } from './repos/leads'

/**
 * Ligar e desligar os avisos da Verandi (a ponte). Mexe em integração, então
 * é de quem configura a operação, como guardar a chave.
 */

export async function acaoLigarAvisosDaVerandi(clienteId: string): Promise<ResultadoDaPonte> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const r = await ligarAvisos(clienteId)
  if (r.ok) {
    await auditar(clienteId, acesso, 'ligou_avisos_da_verandi')
    revalidatePath(`/clientes/${clienteId}/ajustes/chaves`)
  }
  return r
}

export async function acaoDesligarAvisosDaVerandi(clienteId: string): Promise<ResultadoDaPonte> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: 'Sua função não permite mexer em integração.' }
  const r = await desligarAvisos(clienteId)
  await auditar(clienteId, acesso, 'desligou_avisos_da_verandi')
  revalidatePath(`/clientes/${clienteId}/ajustes/chaves`)
  return r
}

type Acesso = Exclude<Awaited<ReturnType<typeof exigirCapacidade>>, { erro: string }>

async function auditar(clienteId: string, acesso: Acesso, acao: string): Promise<void> {
  await registrar({
    acao,
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'integracao',
    alvoNome: 'Verandi',
    impersonadoPor: acesso.sessao.impersonadoPor,
  }).catch(() => undefined)
}

/**
 * O aluno na Verandi para a conversa e a ficha. Só para quem enxerga o
 * contato; sem chave, sem cadastro ou com a Verandi fora, `null`, e o cartão
 * não aparece.
 */
export async function acaoAlunoNaVerandi(clienteId: string, contatoId: string): Promise<AlunoNaVerandi | null> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return null
  const lead = await acharLead(clienteId, contatoId, await meuAlcance(clienteId))
  if (!lead) return null
  return alunoNaVerandi(clienteId, lead.waId)
}
