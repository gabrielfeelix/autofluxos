import { createAvatar } from '@dicebear/core'
import * as bottts from '@dicebear/bottts'
import * as thumbs from '@dicebear/thumbs'

/**
 * O retrato ilustrado de quem usa o sistema, para quando a pessoa não subiu
 * foto. Estilo Bottts do DiceBear, escolha do Gabriel (05/out), no lugar do
 * Personas: robôs não pedem palpite de gênero pelo nome, que o Personas
 * precisava para escolher cabelo.
 *
 * **Gerado aqui, não pela API pública do DiceBear.** A semente é o nome da
 * pessoa: pela API, o nome de cada atendente viajaria para um terceiro a cada
 * tela aberta. Gerado no próprio código, nada sai, e funciona sem rede.
 *
 * Mesmo nome, mesmo rosto, em qualquer tela e sessão, sem guardar nada.
 * Contato de cliente tem o dele, em outro estilo (`retratoDoContato`).
 */

/** Fundos claros, da família do `primary-weak`, para o rosto não brigar com selo colorido ao lado. */
const FUNDOS = ['dbe6ff', 'dff3ef', 'ece6f8', 'fde8da', 'fbe4ea']

const cache = new Map<string, string>()

export function retratoDe(semente: string): string {
  const chave = semente.trim().toLowerCase()
  const pronto = cache.get(chave)
  if (pronto) return pronto

  const uri = createAvatar(bottts, { seed: chave, backgroundColor: FUNDOS }).toDataUri()
  cache.set(chave, uri)
  return uri
}

const cacheDoContato = new Map<string, string>()

/**
 * O retrato de um contato de cliente, no lugar das iniciais (04/nov/2026).
 *
 * Estilo Thumbs, e não o Bottts da equipe: robô é quem trabalha no sistema, e
 * cliente com cara de robô confundiria quem atende com quem é atendido, numa
 * fila em que o bot ainda escreve "chatbot:". Mesma regra de semente: gerado
 * aqui, nada sai para terceiro.
 */
export function retratoDoContato(semente: string): string {
  const chave = semente.trim().toLowerCase()
  const pronto = cacheDoContato.get(chave)
  if (pronto) return pronto

  const uri = createAvatar(thumbs, { seed: chave, backgroundColor: FUNDOS }).toDataUri()
  cacheDoContato.set(chave, uri)
  return uri
}

/**
 * O avatar escolhido na galeria mora no mesmo campo da foto (`image` do
 * usuário), como `avatar:<semente>`. Assim nenhuma tabela nova, e toda tela
 * que já mostra a foto passa a mostrar o avatar escolhido pelo `Avatar`.
 */
export const PREFIXO_DO_AVATAR = 'avatar:'

/**
 * As sementes da galeria de Você. Fixas, e não sorteadas: quem escolheu o
 * robô azul ontem acha o mesmo robô azul hoje, e o servidor só aceita estas.
 */
export const SEMENTES_DA_GALERIA = [
  'atlas', 'bento', 'cora', 'dante', 'eco', 'fiona',
  'gaia', 'hugo', 'iris', 'juno', 'kai', 'luna',
  'milo', 'nina', 'otto', 'pixel', 'quartzo', 'rubi',
] as const

/** O que o `src` de uma imagem deve ser: foto, avatar escolhido ou o gerado pelo nome. */
export function fonteDoRetrato(imagem: string | null | undefined, nome: string): string {
  if (imagem?.startsWith(PREFIXO_DO_AVATAR)) return retratoDe(imagem.slice(PREFIXO_DO_AVATAR.length))
  return imagem || retratoDe(nome)
}
