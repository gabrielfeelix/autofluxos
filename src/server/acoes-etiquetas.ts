'use server'

import { revalidatePath } from 'next/cache'
import { ehCorDeEtiqueta, type CorDeEtiqueta } from '@/core/etiquetas'
import { apagarEtiqueta, criarEtiqueta, editarEtiqueta, juntarEtiquetas } from './repos/etiquetas'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * As ações da tabela de CRM > Etiquetas (F3 do plano de 24/09).
 *
 * Arquivo próprio pelo motivo de `acoes-negocio.ts`: `acoes.ts` é grande e
 * outro trabalho mexe nele. **Nenhuma revalida a tela de Etiquetas**: a tabela
 * muda na hora e o servidor grava por trás. Revalidam Contatos e Conversas,
 * que não estão abertos e mostram etiqueta, para não voltarem com nome velho.
 *
 * A porta é a mesma da tela e das ações antigas: `configurar_operacao`.
 */

function vizinhas(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
}

type Resposta = { ok: boolean; erro?: string }

export async function acaoNovaEtiqueta(
  clienteId: string,
  dados: { nome: string; cor: string },
): Promise<Resposta & { etiqueta?: { id: string; nome: string; cor: CorDeEtiqueta } }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  if (!ehCorDeEtiqueta(dados.cor)) return { ok: false, erro: 'cor inválida' }

  const r = await criarEtiqueta(clienteId, { nome: dados.nome, cor: dados.cor })
  if (!r.ok) return { ok: false, erro: r.motivo }
  return { ok: true, etiqueta: r.etiqueta }
}

export async function acaoSalvarEtiqueta(
  clienteId: string,
  etiquetaId: string,
  dados: { nome: string; cor: string },
): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }
  if (!ehCorDeEtiqueta(dados.cor)) return { ok: false, erro: 'cor inválida' }

  const r = await editarEtiqueta(clienteId, etiquetaId, { nome: dados.nome, cor: dados.cor })
  if (!r.ok) return { ok: false, erro: r.motivo }
  vizinhas(clienteId)
  return { ok: true }
}

export async function acaoJuntarEtiquetas(
  clienteId: string,
  origemId: string,
  destinoId: string,
): Promise<Resposta & { movidos?: number }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const r = await juntarEtiquetas(clienteId, origemId, destinoId)
  if (!r.ok) return { ok: false, erro: r.motivo }
  vizinhas(clienteId)
  // Quantos ganharam a destino agora: quem já tinha as duas não conta de novo.
  return { ok: true, movidos: r.movidos }
}

export async function acaoTirarEtiqueta(clienteId: string, etiquetaId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const r = await apagarEtiqueta(clienteId, etiquetaId)
  if (!r.ok) return { ok: false, erro: r.motivo }
  vizinhas(clienteId)
  return { ok: true }
}
