import { normalizar } from './engine/interpolar'

/**
 * A frase do anúncio → o fluxo (0027).
 *
 * Puro, como `core/gatilhos.ts`, e pelo mesmo motivo: quem lê o banco é o
 * servidor, e a decisão de qual frase casa com qual campanha tem que ser
 * testável sem rede e idêntica no simulador e na produção.
 */

export type Campanha = {
  id: string
  nome: string
  frase: string
  fluxoId: string
  ativa: boolean
  execucoes: number
}

/**
 * O que sobra de uma frase antes de comparar.
 *
 * **A pontuação do fim some, e é isso que resolve o problema real.** O produto
 * de onde o desenho veio pede ao anunciante que não termine a frase com ponto,
 * exclamação ou interrogação — porque o WhatsApp às vezes os remove no caminho.
 * Pedir isso é empurrar um detalhe da plataforma para quem está anunciando, e
 * ele vai esquecer: o anúncio já está no ar, o dinheiro já está sendo gasto, e
 * a conversa cai no fluxo errado sem ninguém entender por quê.
 *
 * Espaço repetido some pelo mesmo motivo: teclado de celular põe dois espaços
 * sozinho, e "quero saber  mais" não pode deixar de ser "quero saber mais".
 */
export function fraseComparavel(bruto: string): string {
  return normalizar(bruto)
    .replace(/[.!?…]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
}

/**
 * Qual campanha esta mensagem abre — ou nenhuma.
 *
 * **Casa com a mensagem inteira, nunca com um pedaço.** A frase de campanha é
 * longa e específica ("Quero saber mais sobre o plano trimestral"), e ela chega
 * pré-preenchida pelo anúncio: se a pessoa apagou parte e escreveu outra coisa,
 * ela não está mais respondendo ao anúncio. É a diferença entre campanha e
 * gatilho, e é por isso que campanha decide primeiro: um `contem` do cliente
 * não pode sequestrar a porta de entrada que ele está pagando para manter
 * aberta.
 */
export function casarCampanha(campanhas: Campanha[], texto: string): Campanha | null {
  const alvo = fraseComparavel(texto)
  if (alvo === '') return null

  return (
    campanhas.find((campanha) => campanha.ativa && fraseComparavel(campanha.frase) === alvo) ?? null
  )
}
