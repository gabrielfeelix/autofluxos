'use server'

import { z } from 'zod'
import { ehEscopoDaApi, type EscopoDaApi } from '@/core/api/chaves'
import { recusaDoPlano } from './recursos-do-plano'
import { registrar } from './repos/auditoria'
import { criarChaveDeApi, revogarChaveDeApi, type ChaveDeApi } from './repos/chaves-de-api'
import { exigirAcessoAoCliente, podeAdministrarConta } from './sessao'

/**
 * Criar e revogar chaves da API pública (Configurações > API).
 *
 * **Só quem administra a conta**: a chave fala pela organização inteira, sem
 * sessão de ninguém por trás. As duas vão para `af_auditoria` com o `publico`,
 * nunca com a chave.
 *
 * Sem `revalidatePath`: a tela é otimista e troca a linha pela que volta daqui.
 */

export type RespostaDaCriacao =
  | { ok: true; chave: ChaveDeApi; inteira: string }
  | { ok: false; erro: string }

export async function acaoCriarChaveDeApi(
  clienteId: string,
  dados: { nome: string; escopos: string[] },
): Promise<RespostaDaCriacao> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) return { ok: false, erro: 'Só quem administra a organização pode criar chaves.' }

  const recusa = await recusaDoPlano(clienteId, 'api')
  if (recusa) return { ok: false, erro: recusa }

  const nome = String(dados?.nome ?? '').trim()
  if (nome === '') return { ok: false, erro: 'Dê um nome para a chave.' }
  if (nome.length > 80) return { ok: false, erro: 'Nome com no máximo 80 caracteres.' }

  const escopos = [...new Set(Array.isArray(dados?.escopos) ? dados.escopos : [])]
  if (escopos.length === 0) return { ok: false, erro: 'Marque ao menos uma permissão.' }
  if (!escopos.every(ehEscopoDaApi)) return { ok: false, erro: 'Permissão desconhecida.' }

  try {
    const { chave, inteira } = await criarChaveDeApi(clienteId, {
      nome,
      escopos: escopos as EscopoDaApi[],
      autorId: acesso.sessao.usuario.id,
      autorNome: acesso.sessao.usuario.nome || acesso.sessao.usuario.email,
    })
    await registrar({
      acao: 'criou_chave_de_api',
      autorId: acesso.sessao.usuario.id,
      autorEmail: acesso.sessao.usuario.email,
      contaId: clienteId,
      alvoTipo: 'chave_de_api',
      alvoId: chave.id,
      alvoNome: `${chave.nome} (${chave.publico})`,
      detalhes: { escopos: chave.escopos },
      impersonadoPor: acesso.sessao.impersonadoPor,
    })
    return { ok: true, chave, inteira }
  } catch (erro) {
    console.error('[api] não deu para criar a chave:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para criar a chave agora. Tente de novo.' }
  }
}

export async function acaoRevogarChaveDeApi(
  clienteId: string,
  chaveId: string,
): Promise<{ ok: true; chave: ChaveDeApi } | { ok: false; erro: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  if (!podeAdministrarConta(acesso)) return { ok: false, erro: 'Só quem administra a organização pode revogar chaves.' }
  if (!z.guid().safeParse(chaveId).success) return { ok: false, erro: 'Chave inválida.' }

  try {
    const chave = await revogarChaveDeApi(clienteId, chaveId)
    if (!chave) return { ok: false, erro: 'Esta chave não existe ou já foi revogada.' }
    await registrar({
      acao: 'revogou_chave_de_api',
      autorId: acesso.sessao.usuario.id,
      autorEmail: acesso.sessao.usuario.email,
      contaId: clienteId,
      alvoTipo: 'chave_de_api',
      alvoId: chave.id,
      alvoNome: `${chave.nome} (${chave.publico})`,
      impersonadoPor: acesso.sessao.impersonadoPor,
    })
    return { ok: true, chave }
  } catch (erro) {
    console.error('[api] não deu para revogar a chave:', erro instanceof Error ? erro.message : erro)
    return { ok: false, erro: 'Não deu para revogar agora. Tente de novo.' }
  }
}
