import 'server-only'

import { db, ehIdInvalido } from '../db'

/**
 * Arquivos guardados num negócio (0127): proposta, contrato, foto do produto.
 *
 * **O arquivo não passa pelo nosso servidor.** A Vercel corta o corpo de uma
 * requisição perto de 4,5 MB, e um PDF de proposta passa disso fácil. Então o
 * servidor confere tudo (sessão, negócio, tipo, tamanho), devolve uma URL
 * assinada de **envio** para um caminho que ele mesmo escolheu, e o navegador
 * manda o arquivo direto ao Storage. Depois, `registrar` confere que o objeto
 * chegou e só então grava a linha. O bucket recusa sozinho o que passar do teto
 * ou não for dos tipos aceitos.
 *
 * **Caminho, nunca URL.** A tela pede URL assinada de leitura na hora de
 * desenhar, com validade curta, como a mídia recebida (`midia-recebida.ts`).
 */

export const BUCKET_DOS_NEGOCIOS = 'autofluxos-negocios'
export const TETO_DO_ARQUIVO = 10 * 1024 * 1024
export const TIPOS_DO_ARQUIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
const VALIDADE_DA_LEITURA_S = 600

export type ArquivoDoNegocio = {
  id: string
  nome: string
  mime: string
  bytes: number
  autor: string | null
  criadoEm: string
  /** Assinada na hora; `null` quando o Storage não respondeu. */
  url: string | null
}

type Linha = {
  id: string
  caminho: string
  nome: string
  mime: string
  bytes: number
  autor_nome: string | null
  criado_em: string
}

function extensao(mime: string): string {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/** O caminho que o servidor escolhe: conta, negócio e um id. O nome da pessoa não entra. */
export function caminhoNovo(clienteId: string, cartaoId: string, mime: string): string {
  return `${clienteId}/${cartaoId}/${crypto.randomUUID()}.${extensao(mime)}`
}

/** O caminho pertence a este negócio desta conta? Protege `registrar` de um caminho forjado. */
export function caminhoEhDoNegocio(caminho: string, clienteId: string, cartaoId: string): boolean {
  return /^[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.(pdf|png|webp|jpg)$/.test(caminho) &&
    caminho.startsWith(`${clienteId}/${cartaoId}/`)
}

export async function urlDeEnvio(caminho: string): Promise<{ url: string } | null> {
  const { data, error } = await db().storage.from(BUCKET_DOS_NEGOCIOS).createSignedUploadUrl(caminho)
  if (error || !data) {
    console.error('[arquivos do negócio] não deu para assinar o envio', error?.message)
    return null
  }
  return { url: data.signedUrl }
}

export async function registrar(
  clienteId: string,
  cartaoId: string,
  arquivo: { caminho: string; nome: string; mime: string; bytes: number },
  autor: { id: string | null; nome: string | null },
): Promise<ArquivoDoNegocio | null> {
  // O objeto precisa existir: sem isso, uma linha apontaria para o nada.
  const { data: assinado, error: erroDoObjeto } = await db()
    .storage.from(BUCKET_DOS_NEGOCIOS)
    .createSignedUrl(arquivo.caminho, VALIDADE_DA_LEITURA_S)
  if (erroDoObjeto || !assinado) return null

  const { data, error } = await db()
    .from('negocio_arquivos')
    .insert({
      client_id: clienteId,
      cartao_id: cartaoId,
      caminho: arquivo.caminho,
      nome: arquivo.nome,
      mime: arquivo.mime,
      bytes: arquivo.bytes,
      autor_id: autor.id,
      autor_nome: autor.nome,
    })
    .select('id, caminho, nome, mime, bytes, autor_nome, criado_em')
    .single()

  if (error) {
    console.error('[arquivos do negócio] não deu para registrar', error.message)
    return null
  }
  const linha = data as Linha
  return {
    id: linha.id,
    nome: linha.nome,
    mime: linha.mime,
    bytes: linha.bytes,
    autor: linha.autor_nome,
    criadoEm: linha.criado_em,
    url: assinado.signedUrl,
  }
}

export async function arquivosDoNegocio(clienteId: string, cartaoId: string): Promise<ArquivoDoNegocio[]> {
  const { data, error } = await db()
    .from('negocio_arquivos')
    .select('id, caminho, nome, mime, bytes, autor_nome, criado_em')
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .order('criado_em', { ascending: false })

  // Degrada, não derruba: a página do negócio abre sem os arquivos.
  if (ehIdInvalido(error)) return []
  if (error) {
    console.error('[arquivos do negócio] não deu para ler', error.message)
    return []
  }
  const linhas = (data ?? []) as Linha[]
  if (linhas.length === 0) return []

  const { data: assinadas } = await db()
    .storage.from(BUCKET_DOS_NEGOCIOS)
    .createSignedUrls(
      linhas.map((linha) => linha.caminho),
      VALIDADE_DA_LEITURA_S,
    )
  const porCaminho = new Map((assinadas ?? []).map((item) => [item.path, item.signedUrl]))

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    mime: linha.mime,
    bytes: linha.bytes,
    autor: linha.autor_nome,
    criadoEm: linha.criado_em,
    url: porCaminho.get(linha.caminho) ?? null,
  }))
}

/** Quantos arquivos cada negócio tem, para a lista da ficha. */
export async function contagemDeArquivos(clienteId: string, cartoes: string[]): Promise<Map<string, number>> {
  const contagem = new Map<string, number>()
  if (cartoes.length === 0) return contagem
  const { data, error } = await db()
    .from('negocio_arquivos')
    .select('cartao_id')
    .eq('client_id', clienteId)
    .in('cartao_id', cartoes)
  if (error) return contagem
  for (const linha of (data ?? []) as { cartao_id: string }[]) {
    contagem.set(linha.cartao_id, (contagem.get(linha.cartao_id) ?? 0) + 1)
  }
  return contagem
}

export async function apagar(clienteId: string, cartaoId: string, arquivoId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('negocio_arquivos')
    .delete()
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
    .eq('id', arquivoId)
    .select('caminho')
    .maybeSingle()
  if (error || !data) return false
  await apagarObjetos([(data as { caminho: string }).caminho])
  return true
}

/**
 * Antes de apagar o negócio: a linha cai em cascata, o objeto no bucket não.
 * Sem isto, o arquivo ficaria no Storage sem ninguém que o enxergue.
 */
export async function apagarTodosDoNegocio(clienteId: string, cartaoId: string): Promise<void> {
  const { data } = await db()
    .from('negocio_arquivos')
    .select('caminho')
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)
  await apagarObjetos(((data ?? []) as { caminho: string }[]).map((linha) => linha.caminho))
}

async function apagarObjetos(caminhos: string[]): Promise<void> {
  if (caminhos.length === 0) return
  const { error } = await db().storage.from(BUCKET_DOS_NEGOCIOS).remove(caminhos)
  if (error) console.error('[arquivos do negócio] não deu para apagar do bucket', error.message)
}
