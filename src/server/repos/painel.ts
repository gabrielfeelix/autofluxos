import 'server-only'
import { nomeParaMostrar } from '@/core/contatos/nome-para-mostrar'
import { db, ehIdInvalido } from '../db'

/**
 * As consultas da primeira tela, e só dela.
 *
 * Moram aqui, e não em `metricas.ts`, porque respondem outra pergunta. Aquele
 * arquivo mede o mês: quantas conversas, quanto tempo, quem atendeu. Este
 * responde **quem está esperando agora**, que é trabalho, não medida, e que a
 * tela precisa ter antes de qualquer número (ver `docs/PLANO-HOMEPAGE.md` §1).
 *
 * O custo é a regra que rege o arquivo: a primeira tela abre a cada visita ao
 * cliente. Nada aqui traz lista inteira, a fila vem com `limit` e o resto vem
 * como contagem `head: true`, que não transfere linha nenhuma.
 */

/** Por que esta pessoa está na fila. A ordem do tipo é a ordem da urgência. */
export type MotivoDaFila = 'pediu-pessoa' | 'esperando-resposta'

export type ItemDaFila = {
  contatoId: string
  nome: string | null
  telefone: string
  motivo: MotivoDaFila
  /** O que o bot entendeu quando passou para uma pessoa. Só no handoff. */
  detalhe: string | null
  /** Desde quando espera, em ISO. É daqui que sai o "há 3 dias" da tela. */
  desde: string
  /**
   * Quando fecha a janela de 24h do WhatsApp, em ISO. `null` = a pessoa nunca
   * escreveu. Depois disso só sai modelo aprovado pela Meta.
   */
  fechaEm: string | null
  /** A janela já fechou: responder agora exige modelo. */
  vencida: boolean
  /** Minutos até fechar, contados aqui e não no render. `0` quando vencida. */
  minutosRestantes: number
}

export type FilaDoPainel = {
  itens: ItemDaFila[]
  /** Quantos esperam ao todo, o da lista é um recorte dos mais antigos. */
  total: number
  pedindoPessoa: number
}

/** Quantas linhas cabem na primeira tela sem ela virar o Inbox. */
export const ITENS_NA_FILA = 6

type LinhaDaFila = {
  contact_id: string
  nome: string | null
  wa_id: string
  handoff_motivo: string | null
  handoff_em: string | null
  ultima_em: string | null
  ultima_entrada_em: string | null
}

/**
 * Quem o escopo alcança: `null` é a conta inteira; uma lista são as pessoas da
 * equipe (ou só a própria), **mais o que ainda não tem dono**, porque conversa
 * sem responsável é de quem pegar primeiro e esconder dela é deixar esperando.
 * Os ids saem de `responsaveisDoEscopo`, lidos do banco, nunca da tela.
 */
export type Donos = readonly string[] | null

type ConsultaComDono = { or: (f: string) => unknown; is: (c: string, v: null) => unknown }

/*
 * O tipo genérico do construtor do supabase-js estoura o limite de
 * instanciação do TypeScript quando atravessa uma função genérica; por isso a
 * consulta entra e sai com o próprio tipo, e só o miolo vê a forma mínima.
 */
function noEscopo<Q>(q: Q, donos: Donos, coluna = 'atribuido_a'): Q {
  if (donos === null) return q
  const c = q as unknown as ConsultaComDono
  if (donos.length === 0) return c.is(coluna, null) as Q
  return c.or(`${coluna}.is.null,${coluna}.in.(${donos.join(',')})`) as Q
}

/**
 * Quem precisa de uma pessoa, do mais antigo para o mais recente.
 *
 * **Duas leituras, e não uma com `or`.** As duas famílias têm critérios de
 * ordenação diferentes, quem pediu pessoa se ordena pelo instante do pedido,
 * quem espera resposta se ordena pela última mensagem, e uma consulta só
 * obrigaria a ordenar as duas pelo mesmo campo, o que enterraria um pedido de
 * ajuda de agora embaixo de uma conversa esquecida de março.
 *
 * O mais antigo primeiro, e não o mais recente: quem espera há três dias é
 * justamente quem some da tela quando a lista é cronológica ao contrário.
 */
export async function filaDoPainel(
  clienteId: string,
  limite = ITENS_NA_FILA,
  donos: Donos = null,
  agora = new Date(),
): Promise<FilaDoPainel> {
  const campos = 'contact_id, nome, wa_id, handoff_motivo, handoff_em, ultima_em, ultima_entrada_em'
  /*
   * Lê mais que a tela mostra: a ordem final é "janela aberta primeiro", e os
   * mais antigos costumam ser justamente os de janela vencida. Pegar só os
   * seis mais antigos enchia a lista de conversas que ninguém pode responder.
   */
  const lote = Math.max(limite, 40)
  const doEscopo = <Q,>(q: Q) => noEscopo(q, donos)

  const [pediram, devendo, quantosPediram, quantosDevendo] = await Promise.all([
    doEscopo(db()
      .from('leads')
      .select(campos)
      .eq('client_id', clienteId)
      .not('handoff_em', 'is', null)
      .order('handoff_em', { ascending: true })
      .limit(lote)),

    doEscopo(db()
      .from('leads')
      .select(campos)
      .eq('client_id', clienteId)
      .eq('estado_efetivo', 'aberta')
      .eq('ultima_direcao', 'entrada')
      .is('handoff_em', null)
      .order('ultima_em', { ascending: true })
      .limit(lote)),

    doEscopo(db()
      .from('leads')
      .select('contact_id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .not('handoff_em', 'is', null)),

    doEscopo(db()
      .from('leads')
      .select('contact_id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('estado_efetivo', 'aberta')
      .eq('ultima_direcao', 'entrada')
      .is('handoff_em', null)),
  ])

  // Id torto na URL é 404 da tela, não erro do painel: devolver fila vazia
  // deixa o resto da página abrir.
  const erro = pediram.error ?? devendo.error ?? quantosPediram.error ?? quantosDevendo.error
  if (ehIdInvalido(erro)) return { itens: [], total: 0, pedindoPessoa: 0 }
  if (erro) throw new Error(`não deu para montar a fila do painel: ${erro.message}`)

  const itens: ItemDaFila[] = []

  for (const linha of (pediram.data ?? []) as LinhaDaFila[]) {
    if (!linha.handoff_em) continue
    itens.push({
      contatoId: linha.contact_id,
      nome: linha.nome,
      telefone: linha.wa_id,
      motivo: 'pediu-pessoa',
      detalhe: linha.handoff_motivo,
      desde: linha.handoff_em,
      ...janelaDe(linha.ultima_entrada_em, agora),
    })
  }

  for (const linha of (devendo.data ?? []) as LinhaDaFila[]) {
    if (!linha.ultima_em) continue
    itens.push({
      contatoId: linha.contact_id,
      nome: linha.nome,
      telefone: linha.wa_id,
      motivo: 'esperando-resposta',
      detalhe: null,
      desde: linha.ultima_em,
      ...janelaDe(linha.ultima_entrada_em, agora),
    })
  }

  /*
   * A ordem é a do que dá para fazer agora: janela aberta primeiro, a que fecha
   * mais cedo na frente; vencida depois. Dentro de cada grupo, quem pediu
   * pessoa vem antes, porque é o caso em que o bot já disse que não dá conta.
   */
  const ordenados = [...itens].sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? 1 : -1
    if (a.motivo !== b.motivo) return a.motivo === 'pediu-pessoa' ? -1 : 1
    return a.vencida ? b.desde.localeCompare(a.desde) : a.minutosRestantes - b.minutosRestantes
  })
  return {
    itens: ordenados.slice(0, limite),
    total: (quantosPediram.count ?? 0) + (quantosDevendo.count ?? 0),
    pedindoPessoa: quantosPediram.count ?? 0,
  }
}

const JANELA_MS = 24 * 60 * 60 * 1000

/** A janela de 24h a partir da última mensagem da pessoa. */
function janelaDe(
  ultimaEntradaEm: string | null,
  agora: Date,
): Pick<ItemDaFila, 'fechaEm' | 'vencida' | 'minutosRestantes'> {
  if (!ultimaEntradaEm) return { fechaEm: null, vencida: true, minutosRestantes: 0 }
  const fecha = new Date(ultimaEntradaEm).getTime() + JANELA_MS
  const restam = Math.floor((fecha - agora.getTime()) / 60_000)
  return { fechaEm: new Date(fecha).toISOString(), vencida: restam <= 0, minutosRestantes: Math.max(0, restam) }
}

export type Fechamentos = {
  ganhos: number
  perdidos: number
  /** Soma do que foi ganho, em reais. `null` quando nenhum ganho tinha valor. */
  valor: number | null
  dias: number
}

/**
 * O que fechou na janela, ganho, perdido e quanto (0058).
 *
 * **Só o que fechou.** A soma do funil aberto, o tal "pipeline", é o número mais
 * enganoso do CRM: ele cresce sozinho quando ninguém arquiva o que já morreu, e
 * uma conta desleixada acaba exibindo o maior número da tela. Ver
 * `docs/PLANO-HOMEPAGE.md` §6.
 *
 * `valor` é `null`, e não zero, quando nenhum cartão ganho tinha valor
 * preenchido: "R$ 0" diria que se vendeu de graça, quando o que houve foi
 * ninguém anotar o preço.
 */
export async function fechamentos(
  clienteId: string,
  dias = 30,
  agora = new Date(),
): Promise<Fechamentos> {
  const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('situacao, valor')
    .eq('client_id', clienteId)
    .in('situacao', ['ganha', 'perdida'])
    .gte('fechado_em', desde)
    // Com teto, a mesma função mede a janela anterior: é só passar outro `agora`.
    .lt('fechado_em', agora.toISOString())

  const vazio = { ganhos: 0, perdidos: 0, valor: null, dias }
  if (ehIdInvalido(error)) return vazio
  if (error) throw new Error(`não deu para contar os fechamentos: ${error.message}`)

  let ganhos = 0
  let perdidos = 0
  let valor: number | null = null

  for (const linha of (data ?? []) as { situacao: string; valor: number | string | null }[]) {
    if (linha.situacao === 'ganha') {
      ganhos += 1
      // `numeric` chega como texto no PostgREST, somar sem converter concatena.
      const bruto = linha.valor === null ? null : Number(linha.valor)
      if (bruto !== null && Number.isFinite(bruto)) valor = (valor ?? 0) + bruto
    } else {
      perdidos += 1
    }
  }

  return { ganhos, perdidos, valor, dias }
}

// ---------------------------------------------------------------------------
// Negócios parados
// ---------------------------------------------------------------------------

export type NegocioParado = {
  cartaoId: string
  nome: string
  titulo: string | null
  etapa: string | null
  /** O nome do funil, para "Vendas › Proposta" quando a conta tem mais de um. */
  funil: string | null
  valor: number | null
  temperatura: string | null
  desde: string
  /** Dias inteiros na etapa, contados aqui: relógio no render muda a cada pintura. */
  dias: number
}

/** Uma semana na mesma etapa: menos que isso é ritmo normal de venda. */
export const DIAS_PARADO = 7

/**
 * Negócio em aberto que não anda há uma semana, do mais esquecido primeiro.
 *
 * É a pendência do funil que ninguém vê: o cartão não grita, só fica. No
 * escopo de quem lê, pelo responsável **do cartão**, e o sem responsável
 * entra junto, pelo mesmo motivo da fila.
 */
export async function negociosParados(
  clienteId: string,
  donos: Donos,
  limite = 5,
  agora = new Date(),
): Promise<{ itens: NegocioParado[]; total: number }> {
  const corte = new Date(agora.getTime() - DIAS_PARADO * 24 * 60 * 60 * 1000).toISOString()
  const base = <Q,>(q: Q) => noEscopo(q, donos, 'responsavel')

  const [lista, contagem] = await Promise.all([
    base(
      db()
        .from('quadro_cartoes')
        .select('id, titulo, valor, temperatura, entrou_na_coluna_em, contacts (nome_real, nome, wa_id), quadro_colunas (nome), quadros (nome)')
        .eq('client_id', clienteId)
        .eq('situacao', 'aberta')
        .lt('entrou_na_coluna_em', corte),
    )
      .order('entrou_na_coluna_em', { ascending: true })
      .limit(limite),
    base(
      db()
        .from('quadro_cartoes')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId)
        .eq('situacao', 'aberta')
        .lt('entrou_na_coluna_em', corte),
    ),
  ])

  const erro = lista.error ?? contagem.error
  if (ehIdInvalido(erro)) return { itens: [], total: 0 }
  if (erro) throw new Error(`não deu para ler os negócios parados: ${erro.message}`)

  type Linha = {
    id: string
    titulo: string | null
    valor: number | string | null
    temperatura: string | null
    entrou_na_coluna_em: string
    contacts: { nome_real: string | null; nome: string | null; wa_id: string | null } | null
    quadro_colunas: { nome: string } | null
    quadros: { nome: string } | null
  }

  return {
    itens: ((lista.data ?? []) as unknown as Linha[]).map((linha) => ({
      cartaoId: linha.id,
      nome: nomeParaMostrar({
        nomeReal: linha.contacts?.nome_real,
        nome: linha.contacts?.nome,
        waId: linha.contacts?.wa_id,
      }),
      titulo: linha.titulo,
      etapa: linha.quadro_colunas?.nome ?? null,
      funil: linha.quadros?.nome ?? null,
      valor: linha.valor === null || linha.valor === undefined ? null : Number(linha.valor),
      temperatura: linha.temperatura,
      desde: linha.entrou_na_coluna_em,
      dias: Math.max(DIAS_PARADO, Math.floor((agora.getTime() - new Date(linha.entrou_na_coluna_em).getTime()) / 86_400_000)),
    })),
    total: contagem.count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// A fila por pessoa, para quem coordena
// ---------------------------------------------------------------------------

/**
 * Quantas conversas esperam com cada pessoa, e quantas sem ninguém.
 *
 * É a pergunta de quem coordena: não "quanto a equipe atendeu no mês", e sim
 * "quem está afogado agora e quem está livre". Lê só a coluna do dono das
 * conversas que esperam, e soma aqui.
 */
export async function filaPorPessoa(
  clienteId: string,
  donos: Donos,
): Promise<{ semDono: number; porPessoa: Map<string, number> }> {
  const { data, error } = await noEscopo(
    db()
      .from('leads')
      .select('atribuido_a')
      .eq('client_id', clienteId)
      .or('handoff_em.not.is.null,and(estado_efetivo.eq.aberta,ultima_direcao.eq.entrada)'),
    donos,
  ).limit(2000)

  const porPessoa = new Map<string, number>()
  if (ehIdInvalido(error)) return { semDono: 0, porPessoa }
  if (error) throw new Error(`não deu para ler a fila da equipe: ${error.message}`)

  let semDono = 0
  for (const { atribuido_a } of (data ?? []) as { atribuido_a: string | null }[]) {
    if (atribuido_a === null) semDono += 1
    else porPessoa.set(atribuido_a, (porPessoa.get(atribuido_a) ?? 0) + 1)
  }
  return { semDono, porPessoa }
}
