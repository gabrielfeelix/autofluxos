'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { fluxoSchema } from '@/core/flow/schema'
import { fluxoNovo } from '@/core/flow/novo'
import { triagem } from '@/exemplos/triagem'
import { criarCliente } from './repos/clientes'
import { criarCanal } from './repos/conversas'
import { criarFluxo, publicar, salvarRascunho } from './repos/fluxos'

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

/**
 * Salva o desenho. Chamada pelo editor a cada pausa na digitação.
 *
 * Aceita rascunho incompleto de propósito: mensagem sem texto, opção sem
 * rótulo. O que impede de ir ao ar é o `validar()`, não o salvar — senão o
 * editor perderia trabalho toda vez que alguém parasse no meio de uma frase.
 * O `fluxoSchema.parse` aqui é a garantia de que a *estrutura* está sã.
 */
export async function acaoSalvarRascunho(fluxoId: string, grafo: unknown) {
  const analise = fluxoSchema.safeParse(grafo)
  if (!analise.success) {
    return { ok: false as const, erro: 'o desenho chegou com formato inválido' }
  }

  await salvarRascunho(fluxoId, analise.data)
  return { ok: true as const }
}

export async function acaoCriarFluxo(clienteId: string, formData: FormData) {
  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return

  // Nasce válido de propósito — ver core/flow/novo.ts.
  const fluxo = await criarFluxo(clienteId, nome, fluxoNovo())
  revalidatePath(`/clientes/${clienteId}`)
  redirect(`/clientes/${clienteId}/fluxos/${fluxo.id}`)
}

/**
 * Publica o que está na tela.
 *
 * A checagem de verdade mora no repo (`publicar`), não aqui e muito menos no
 * botão desabilitado: um fluxo sem saída para humano tem que ser recusado
 * mesmo que a chamada venha de outro lugar.
 */
export async function acaoPublicar(fluxoId: string, clienteId: string, grafo: unknown) {
  const resultado = await publicar(fluxoId, grafo)

  if (resultado.ok) {
    revalidatePath(`/clientes/${clienteId}`)
    return {
      ok: true as const,
      versao: resultado.versao.versao,
      publicadoEm: resultado.versao.publicadoEm,
    }
  }

  return { ok: false as const, erros: resultado.erros }
}

export async function acaoConectarNumero(clienteId: string, formData: FormData) {
  const phoneNumberId = String(formData.get('phoneNumberId') ?? '').trim()
  const flowId = String(formData.get('flowId') ?? '').trim()
  if (phoneNumberId === '') return

  await criarCanal({ clienteId, phoneNumberId, flowId: flowId === '' ? null : flowId })
  revalidatePath(`/clientes/${clienteId}`)
}
