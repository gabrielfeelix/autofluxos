'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fluxoNovo } from '@/core/flow/novo'
import { triagem } from '@/exemplos/triagem'
import { criarCliente } from './repos/clientes'
import { criarFluxo } from './repos/fluxos'

export async function acaoCriarCliente(formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return

  const cliente = await criarCliente(nome)
  revalidatePath('/')
  redirect(`/clientes/${cliente.id}`)
}

/**
 * Atalho para a tela vazia: cria um cliente já com o fluxo de exemplo dentro,
 * para dar o que explorar sem ninguém precisar desenhar nada antes.
 */
export async function acaoCriarExemplo() {
  const cliente = await criarCliente('Estúdio de exemplo')
  await criarFluxo(cliente.id, 'Triagem de orçamento', triagem)
  revalidatePath('/')
  redirect(`/clientes/${cliente.id}`)
}

export async function acaoCriarFluxo(clienteId: string, formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return

  // Nasce válido de propósito — ver core/flow/novo.ts.
  const fluxo = await criarFluxo(clienteId, nome, fluxoNovo())
  revalidatePath(`/clientes/${clienteId}`)
  redirect(`/clientes/${clienteId}/fluxos/${fluxo.id}`)
}
