/**
 * Os quadros: em que etapa cada contato está (0032).
 *
 * Puro e sem rede, como todo `core/`. O que mora aqui é a régua — quantas
 * etapas cabem, como se ordena, e o cálculo de "parado há quanto tempo", que é
 * a única informação do quadro que faz alguém agir.
 */

/**
 * As etapas com que um quadro nasce.
 *
 * **Neutras de propósito.** O plano tem uma regra sobre isto, e ela veio de um
 * erro do produto de referência: o empty state deles é um mockup *de
 * imobiliária* ("Visita agendada", "R$600 mil") numa conta de estúdio de
 * pilates. Empty state ensina o negócio de quem está olhando.
 *
 * Estas três descrevem **atendimento**, não um ramo: servem à barbearia, à
 * clínica e ao estúdio igualmente, e a primeira coisa que se espera é que a
 * pessoa as renomeie. Zero etapas seria a outra forma de errar — um quadro que
 * abre morto e exige três cliques antes de mostrar qualquer coisa.
 */
export const ETAPAS_INICIAIS = ['Novo', 'Em conversa', 'Fechado'] as const

/**
 * Quantas etapas cabem num quadro.
 *
 * Oito, e o limite é de tela antes de ser de produto: acima disso as colunas
 * não cabem lado a lado e o quadro vira uma barra de rolagem horizontal, que é
 * exatamente a visão de conjunto que ele existe para dar. Funil com mais de oito
 * etapas também costuma ser dois funis.
 */
export const LIMITE_DE_ETAPAS = 8

/** Tamanho do nome de quadro e de etapa. Cabe no cabeçalho da coluna. */
export const LIMITE_DO_NOME = 32

export type Etapa = {
  id: string
  nome: string
  ordem: number
  /** Só para desempatar `ordem` igual. Ver a 0032 sobre não haver único. */
  criadoEm: string
}

export type Cartao = {
  id: string
  contatoId: string
  colunaId: string
  nome: string
  telefone: string
  entrouNaColunaEm: string
}

/**
 * A ordem das etapas na tela.
 *
 * `ordem` não é única no banco de propósito — trocar duas de lugar com um índice
 * único exige valor temporário e coreografia. O empate é desempatado por
 * `criadoEm`, que é determinístico: duas leituras seguidas nunca devolvem
 * ordens diferentes, que é o que faria a coluna "pular" ao recarregar.
 */
export function etapasEmOrdem(etapas: Etapa[]): Etapa[] {
  return [...etapas].sort((a, b) => a.ordem - b.ordem || a.criadoEm.localeCompare(b.criadoEm))
}

/**
 * Onde uma etapa nova entra.
 *
 * No fim, sempre. Uma etapa nova é quase sempre um passo que faltava depois do
 * último, e inserir no começo empurraria o funil inteiro por causa de um
 * cadastro.
 */
export function proximaOrdem(etapas: Etapa[]): number {
  return etapas.reduce((maior, etapa) => Math.max(maior, etapa.ordem), -1) + 1
}

/**
 * As duas etapas que trocam de lugar quando alguém move uma para o lado.
 *
 * Devolve `null` quando não há para onde ir — é a ponta da lista, e o botão
 * fica desabilitado em vez de sumir. Só as **duas** trocam: renumerar a lista
 * inteira a cada clique reescreveria oito linhas para mover uma.
 */
export function trocaDeLugar(
  etapas: Etapa[],
  etapaId: string,
  direcao: 'esquerda' | 'direita',
): { a: Etapa; b: Etapa } | null {
  const ordenadas = etapasEmOrdem(etapas)
  const indice = ordenadas.findIndex((etapa) => etapa.id === etapaId)
  if (indice === -1) return null

  const vizinho = ordenadas[direcao === 'esquerda' ? indice - 1 : indice + 1]
  if (!vizinho) return null

  return { a: ordenadas[indice]!, b: vizinho }
}

/**
 * Há quantos dias este cartão está parado nesta etapa.
 *
 * Recebe o agora por parâmetro porque data calculada no navegador diverge do que
 * o servidor renderizou — é a divergência de hidratação que já mordeu este
 * projeto na lista de contatos.
 */
export function diasParado(entrouNaColunaEm: string, agora: number = Date.now()): number {
  const inicio = Date.parse(entrouNaColunaEm)
  if (Number.isNaN(inicio)) return 0
  return Math.max(0, Math.floor((agora - inicio) / 86_400_000))
}

/**
 * A partir de quantos dias parado o cartão fica marcado.
 *
 * Três, e o número é uma escolha de produto que vale explicar: dentro da janela
 * de 24h da Meta ainda dá para retomar em texto livre; passados três dias, a
 * conversa acabou e retomar exige um motivo novo. Marcar antes disso pintaria o
 * quadro inteiro de aviso no primeiro fim de semana, e aviso que aparece sempre
 * para de ser lido.
 */
export const DIAS_PARA_MARCAR_PARADO = 3

export function estaParado(entrouNaColunaEm: string, agora: number = Date.now()): boolean {
  return diasParado(entrouNaColunaEm, agora) >= DIAS_PARA_MARCAR_PARADO
}

/** "hoje", "há 1 dia", "há 6 dias" — já formatado no servidor. */
export function comoParado(entrouNaColunaEm: string, agora: number = Date.now()): string {
  const dias = diasParado(entrouNaColunaEm, agora)
  if (dias === 0) return 'hoje'
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`
}

/**
 * A régua de uma etapa nova, antes de o banco ver qualquer coisa.
 *
 * Os índices da 0032 dizem o mesmo; isto existe para a recusa chegar como frase,
 * que é o que a pessoa lê.
 */
export function conferirEtapa(
  nome: string,
  jaExistentes: string[],
): { ok: true; nome: string } | { ok: false; motivo: string } {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'escreva o nome da etapa' }
  if (limpo.length > LIMITE_DO_NOME) {
    return { ok: false, motivo: `o nome cabe em ${LIMITE_DO_NOME} caracteres` }
  }
  if (jaExistentes.some((existente) => existente.trim().toLowerCase() === limpo.toLowerCase())) {
    return { ok: false, motivo: 'já existe uma etapa com este nome' }
  }
  if (jaExistentes.length >= LIMITE_DE_ETAPAS) {
    return {
      ok: false,
      motivo: `um quadro tem no máximo ${LIMITE_DE_ETAPAS} etapas — acima disso elas não cabem lado a lado, e funil maior que isso costuma ser dois funis`,
    }
  }
  return { ok: true, nome: limpo }
}

/** Os cartões de cada etapa, na ordem em que a coluna os mostra. */
export function cartoesPorEtapa(cartoes: Cartao[]): Map<string, Cartao[]> {
  const mapa = new Map<string, Cartao[]>()
  for (const cartao of cartoes) {
    const lista = mapa.get(cartao.colunaId) ?? []
    lista.push(cartao)
    mapa.set(cartao.colunaId, lista)
  }

  // **Quem está parado há mais tempo fica em cima.** A coluna é uma fila de
  // trabalho, e ordenar por chegada esconderia o esquecido no fim dela — que é
  // exatamente a pessoa que o quadro precisa mostrar.
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.entrouNaColunaEm.localeCompare(b.entrouNaColunaEm))
  }
  return mapa
}
