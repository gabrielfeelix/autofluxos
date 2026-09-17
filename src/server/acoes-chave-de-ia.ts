'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { apagarChave, guardarChave } from './repos/chave-de-ia'
import { exigirAcessoAoCliente, podeAdministrarConta } from './sessao'

/**
 * A chave de IA da conta, em arquivo próprio.
 *
 * Separada de `acoes.ts` pelo mesmo motivo do funil: aquele arquivo já passou de
 * 2.500 linhas e cada bloco novo lá é mais uma chance de dois trabalhos
 * paralelos colidirem no mesmo lugar.
 *
 * **As duas exigem administrar a conta**, e não só ter acesso a ela. Trocar a
 * chave muda para onde vai a conversa de todo mundo daquela conta, e apagar
 * devolve o tráfego para a nossa conta free, onde o Google treina modelo. Quem
 * atende no Inbox não deveria poder fazer nem uma coisa nem outra sem querer.
 */

export async function acaoGuardarChaveDeIa(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) {
    return { erro: 'só quem administra a conta pode trocar a chave' }
  }

  const chave = String(formData.get('chave') ?? '').trim()
  if (chave === '') return { erro: 'cole a chave antes de salvar' }

  try {
    await guardarChave(clienteId, chave)
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : 'não deu para guardar a chave' }
  }

  revalidatePath(`/clientes/${clienteId}/ajustes/contexto`)
  return { ok: true }
}

export async function acaoApagarChaveDeIa(
  clienteId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) {
    return { ok: false, erro: 'só quem administra a conta pode apagar a chave' }
  }

  try {
    await apagarChave(clienteId)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para apagar' }
  }

  revalidatePath(`/clientes/${clienteId}/ajustes/contexto`)
  return { ok: true }
}
