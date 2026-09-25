'use server'

import { type ConfigDoSite, type Mascote, lerConfigDoSite, lerListaDeDominios } from '@/core/chat-do-site'
import { db } from './db'
import { BUCKET_DO_ACERVO } from './repos/acervo'
import { exigirCapacidade, recusou } from './permissoes'
import { chatDoSite, garantirChatDoSite, ligarChatDoSite, pausarChatDoSite, salvarConfigDoSite } from './repos/canais-site'

/**
 * As ações da tela do chat do site. Todas devolvem o resultado em vez de
 * recarregar a página: a tela já mudou na hora, e só volta atrás se o servidor
 * recusar.
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string }

export async function acaoLigarChatDoSite(clienteId: string): Promise<Resultado<{ chave: string }>> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso
  const canal = await ligarChatDoSite(clienteId)
  return { ok: true, chave: canal.chave }
}

export async function acaoPausarChatDoSite(clienteId: string): Promise<Resultado> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso
  await pausarChatDoSite(clienteId)
  return { ok: true }
}

export async function acaoSalvarChatDoSite(
  clienteId: string,
  dados: {
    dominios: string
    cor: string
    titulo: string
    saudacao: string
    pedirContato: boolean
    tema: 'claro' | 'escuro'
  },
): Promise<Resultado<{ config: ConfigDoSite; recusados: string[]; chave: string }>> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const { validos, recusados } = lerListaDeDominios(dados.dominios)
  // Passa pelo mesmo leitor do banco: cor inválida, título vazio e texto longo
  // caem no padrão ou no teto aqui, e não num segundo conjunto de regras.
  const canal = await garantirChatDoSite(clienteId, 'pausado')
  // O personagem não vem deste formulário: ele tem ação própria, e salvar a
  // aparência não pode apagar a animação que a loja subiu.
  const config = lerConfigDoSite({ ...dados, dominios: validos, mascote: canal.config.mascote })
  await salvarConfigDoSite(clienteId, config)
  return { ok: true, config, recusados, chave: canal.chave }
}

/**
 * O que a tela aceita como animação do botão, e como cada um é guardado.
 *
 * O bucket é o `autofluxos-acervo` (público, do AutoFluxos), num prefixo
 * próprio para não aparecer na lista de arquivos da conta. Ele não aceita GIF,
 * e é de propósito que não se mexe nele: Storage é global ao projeto dividido
 * com a Verandi. O GIF, que é o formato que todo mundo tem, vira WebP animado
 * aqui, com o mesmo movimento e um terço do peso.
 */
// Abaixo dos 4 MB que a Server Action aceita (next.config.ts), com folga para o formulário.
const TETO_DO_MASCOTE = 3.5 * 1024 * 1024
const ACEITOS: Record<string, { extensao: string; tipo: Mascote['tipo'] }> = {
  'image/gif': { extensao: 'webp', tipo: 'imagem' },
  'image/webp': { extensao: 'webp', tipo: 'imagem' },
  'image/png': { extensao: 'png', tipo: 'imagem' },
  'video/mp4': { extensao: 'mp4', tipo: 'video' },
}

export async function acaoSubirMascote(formData: FormData): Promise<Resultado<{ mascote: Mascote }>> {
  const clienteId = String(formData.get('clienteId') ?? '')
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const arquivo = formData.get('arquivo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'escolha um arquivo' }
  const aceito = ACEITOS[arquivo.type]
  if (!aceito) return { ok: false, erro: 'use GIF, WebP, PNG ou MP4' }
  if (arquivo.size > TETO_DO_MASCOTE) return { ok: false, erro: 'o arquivo passa de 3,5 MB' }

  let bytes: Uint8Array = new Uint8Array(await arquivo.arrayBuffer())
  let contentType = arquivo.type
  if (arquivo.type === 'image/gif') {
    try {
      const sharp = (await import('sharp')).default
      bytes = await sharp(bytes, { animated: true }).webp({ quality: 82 }).toBuffer()
      contentType = 'image/webp'
    } catch (erro) {
      console.error('[site] não deu para converter o GIF', erro)
      return { ok: false, erro: 'não deu para converter este GIF; mande em WebP ou MP4' }
    }
  }

  const canal = await garantirChatDoSite(clienteId, 'pausado')
  const caminho = `chat-do-site/${clienteId}/${Date.now()}.${aceito.extensao}`
  const { error } = await db()
    .storage.from(BUCKET_DO_ACERVO)
    .upload(caminho, bytes, { contentType, upsert: false })
  if (error) {
    console.error('[site] não deu para subir a animação:', error.message)
    return { ok: false, erro: 'não deu para guardar o arquivo agora, tente de novo' }
  }

  const mascote: Mascote = {
    url: db().storage.from(BUCKET_DO_ACERVO).getPublicUrl(caminho).data.publicUrl,
    tipo: aceito.tipo,
  }
  await salvarConfigDoSite(clienteId, { ...canal.config, mascote })
  await apagarMascoteAntigo(clienteId, canal.config.mascote)
  return { ok: true, mascote }
}

/** Volta para o robô padrão. */
export async function acaoTirarMascote(clienteId: string): Promise<Resultado> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso
  const canal = await chatDoSite(clienteId)
  if (!canal) return { ok: true }
  await salvarConfigDoSite(clienteId, { ...canal.config, mascote: null })
  await apagarMascoteAntigo(clienteId, canal.config.mascote)
  return { ok: true }
}

/** O arquivo trocado sai do bucket. Falhar só deixa um órfão; não desfaz nada. */
async function apagarMascoteAntigo(clienteId: string, antigo: Mascote | null): Promise<void> {
  if (!antigo) return
  const marca = `/${BUCKET_DO_ACERVO}/`
  const i = antigo.url.indexOf(marca)
  if (i < 0) return
  const caminho = antigo.url.slice(i + marca.length)
  if (!caminho.startsWith(`chat-do-site/${clienteId}/`)) return
  await db().storage.from(BUCKET_DO_ACERVO).remove([caminho]).catch(() => undefined)
}
