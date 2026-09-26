import 'server-only'
import { ehTipoDeMaterial, type Material, type TipoDeMaterial } from '@/core/materiais'
import { db, ehIdInvalido } from '../db'

/**
 * Os materiais da conta no banco (`public.materiais`, 0106).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide se o endereço e o nome
 * servem é `core/materiais.ts`, e quem confere a permissão é a ação.
 *
 * Apagar a linha não apaga o arquivo do acervo, de propósito: o mesmo PDF pode
 * estar num bloco de mídia de um fluxo publicado, e tirar o cardápio do bot
 * não pode derrubar o fluxo de botões. O acervo tem a própria tela para
 * apagar arquivo.
 */

type LinhaDoMaterial = {
  tipo: string
  url: string
  nome_arquivo: string | null
  atualizado_em: string
}

function paraMaterial(linha: LinhaDoMaterial): Material | null {
  if (!ehTipoDeMaterial(linha.tipo)) return null
  return { tipo: linha.tipo, url: linha.url, nomeArquivo: linha.nome_arquivo, atualizadoEm: linha.atualizado_em }
}

/** Os materiais da conta. Vazio quando não há nenhum, e também em id inválido. */
export async function listarMateriais(clienteId: string): Promise<Material[]> {
  const { data, error } = await db()
    .from('materiais')
    .select('tipo, url, nome_arquivo, atualizado_em')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os materiais: ${error.message}`)
  return (data as LinhaDoMaterial[]).flatMap((l) => paraMaterial(l) ?? [])
}

/**
 * Grava o material do tipo, trocando o que havia (`unique (client_id, tipo)`).
 * Recebe o que `core/materiais.conferirMaterial` já conferiu.
 */
export async function salvarMaterial(
  clienteId: string,
  tipo: TipoDeMaterial,
  url: string,
  nomeArquivo: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db()
    .from('materiais')
    .upsert(
      { client_id: clienteId, tipo, url, nome_arquivo: nomeArquivo, atualizado_em: new Date().toISOString() },
      { onConflict: 'client_id,tipo' },
    )
  if (error) return { ok: false, motivo: `não deu para salvar o arquivo: ${error.message}` }
  return { ok: true }
}

/** Tira o material do bot. O arquivo continua no acervo (ver o cabeçalho). */
export async function removerMaterial(
  clienteId: string,
  tipo: TipoDeMaterial,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error } = await db().from('materiais').delete().eq('client_id', clienteId).eq('tipo', tipo)
  if (ehIdInvalido(error)) return { ok: true }
  if (error) return { ok: false, motivo: `não deu para tirar o arquivo: ${error.message}` }
  return { ok: true }
}
