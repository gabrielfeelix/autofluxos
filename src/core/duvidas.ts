/**
 * As dúvidas do atendimento: o que o cliente final pergunta, em que categoria,
 * e quem respondeu.
 *
 * ---------------------------------------------------------------------------
 * Por que categoria fixa e tema livre
 * ---------------------------------------------------------------------------
 *
 * Os dois jeitos do mercado, juntos. O Zendesk dá uma lista pronta por ramo
 * (e-commerce, seguros, viagens); o Intercom descobre os temas agrupando
 * perguntas parecidas. A lista fixa é o que deixa comparar um mês com o
 * outro: se cada conversa inventasse a própria categoria, nada se somaria. O
 * tema livre é o que diz a dúvida de verdade ("prazo de entrega para o
 * interior"), que lista nenhuma prevê.
 *
 * O tema só agrupa se o nome se repetir, então a classificação recebe os temas
 * que a conta já tem e é instruída a reaproveitá-los. Juntar e renomear à mão
 * (apelidos) corrige o que ainda escapar.
 *
 * Puro, sem banco e sem React.
 */
import type { Nicho } from './nichos'

export const RESOLVIDA_POR = ['ia', 'equipe', 'ninguem'] as const
export type ResolvidaPor = (typeof RESOLVIDA_POR)[number]

export const ROTULO_DE_QUEM_RESOLVEU: Record<ResolvidaPor, string> = {
  ia: 'IA respondeu',
  equipe: 'Equipe respondeu',
  ninguem: 'Sem resposta',
}

const OUTROS = 'Outros'

/** As categorias do ramo. A última é sempre "Outros", para nada ficar sem casa. */
const CATEGORIAS: Record<Nicho | 'padrao', readonly string[]> = {
  aulas: [
    'Planos e preço',
    'Horários e turmas',
    'Aula experimental',
    'Reposição e falta',
    'Pagamento',
    'Localização',
    OUTROS,
  ],
  ecommerce: [
    'Preço e promoção',
    'Prazo e frete',
    'Pedido e rastreio',
    'Troca e devolução',
    'Pagamento',
    'Produto e estoque',
    OUTROS,
  ],
  restaurante: [
    'Cardápio e preço',
    'Entrega e taxa',
    'Horário de funcionamento',
    'Pedido em andamento',
    'Pagamento',
    'Reserva',
    OUTROS,
  ],
  comercio: [
    'Preço',
    'Produto e estoque',
    'Horário e endereço',
    'Pagamento',
    'Entrega',
    'Troca e garantia',
    OUTROS,
  ],
  padrao: [
    'Preço',
    'Prazo e entrega',
    'Pagamento',
    'Produto ou serviço',
    'Horário e localização',
    'Pedido e andamento',
    'Troca e cancelamento',
    OUTROS,
  ],
}

export function categoriasDoRamo(nicho: Nicho | null | undefined): readonly string[] {
  return CATEGORIAS[nicho ?? 'padrao'] ?? CATEGORIAS.padrao
}

/**
 * A chave que junta a mesma pergunta escrita de jeitos quase iguais: "Qual o
 * horário?" e "qual o horario" são uma linha só, com contagem 2.
 */
export function chaveDaPergunta(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Ensinar a resposta
// ---------------------------------------------------------------------------

/** O bloco do texto da IA onde caem as respostas ensinadas pelo relatório. */
export const TITULO_DAS_ENSINADAS = 'PERGUNTAS RESPONDIDAS PELA EQUIPE'

const TITULO = /^==\s*(.+?)\s*==\s*$/

/**
 * Acrescenta pergunta e resposta ao texto que a IA lê, no bloco
 * `== PERGUNTAS RESPONDIDAS PELA EQUIPE ==`, criado no fim se não existir.
 *
 * No mesmo formato de blocos da ficha do assistente: a ficha preserva bloco
 * que não reconhece (vai para "Mais alguma coisa"), então ensinar daqui não
 * desmonta a ficha de quem usa uma.
 */
export function ensinarResposta(texto: string, pergunta: string, resposta: string): string {
  const par = `Pergunta: ${pergunta.trim()}\nResposta: ${resposta.trim()}`
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  const inicio = linhas.findIndex((linha) => {
    const t = TITULO.exec(linha)
    return t !== null && t[1]!.trim().toUpperCase() === TITULO_DAS_ENSINADAS
  })

  if (inicio === -1) {
    const base = texto.trimEnd()
    return `${base}${base ? '\n\n' : ''}== ${TITULO_DAS_ENSINADAS} ==\n${par}\n`
  }

  // O fim do bloco é o próximo título, ou o fim do texto.
  let fim = linhas.length
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (TITULO.test(linhas[i]!)) {
      fim = i
      break
    }
  }
  const corpo = linhas.slice(inicio + 1, fim).join('\n').trim()
  const novo = [`== ${TITULO_DAS_ENSINADAS} ==`, corpo ? `${corpo}\n\n${par}` : par]
  const depois = linhas.slice(fim).join('\n').trim()
  return [linhas.slice(0, inicio).join('\n').trimEnd(), novo.join('\n'), depois]
    .filter((parte) => parte !== '')
    .join('\n\n')
    .concat('\n')
}

// ---------------------------------------------------------------------------
// A classificação
// ---------------------------------------------------------------------------

export type FalaDaConversa = { quem: 'cliente' | 'ia' | 'equipe'; texto: string; em: string }

export type ConversaParaClassificar = { id: string; falas: FalaDaConversa[] }

export type DuvidaClassificada = {
  conversa: string
  categoria: string
  tema: string
  pergunta: string
  resolvidaPor: ResolvidaPor
  /** O instante da fala do cliente que fez a pergunta. */
  em: string
}

const QUEM: Record<FalaDaConversa['quem'], string> = { cliente: 'CLIENTE', ia: 'IA', equipe: 'EQUIPE' }

/**
 * O pedido para o modelo. As falas vão numeradas por conversa, e o modelo
 * devolve o número da fala da pergunta: é daí que sai o instante, sem confiar
 * em data escrita pelo modelo.
 */
export function pedidoDeClassificacao(
  conversas: readonly ConversaParaClassificar[],
  categorias: readonly string[],
  temasConhecidos: readonly { categoria: string; tema: string }[],
): string {
  const temas = temasConhecidos.length
    ? temasConhecidos.map((t) => `- ${t.categoria} / ${t.tema}`).join('\n')
    : '(nenhum ainda)'

  const corpo = conversas
    .map(
      (conversa) =>
        `### CONVERSA ${conversa.id}\n` +
        conversa.falas.map((fala, i) => `${i + 1}. ${QUEM[fala.quem]}: ${fala.texto.replace(/\s+/g, ' ').slice(0, 400)}`).join('\n'),
    )
    .join('\n\n')

  return [
    'Você analisa conversas de atendimento de uma empresa e extrai as DÚVIDAS do cliente.',
    'Dúvida é uma pergunta ou pedido de informação do cliente sobre a empresa, seus produtos ou serviços.',
    'Não é dúvida: cumprimento, agradecimento, "ok", envio de dado pedido (nome, CPF, endereço), reclamação sem pergunta.',
    '',
    'Para cada dúvida, devolva:',
    `- "categoria": exatamente uma destas: ${categorias.join(' | ')}`,
    '- "tema": 2 a 6 palavras em português, minúsculas, que nomeiam o assunto de forma genérica (ex.: "prazo de entrega para o interior"). REAPROVEITE um tema conhecido sempre que for o mesmo assunto, escrito exatamente igual.',
    '- "pergunta": a dúvida reescrita em uma frase curta, sem nome, telefone, e-mail, CPF, endereço ou número de pedido.',
    '- "resolvida_por": "ia" se a IA respondeu a dúvida; "equipe" se alguém da EQUIPE respondeu; "ninguem" se ficou sem resposta ou a IA só disse que ia passar para alguém.',
    '- "fala": o número da fala do CLIENTE onde a dúvida aparece.',
    '- "conversa": o id da conversa.',
    '',
    'Uma dúvida repetida na mesma conversa conta uma vez só. Conversa sem dúvida não gera nada.',
    'Responda só JSON: {"duvidas": [ ... ]}',
    '',
    'TEMAS CONHECIDOS:',
    temas,
    '',
    corpo,
  ].join('\n')
}

/**
 * Lê a resposta do modelo, e descarta o que não confere: categoria fora da
 * lista vai para "Outros"; conversa ou fala inexistente, ou fala que não é do
 * cliente, some. Modelo é sugestão, não fonte de verdade.
 */
export function lerClassificacao(
  bruto: string,
  conversas: readonly ConversaParaClassificar[],
  categorias: readonly string[],
): DuvidaClassificada[] {
  let json: unknown
  try {
    json = JSON.parse(bruto.replace(/^```(?:json)?\s*|\s*```$/g, ''))
  } catch {
    return []
  }
  const lista = (json as { duvidas?: unknown })?.duvidas
  if (!Array.isArray(lista)) return []

  const porId = new Map(conversas.map((c) => [c.id, c]))
  const saida: DuvidaClassificada[] = []
  const vistas = new Set<string>()

  for (const item of lista) {
    if (typeof item !== 'object' || item === null) continue
    const d = item as Record<string, unknown>
    const conversa = porId.get(String(d.conversa ?? ''))
    if (!conversa) continue
    const fala = conversa.falas[Number(d.fala) - 1]
    if (!fala || fala.quem !== 'cliente') continue

    const tema = String(d.tema ?? '').trim().toLowerCase().slice(0, 120)
    const pergunta = String(d.pergunta ?? '').trim().slice(0, 300)
    if (!tema || !pergunta) continue

    const categoriaPedida = String(d.categoria ?? '').trim()
    const categoria = categorias.find((c) => c.toLowerCase() === categoriaPedida.toLowerCase()) ?? OUTROS
    const resolvidaPor = (RESOLVIDA_POR as readonly string[]).includes(String(d.resolvida_por))
      ? (d.resolvida_por as ResolvidaPor)
      : 'ninguem'

    const chave = `${conversa.id}|${categoria}|${tema}`
    if (vistas.has(chave)) continue
    vistas.add(chave)

    saida.push({ conversa: conversa.id, categoria, tema, pergunta, resolvidaPor, em: fala.em })
  }
  return saida
}
