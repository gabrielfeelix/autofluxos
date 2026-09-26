/**
 * Os materiais da conta (0106): o cardápio em PDF e em imagem.
 *
 * ---------------------------------------------------------------------------
 * O arquivo inteiro, e não o item
 * ---------------------------------------------------------------------------
 *
 * O catálogo responde "quanto custa a calabresa"; o material responde "me
 * manda o cardápio". São perguntas diferentes, e a segunda não se responde com
 * quinze cards: quem pede o cardápio quer a folha que já conhece, com a cara
 * da casa, para ler no próprio ritmo. Um de cada tipo por conta (o `unique`
 * da 0106), porque "o cardápio" é um só.
 *
 * O arquivo em si mora no acervo (`autofluxos-acervo`, pasta da conta); aqui
 * fica só o endereço e o nome que o cliente vê ao receber. O bot manda pelo
 * mesmo caminho dos cards da loja (`server/efeitos/resolver.ts`, ferramenta
 * `enviar_cardapio`), sem o arquivo passar pelo modelo.
 *
 * Puro e sem rede. Quem grava é `server/repos/materiais.ts`.
 */

import type { Acao } from './engine/types'

export const TIPOS_DE_MATERIAL = ['cardapio-pdf', 'cardapio-imagem'] as const

export type TipoDeMaterial = (typeof TIPOS_DE_MATERIAL)[number]

export function ehTipoDeMaterial(valor: unknown): valor is TipoDeMaterial {
  return typeof valor === 'string' && (TIPOS_DE_MATERIAL as readonly string[]).includes(valor)
}

export type Material = {
  tipo: TipoDeMaterial
  /** Só `https://`, o banco recusa o resto. */
  url: string
  /** O nome que aparece no WhatsApp. Só o PDF usa; `null` = o nome padrão. */
  nomeArquivo: string | null
  atualizadoEm: string
}

/** Os tipos de arquivo de cada material. Subconjunto do que o acervo aceita. */
export const MIME_DO_MATERIAL: Record<TipoDeMaterial, readonly string[]> = {
  'cardapio-pdf': ['application/pdf'],
  'cardapio-imagem': ['image/png', 'image/jpeg', 'image/webp'],
}

/** Como a tela chama cada material. */
export const NOME_DO_MATERIAL: Record<TipoDeMaterial, string> = {
  'cardapio-pdf': 'Cardápio em PDF',
  'cardapio-imagem': 'Cardápio em imagem',
}

/** O nome do documento quando o dono não escolheu outro. */
export const NOME_PADRAO_DO_PDF = 'Cardápio.pdf'

export type ConferenciaDeMaterial =
  | { ok: true; url: string; nomeArquivo: string | null }
  | { ok: false; motivo: string }

/**
 * O endereço e o nome servem?
 *
 * O nome do PDF ganha `.pdf` se faltar: sem a extensão, o WhatsApp de alguns
 * celulares oferece "abrir com" em vez de abrir o PDF direto. A imagem não
 * tem nome que alguém veja, então o nome dela é descartado.
 */
export function conferirMaterial(tipo: TipoDeMaterial, urlBruta: string, nomeBruto: string): ConferenciaDeMaterial {
  const url = urlBruta.trim()
  let lida: URL
  try {
    lida = new URL(url)
  } catch {
    return { ok: false, motivo: 'o endereço do arquivo precisa começar com https://' }
  }
  // `new URL` aceita "https:site.com"; o banco (0106) exige as barras.
  if (lida.protocol !== 'https:' || !url.startsWith('https://')) {
    return { ok: false, motivo: 'o endereço do arquivo precisa começar com https://' }
  }
  if (url.length > 2000) return { ok: false, motivo: 'o endereço do arquivo é longo demais' }

  if (tipo === 'cardapio-imagem') return { ok: true, url, nomeArquivo: null }

  const nome = nomeBruto.trim().replace(/\s+/g, ' ')
  if (nome === '') return { ok: true, url, nomeArquivo: null }
  const comExtensao = /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`
  if (comExtensao.length > 120) return { ok: false, motivo: 'o nome do arquivo precisa ter até 120 caracteres' }
  return { ok: true, url, nomeArquivo: comExtensao }
}

type EnvioDeMidia = Extract<Acao, { tipo: 'enviar_midia' }>

/**
 * O que o bot manda quando pedem o cardápio: a imagem primeiro, o PDF depois.
 *
 * A imagem abre na própria conversa e responde na hora; o PDF é para quem
 * quer guardar ou ampliar. Nessa ordem, quem só olha a primeira já tem o
 * cardápio. Sem legenda de propósito: a frase da IA vem logo antes, e uma
 * legenda escrita aqui repetiria o que ela acabou de dizer.
 */
export function envioDoCardapio(materiais: readonly Material[]): EnvioDeMidia[] {
  const imagem = materiais.find((m) => m.tipo === 'cardapio-imagem')
  const pdf = materiais.find((m) => m.tipo === 'cardapio-pdf')
  return [
    ...(imagem ? [{ tipo: 'enviar_midia' as const, midia: 'imagem' as const, url: imagem.url }] : []),
    ...(pdf
      ? [
          {
            tipo: 'enviar_midia' as const,
            midia: 'documento' as const,
            url: pdf.url,
            nomeArquivo: pdf.nomeArquivo ?? NOME_PADRAO_DO_PDF,
          },
        ]
      : []),
  ]
}
