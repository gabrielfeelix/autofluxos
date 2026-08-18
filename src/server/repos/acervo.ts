import 'server-only'
import type { TipoDeMidia } from '@/core/flow/schema'
import { db } from '../db'

/**
 * O acervo de arquivos de um cliente — o que o bloco de mídia pode mandar.
 *
 * Mora no Storage e não numa tabela: o arquivo já vive lá, e uma tabela espelho
 * criaria duas verdades que divergem no dia em que um upload falhar no meio.
 * A pasta é o `clienteId`, então listar a pasta **é** a consulta por cliente.
 */
export const BUCKET_DO_ACERVO = 'autofluxos-acervo'

export type ArquivoDoAcervo = {
  /** Caminho dentro do bucket: `<clienteId>/<nome>`. É a chave para apagar. */
  caminho: string
  nome: string
  url: string
  /** Qual bloco de mídia serve para este arquivo. */
  midia: TipoDeMidia
  bytes: number
  criadoEm: string
}

/**
 * O que a Cloud API aceita, e em qual bloco cada coisa cai.
 *
 * A lista repete a do bucket (migration 0017) de propósito: lá ela é a recusa
 * que vale mesmo se alguém subir por outro caminho; aqui ela é o que traduz
 * tipo MIME em tipo de bloco, e ainda faz o erro chegar em português na tela.
 */
export const TIPOS_ACEITOS: Record<string, { extensao: string; midia: TipoDeMidia }> = {
  'image/png': { extensao: 'png', midia: 'imagem' },
  'image/jpeg': { extensao: 'jpg', midia: 'imagem' },
  'image/webp': { extensao: 'webp', midia: 'imagem' },
  'video/mp4': { extensao: 'mp4', midia: 'video' },
  'audio/mpeg': { extensao: 'mp3', midia: 'audio' },
  'audio/ogg': { extensao: 'ogg', midia: 'audio' },
  'application/pdf': { extensao: 'pdf', midia: 'documento' },
}

/** Teto da própria Cloud API. Guardar mais seria guardar o que ela recusaria. */
export const LIMITE_DO_ARQUIVO = 16 * 1024 * 1024

/** Pela extensão, porque é o que sobrevive à ida e volta do Storage. */
function midiaDaExtensao(nome: string): TipoDeMidia {
  const extensao = nome.slice(nome.lastIndexOf('.') + 1).toLowerCase()
  const achado = Object.values(TIPOS_ACEITOS).find((t) => t.extensao === extensao)
  return achado?.midia ?? 'documento'
}

export async function listarAcervo(clienteId: string): Promise<ArquivoDoAcervo[]> {
  const { data, error } = await db()
    .storage.from(BUCKET_DO_ACERVO)
    .list(clienteId, { sortBy: { column: 'created_at', order: 'desc' }, limit: 200 })

  // Pasta que nunca recebeu arquivo não existe no Storage e a listagem devolve
  // vazio, não erro. Cliente novo cai aqui, e vazio é a resposta certa.
  if (error) throw new Error(`não deu para listar o acervo: ${error.message}`)
  if (!data) return []

  return data
    // O Storage devolve um `.emptyFolderPlaceholder` em pasta esvaziada. Ele
    // não é arquivo de ninguém e não pode aparecer na grade.
    .filter((item) => item.name !== '.emptyFolderPlaceholder')
    .map((item) => {
      const caminho = `${clienteId}/${item.name}`
      const { data: publico } = db().storage.from(BUCKET_DO_ACERVO).getPublicUrl(caminho)
      return {
        caminho,
        nome: item.name,
        url: publico.publicUrl,
        midia: midiaDaExtensao(item.name),
        bytes: Number(item.metadata?.size ?? 0),
        criadoEm: item.created_at ?? '',
      }
    })
}

/**
 * Guarda um arquivo no acervo do cliente.
 *
 * O nome ganha um sufixo aleatório em vez de sobrescrever pelo nome original:
 * dois arquivos chamados `plano.pdf` são o caso comum, e sobrescrever trocaria
 * o PDF de um fluxo publicado sem ninguém pedir. Versão publicada é imutável
 * aqui também — o grafo aponta para uma URL, e essa URL não pode mudar de
 * conteúdo pelas costas.
 */
export async function guardarNoAcervo(
  clienteId: string,
  arquivo: File,
): Promise<ArquivoDoAcervo> {
  const aceito = TIPOS_ACEITOS[arquivo.type]
  if (!aceito) throw new Error('Tipo de arquivo que o WhatsApp não envia.')

  const base = arquivo.name
    .slice(0, arquivo.name.lastIndexOf('.') === -1 ? undefined : arquivo.name.lastIndexOf('.'))
    // Acento e espaço viram %20 na URL e o WhatsApp mostra isso no nome do
    // documento. Normalizar aqui é mais barato do que explicar depois.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .toLowerCase()

  const sufixo = Math.random().toString(36).slice(2, 8)
  const nome = `${base === '' ? 'arquivo' : base}-${sufixo}.${aceito.extensao}`
  const caminho = `${clienteId}/${nome}`

  const { error } = await db()
    .storage.from(BUCKET_DO_ACERVO)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false })

  if (error) throw new Error(error.message)

  const { data } = db().storage.from(BUCKET_DO_ACERVO).getPublicUrl(caminho)
  return {
    caminho,
    nome,
    url: data.publicUrl,
    midia: aceito.midia,
    bytes: arquivo.size,
    criadoEm: new Date().toISOString(),
  }
}

/**
 * Tira um arquivo do acervo.
 *
 * Confere que o caminho começa pela pasta do cliente **antes** de apagar. Sem
 * isso, um caminho vindo do formulário apagaria arquivo de outro cliente — é o
 * mesmo cuidado que as escritas de fluxo já tomam com o par `(fluxo, cliente)`.
 */
export async function apagarDoAcervo(clienteId: string, caminho: string): Promise<void> {
  if (!caminho.startsWith(`${clienteId}/`) || caminho.includes('..')) {
    throw new Error('este arquivo não é deste cliente')
  }

  const { error } = await db().storage.from(BUCKET_DO_ACERVO).remove([caminho])
  if (error) throw new Error(`não deu para apagar o arquivo: ${error.message}`)
}

/**
 * Apaga o acervo inteiro de um cliente.
 *
 * Chamado ao apagar o cliente. Cascata de banco não alcança o Storage — foi
 * exatamente o que aconteceu com a logo, e o acervo é maior e mais pessoal.
 */
export async function apagarAcervoDoCliente(clienteId: string): Promise<void> {
  const arquivos = await listarAcervo(clienteId)
  if (arquivos.length === 0) return

  const { error } = await db()
    .storage.from(BUCKET_DO_ACERVO)
    .remove(arquivos.map((a) => a.caminho))

  // Não estoura: o cliente sair do banco importa mais do que o bucket ficar
  // limpo, e arquivo órfão dá para varrer depois. Mesma escolha da logo.
  if (error) console.error('[acervo] não deu para limpar o acervo do cliente', error.message)
}
