import { casarGatilho } from './gatilhos'

/**
 * Resposta automática a comentário do Instagram.
 *
 * Quem comenta num post recebe uma mensagem no direct, e opcionalmente uma
 * resposta pública no comentário. A regra diz em qual post (ou todos) e com
 * quais palavras (ou qualquer comentário).
 */
export type RespostaAComentario = {
  id: string
  /** Vazia: qualquer comentário serve. */
  palavras: string[]
  /** Nulo: vale para todos os posts. */
  postId: string | null
  ativo: boolean
}

/** O que a tela aceita, conferido também no servidor. */
export const LIMITES_DO_COMENTARIO = {
  palavras: 10,
  palavra: 40,
  mensagem: 1000,
  respostaPublica: 300,
} as const

/**
 * Lê o campo de palavras como a pessoa escreve: separadas por vírgula ou por
 * linha. Repetida sai, vazia sai, e a ordem de quem escreveu fica.
 */
export function lerPalavras(texto: string): string[] {
  const vistas = new Set<string>()
  const palavras: string[] = []
  for (const parte of texto.split(/[,\n]/)) {
    const palavra = parte.trim().replace(/\s+/g, ' ').slice(0, LIMITES_DO_COMENTARIO.palavra)
    const chave = palavra.toLocaleLowerCase('pt-BR')
    if (palavra === '' || vistas.has(chave)) continue
    vistas.add(chave)
    palavras.push(palavra)
  }
  return palavras
}

/**
 * Qual resposta este comentário dispara, ou nenhuma.
 *
 * A regra mais específica ganha, e a ordem de cadastro só desempata no fim,
 * pelo mesmo motivo de `casarGatilho`: cadastrar primeiro não é argumento.
 *
 * 1. a do post exato antes da de "todos os posts";
 * 2. a que tem palavra antes da de "qualquer comentário";
 * 3. a palavra mais longa que casou, que é a mais específica;
 * 4. a ordem recebida.
 *
 * O casamento é o das palavras-chave: palavra inteira, sem acento, sem
 * diferença de maiúscula. `pix` não dispara em "pixel".
 */
export function escolherResposta<T extends RespostaAComentario>(
  respostas: T[],
  comentario: { postId: string; texto: string },
): T | null {
  const candidatas: { resposta: T; doPost: boolean; peso: number; ordem: number }[] = []

  respostas.forEach((resposta, ordem) => {
    if (!resposta.ativo) return
    if (resposta.postId !== null && resposta.postId !== comentario.postId) return

    const doPost = resposta.postId !== null
    if (resposta.palavras.length === 0) {
      candidatas.push({ resposta, doPost, peso: -1, ordem })
      return
    }

    const casou = casarGatilho(
      resposta.palavras.map((frase, i) => ({
        id: String(i),
        frase,
        operador: 'contem' as const,
        fluxoId: '',
        ativo: true,
        execucoes: 0,
      })),
      comentario.texto,
    )
    if (casou) candidatas.push({ resposta, doPost, peso: casou.frase.trim().length, ordem })
  })

  candidatas.sort(
    (a, b) =>
      Number(b.doPost) - Number(a.doPost) ||
      Number(b.peso >= 0) - Number(a.peso >= 0) ||
      b.peso - a.peso ||
      a.ordem - b.ordem,
  )
  return candidatas[0]?.resposta ?? null
}
