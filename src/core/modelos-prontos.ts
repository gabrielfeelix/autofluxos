import type { Categoria } from './templates'

/**
 * Os modelos prontos de mensagem — a galeria que abre no lugar de um formulário
 * em branco.
 *
 * ---------------------------------------------------------------------------
 * Por que existem, mesmo com a biblioteca da Meta ao lado
 * ---------------------------------------------------------------------------
 *
 * A biblioteca dela aprova quase na hora, e por isso vem primeiro na tela. Mas
 * ela é global, em inglês na maior parte, e escrita para o mercado americano —
 * "your appointment is confirmed" não é como um consultório brasileiro fala.
 *
 * Estes são nossos: em português, no tom que um cliente daqui usa, e cobrindo
 * os casos que aparecem de verdade nas contas que atendemos. Custam a espera de
 * revisão da Meta, e é por isso que a tela diz isso antes da escolha em vez de
 * depois.
 *
 * ---------------------------------------------------------------------------
 * `{{1}}` não aparece aqui, e essa é a decisão
 * ---------------------------------------------------------------------------
 *
 * O corpo é escrito com marcadores em português — `{nome}`, `{data}` — porque é
 * o que a pessoa lê na tela. A tradução para o `{{1}}` da Meta acontece na hora
 * de submeter, e o número nunca chega aos olhos de quem escreve.
 *
 * Quem desenhou a tela anterior expôs o `{{1}}` direto e pedia "exemplo da
 * variável 2" depois — jargão de API vazando para quem só quer mandar um
 * lembrete.
 */

/** Um campo que muda por pessoa. O `id` é o que aparece no texto, entre chaves. */
export type CampoDoModelo = {
  id: string
  /** Como o botão de inserir se chama na tela. */
  rotulo: string
  /** O valor que a Meta vê como exemplo, e que a prévia mostra. */
  exemplo: string
  /**
   * Vem do contato, sem ninguém preencher?
   *
   * `nome` é o único hoje. A diferença importa na tela de transmissão: campo
   * automático não é perguntado, os outros são.
   */
  automatico?: boolean
}

export const CAMPOS: readonly CampoDoModelo[] = [
  { id: 'nome', rotulo: 'Nome do cliente', exemplo: 'Maria', automatico: true },
  { id: 'data', rotulo: 'Data', exemplo: '15/10' },
  { id: 'hora', rotulo: 'Horário', exemplo: '14h' },
  { id: 'valor', rotulo: 'Valor', exemplo: 'R$ 150,00' },
  { id: 'codigo', rotulo: 'Código ou número', exemplo: '1234' },
  { id: 'link', rotulo: 'Link', exemplo: 'exemplo.com/abrir' },
]

export type ModeloPronto = {
  id: string
  /** O que a pessoa escolhe na galeria. */
  titulo: string
  /** Uma linha dizendo quando usar. */
  resumo: string
  corpo: string
  categoria: Categoria
  /** Para a busca achar pelo que a pessoa chama, e não pelo que nomeamos. */
  sinonimos?: readonly string[]
}

/**
 * A categoria vem com o modelo, e não é escolha da pessoa.
 *
 * Ela muda **quanto a Meta cobra** e o quanto ela implica na revisão: um
 * lembrete é `UTILITY`, barato e aprovado fácil; uma promoção é `MARKETING`,
 * mais caro e exige opt-in. Pedir isso a quem só quer avisar de uma consulta é
 * transferir uma decisão de cobrança para quem não tem como tomá-la — e errar
 * aqui é caro, porque a Meta reclassifica e a conta vem diferente.
 */
export const MODELOS_PRONTOS: readonly ModeloPronto[] = [
  {
    id: 'lembrete-consulta',
    titulo: 'Lembrete de consulta',
    resumo: 'Avisa na véspera e pede confirmação.',
    corpo: 'Oi {nome}! Passando para lembrar da sua consulta dia {data} às {hora}. Pode confirmar?',
    categoria: 'UTILITY',
    sinonimos: ['agendamento', 'horário', 'marcado', 'véspera'],
  },
  {
    id: 'confirmacao-agendamento',
    titulo: 'Confirmação de agendamento',
    resumo: 'Confirma na hora que o horário foi marcado.',
    corpo: 'Oi {nome}, seu horário está confirmado para {data} às {hora}. Até lá!',
    categoria: 'UTILITY',
    sinonimos: ['marcado', 'agendou', 'reserva'],
  },
  {
    id: 'cobranca-amigavel',
    titulo: 'Aviso de vencimento',
    resumo: 'Lembra de uma parcela antes de vencer.',
    corpo: 'Oi {nome}, sua parcela de {valor} vence dia {data}. Qualquer coisa, é só chamar aqui.',
    categoria: 'UTILITY',
    sinonimos: ['cobrança', 'boleto', 'pagamento', 'fatura', 'vencer'],
  },
  {
    id: 'pedido-a-caminho',
    titulo: 'Pedido a caminho',
    resumo: 'Avisa que saiu para entrega.',
    corpo:
      'Oi {nome}! Seu pedido {codigo} saiu para entrega e chega hoje. Acompanhe em {link} se quiser.',
    categoria: 'UTILITY',
    sinonimos: ['entrega', 'envio', 'rastreio', 'encomenda'],
  },
  {
    id: 'retomar-conversa',
    titulo: 'Retomar conversa parada',
    resumo: 'Para quem sumiu no meio do atendimento.',
    corpo: 'Oi {nome}, tudo bem? Vi que nossa conversa ficou pela metade. Ainda posso ajudar?',
    categoria: 'UTILITY',
    sinonimos: ['sumiu', 'parou', 'follow up', 'retomada'],
  },
  {
    id: 'pos-atendimento',
    titulo: 'Depois do atendimento',
    resumo: 'Pergunta como foi, no dia seguinte.',
    corpo: 'Oi {nome}! Como foi seu atendimento do dia {data}? Sua opinião ajuda muito a gente.',
    categoria: 'UTILITY',
    sinonimos: ['pesquisa', 'satisfação', 'feedback', 'avaliação', 'nps'],
  },
  {
    id: 'novidade',
    titulo: 'Novidade ou promoção',
    resumo: 'Divulga algo novo. Exige aceite de marketing.',
    corpo:
      'Oi {nome}! Temos uma novidade que combina com você. É só abrir {link} para ver.',
    categoria: 'MARKETING',
    sinonimos: ['oferta', 'desconto', 'lançamento', 'campanha'],
  },
]

// ---------------------------------------------------------------------------
// A tradução dos marcadores
// ---------------------------------------------------------------------------

/** Acha os `{campo}` de um texto, na ordem em que aparecem e sem repetir. */
export function camposUsados(corpo: string): string[] {
  const achados: string[] = []
  for (const casamento of corpo.matchAll(/\{([a-z_]+)\}/g)) {
    const id = casamento[1]!
    if (!achados.includes(id)) achados.push(id)
  }
  return achados
}

/**
 * Troca `{nome}` por `{{1}}`, na ordem de aparição.
 *
 * É aqui que o jargão da Meta entra, e é o único lugar onde ele existe — a
 * pessoa nunca digita um número entre chaves duplas.
 *
 * A ordem é a de aparição no texto porque é assim que a Meta numera: o primeiro
 * buraco é `{{1}}`. Numerar por outra regra faria o valor do nome aparecer no
 * lugar da data.
 */
export function paraFormatoDaMeta(corpo: string): {
  corpo: string
  /** Os campos na ordem em que a Meta os numerou. */
  campos: string[]
} {
  const campos = camposUsados(corpo)
  let saida = corpo
  campos.forEach((id, i) => {
    saida = saida.replaceAll(`{${id}}`, `{{${i + 1}}}`)
  })
  return { corpo: saida, campos }
}

/** Os exemplos de cada campo, na ordem da Meta. É o que ela exige na revisão. */
export function exemplosPara(campos: string[]): string[] {
  return campos.map((id) => CAMPOS.find((c) => c.id === id)?.exemplo ?? 'exemplo')
}

/**
 * O texto como o cliente vai ler — a prévia.
 *
 * Existe porque `Oi {nome}` não responde "o que a pessoa recebe?". Ver o nome
 * de alguém no lugar é o que faz a pessoa perceber que faltou vírgula, ou que o
 * texto ficou seco.
 */
export function previa(corpo: string): string {
  let saida = corpo
  for (const campo of CAMPOS) {
    saida = saida.replaceAll(`{${campo.id}}`, campo.exemplo)
  }
  return saida
}

/**
 * Um nome para a Meta, tirado do texto.
 *
 * A pessoa não precisa inventar apelido: o nome é identificador interno da API,
 * não título. Sai das primeiras palavras do corpo, normalizado, com um sufixo
 * de tempo para não colidir com um modelo que já exista com o mesmo começo.
 */
export function nomeAutomatico(titulo: string, agora: Date = new Date()): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .slice(0, 4)
    .join('_')

  const carimbo = `${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}`

  return `${base || 'modelo'}_${carimbo}`.slice(0, 512)
}
