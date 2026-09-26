/**
 * A ficha do assistente de IA (PLANO-NICHOS 1.7).
 *
 * ---------------------------------------------------------------------------
 * O problema
 * ---------------------------------------------------------------------------
 *
 * O que a IA sabe do negócio é uma caixa de texto livre (`contexto_negocio`).
 * Na PCYES e na MGM funciona porque o texto foi escrito em blocos
 * (`== ONDE FICA ==`, `== PAGAMENTO ==`...) por quem sabe o que o cliente
 * final pergunta. O dono de uma pizzaria não sabe, e o bot dele responde "não
 * sei" a tudo.
 *
 * ---------------------------------------------------------------------------
 * A saída: perguntar pelo ramo, e gravar no mesmo texto
 * ---------------------------------------------------------------------------
 *
 * A ficha faz as perguntas que o cliente final sempre faz naquele ramo e
 * **escreve o mesmo texto em blocos** que a PCYES e a MGM já usam. O texto
 * continua sendo o único lugar gravado e o único que a IA lê: nenhuma coluna
 * nova, nenhuma mudança no caminho da resposta, e quem já escreveu em blocos
 * abre a ficha preenchida.
 *
 * Ler e escrever sem mexer: um bloco que a ficha reconhece guarda o título que
 * o dono escreveu ("HORÁRIOS DE FUNCIONAMENTO", e não o nosso "HORÁRIO"), e um
 * bloco que ela não reconhece vai inteiro, com título, para "Mais alguma
 * coisa". Abrir e salvar sem mudar nada devolve os mesmos blocos, com as
 * perguntas do ramo primeiro; nada se perde (há teste).
 *
 * Puro, sem banco e sem React.
 */

export type PerguntaDaFicha = {
  id: string
  /** O título do bloco quando a ficha escreve um novo. */
  titulo: string
  /**
   * Como o título pode começar, sem acento e em minúsculas: "horario" pega
   * "HORÁRIO DO TIME" e "HORÁRIOS DE FUNCIONAMENTO". O primeiro bloco que bate
   * é o da pergunta.
   */
  comeca: string[]
  /** A pergunta para o dono, na tela. */
  pergunta: string
  /** Exemplo de resposta, no campo vazio. */
  exemplo: string
  /** Como o cliente final pergunta isso: é o que o botão Testar manda. */
  doCliente: string
}

/** Uma lista de marcar: o que o assistente pode, nunca faz, e quando passa. */
export type ListaDaFicha = {
  id: 'pode' | 'nunca' | 'passar'
  titulo: string
  rotulo: string
  opcoes: { texto: string; travada?: true }[]
}

/**
 * As listas de marcar do ramo: "pode fazer" vem do pacote, porque o estúdio
 * não mostra catálogo e a loja não marca aula; as outras duas são iguais para
 * todos.
 */
export function listasDoRamo(pode: readonly string[]): ListaDaFicha[] {
  return LISTAS_DA_FICHA.map((lista) =>
    lista.id === 'pode' ? { ...lista, opcoes: pode.map((texto) => ({ texto })) } : lista,
  )
}

/** Para acento e caixa não decidirem se o bloco é o mesmo. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export const LISTAS_DA_FICHA: ListaDaFicha[] = [
  {
    id: 'pode',
    titulo: 'O QUE O ASSISTENTE PODE FAZER',
    rotulo: 'O que o assistente pode fazer',
    opcoes: [
      { texto: 'Tirar dúvidas com o que está nesta ficha' },
      { texto: 'Mostrar produtos, fotos e preços do catálogo' },
      { texto: 'Ajudar a montar um pedido' },
      { texto: 'Informar horário e endereço' },
    ],
  },
  {
    id: 'nunca',
    titulo: 'O QUE O ASSISTENTE NUNCA FAZ',
    rotulo: 'O que ele nunca faz',
    opcoes: [
      // As duas primeiras são de segurança: o dono não desmarca.
      { texto: 'Pedir número de cartão, senha ou código', travada: true },
      { texto: 'Prometer desconto ou condição que não está nesta ficha', travada: true },
      { texto: 'Confirmar estoque, vaga ou horário sem consultar' },
      { texto: 'Falar de concorrentes' },
    ],
  },
  {
    id: 'passar',
    titulo: 'QUANDO PASSAR PARA UMA PESSOA',
    rotulo: 'Quando passar para uma pessoa',
    opcoes: [
      { texto: 'Reclamação' },
      { texto: 'Pedido de reembolso ou cancelamento' },
      { texto: 'Pergunta que não está nesta ficha' },
      { texto: 'Quando pedirem para falar com alguém' },
    ],
  },
]

/** Um bloco do texto: título (nulo na abertura, antes do primeiro) e corpo. */
type Bloco = { titulo: string | null; corpo: string }

const TITULO = /^==\s*(.+?)\s*==\s*$/

/** Separa o texto nos blocos `== TÍTULO ==`, na ordem em que aparecem. */
export function lerBlocos(texto: string): Bloco[] {
  const blocos: Bloco[] = [{ titulo: null, corpo: '' }]
  const linhas: string[][] = [[]]
  for (const linha of texto.replace(/\r\n/g, '\n').split('\n')) {
    const titulo = TITULO.exec(linha)
    if (titulo) {
      blocos.push({ titulo: titulo[1]!, corpo: '' })
      linhas.push([])
    } else linhas[linhas.length - 1]!.push(linha)
  }
  return blocos.map((bloco, i) => ({ ...bloco, corpo: linhas[i]!.join('\n').trim() }))
}

function escreverBloco(bloco: Bloco): string {
  if (bloco.titulo === null) return bloco.corpo
  return bloco.corpo ? `== ${bloco.titulo} ==\n${bloco.corpo}` : ''
}

export type Ficha = {
  /** A frase de abertura, antes do primeiro bloco: "Somos a X, ...". */
  abertura: string
  /** Resposta por id de pergunta, com o título do bloco que ela usa. */
  respostas: Record<string, { titulo: string; texto: string }>
  /** O que está marcado em cada lista. `null` = a lista não existe no texto. */
  listas: Record<ListaDaFicha['id'], string[] | null>
  /** Blocos que a ficha não reconhece, inteiros, com título. */
  mais: string
}

function achaPergunta(titulo: string, perguntas: readonly PerguntaDaFicha[], usadas: Set<string>) {
  const t = normalizar(titulo)
  return perguntas.find((p) => !usadas.has(p.id) && p.comeca.some((inicio) => t.startsWith(inicio)))
}

/**
 * Lê o texto da IA como ficha do ramo.
 *
 * Uma lista só é lida como lista se todas as linhas forem itens `- texto`; um
 * bloco com o mesmo título escrito à mão, em prosa, vai para "mais" e não se
 * perde.
 */
export function lerFicha(texto: string, perguntas: readonly PerguntaDaFicha[]): Ficha {
  const ficha: Ficha = { abertura: '', respostas: {}, listas: { pode: null, nunca: null, passar: null }, mais: '' }
  const mais: string[] = []
  const usadas = new Set<string>()
  for (const bloco of lerBlocos(texto)) {
    if (bloco.titulo === null) {
      ficha.abertura = bloco.corpo
      continue
    }
    const lista = LISTAS_DA_FICHA.find((l) => normalizar(l.titulo) === normalizar(bloco.titulo!))
    const itens = bloco.corpo.split('\n').filter((linha) => linha.trim() !== '')
    if (lista && ficha.listas[lista.id] === null && itens.every((linha) => /^\s*-\s+/.test(linha))) {
      ficha.listas[lista.id] = itens.map((linha) => linha.replace(/^\s*-\s+/, '').trim())
      continue
    }
    const pergunta = achaPergunta(bloco.titulo, perguntas, usadas)
    if (pergunta) {
      usadas.add(pergunta.id)
      ficha.respostas[pergunta.id] = { titulo: bloco.titulo, texto: bloco.corpo }
      continue
    }
    mais.push(escreverBloco(bloco))
  }
  ficha.mais = mais.filter(Boolean).join('\n\n')
  return ficha
}

/**
 * Escreve a ficha de volta no texto em blocos que a IA lê.
 *
 * Ordem: abertura, as perguntas do ramo na ordem do pacote, as três listas, e
 * "mais" no fim. Pergunta sem resposta não vira bloco vazio: bloco vazio é
 * ruído no prompt.
 */
export function escreverFicha(ficha: Ficha, perguntas: readonly PerguntaDaFicha[]): string {
  const partes: string[] = [ficha.abertura.trim()]
  for (const pergunta of perguntas) {
    const resposta = ficha.respostas[pergunta.id]
    if (resposta?.texto.trim()) partes.push(escreverBloco({ titulo: resposta.titulo || pergunta.titulo, corpo: resposta.texto.trim() }))
  }
  for (const lista of LISTAS_DA_FICHA) {
    const marcadas = ficha.listas[lista.id]
    if (marcadas && marcadas.length > 0) partes.push(escreverBloco({ titulo: lista.titulo, corpo: marcadas.map((item) => `- ${item}`).join('\n') }))
  }
  partes.push(ficha.mais.trim())
  return partes.filter(Boolean).join('\n\n')
}

/**
 * O que está marcado numa lista para a tela: o gravado, ou todas as opções se
 * a lista ainda não existe (as caixas nascem marcadas, PLANO 1.7). A opção
 * travada entra sempre.
 */
export function marcadasDaLista(lista: ListaDaFicha, gravadas: string[] | null): string[] {
  const base = gravadas ?? lista.opcoes.map((opcao) => opcao.texto)
  const travadas = lista.opcoes.filter((opcao) => opcao.travada).map((opcao) => opcao.texto)
  return [...travadas.filter((texto) => !base.includes(texto)), ...base]
}

/** "O assistente responde 8 de 10": quantas perguntas do ramo têm resposta. */
export function placarDaFicha(ficha: Ficha, perguntas: readonly PerguntaDaFicha[]) {
  const faltam = perguntas.filter((p) => !ficha.respostas[p.id]?.texto.trim())
  return { respondidas: perguntas.length - faltam.length, total: perguntas.length, faltam }
}
