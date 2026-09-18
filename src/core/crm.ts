/**
 * O CRM: estágio da pessoa, negociação no cartão, funis encadeados (0058).
 *
 * Puro e sem rede, como todo `core/`. A decisão inteira está em
 * `docs/MODELO-CRM.md`; o que mora aqui é a régua dela — quais estágios existem,
 * o que cada fato produz, o que é um valor válido, e por onde a cadeia de funis
 * pode passar sem virar um laço.
 */

// ---------------------------------------------------------------------------
// Estágio do contato
// ---------------------------------------------------------------------------

export const ESTAGIOS = [
  'novo',
  'qualificado',
  'negociando',
  'cliente',
  'perdido',
  'inativo',
] as const

export type Estagio = (typeof ESTAGIOS)[number]

/** Como cada estágio se chama na tela. Minúsculo: é rótulo, não título. */
export const NOME_DO_ESTAGIO: Record<Estagio, string> = {
  novo: 'novo',
  qualificado: 'qualificado',
  negociando: 'negociando',
  cliente: 'cliente',
  perdido: 'perdido',
  inativo: 'inativo',
}

export function ehEstagio(valor: string): valor is Estagio {
  return (ESTAGIOS as readonly string[]).includes(valor)
}

// ---------------------------------------------------------------------------
// Temperatura do contato
// ---------------------------------------------------------------------------

/**
 * Quanto quem atendeu acredita nesta venda (0068).
 *
 * **A contrapartida do estágio, e de propósito.** O estágio é consequência: ele
 * anda sozinho pelos fatos, e mexer nele na mão é exceção. Temperatura é o
 * oposto — nada aqui a move sozinha, porque não há fato que a meça. Duas pessoas
 * na mesma etapa, com a mesma última mensagem, podem ser uma quase fechada e uma
 * que só pediu preço por educação, e quem sabe a diferença é quem conversou.
 *
 * Deduzi-la de tempo parado ou de estágio seria inventar um número e apresentá-lo
 * como opinião de alguém. Quem não opinou fica em `morno`, que é o que "ninguém
 * disse" honestamente significa.
 */
export const TEMPERATURAS = ['frio', 'morno', 'quente'] as const

export type Temperatura = (typeof TEMPERATURAS)[number]

/** Como cada temperatura se chama na tela. Minúsculo: é rótulo, não título. */
export const NOME_DA_TEMPERATURA: Record<Temperatura, string> = {
  frio: 'frio',
  morno: 'morno',
  quente: 'quente',
}

export function ehTemperatura(valor: string): valor is Temperatura {
  return (TEMPERATURAS as readonly string[]).includes(valor)
}

/**
 * Os fatos que mexem no estágio.
 *
 * O estágio é **consequência, não formulário**: a lista abaixo é o conjunto
 * inteiro do que pode movê-lo sozinho. Tudo que não está aqui só muda estágio
 * se um humano pedir, e pedir é exceção.
 */
export type FatoDoContato =
  | 'voltou-a-falar'
  | 'qualificou'
  | 'entrou-em-negociacao'
  | 'ganhou'
  | 'perdeu'
  | 'sumiu'

/**
 * Quanto tempo sem conversa até um contato ser dado por inativo.
 *
 * Noventa dias porque é o ciclo de recompra mais curto que faz sentido para os
 * negócios que usam isto — barbearia, clínica, estúdio. Menos que isso marcaria
 * como inativo quem só volta de três em três meses, que é justamente o cliente
 * fiel.
 */
export const DIAS_PARA_INATIVAR = 90

/**
 * O estágio depois do fato — ou `null` quando nada muda.
 *
 * As duas regras que este `switch` existe para garantir, e que a tela não
 * deveria precisar lembrar:
 *
 * - **quem já é cliente não regride.** Perder uma negociação nova de quem já
 *   comprou não desfaz a compra antiga, e chamá-lo de `perdido` apagaria a única
 *   informação que importa sobre ele;
 * - **cliente que some vira `inativo`, nunca `perdido`.** Perder um
 *   desconhecido e perder alguém que já pagou são fatos diferentes, e o
 *   relatório que junta os dois não responde nada.
 */
export function estagioDepoisDe(
  atual: Estagio,
  fato: FatoDoContato,
  contexto: {
    /** Sobrou algum cartão aberto depois do fato? Só importa ao perder. */
    temOutroAberto?: boolean
    /** Já teve alguma venda ganha? Só importa para quem voltou a falar. */
    jaComprou?: boolean
  } = {},
): Estagio | null {
  switch (fato) {
    case 'qualificou':
      // Só promove quem ainda não passou daqui. Requalificar um cliente seria
      // rebaixá-lo.
      return atual === 'novo' ? 'qualificado' : null

    case 'entrou-em-negociacao':
      return atual === 'novo' || atual === 'qualificado' ? 'negociando' : null

    case 'ganhou':
      return atual === 'cliente' ? null : 'cliente'

    case 'perdeu':
      if (atual === 'cliente') return null
      if (contexto.temOutroAberto) return null
      return 'perdido'

    case 'sumiu':
      if (atual === 'cliente') return 'inativo'
      if (atual === 'inativo' || atual === 'perdido') return null
      return 'inativo'

    case 'voltou-a-falar':
      // Quem estava dado como perdido e escreveu de novo **não é um lead novo
      // qualquer** — mas tratá-lo como perdido é pior: ele sumiria de toda lista
      // de quem merece resposta. Volta para `novo`, que é a fila de quem precisa
      // de atenção.
      if (atual === 'perdido') return 'novo'
      if (atual === 'inativo') return contexto.jaComprou ? 'cliente' : 'novo'
      return null
  }
}

// ---------------------------------------------------------------------------
// A negociação dentro do cartão
// ---------------------------------------------------------------------------

export const SITUACOES = ['aberta', 'ganha', 'perdida'] as const
export type Situacao = (typeof SITUACOES)[number]

/** O tipo da etapa: cair numa delas fecha a negociação sozinha. */
export const TIPOS_DE_ETAPA = ['normal', 'ganho', 'perdido'] as const
export type TipoDeEtapa = (typeof TIPOS_DE_ETAPA)[number]

export const LIMITE_DO_TITULO = 60

/**
 * Os motivos com que uma conta nasce.
 *
 * Curtos e genéricos de propósito — servem à barbearia e à clínica igualmente, e
 * a primeira coisa que se espera é que alguém edite. Lista vazia seria pior:
 * obrigaria a cadastrar motivo antes de poder perder a primeira venda, que é o
 * momento em que ninguém tem paciência para cadastro.
 */
export const MOTIVOS_INICIAIS = [
  'Preço',
  'Sem resposta',
  'Comprou de outro',
  'Fora do perfil',
  'Sem interesse agora',
] as const

/**
 * O valor digitado, virando número.
 *
 * Aceita "1.234,56", "1234.56" e "R$ 1.234" porque é o que a mão digita, e
 * recusar por formato seria transformar a caixa de valor num teste de datilogia.
 * Vazio é válido: nem toda venda tem valor conhecido na hora de fechar, e
 * exigir um número faria alguém digitar 1 para poder seguir.
 */
export function lerValor(
  bruto: string,
): { ok: true; valor: number | null } | { ok: false; motivo: string } {
  const limpo = bruto.trim()
  if (limpo === '') return { ok: true, valor: null }

  const semMoeda = limpo.replace(/r\$/i, '').replace(/\s/g, '')

  /**
   * Três grafias convivem na mesma caixa, e todas são a mão de quem vende:
   * "1.234,56" (brasileiro), "1234.56" (teclado numérico) e "1.500" (milhar sem
   * centavo). A vírgula resolve a primeira. A terceira é a ambígua, e a regra é
   * a mesma que qualquer pessoa usa ao ler: **ponto seguido de exatamente três
   * dígitos, em grupos, é separador de milhar** — "1.500" é mil e quinhentos, e
   * "1.50" é um e cinquenta.
   */
  const temVirgula = semMoeda.includes(',')
  const ehMilhar = !temVirgula && /^\d{1,3}(\.\d{3})+$/.test(semMoeda)
  const normalizado = temVirgula
    ? semMoeda.replace(/\./g, '').replace(',', '.')
    : ehMilhar
      ? semMoeda.replace(/\./g, '')
      : semMoeda

  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) {
    return { ok: false, motivo: 'escreva só o número, como 1.500 ou 1500,00' }
  }

  const valor = Number(normalizado)
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, motivo: 'valor inválido' }
  if (valor > 9_999_999_999) return { ok: false, motivo: 'valor alto demais' }

  return { ok: true, valor }
}

/**
 * "R$ 1.500,00", escrito à mão.
 *
 * **Sem `Intl`, e o motivo é um defeito real de hidratação.** O
 * `Intl.NumberFormat` do Node e o do navegador vêm de versões diferentes do
 * ICU, e elas discordam do separador entre o símbolo e o número: uma escreve
 * espaço estreito (U+202F), a outra espaço não separável (U+00A0). O React
 * compara o texto que veio do servidor com o que o cliente produz, vê dois
 * caracteres diferentes, e derruba a hidratação inteira com o erro #418 — que
 * no console aparece minificado e sem dizer onde.
 *
 * Um número de dinheiro não precisa de biblioteca: duas casas, ponto no milhar,
 * vírgula no centavo. Determinístico dos dois lados, que é a única coisa que
 * esta função precisa garantir.
 */
export function comoDinheiro(valor: number | null): string {
  if (valor === null) return ''

  const negativo = valor < 0
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.')
  const comMilhar = (inteiro ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${negativo ? '-' : ''}R$ ${comMilhar},${centavos}`
}

/**
 * A régua de fechar um cartão.
 *
 * Ganhar sem valor é permitido; **perder sem motivo não é**. A assimetria é o
 * ponto do produto: o valor é opcional porque o número às vezes só se sabe
 * depois, e o motivo é obrigatório porque agrupar motivo é a única razão de
 * registrar a perda — e um campo opcional aqui produziria um relatório com 80%
 * de "não informado".
 */
export function conferirFechamento(
  situacao: Situacao,
  dados: { valor?: number | null; motivo?: string | null },
  motivosDaConta: string[],
): { ok: true } | { ok: false; motivo: string } {
  if (situacao === 'aberta') return { ok: false, motivo: 'fechar é ganhar ou perder' }

  if (situacao === 'perdida') {
    const escolhido = (dados.motivo ?? '').trim()
    if (escolhido === '') return { ok: false, motivo: 'diga por que esta venda foi perdida' }
    if (!motivosDaConta.some((m) => m.trim().toLowerCase() === escolhido.toLowerCase())) {
      return { ok: false, motivo: 'este motivo não está na lista da conta' }
    }
  }

  if (situacao === 'ganha' && dados.valor !== null && dados.valor !== undefined && dados.valor < 0) {
    return { ok: false, motivo: 'valor inválido' }
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// O que o cliente já rendeu
// ---------------------------------------------------------------------------

export type CartaoFechado = { valor: number | null; fechadoEm: string | null }

/**
 * Quanto essa pessoa já rendeu, quantas vezes comprou e quando foi a última.
 *
 * É o que substitui um módulo de e-commerce inteiro: com o título e o valor dos
 * cartões ganhos dá para responder quanto, quando e o quê — as três perguntas
 * que alguém realmente faz sobre um cliente antigo. Catálogo, estoque e
 * recorrência cobrada são outro produto.
 */
export function resumoDoCliente(ganhos: CartaoFechado[]): {
  total: number
  compras: number
  ultimaEm: string | null
} {
  let total = 0
  let ultimaEm: string | null = null

  for (const cartao of ganhos) {
    total += cartao.valor ?? 0
    if (cartao.fechadoEm && (!ultimaEm || cartao.fechadoEm > ultimaEm)) ultimaEm = cartao.fechadoEm
  }

  return { total, compras: ganhos.length, ultimaEm }
}

// ---------------------------------------------------------------------------
// Funis encadeados
// ---------------------------------------------------------------------------

/**
 * Dá para fazer este quadro apontar para aquele?
 *
 * A cadeia SDR → Vendas → Pós-venda é uma lista, e lista que se morde vira
 * repasse infinito: ganhar em A abriria cartão em B, que ao ser ganho abriria em
 * A de novo. O banco barra só o caso de tamanho um (`A → A`), porque o resto
 * exigiria gatilho recursivo para uma configuração que muda uma vez por ano.
 *
 * Recebe o mapa inteiro de `quadroId -> seguinteId` e caminha até o fim.
 */
export function podeEncadear(
  origem: string,
  destino: string | null,
  cadeiaAtual: Map<string, string | null>,
): { ok: true } | { ok: false; motivo: string } {
  if (destino === null) return { ok: true }
  if (destino === origem) {
    return { ok: false, motivo: 'um quadro não pode mandar para ele mesmo' }
  }

  // Caminha a partir do destino: se voltar à origem, fechou o laço.
  const vistos = new Set<string>([origem])
  let atual: string | null = destino

  while (atual) {
    if (vistos.has(atual)) {
      return {
        ok: false,
        motivo: 'esses quadros formariam um ciclo — o contato voltaria para o começo sem parar',
      }
    }
    vistos.add(atual)
    atual = cadeiaAtual.get(atual) ?? null
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// A linha do tempo
// ---------------------------------------------------------------------------

export const TIPOS_DE_EVENTO = [
  'chegou',
  'mensagem-recebida',
  'mensagem-enviada',
  'mudou-de-etapa',
  'mudou-de-estagio',
  'mudou-de-temperatura',
  'assumiu',
  'ganhou',
  'perdeu',
  'entrou-no-quadro',
  'saiu-do-quadro',
  'agendou',
  'automacao',
  'nota',
] as const

export type TipoDeEvento = (typeof TIPOS_DE_EVENTO)[number]

export type Evento = {
  id: string
  tipo: TipoDeEvento | string
  dados: Record<string, unknown>
  autor: string | null
  criadoEm: string
}

/**
 * O evento virando frase.
 *
 * A linha do tempo só informa se cada linha se lê sozinha — "mudou-de-etapa
 * {de:…, para:…}" é log, não histórico. O `default` devolve o tipo cru de
 * propósito: evento novo escrito por código futuro aparece feio, mas aparece, em
 * vez de sumir da tela sem ninguém notar.
 */
export function comoFrase(evento: Evento): string {
  const d = evento.dados as Record<string, string | undefined>

  switch (evento.tipo) {
    case 'chegou':
      return d.origem ? `chegou por ${d.origem}` : 'chegou'
    case 'mensagem-recebida':
      return 'mandou mensagem'
    case 'mensagem-enviada':
      return 'recebeu mensagem'
    case 'mudou-de-etapa':
      return d.de ? `saiu de ${d.de} para ${d.para}` : `entrou em ${d.para}`
    case 'mudou-de-estagio':
      return `agora é ${d.para}`
    case 'mudou-de-temperatura':
      return `marcado como ${d.para}`
    case 'assumiu':
      return d.quem ? `${d.quem} assumiu` : 'ficou sem responsável'
    case 'ganhou':
      return d.valor ? `ganhou — ${d.valor}` : 'ganhou'
    case 'perdeu':
      return d.motivo ? `perdeu — ${d.motivo}` : 'perdeu'
    case 'entrou-no-quadro':
      return `entrou no funil ${d.quadro ?? ''}`.trim()
    case 'saiu-do-quadro':
      return `saiu do funil ${d.quadro ?? ''}`.trim()
    case 'agendou':
      return d.quando ? `mensagem agendada para ${d.quando}` : 'mensagem agendada'
    case 'automacao':
      return d.ativa === 'true' ? 'automação religada' : 'automação pausada'
    case 'nota':
      return d.texto ?? 'nota'
    default:
      return evento.tipo
  }
}
