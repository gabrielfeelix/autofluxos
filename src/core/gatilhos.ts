import { normalizar } from './engine/interpolar'

/**
 * Palavra-chave → fluxo.
 *
 * O motor (`core/engine/executar.ts`) já tem um escape global: uma lista fixa
 * de frases que tiram a pessoa de qualquer nó e a levam para um atendente.
 * Isto aqui é a mesma ideia entregue ao cliente — ele escreve as frases dele e
 * escolhe para onde cada uma leva.
 *
 * Puro, e pelo mesmo motivo que `core/horario.ts` é puro: quem lê o banco é o
 * servidor, e a decisão de qual frase casa com qual gatilho tem que ser
 * testável sem rede e idêntica no simulador e na produção.
 */

export const OPERADORES_DE_GATILHO = ['igual', 'contem'] as const

export type OperadorDeGatilho = (typeof OPERADORES_DE_GATILHO)[number]

/** Como a tela chama cada operador. Um lugar só, para as duas não divergirem. */
export const ROTULO_DO_OPERADOR: Record<OperadorDeGatilho, string> = {
  igual: 'É',
  contem: 'Contém',
}

export type Gatilho = {
  id: string
  frase: string
  operador: OperadorDeGatilho
  /** Para onde a conversa vai quando esta frase casa. */
  fluxoId: string
  ativo: boolean
  execucoes: number
}

/**
 * Qual gatilho esta mensagem dispara — ou nenhum.
 *
 * **A ordem do desempate não é a de cadastro.** Duas regras podem casar com a
 * mesma frase ("cancelar" contém, "cancelar assinatura" contém), e cadastrar
 * primeiro não é argumento nenhum para ganhar. Ganha, nesta ordem:
 *
 * 1. `igual` antes de `contem` — quem escreveu a frase inteira disse mais;
 * 2. a frase mais longa — é a mais específica das que casaram;
 * 3. a mais antiga, só para o resultado nunca depender da ordem que o banco
 *    devolveu. Empate que muda de resposta entre duas execuções é o pior tipo
 *    de defeito: ele some quando você vai olhar.
 */
export function casarGatilho(gatilhos: Gatilho[], texto: string): Gatilho | null {
  const alvo = normalizar(texto)
  if (alvo === '') return null

  const casaram = gatilhos.filter((g) => g.ativo && casa(g, alvo))
  if (casaram.length === 0) return null

  return casaram.sort(desempatar)[0]!
}

function casa(gatilho: Gatilho, alvo: string): boolean {
  const frase = normalizar(gatilho.frase)
  if (frase === '') return false

  return gatilho.operador === 'igual' ? alvo === frase : contemPalavra(alvo, frase)
}

function desempatar(a: Gatilho, b: Gatilho): number {
  if (a.operador !== b.operador) return a.operador === 'igual' ? -1 : 1
  return b.frase.trim().length - a.frase.trim().length
}

/**
 * `contem` é "contém a palavra", e não "contém as letras".
 *
 * Substring cru transformaria o gatilho `sim` num gatilho que dispara em
 * "assim", "simples" e "simpatia" — e o cliente que cadastrou isso jamais
 * ligaria a causa ao efeito, porque a tela dele diz `sim` e a conversa foi
 * parar noutro fluxo. Exigir borda de palavra dos dois lados custa nada e
 * elimina a classe inteira desses enganos.
 *
 * A varredura é manual, sem montar expressão regular com o que a pessoa
 * digitou: `.` e `(` numa frase virariam sintaxe em vez de texto, e o caso
 * ruim não é o gatilho que não casa — é o que estoura no meio do webhook.
 */
function contemPalavra(alvo: string, frase: string): boolean {
  for (let i = alvo.indexOf(frase); i !== -1; i = alvo.indexOf(frase, i + 1)) {
    if (!ehLetraOuNumero(alvo[i - 1]) && !ehLetraOuNumero(alvo[i + frase.length])) return true
  }
  return false
}

/** Fim de texto conta como borda: `undefined` não é letra. */
function ehLetraOuNumero(caractere: string | undefined): boolean {
  return caractere !== undefined && /[\p{L}\p{N}]/u.test(caractere)
}
