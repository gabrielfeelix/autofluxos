import 'server-only'
import { db, ehIdInvalido } from '../db'

export type MedidasDoMes = {
  conversas: number
  resolvidasPeloBot: number
  esperandoPessoa: number
}

export type FunilMensal = {
  atual: MedidasDoMes
  anterior: MedidasDoMes
}

type Linha = {
  flow_id: string
  mes: string
  status: string
  total: number | string
}

type LinhaDeExecucoes = Pick<Linha, 'flow_id' | 'total'>

const FUSO_DAS_METRICAS = 'America/Sao_Paulo'
const formatadorDoMes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DAS_METRICAS,
  year: 'numeric',
  month: '2-digit',
})

const vazio = (): MedidasDoMes => ({
  conversas: 0,
  resolvidasPeloBot: 0,
  esperandoPessoa: 0,
})

export async function medirFunil(clienteId: string, agora = new Date()): Promise<FunilMensal> {
  const mesAtual = chaveDoMes(agora)
  const mesAnterior = chaveDoMesAnterior(mesAtual)
  const { data, error } = await db()
    .from('metricas_sessoes')
    .select('flow_id, mes, status, total')
    .eq('client_id', clienteId)
    .in('mes', [mesAtual, mesAnterior])

  if (ehIdInvalido(error)) return { atual: vazio(), anterior: vazio() }
  if (error) throw new Error(`não deu para medir o funil: ${error.message}`)

  const funil = { atual: vazio(), anterior: vazio() }
  for (const linha of data as Linha[]) {
    const medidas = linha.mes === mesAtual ? funil.atual : funil.anterior
    acumular(medidas, linha.status, Number(linha.total))
  }
  return funil
}

export async function contarExecucoesPorFluxo(clienteId: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('metricas_sessoes')
    .select('flow_id, total')
    .eq('client_id', clienteId)

  if (ehIdInvalido(error)) return new Map()
  if (error) throw new Error(`não deu para contar as execuções: ${error.message}`)

  const execucoes = new Map<string, number>()
  for (const linha of data as LinhaDeExecucoes[]) {
    execucoes.set(linha.flow_id, (execucoes.get(linha.flow_id) ?? 0) + Number(linha.total))
  }
  return execucoes
}

function chaveDoMes(data: Date): string {
  const partes = formatadorDoMes.formatToParts(data)
  const ano = partes.find((parte) => parte.type === 'year')?.value
  const mes = partes.find((parte) => parte.type === 'month')?.value
  if (!ano || !mes) throw new Error('não deu para descobrir o mês das métricas')
  return `${ano}-${mes}-01`
}

function chaveDoMesAnterior(chave: string): string {
  const correspondencia = /^(\d{4})-(\d{2})-01$/.exec(chave)
  if (!correspondencia) throw new Error('a chave do mês está inválida')

  const ano = Number(correspondencia[1])
  const mes = Number(correspondencia[2])
  return mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, '0')}-01`
}

function acumular(medidas: MedidasDoMes, status: string, total: number): void {
  medidas.conversas += total
  if (status === 'encerrada') medidas.resolvidasPeloBot += total
  if (status === 'humano') medidas.esperandoPessoa += total
}

// ---------------------------------------------------------------------------
// B3 — tempo, série diária e desempenho por pessoa (0028)
// ---------------------------------------------------------------------------

/**
 * Quanto alguém esperou.
 *
 * **Mediana e média juntas, sempre.** Média de tempo de resposta é a métrica
 * que mais mente em atendimento: uma conversa esquecida no fim de semana puxa
 * a média do mês inteiro e faz o time parecer lento. A mediana responde "quanto
 * esperou o atendimento típico"; a média mostra que existe cauda. Mostrar só
 * uma é escolher entre esconder o problema e inventá-lo.
 *
 * Segundos, porque a tela formata. `null` = ninguém entrou na fila naquele mês,
 * e é diferente de zero — zero seria "responderam instantaneamente".
 */
export type TemposDoMes = {
  entraramNaFila: number
  responderam: number
  fecharam: number
  medianaAteResponder: number | null
  mediaAteResponder: number | null
  medianaAteFechar: number | null
  mediaAteFechar: number | null
}

const semTempos = (): TemposDoMes => ({
  entraramNaFila: 0,
  responderam: 0,
  fecharam: 0,
  medianaAteResponder: null,
  mediaAteResponder: null,
  medianaAteFechar: null,
  mediaAteFechar: null,
})

export async function medirTempos(
  clienteId: string,
  agora = new Date(),
): Promise<{ atual: TemposDoMes; anterior: TemposDoMes }> {
  const mesAtual = chaveDoMes(agora)
  const mesAnterior = chaveDoMesAnterior(mesAtual)

  const { data, error } = await db()
    .from('metricas_de_tempo')
    .select(
      'mes, entraram_na_fila, responderam, fecharam, mediana_ate_responder, media_ate_responder, mediana_ate_fechar, media_ate_fechar',
    )
    .eq('client_id', clienteId)
    .in('mes', [mesAtual, mesAnterior])

  const vazio = { atual: semTempos(), anterior: semTempos() }
  if (ehIdInvalido(error)) return vazio
  if (error) throw new Error(`não deu para medir os tempos: ${error.message}`)

  const resultado = vazio
  for (const linha of data as Record<string, string | number | null>[]) {
    const alvo = linha.mes === mesAtual ? resultado.atual : resultado.anterior
    alvo.entraramNaFila = Number(linha.entraram_na_fila ?? 0)
    alvo.responderam = Number(linha.responderam ?? 0)
    alvo.fecharam = Number(linha.fecharam ?? 0)
    alvo.medianaAteResponder = numeroOuNulo(linha.mediana_ate_responder)
    alvo.mediaAteResponder = numeroOuNulo(linha.media_ate_responder)
    alvo.medianaAteFechar = numeroOuNulo(linha.mediana_ate_fechar)
    alvo.mediaAteFechar = numeroOuNulo(linha.media_ate_fechar)
  }
  return resultado
}

export type DiaDaSerie = {
  dia: string
  contatosNovos: number
  conversas: number
  foramParaPessoa: number
}

/**
 * A série do gráfico, com os dias vazios preenchidos.
 *
 * **Dia sem nada tem que virar zero, e não sumir.** Um gráfico que pula os dias
 * mortos comprime o eixo e transforma uma semana parada num degrau — a linha
 * sobe onde não houve crescimento nenhum. O banco só devolve os dias que
 * existiram; completar é trabalho de quem desenha.
 */
export async function serieDiaria(
  clienteId: string,
  dias = 30,
  agora = new Date(),
): Promise<DiaDaSerie[]> {
  const inicio = new Date(agora.getTime() - (dias - 1) * 24 * 60 * 60 * 1000)

  const { data, error } = await db()
    .from('metricas_diarias')
    .select('dia, contatos_novos, conversas, foram_para_pessoa')
    .eq('client_id', clienteId)
    .gte('dia', diaDeSaoPaulo(inicio))
    .order('dia', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler a série: ${error.message}`)

  const porDia = new Map<string, DiaDaSerie>()
  for (const linha of data as Record<string, string | number>[]) {
    const dia = String(linha.dia)
    porDia.set(dia, {
      dia,
      contatosNovos: Number(linha.contatos_novos ?? 0),
      conversas: Number(linha.conversas ?? 0),
      foramParaPessoa: Number(linha.foram_para_pessoa ?? 0),
    })
  }

  const serie: DiaDaSerie[] = []
  for (let i = 0; i < dias; i++) {
    const data = new Date(inicio.getTime() + i * 24 * 60 * 60 * 1000)
    const dia = diaDeSaoPaulo(data)
    serie.push(porDia.get(dia) ?? { dia, contatosNovos: 0, conversas: 0, foramParaPessoa: 0 })
  }
  return serie
}

export type DesempenhoDaPessoa = {
  usuarioId: string
  atendimentos: number
  fechados: number
}

/**
 * Quanto cada pessoa atendeu no mês.
 *
 * **Volume, e não tempo.** A responsabilidade por um contato pode trocar de
 * mãos no meio, e dividir a espera entre quem assumiu depois seria cobrar de
 * alguém o atraso de outro. O tempo é da conta; o volume é da pessoa.
 */
export async function medirPessoas(
  clienteId: string,
  agora = new Date(),
): Promise<DesempenhoDaPessoa[]> {
  const { data, error } = await db()
    .from('metricas_por_pessoa')
    .select('usuario_id, atendimentos, fechados')
    .eq('client_id', clienteId)
    .eq('mes', chaveDoMes(agora))

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para medir o desempenho: ${error.message}`)

  return (data as Record<string, string | number>[])
    .map((linha) => ({
      usuarioId: String(linha.usuario_id),
      atendimentos: Number(linha.atendimentos ?? 0),
      fechados: Number(linha.fechados ?? 0),
    }))
    .sort((a, b) => b.atendimentos - a.atendimentos)
}

function numeroOuNulo(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

/** `YYYY-MM-DD` no fuso das métricas, como a view grava. */
function diaDeSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_DAS_METRICAS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
}

// ---------------------------------------------------------------------------
// Satisfação — NPS e CSAT (0060)
// ---------------------------------------------------------------------------

/**
 * A satisfação do mês.
 *
 * **O NPS mora aqui, e não na view, de propósito.** Promotor e detrator são
 * definição de produto: mudar o corte é uma decisão de negócio, e num arquivo
 * TypeScript isso é um deploy — numa view seria uma migration contra o banco que
 * a Verandi divide (ver docs/BANCO-COMPARTILHADO.md). A view entrega contagem
 * crua; a conta é nossa.
 *
 * `nps` é `null` quando ninguém respondeu, e isso **não** é zero. Zero é o
 * resultado real de uma conta empatada — tantos promotores quanto detratores —
 * e mostrá-lo no lugar de "ninguém respondeu ainda" faria uma tela vazia
 * parecer um mês medíocre.
 */
export type Satisfacao = {
  respostas: number
  promotores: number
  neutros: number
  detratores: number
  /** −100 a 100. `null` quando não houve resposta nenhuma. */
  nps: number | null
  /** A média das notas, que é o CSAT quando a escala usada é a de satisfação. */
  media: number | null
  comentarios: number
}

const semSatisfacao = (): Satisfacao => ({
  respostas: 0,
  promotores: 0,
  neutros: 0,
  detratores: 0,
  nps: null,
  media: null,
  comentarios: 0,
})

export async function medirSatisfacao(
  clienteId: string,
  agora = new Date(),
): Promise<{ atual: Satisfacao; anterior: Satisfacao }> {
  const mesAtual = chaveDoMes(agora)
  const mesAnterior = chaveDoMesAnterior(mesAtual)

  const { data, error } = await db()
    .from('metricas_de_satisfacao')
    .select('mes, respostas, promotores, neutros, detratores, media, comentarios')
    .eq('client_id', clienteId)
    .in('mes', [mesAtual, mesAnterior])

  const vazio = { atual: semSatisfacao(), anterior: semSatisfacao() }
  if (ehIdInvalido(error)) return vazio
  if (error) throw new Error(`não deu para medir a satisfação: ${error.message}`)

  /*
   * Soma antes de calcular, porque a view quebra por origem.
   *
   * A pesquisa do fluxo e a do fim do atendimento são linhas separadas, e o NPS
   * do mês é o das duas juntas. Calcular por linha e tirar a média das médias
   * daria peso igual a uma origem com três respostas e a outra com trezentas.
   */
  const somas = { atual: semSatisfacao(), anterior: semSatisfacao() }
  const pontos = { atual: 0, anterior: 0 }

  for (const linha of data as Record<string, string | number | null>[]) {
    const chave = linha.mes === mesAtual ? 'atual' : 'anterior'
    const alvo = somas[chave]
    const respostas = Number(linha.respostas ?? 0)

    alvo.respostas += respostas
    alvo.promotores += Number(linha.promotores ?? 0)
    alvo.neutros += Number(linha.neutros ?? 0)
    alvo.detratores += Number(linha.detratores ?? 0)
    alvo.comentarios += Number(linha.comentarios ?? 0)
    // A média volta a ser soma para poder ser somada; vira média de novo no fim.
    pontos[chave] += Number(linha.media ?? 0) * respostas
  }

  for (const chave of ['atual', 'anterior'] as const) {
    const alvo = somas[chave]
    if (alvo.respostas === 0) continue

    // O NPS é **percentual de promotores menos percentual de detratores**. Os
    // neutros não entram na conta — e é por isso que ele vai de −100 a 100.
    alvo.nps = Math.round(
      (alvo.promotores / alvo.respostas) * 100 - (alvo.detratores / alvo.respostas) * 100,
    )
    alvo.media = pontos[chave] / alvo.respostas
  }

  return somas
}
