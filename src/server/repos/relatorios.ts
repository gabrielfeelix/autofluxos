import 'server-only'
import { SEM_CONVERSAS, type ContagemPorDesfecho } from '@/core/desfecho-da-conversa'
import { faixaDaNota } from '@/core/flow/schema'
import type { FiltroDeEscopo } from '@/core/permissoes'
import { resumirProdutosNoAtendimento, type ProdutosNoAtendimento } from '@/core/produtos-no-atendimento'
import { FUSO_DOS_RELATORIOS, type DiaDoRelatorio, type Periodo } from '@/core/relatorios'
import { bancoDoLogin } from '../auth'
import { db } from '../db'

/**
 * Os números da tela de Relatórios, para **qualquer período** (plano de UX, 11.1).
 *
 * ---------------------------------------------------------------------------
 * Por que SQL aqui, e não as views de `metricas.ts`
 * ---------------------------------------------------------------------------
 *
 * As views (0028, 0060, 0086) agregam **por mês**, e só `metricas_diarias` é
 * por dia. Um período de 7 dias não se monta somando meses, e mediana não se
 * monta somando nada: a mediana de uma semana não é a média das medianas dos
 * dias. Então a conta roda sobre as tabelas, com o período e o escopo como
 * parâmetro.
 *
 * **As definições são as das views, copiadas de propósito e sem mudar uma
 * vírgula**, para o número de 30 dias aqui e o do mês lá dizerem a mesma coisa:
 *
 * - contato novo: `contacts.criado_em` (0028, `metricas_diarias`);
 * - conversa: sessão iniciada, pelo fluxo da conta (0028);
 * - foi para pessoa / entrou na fila: handoff criado (0028);
 * - desfecho: o `case` de `metricas_de_desfecho` (0086), com o primeiro handoff
 *   decidindo a fatia;
 * - espera: do handoff até a primeira saída depois dele (0028);
 * - satisfação: `avaliacoes`, com a faixa do NPS de `core/nps.ts`;
 * - fechamento: cartão ganho ou perdido pelo `fechado_em` (0058).
 *
 * Não é migration porque não precisa ser: consulta parametrizada não cria nada
 * no banco que a Verandi divide. Vai pelo mesmo pool do login, que já fala
 * Postgres direto (`bancoDoLogin`); valor sempre como parâmetro (`$1`),
 * identificador nunca vem de fora.
 *
 * ---------------------------------------------------------------------------
 * Escopo
 * ---------------------------------------------------------------------------
 *
 * `responsaveis` é quem entra na conta: `null` = a conta inteira, lista = só
 * contatos (e cartões) com um desses responsáveis. Quem vê só os próprios
 * recebe o número dos contatos dele, e nunca o agregado da conta (H05).
 * Contato sem responsável fica de fora de qualquer lista, como na agenda: a
 * fila de ninguém não é de todo mundo por acidente.
 */

export type Responsaveis = readonly string[] | null

export type Tempos = {
  entraramNaFila: number
  responderam: number
  fecharam: number
  medianaAteResponder: number | null
  mediaAteResponder: number | null
  medianaAteFechar: number | null
}

export type SatisfacaoDoPeriodo = {
  respostas: number
  promotores: number
  neutros: number
  detratores: number
  /** `null` quando ninguém respondeu, que é diferente de NPS zero. */
  nps: number | null
  media: number | null
  /** Quantas respostas cada nota teve, de 0 a 10 (índice = nota). */
  porNota: number[]
}

export type FechamentosDoPeriodo = {
  ganhos: number
  perdidos: number
  /** `null` quando nenhum ganho tinha valor anotado: não é "R$ 0". */
  valor: number | null
}

export type TotaisDoPeriodo = {
  contatosNovos: number
  conversas: number
  desfechos: ContagemPorDesfecho
  tempos: Tempos
  satisfacao: SatisfacaoDoPeriodo
  fechamentos: FechamentosDoPeriodo
}

export type AtendimentoDaPessoa = {
  usuarioId: string
  atendimentos: number
  fechados: number
}

/**
 * Quem o escopo alcança, como lista de responsáveis.
 *
 * `impossivel` vira lista vazia, e lista vazia faz toda soma dar zero: a
 * consulta roda igual e responde "nada", sem montar `in ()` inválido.
 */
export async function responsaveisDoEscopo(
  clienteId: string,
  escopo: FiltroDeEscopo,
): Promise<Responsaveis> {
  if (escopo.tipo === 'tudo') return null
  if (escopo.tipo === 'impossivel') return []
  if (escopo.tipo === 'proprios') return [escopo.usuarioId]

  const { data, error } = await db()
    .from('equipe_membros')
    .select('usuario_id')
    .eq('client_id', clienteId)
    .in('equipe_id', [...escopo.equipes])
  if (error) throw new Error(`não deu para ler as equipes: ${error.message}`)
  return [...new Set((data as { usuario_id: string }[]).map((m) => m.usuario_id))]
}

// Os limites do período como instante: meia-noite de São Paulo do primeiro dia
// até a meia-noite seguinte ao último. Comparar `criado_em` com eles (e não o
// dia de cada linha) deixa o Postgres usar o índice de data.
const LIMITES = `
  lim as (
    select ($2::date::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as ini,
           (($3::date + 1)::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as fim
  )`

const NO_ESCOPO = (coluna: string) => `($4::uuid[] is null or ${coluna} = any($4::uuid[]))`

const SQL_DOS_TOTAIS = `
with ${LIMITES},
contatos as (
  select count(*)::int as n
    from public.contacts c, lim
   where c.client_id = $1
     and c.criado_em >= lim.ini and c.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
),
sessoes as (
  select s.status,
         exists (select 1 from public.handoffs h where h.session_id = s.id) as teve_handoff,
         (select h.origem from public.handoffs h
           where h.session_id = s.id order by h.criado_em asc limit 1) as origem
    from public.sessions s
    join public.flow_versions fv on fv.id = s.flow_version_id
    join public.flows f on f.id = fv.flow_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where f.client_id = $1
     and s.criado_em >= lim.ini and s.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
),
desfechos as (
  select count(*)::int as total,
         count(*) filter (where status = 'encerrada' and not teve_handoff)::int as bot,
         count(*) filter (where (teve_handoff or status = 'humano')
                            and origem = 'prevista')::int as prevista,
         count(*) filter (where (teve_handoff or status = 'humano')
                            and origem is distinct from 'prevista')::int as falha
    from sessoes
),
fila as (
  select h.criado_em as entrou_em,
         h.resolvido_em,
         (select min(m.ts) from public.messages m
           where m.contact_id = c.id and m.direcao = 'saida' and m.ts > h.criado_em) as respondida_em
    from public.handoffs h
    join public.sessions s on s.id = h.session_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where c.client_id = $1
     and h.criado_em >= lim.ini and h.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
),
tempos as (
  select count(*)::int as entraram,
         count(respondida_em)::int as responderam,
         count(resolvido_em)::int as fecharam,
         percentile_cont(0.5) within group (order by extract(epoch from (respondida_em - entrou_em)))::bigint as mediana_resp,
         avg(extract(epoch from (respondida_em - entrou_em)))::bigint as media_resp,
         percentile_cont(0.5) within group (order by extract(epoch from (resolvido_em - entrou_em)))::bigint as mediana_fech
    from fila
),
notas as (
  select coalesce(json_agg(json_build_object('nota', nota, 'n', n)), '[]'::json) as lista
    from (
      select a.nota, count(*)::int as n
        from public.avaliacoes a
        join public.contacts c on c.id = a.contato_id,
             lim
       where a.cliente_id = $1
         and a.criada_em >= lim.ini and a.criada_em < lim.fim
         and ${NO_ESCOPO('c.atribuido_a')}
       group by a.nota
    ) por_nota
),
fechados as (
  select count(*) filter (where q.situacao = 'ganha')::int as ganhos,
         count(*) filter (where q.situacao = 'perdida')::int as perdidos,
         sum(q.valor) filter (where q.situacao = 'ganha') as valor
    from public.quadro_cartoes q, lim
   where q.client_id = $1
     and q.situacao in ('ganha', 'perdida')
     and q.fechado_em >= lim.ini and q.fechado_em < lim.fim
     and ${NO_ESCOPO('q.responsavel')}
)
select contatos.n as contatos_novos,
       desfechos.*,
       tempos.*,
       notas.lista as notas,
       fechados.ganhos, fechados.perdidos, fechados.valor
  from contatos, desfechos, tempos, notas, fechados`

const SQL_DA_SERIE = `
with ${LIMITES},
contatos as (
  select (c.criado_em at time zone '${FUSO_DOS_RELATORIOS}')::date as dia, count(*)::int as n
    from public.contacts c, lim
   where c.client_id = $1
     and c.criado_em >= lim.ini and c.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
   group by 1
),
conversas as (
  select (s.criado_em at time zone '${FUSO_DOS_RELATORIOS}')::date as dia, count(*)::int as n
    from public.sessions s
    join public.flow_versions fv on fv.id = s.flow_version_id
    join public.flows f on f.id = fv.flow_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where f.client_id = $1
     and s.criado_em >= lim.ini and s.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
   group by 1
),
filas as (
  select (h.criado_em at time zone '${FUSO_DOS_RELATORIOS}')::date as dia, count(*)::int as n
    from public.handoffs h
    join public.sessions s on s.id = h.session_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where c.client_id = $1
     and h.criado_em >= lim.ini and h.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
   group by 1
)
select to_char(coalesce(ct.dia, cv.dia, fl.dia), 'YYYY-MM-DD') as dia,
       coalesce(ct.n, 0) as contatos_novos,
       coalesce(cv.n, 0) as conversas,
       coalesce(fl.n, 0) as foram_para_pessoa
  from contatos ct
  full outer join conversas cv on cv.dia = ct.dia
  full outer join filas fl on fl.dia = coalesce(ct.dia, cv.dia)
 order by 1`

const SQL_DAS_PESSOAS = `
with ${LIMITES}
select c.atribuido_a as usuario_id,
       count(*)::int as atendimentos,
       count(h.resolvido_em)::int as fechados
  from public.handoffs h
  join public.sessions s on s.id = h.session_id
  join public.contacts c on c.id = s.contact_id,
       lim
 where c.client_id = $1
   and h.criado_em >= lim.ini and h.criado_em < lim.fim
   and c.atribuido_a is not null
   and ${NO_ESCOPO('c.atribuido_a')}
 group by c.atribuido_a
 order by atendimentos desc`

function parametros(clienteId: string, periodo: Periodo, responsaveis: Responsaveis) {
  return [clienteId, periodo.de, periodo.ate, responsaveis === null ? null : [...responsaveis]]
}

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/** Os totais de um período, no escopo pedido. Uma ida ao banco. */
export async function totaisDoPeriodo(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<TotaisDoPeriodo> {
  const { rows } = await bancoDoLogin().query(SQL_DOS_TOTAIS, parametros(clienteId, periodo, responsaveis))
  const r = rows[0] as Record<string, unknown>

  const desfechos: ContagemPorDesfecho = { ...SEM_CONVERSAS }
  desfechos.bot = Number(r.bot)
  desfechos.prevista = Number(r.prevista)
  desfechos.falha = Number(r.falha)
  // O que sobra não terminou: as quatro fatias somam o total, como na view.
  desfechos.aberta = Number(r.total) - desfechos.bot - desfechos.prevista - desfechos.falha

  return {
    contatosNovos: Number(r.contatos_novos),
    conversas: Number(r.total),
    desfechos,
    tempos: {
      entraramNaFila: Number(r.entraram),
      responderam: Number(r.responderam),
      fecharam: Number(r.fecharam),
      medianaAteResponder: numeroOuNulo(r.mediana_resp),
      mediaAteResponder: numeroOuNulo(r.media_resp),
      medianaAteFechar: numeroOuNulo(r.mediana_fech),
    },
    satisfacao: resumirNotas(r.notas as { nota: number; n: number }[]),
    fechamentos: {
      ganhos: Number(r.ganhos),
      perdidos: Number(r.perdidos),
      // `numeric` chega como texto: somar sem converter concatena.
      valor: numeroOuNulo(r.valor),
    },
  }
}

/** A faixa de cada nota é a de `core/nps.ts`, a mesma da home e do fluxo. */
function resumirNotas(notas: { nota: number; n: number }[]): SatisfacaoDoPeriodo {
  let respostas = 0
  let promotores = 0
  let neutros = 0
  let detratores = 0
  let soma = 0
  const porNota = Array.from({ length: 11 }, () => 0)
  for (const { nota, n } of notas) {
    if (nota >= 0 && nota <= 10) porNota[nota] = (porNota[nota] ?? 0) + n
    respostas += n
    soma += nota * n
    const faixa = faixaDaNota(nota)
    if (faixa === 'promotor') promotores += n
    else if (faixa === 'neutro') neutros += n
    else detratores += n
  }
  if (respostas === 0) return { respostas, promotores, neutros, detratores, nps: null, media: null, porNota }
  return {
    respostas,
    promotores,
    neutros,
    detratores,
    nps: Math.round(((promotores - detratores) / respostas) * 100),
    media: Math.round((soma / respostas) * 10) / 10,
    porNota,
  }
}

/**
 * A série por dia, **só com os dias que tiveram movimento**. Quem desenha
 * completa os vazios com `completarDias`, que é a função testada.
 */
export async function serieDoPeriodo(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<DiaDoRelatorio[]> {
  const { rows } = await bancoDoLogin().query(SQL_DA_SERIE, parametros(clienteId, periodo, responsaveis))
  return (rows as Record<string, unknown>[]).map((r) => ({
    dia: String(r.dia),
    contatosNovos: Number(r.contatos_novos),
    conversas: Number(r.conversas),
    foramParaPessoa: Number(r.foram_para_pessoa),
  }))
}

/** Volume por pessoa no período. Volume, e não tempo: ver `medirPessoas`. */
export async function atendimentosPorPessoa(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<AtendimentoDaPessoa[]> {
  const { rows } = await bancoDoLogin().query(SQL_DAS_PESSOAS, parametros(clienteId, periodo, responsaveis))
  return (rows as Record<string, unknown>[]).map((r) => ({
    usuarioId: String(r.usuario_id),
    atendimentos: Number(r.atendimentos),
    fechados: Number(r.fechados),
  }))
}

// ---------------------------------------------------------------------------
// Os blocos a mais de Análise > Atendimento: quando, por onde, de onde e
// quanto esperaram. Mesmas definições de conversa, contato e fila de cima.
// ---------------------------------------------------------------------------

const SESSOES_DO_PERIODO = `
    from public.sessions s
    join public.flow_versions fv on fv.id = s.flow_version_id
    join public.flows f on f.id = fv.flow_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where f.client_id = $1
     and s.criado_em >= lim.ini and s.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}`

const SQL_DOS_HORARIOS = `
with ${LIMITES}
select extract(isodow from s.criado_em at time zone '${FUSO_DOS_RELATORIOS}')::int as dia,
       extract(hour from s.criado_em at time zone '${FUSO_DOS_RELATORIOS}')::int as hora,
       count(*)::int as n
  ${SESSOES_DO_PERIODO}
 group by 1, 2`

/*
 * O site roda os fluxos do WhatsApp, então `flows.canal` diz "whatsapp" para
 * as duas coisas. Quem separa é o contato: o visitante do site tem `wa_id`
 * começando por "site:".
 */
const SQL_DOS_CANAIS = `
with ${LIMITES}
select case when c.wa_id like 'site:%' then 'site' else f.canal end as canal, count(*)::int as n
  ${SESSOES_DO_PERIODO}
 group by 1`

const SQL_DA_ESPERA = `
with ${LIMITES},
fila as (
  select extract(epoch from (
           (select min(m.ts) from public.messages m
             where m.contact_id = c.id and m.direcao = 'saida' and m.ts > h.criado_em) - h.criado_em
         )) as segundos
    from public.handoffs h
    join public.sessions s on s.id = h.session_id
    join public.contacts c on c.id = s.contact_id,
         lim
   where c.client_id = $1
     and h.criado_em >= lim.ini and h.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
)
select count(*) filter (where segundos < 300)::int as ate5,
       count(*) filter (where segundos >= 300 and segundos < 900)::int as ate15,
       count(*) filter (where segundos >= 900 and segundos < 3600)::int as ate60,
       count(*) filter (where segundos >= 3600 and segundos < 14400)::int as ate4h,
       count(*) filter (where segundos >= 14400)::int as mais,
       count(*) filter (where segundos is null)::int as sem_resposta
  from fila`

/*
 * A primeira passagem de anúncio de cada contato novo decide a origem dele:
 * quem chegou por anúncio e depois voltou direto continua sendo "do anúncio".
 */
const SQL_DA_ORIGEM = `
with ${LIMITES},
novos as (
  select c.id
    from public.contacts c, lim
   where c.client_id = $1
     and c.criado_em >= lim.ini and c.criado_em < lim.fim
     and ${NO_ESCOPO('c.atribuido_a')}
)
select a.campanha, (p.ad_id is not null) as anuncio, count(*)::int as n
  from novos
  left join lateral (
    select pp.ad_id from public.passagens pp
     where pp.contact_id = novos.id and pp.client_id = $1
     order by pp.criado_em asc limit 1
  ) p on true
  left join public.anuncios a on a.client_id = $1 and a.ad_id = p.ad_id
 group by 1, 2`

/** `[dia][hora]`, segunda na linha 0, com zero onde não houve conversa. */
export async function horariosDoPeriodo(clienteId: string, periodo: Periodo, responsaveis: Responsaveis): Promise<number[][]> {
  const { rows } = await bancoDoLogin().query(SQL_DOS_HORARIOS, parametros(clienteId, periodo, responsaveis))
  const celulas = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
  for (const r of rows as { dia: number; hora: number; n: number }[]) {
    const linha = celulas[Number(r.dia) - 1]
    if (linha) linha[Number(r.hora)] = Number(r.n)
  }
  return celulas
}

export async function conversasPorCanal(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<{ canal: string; n: number }[]> {
  const { rows } = await bancoDoLogin().query(SQL_DOS_CANAIS, parametros(clienteId, periodo, responsaveis))
  return (rows as Record<string, unknown>[]).map((r) => ({ canal: String(r.canal), n: Number(r.n) }))
}

export type FaixasDeEspera = { ate5: number; ate15: number; ate60: number; ate4h: number; mais: number; semResposta: number }

export async function faixasDeEspera(clienteId: string, periodo: Periodo, responsaveis: Responsaveis): Promise<FaixasDeEspera> {
  const { rows } = await bancoDoLogin().query(SQL_DA_ESPERA, parametros(clienteId, periodo, responsaveis))
  const r = rows[0] as Record<string, unknown>
  return {
    ate5: Number(r.ate5),
    ate15: Number(r.ate15),
    ate60: Number(r.ate60),
    ate4h: Number(r.ate4h),
    mais: Number(r.mais),
    semResposta: Number(r.sem_resposta),
  }
}

/** `campanha` nula com `anuncio` falso = chegou sem anúncio. */
export async function origemDosContatos(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<{ campanha: string | null; anuncio: boolean; n: number }[]> {
  const { rows } = await bancoDoLogin().query(SQL_DA_ORIGEM, parametros(clienteId, periodo, responsaveis))
  return (rows as Record<string, unknown>[]).map((r) => ({
    campanha: r.campanha ? String(r.campanha) : null,
    anuncio: Boolean(r.anuncio),
    n: Number(r.n),
  }))
}

// ---------------------------------------------------------------------------
// Produtos no atendimento: cards de produto enviados e cliques em "Ver
// produto". A soma e a separação robô/pessoa ficam em
// `core/produtos-no-atendimento.ts`; aqui o banco só agrupa.
// ---------------------------------------------------------------------------

/*
 * Um item de `payload.produtos` é um card. Só conta o que saiu de fato
 * (`entregue`): a linha é gravada antes do envio, e envio que falhou não
 * ofereceu nada a ninguém.
 */
const SQL_DOS_CARDS = `
with ${LIMITES}
select m.payload->'autor'->>'tipo' as tipo,
       m.payload->'autor'->>'id' as usuario_id,
       m.payload->'autor'->>'nome' as nome,
       sum(jsonb_array_length(m.payload->'produtos'))::int as cards
  from public.messages m
  join public.contacts c on c.id = m.contact_id,
       lim
 where c.client_id = $1
   and m.direcao = 'saida'
   and m.entregue
   and m.ts >= lim.ini and m.ts < lim.fim
   and jsonb_typeof(m.payload->'produtos') = 'array'
   and ${NO_ESCOPO('c.atribuido_a')}
 group by 1, 2, 3`

/*
 * Agrupado por produto e link: o link traz as UTMs de quem mandou o card.
 * Com teto, que só pesa numa conta com milhares de produtos distintos no
 * período, e aí os de baixo são os de um clique.
 */
const SQL_DOS_CLIQUES = `
with ${LIMITES}
select e.dados->>'produto' as produto,
       e.dados->>'link' as link,
       count(*)::int as n
  from public.eventos_do_contato e
  join public.contacts c on c.id = e.contato_id,
       lim
 where e.client_id = $1
   and e.tipo = 'abriu-produto'
   and e.criado_em >= lim.ini and e.criado_em < lim.fim
   and ${NO_ESCOPO('c.atribuido_a')}
 group by 1, 2
 order by n desc
 limit 2000`

export async function produtosNoAtendimento(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<ProdutosNoAtendimento> {
  const cards = await bancoDoLogin().query(SQL_DOS_CARDS, parametros(clienteId, periodo, responsaveis))
  const cliques = await bancoDoLogin().query(SQL_DOS_CLIQUES, parametros(clienteId, periodo, responsaveis))
  return resumirProdutosNoAtendimento(
    (cliques.rows as Record<string, unknown>[]).map((r) => ({
      produto: r.produto ? String(r.produto) : null,
      link: r.link ? String(r.link) : null,
      n: Number(r.n),
    })),
    (cards.rows as Record<string, unknown>[]).map((r) => ({
      tipo: r.tipo ? String(r.tipo) : null,
      usuarioId: r.usuario_id ? String(r.usuario_id) : null,
      nome: r.nome ? String(r.nome) : null,
      cards: Number(r.cards),
    })),
  )
}
