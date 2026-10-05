import { createAvatar } from '@dicebear/core'
import * as personas from '@dicebear/personas'
import { generoDoNome } from '@/core/genero-do-nome'

/**
 * O retrato ilustrado de quem usa o sistema, para quando a pessoa não subiu
 * foto. Ideia que veio do CRM da Oderco (DiceBear semeado pelo nome).
 *
 * **Lá ele foi trocado por iniciais, e o motivo não vale aqui.** O CRM
 * desenhava também o cliente, de quem não sabia o gênero, e um rosto errado
 * num cliente é constrangedor. Aqui é só a equipe, gente que entra no painel,
 * e o primeiro nome dá o palpite (`core/genero-do-nome.ts`). Contato de
 * cliente continua com iniciais (`inbox/avatar.tsx`).
 *
 * **Gerado aqui, não pela API pública do DiceBear.** A semente é o nome da
 * pessoa: pela API, o nome de cada atendente viajaria para um terceiro a cada
 * tela aberta. Gerado no próprio código, nada sai, e funciona sem rede.
 *
 * Mesmo nome, mesmo rosto, em qualquer tela e sessão, sem guardar nada.
 */

const CABELO = {
  feminino: ['long', 'bobCut', 'bobBangs', 'curlyBun', 'straightBun', 'extraLong', 'pigtails', 'bunUndercut'],
  // Sem `curly`: no personas ele é comprido e lia como feminino.
  masculino: ['shortCombover', 'shortComboverChops', 'buzzcut', 'fade', 'curlyHighTop', 'sideShave'],
} as const

/** Só as cores de cabelo naturais: rosa, lilás e o branco (que envelhece) destoam. */
const COR_DO_CABELO = ['362c47', '6c4545', 'f27d65', 'f29c65']

/**
 * Rosto de quem está trabalhando: olhos abertos e sorriso. Fora ficam chupeta,
 * óculos escuros, olho fechado, careta e boca de susto, que o estilo sorteia
 * e que num cabeçalho de painel parecem piada.
 */
const OLHOS = ['open', 'happy', 'glasses']
const BOCA = ['smile', 'bigSmile', 'lips']

/** Fundos claros, da família do `primary-weak`, para o rosto não brigar com selo colorido ao lado. */
const FUNDOS = ['dbe6ff', 'dff3ef', 'ece6f8', 'fde8da', 'fbe4ea']

const cache = new Map<string, string>()

export function retratoDe(nome: string): string {
  const chave = nome.trim().toLowerCase()
  const pronto = cache.get(chave)
  if (pronto) return pronto

  const genero = generoDoNome(nome)
  const uri = createAvatar(personas, {
    seed: chave,
    hair: [...CABELO[genero]],
    hairColor: COR_DO_CABELO,
    eyes: OLHOS as personas.Options['eyes'],
    mouth: BOCA as personas.Options['mouth'],
    facialHairProbability: genero === 'feminino' ? 0 : 35,
    backgroundColor: FUNDOS,
  }).toDataUri()

  cache.set(chave, uri)
  return uri
}
