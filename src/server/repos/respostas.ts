import 'server-only'
import { db, ehIdInvalido, pareceUuid } from '../db'
import { VARIAVEIS_DE_DATA } from '@/core/datas'
import { VARIAVEIS_DO_ATENDIMENTO } from '@/core/vars-do-atendimento'

/**
 * O histórico de respostas: uma linha por passagem pela automação.
 *
 * ---------------------------------------------------------------------------
 * Por que isto não é a tela de Contatos
 * ---------------------------------------------------------------------------
 *
 * `contacts.campos` guarda o **último** valor de cada campo por pessoa: quem
 * respondeu "acima de 100 mil" em julho e "de 10 a 20 mil" em outubro aparece
 * lá só com o segundo. É o que a tela de Contatos precisa (quem é essa pessoa
 * hoje) e é exatamente o que não responde "o que essa automação colheu".
 *
 * `sessions` já guarda o outro recorte, e guarda desde a 0003: uma linha por
 * conversa, com `vars` (as respostas daquela passagem), a versão do fluxo que
 * estava no ar, o status e as datas. Esta tela é a leitura dessa tabela, não
 * uma tabela nova, e é por isso que ela nasce com o histórico inteiro já
 * preenchido em vez de começar vazia no dia do deploy.
 *
 * ---------------------------------------------------------------------------
 * As colunas não são fixas
 * ---------------------------------------------------------------------------
 *
 * Cada automação pergunta outra coisa, então o cabeçalho é a união das chaves
 * de `vars` das linhas **daquela página**, na ordem em que aparecem. É a mesma
 * decisão que o CSV de leads já tomou (`colunasDosCampos`): cabeçalho fixo
 * exigiria um registro de variáveis por fluxo que o produto não tem, e a união
 * acerta inclusive no fluxo que mudou de perguntas no meio do caminho.
 */

/** Quantas passagens cabem numa página da tela. */
export const RESPOSTAS_POR_PAGINA = 25

/**
 * O que aconteceu com a conversa, nas três fatias que somam o total.
 *
 * Mesma regra da view `metricas_de_desfecho` (0086), e escrita aqui de novo
 * porque esta tela lê linha a linha, não o agregado: `encerrada` sem nunca ter
 * passado por gente é o bot tendo resolvido sozinho; qualquer handoff (ou
 * `status = 'humano'`) é pessoa; o resto não terminou.
 */
export type DesfechoDaResposta = 'bot' | 'pessoa' | 'aberta'

export type Resposta = {
  sessaoId: string
  contatoId: string
  /** O nome que o WhatsApp mandou. Pode não existir: nem todo perfil tem. */
  nome: string | null
  waId: string
  fluxoId: string
  fluxoNome: string
  iniciadaEm: string
  atualizadaEm: string
  desfecho: DesfechoDaResposta
  /** As respostas daquela passagem, já em texto. */
  vars: Record<string, string>
}

export type PaginaDeRespostas = {
  respostas: Resposta[]
  /** As chaves de `vars` que a página usa, na ordem em que aparecem. */
  colunas: string[]
  total: number
  pagina: number
  paginas: number
  /** Para o seletor de automação da tela, já com a contagem de cada uma. */
  automacoes: { id: string; nome: string }[]
}

export type FiltroDeRespostas = {
  /** Vazio ou nulo mostra as de todas as automações da conta. */
  fluxoId?: string | null
  /** Nome ou telefone da pessoa. */
  busca?: string
  pagina?: number
  porPagina?: number
  /** Só as que terminaram de um jeito específico. */
  desfecho?: DesfechoDaResposta | null
}

/**
 * Chaves que moram em `vars` sem serem resposta de ninguém.
 *
 * `resolver.ts` já apaga as duas famílias antes de gravar a sessão, então na
 * prática elas não chegam aqui. A lista existe para a linha antiga, gravada
 * antes daquela limpeza: uma coluna "Hoje" no meio das perguntas seria ruído
 * permanente numa tela que a pessoa abre para conferir resposta.
 */
const NAO_SAO_RESPOSTA = new Set<string>([...VARIAVEIS_DE_DATA, ...VARIAVEIS_DO_ATENDIMENTO])

const STATUS_ABERTOS = ['ativa', 'aguardando_ia', 'aguardando_http', 'aguardando_confirmacao']

type LinhaDeSessao = {
  id: string
  contact_id: string
  flow_version_id: string
  vars: Record<string, unknown> | null
  status: string
  criado_em: string
  atualizado_em: string
}

/**
 * Uma página do histórico.
 *
 * **O filtro por automação é resolvido pelas versões, não pela sessão.** A
 * sessão aponta para `flow_version_id` (a 0003 prende a conversa na versão que
 * estava no ar quando ela começou), então "as respostas deste fluxo" é "as
 * sessões de qualquer versão dele". Filtrar pelo fluxo direto não existe como
 * coluna, e é justamente essa indireção que faz o histórico sobreviver a uma
 * republicação no meio do dia.
 *
 * O `clienteId` entra **sempre**, mesmo quando há `fluxoId`: o id do fluxo vem
 * do endereço, e um fluxo de outra conta colado na URL não pode virar uma
 * planilha de contatos de outra empresa.
 */
export async function paginarRespostas(
  clienteId: string,
  filtro: FiltroDeRespostas = {},
): Promise<PaginaDeRespostas> {
  const porPagina = filtro.porPagina ?? RESPOSTAS_POR_PAGINA
  const pedida = Math.max(1, filtro.pagina ?? 1)
  const vazia: PaginaDeRespostas = {
    respostas: [],
    colunas: [],
    total: 0,
    pagina: 1,
    paginas: 1,
    automacoes: [],
  }

  if (!pareceUuid(clienteId)) return vazia

  const { data: fluxos, error: erroDosFluxos } = await db()
    .from('flows')
    .select('id, nome')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(erroDosFluxos)) return vazia
  if (erroDosFluxos) {
    throw new Error(`não deu para listar as automações: ${erroDosFluxos.message}`)
  }

  const automacoes = (fluxos ?? []) as { id: string; nome: string }[]
  const nomeDoFluxo = new Map(automacoes.map((fluxo) => [fluxo.id, fluxo.nome]))

  // Um fluxo pedido que não é desta conta responde igual a um fluxo que não
  // existe: lista vazia, e não a lista inteira da conta.
  const pedido = filtro.fluxoId && filtro.fluxoId !== '' ? filtro.fluxoId : null
  if (pedido && !nomeDoFluxo.has(pedido)) return { ...vazia, automacoes }

  const idsDeFluxo = pedido ? [pedido] : automacoes.map((fluxo) => fluxo.id)
  if (idsDeFluxo.length === 0) return { ...vazia, automacoes }

  const { data: versoes, error: erroDasVersoes } = await db()
    .from('flow_versions')
    .select('id, flow_id')
    .in('flow_id', idsDeFluxo)

  if (ehIdInvalido(erroDasVersoes)) return { ...vazia, automacoes }
  if (erroDasVersoes) {
    throw new Error(`não deu para achar as versões das automações: ${erroDasVersoes.message}`)
  }

  const fluxoDaVersao = new Map(
    ((versoes ?? []) as { id: string; flow_id: string }[]).map((v) => [v.id, v.flow_id]),
  )
  if (fluxoDaVersao.size === 0) return { ...vazia, automacoes }

  /*
   * A busca acontece nos contatos, e não nas respostas.
   *
   * Quem digita aqui está procurando uma pessoa ("Maria", "99988"), e o
   * PostgREST não filtra dentro de `vars` sem uma expressão que dependeria do
   * nome da chave, que é diferente em cada fluxo. Resolver o contato primeiro
   * mantém a contagem honesta: o `count` volta do banco já filtrado, em vez de
   * contar tudo e esconder linhas na tela.
   */
  let contatosDaBusca: string[] | null = null
  const termo = (filtro.busca ?? '').trim()
  if (termo !== '') {
    const alvo = `%${termo.replaceAll('%', '').replaceAll(',', '')}%`
    const { data: achados, error } = await db()
      .from('contacts')
      .select('id')
      .eq('client_id', clienteId)
      .or(`nome.ilike.${alvo},wa_id.ilike.${alvo}`)
      .limit(500)

    if (error && !ehIdInvalido(error)) {
      throw new Error(`não deu para buscar por "${termo}": ${error.message}`)
    }
    contatosDaBusca = ((achados ?? []) as { id: string }[]).map((c) => c.id)
    if (contatosDaBusca.length === 0) return { ...vazia, automacoes }
  }

  const de = (pedida - 1) * porPagina
  let consulta = db()
    .from('sessions')
    .select('id, contact_id, flow_version_id, vars, status, criado_em, atualizado_em', {
      count: 'exact',
    })
    .in('flow_version_id', [...fluxoDaVersao.keys()])

  if (contatosDaBusca) consulta = consulta.in('contact_id', contatosDaBusca)
  /*
   * `aberta` é o único desfecho que o `status` decide sozinho; `bot` e `pessoa`
   * dependem de handoff, que mora noutra tabela. Filtrar aqui o que dá e
   * refinar depois seria paginação mentirosa (página com menos linhas do que a
   * contagem), então os dois refinados filtram por `status` primeiro e o
   * handoff entra como o desempate de `encerrada`.
   */
  if (filtro.desfecho === 'aberta') consulta = consulta.in('status', STATUS_ABERTOS)
  if (filtro.desfecho === 'bot') consulta = consulta.eq('status', 'encerrada')
  if (filtro.desfecho === 'pessoa') consulta = consulta.eq('status', 'humano')

  const { data, count, error } = await consulta
    .order('criado_em', { ascending: false })
    .range(de, de + porPagina - 1)

  if (ehIdInvalido(error)) return { ...vazia, automacoes }
  if (error) throw new Error(`não deu para ler as respostas: ${error.message}`)

  const sessoes = (data ?? []) as LinhaDeSessao[]
  const total = count ?? sessoes.length
  const paginas = Math.max(1, Math.ceil(total / porPagina))

  if (sessoes.length === 0) {
    return { respostas: [], colunas: [], total, pagina: pedida, paginas, automacoes }
  }

  const [pessoas, comHandoff] = await Promise.all([
    contatosDe(sessoes.map((s) => s.contact_id)),
    sessoesComHandoff(sessoes.map((s) => s.id)),
  ])

  const respostas: Resposta[] = sessoes.map((sessao) => {
    const pessoa = pessoas.get(sessao.contact_id)
    const fluxoId = fluxoDaVersao.get(sessao.flow_version_id) ?? ''

    return {
      sessaoId: sessao.id,
      contatoId: sessao.contact_id,
      nome: pessoa?.nome ?? null,
      waId: pessoa?.waId ?? '',
      fluxoId,
      fluxoNome: nomeDoFluxo.get(fluxoId) ?? 'automação apagada',
      iniciadaEm: sessao.criado_em,
      atualizadaEm: sessao.atualizado_em,
      desfecho: desfecho(sessao.status, comHandoff.has(sessao.id)),
      vars: emTexto(sessao.vars),
    }
  })

  /*
   * O filtro `bot` precisa de um segundo passe: `encerrada` que passou por
   * gente é `pessoa`, não `bot`. Ele encolhe a página (a contagem já veio do
   * banco por `status`), e o alternativo seria uma view nova por linha; o
   * volume aqui é o de uma conta, e a tela diz quantas foram lidas.
   */
  const filtradas =
    filtro.desfecho === 'bot' ? respostas.filter((r) => r.desfecho === 'bot') : respostas

  return {
    respostas: filtradas,
    colunas: colunasDe(filtradas),
    total,
    pagina: Math.min(pedida, paginas),
    paginas,
    automacoes,
  }
}

/**
 * Lê o histórico inteiro, em lotes, para a exportação.
 *
 * O teto existe pelo mesmo motivo do CSV de leads: uma exportação não pode ser
 * o motivo de a função estourar memória.
 */
export async function lerRespostasParaArquivo(
  clienteId: string,
  filtro: FiltroDeRespostas,
  teto = 20_000,
  lote = 500,
): Promise<Resposta[]> {
  const tudo: Resposta[] = []

  for (let pagina = 1; tudo.length < teto; pagina++) {
    const atual = await paginarRespostas(clienteId, { ...filtro, pagina, porPagina: lote })
    tudo.push(...atual.respostas)
    if (pagina >= atual.paginas || atual.respostas.length === 0) break
  }

  return tudo.slice(0, teto)
}

/** As colunas de uma lista de respostas, na ordem em que aparecem. */
export function colunasDe(respostas: Resposta[]): string[] {
  const vistas: string[] = []
  for (const resposta of respostas) {
    for (const chave of Object.keys(resposta.vars)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

function desfecho(status: string, teveHandoff: boolean): DesfechoDaResposta {
  if (status === 'humano' || teveHandoff) return 'pessoa'
  if (status === 'encerrada') return 'bot'
  return 'aberta'
}

/**
 * `vars` é `jsonb`: o valor pode ser número, booleano ou nulo.
 *
 * A tela e o CSV querem texto, e `String(null)` viraria a palavra "null" numa
 * célula de planilha. Objeto e lista viram JSON em vez de `[object Object]`,
 * que é o que aparecia antes em campo vindo de um `http`.
 */
function emTexto(vars: Record<string, unknown> | null): Record<string, string> {
  const saida: Record<string, string> = {}
  for (const [chave, valor] of Object.entries(vars ?? {})) {
    if (NAO_SAO_RESPOSTA.has(chave)) continue
    if (valor === null || valor === undefined) continue
    saida[chave] = typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  }
  return saida
}

async function contatosDe(ids: string[]): Promise<Map<string, { nome: string | null; waId: string }>> {
  const mapa = new Map<string, { nome: string | null; waId: string }>()
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return mapa

  const { data, error } = await db().from('contacts').select('id, nome, wa_id').in('id', unicos)

  if (ehIdInvalido(error)) return mapa
  if (error) throw new Error(`não deu para ler os contatos das respostas: ${error.message}`)

  for (const linha of (data ?? []) as { id: string; nome: string | null; wa_id: string }[]) {
    mapa.set(linha.id, { nome: linha.nome, waId: linha.wa_id })
  }
  return mapa
}

async function sessoesComHandoff(ids: string[]): Promise<Set<string>> {
  const comHandoff = new Set<string>()
  if (ids.length === 0) return comHandoff

  const { data, error } = await db().from('handoffs').select('session_id').in('session_id', ids)

  // Erro aqui vira "ninguém passou por gente", e o lado certo de errar é esse:
  // a linha aparece como o status dela diz, em vez de a tela inteira falhar
  // por causa de uma coluna.
  if (error) return comHandoff

  for (const linha of (data ?? []) as { session_id: string | null }[]) {
    if (linha.session_id) comHandoff.add(linha.session_id)
  }
  return comHandoff
}
