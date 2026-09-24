'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  apagarRespostaRapida,
  criarRespostaRapida,
  editarRespostaRapida,
  type RespostaRapida,
} from './repos/respostas-rapidas'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * As ações da tela Conversas > Respostas rápidas.
 *
 * Arquivo próprio pelo motivo de `acoes-etiquetas.ts`. **Nenhuma revalida a
 * tela aberta**: a lista muda na hora com o que volta daqui. Revalidam as
 * Conversas, onde as respostas são usadas, para não voltarem com texto velho.
 *
 * A regra do atalho é a mesma de `acaoCriarRespostaRapida` em `acoes.ts`.
 */

const esquema = z.object({
  atalho: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/, 'use até 40 letras minúsculas, números, _ ou -'),
  texto: z.string().trim().min(1, 'escreva a mensagem').max(4096),
})

type Resposta = { ok: boolean; erro?: string; resposta?: RespostaRapida }

function conversas(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/inbox`)
}

export async function acaoNovaRespostaRapida(
  clienteId: string,
  dados: { atalho: string; texto: string },
): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const lido = esquema.safeParse(dados)
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? 'resposta inválida' }

  try {
    const resposta = await criarRespostaRapida(clienteId, lido.data)
    conversas(clienteId)
    return { ok: true, resposta }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para criar' }
  }
}

export async function acaoEditarRespostaRapida(
  clienteId: string,
  respostaId: string,
  dados: { atalho: string; texto: string },
): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const lido = esquema.safeParse(dados)
  if (!lido.success) return { ok: false, erro: lido.error.issues[0]?.message ?? 'resposta inválida' }

  try {
    const resposta = await editarRespostaRapida(respostaId, clienteId, lido.data)
    if (!resposta) return { ok: false, erro: 'esta resposta não existe mais' }
    conversas(clienteId)
    return { ok: true, resposta }
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para salvar' }
  }
}

export async function acaoTirarRespostaRapida(clienteId: string, respostaId: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro }

  const apagou = await apagarRespostaRapida(respostaId, clienteId)
  if (!apagou) return { ok: false, erro: 'esta resposta não existe mais' }
  conversas(clienteId)
  return { ok: true }
}
