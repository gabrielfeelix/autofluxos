'use server'

import { ensinarResposta } from '@/core/duvidas'
import { exigirCapacidade, recusou } from './permissoes'
import { acharCliente, atualizarContexto } from './repos/clientes'
import { renomearTema } from './repos/duvidas'

/**
 * As duas ações do relatório de dúvidas. As duas mudam o que a conta é (o que
 * a IA sabe, como os temas se chamam), então pedem a mesma capacidade de
 * Conhecimento da IA: configurar a operação da conta inteira.
 *
 * Sem `revalidatePath`: a tela marca o feito na hora e o próximo carregamento
 * traz o resto (ver a memória de ações otimistas).
 */

const LIMITE = 1000

/** Acrescenta a pergunta e a resposta ao texto que a IA lê. Vale na próxima conversa. */
export async function acaoEnsinarResposta(
  clienteId: string,
  pergunta: string,
  resposta: string,
): Promise<{ ok?: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { erro: 'só quem configura a conta pode ensinar a IA' }

  const p = pergunta.trim().slice(0, LIMITE)
  const r = resposta.trim().slice(0, LIMITE)
  if (!p || !r) return { erro: 'escreva a pergunta e a resposta' }

  try {
    const cliente = await acharCliente(clienteId)
    if (!cliente) return { erro: 'conta não encontrada' }
    await atualizarContexto(clienteId, ensinarResposta(cliente.contextoNegocio, p, r))
    return { ok: true }
  } catch {
    return { erro: 'não deu para salvar. Tente de novo.' }
  }
}

/** Renomeia um tema; renomear para um nome que já existe junta os dois. */
export async function acaoRenomearTema(
  clienteId: string,
  categoria: string,
  de: string,
  para: string,
): Promise<{ ok?: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { erro: 'só quem configura a conta pode renomear temas' }

  const novo = para.trim().toLowerCase().slice(0, 120)
  if (!novo) return { erro: 'escreva o nome do tema' }
  if (novo === de) return { ok: true }

  try {
    await renomearTema(clienteId, categoria, de, novo)
    return { ok: true }
  } catch {
    return { erro: 'não deu para renomear. Tente de novo.' }
  }
}
