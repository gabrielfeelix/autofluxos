import 'server-only'
import type { AlcanceDosNegocios, MesDeVendas, MotivoDePerda } from '@/core/analise-de-vendas'
import { FUSO_DOS_RELATORIOS, type Periodo } from '@/core/relatorios'
import { bancoDeDados } from '../banco-de-dados'
import type { Responsaveis } from './relatorios'

/**
 * Os números de Análise > Vendas (plano de navegação e CRM, 5.3).
 *
 * SQL direto pelo pool do login, como `repos/relatorios.ts` e pelos mesmos
 * motivos: período qualquer, escopo como parâmetro, nada criado no banco que a
 * Verandi divide. Valor sempre como parâmetro; identificador nunca vem de fora.
 *
 * **As definições, e são as mesmas do cartão "Fechamentos" do Atendimento**,
 * para as duas telas nunca discordarem:
 *
 * - ganho e perdido: `quadro_cartoes.situacao`, no dia de `fechado_em`;
 * - valor: soma de `valor` dos ganhos; ganho sem valor conta no número de
 *   ganhos e fica fora do valor e do ticket;
 * - escopo: `responsavel` do negócio; negócio sem responsável só entra para
 *   quem vê a conta inteira;
 * - funil: todos, ou o escolhido (`$5`).
 *
 * A passagem de etapa a etapa olha outra população, de propósito: os negócios
 * **criados** no período, e até onde cada um chegou. Olhar os fechados no
 * período misturaria negócio de um ano atrás com o de ontem.
 */

const LIMITES = `
  lim as (
    select ($2::date::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as ini,
           (($3::date + 1)::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as fim
  )`

const recorte = (responsaveis = '$4', quadro = '$5') => `q.client_id = $1
     and (${responsaveis}::uuid[] is null or q.responsavel = any(${responsaveis}::uuid[]))
     and (${quadro}::uuid is null or q.quadro_id = ${quadro}::uuid)`

const DO_RECORTE = recorte()

const FECHADO_NO_PERIODO = `q.situacao in ('ganha', 'perdida')
     and q.fechado_em >= lim.ini and q.fechado_em < lim.fim`

const SQL_DOS_TOTAIS = `
with ${LIMITES}
select count(*) filter (where q.situacao = 'ganha')::int as ganhos,
       count(*) filter (where q.situacao = 'perdida')::int as perdidos,
       sum(q.valor) filter (where q.situacao = 'ganha') as valor,
       count(q.valor) filter (where q.situacao = 'ganha')::int as ganhos_com_valor,
       avg(extract(epoch from (q.fechado_em - q.criado_em))) filter (where q.situacao = 'ganha')::bigint as segundos_ate_ganhar
  from public.quadro_cartoes q, lim
 where ${DO_RECORTE}
   and ${FECHADO_NO_PERIODO}`

const SQL_EXISTE = `
select exists (
  select 1 from public.quadro_cartoes q
   where ${recorte('$2', '$3')}
) as existe`

const SQL_DOS_MESES = `
with ${LIMITES}
select to_char(q.fechado_em at time zone '${FUSO_DOS_RELATORIOS}', 'YYYY-MM') as mes,
       count(*)::int as ganhos,
       sum(q.valor) as valor
  from public.quadro_cartoes q, lim
 where ${DO_RECORTE}
   and q.situacao = 'ganha'
   and q.fechado_em >= lim.ini and q.fechado_em < lim.fim
 group by 1
 order by 1`

const SQL_DOS_MOTIVOS = `
with ${LIMITES}
select nullif(trim(q.motivo), '') as motivo, count(*)::int as n
  from public.quadro_cartoes q, lim
 where ${DO_RECORTE}
   and q.situacao = 'perdida'
   and q.fechado_em >= lim.ini and q.fechado_em < lim.fim
 group by 1`

/*
 * Quem vendeu: o responsável do negócio, e na falta dele quem é dono do
 * contato. Em 05/out/2026 nenhum dos 107 negócios de produção tinha
 * responsável: o cartão nasce sem dono, e o ranking só mostraria "sem
 * responsável" numa conta que tem equipe atendendo.
 *
 * Quem registrou a venda (`vendas.autor`) ficou de fora: o papel que lê os
 * relatórios (`autofluxos_dados`) não tem `select` em `vendas`, e a consulta
 * derrubou a tela em produção.
 */
const SQL_DA_EQUIPE = `
with ${LIMITES}
select coalesce(q.responsavel, c.atribuido_a) as usuario_id,
       count(*) filter (where q.situacao = 'ganha')::int as ganhos,
       count(*) filter (where q.situacao = 'perdida')::int as perdidos,
       sum(q.valor) filter (where q.situacao = 'ganha') as valor,
       avg(extract(epoch from (q.fechado_em - q.criado_em))) filter (where q.situacao = 'ganha')::bigint as segundos_ate_ganhar
  from public.quadro_cartoes q
  left join public.contacts c on c.id = q.contact_id,
       lim
 where ${DO_RECORTE}
   and ${FECHADO_NO_PERIODO}
 group by 1
 order by ganhos desc, valor desc nulls last`

/*
 * Até onde cada negócio criado no período chegou: a etapa atual (se não for a
 * de perdido) ou a mais adiantada do histórico de mudanças de etapa. O evento
 * guarda o nome da etapa, e não o id, então o nome é casado dentro do funil.
 *
 * Evento com `cartaoId` é deste negócio. Evento antigo, de antes da F2, não
 * tem o id: conta se é do mesmo contato e depois da criação do negócio, que é
 * o melhor que dá para saber sem ele.
 */
const SQL_DO_ALCANCE = `
with ${LIMITES},
cartoes as (
  select q.id, q.situacao, q.criado_em, q.contact_id, col.ordem, col.tipo
    from public.quadro_cartoes q
    join public.quadro_colunas col on col.id = q.coluna_id,
         lim
   where ${DO_RECORTE}
     and q.criado_em >= lim.ini and q.criado_em < lim.fim
),
alcance as (
  select c.situacao,
         greatest(
           case when c.tipo <> 'perdido' then c.ordem end,
           (select max(k.ordem)
              from public.eventos_do_contato e
              join public.quadro_colunas k
                on k.quadro_id = $5::uuid
               and k.tipo <> 'perdido'
               and k.nome in (e.dados->>'de', e.dados->>'para')
             where e.client_id = $1
               and e.contato_id = c.contact_id
               and e.tipo = 'mudou-de-etapa'
               and (e.dados->>'cartaoId' = c.id::text
                    or (e.dados->>'cartaoId' is null and e.criado_em >= c.criado_em)))
         ) as maior_ordem
    from cartoes c
)
select maior_ordem, situacao = 'ganha' as ganho, count(*)::int as n
  from alcance
 group by 1, 2`

function numeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function parametros(clienteId: string, periodo: Pick<Periodo, 'de' | 'ate'>, responsaveis: Responsaveis, quadroId: string | null) {
  return [clienteId, periodo.de, periodo.ate, responsaveis === null ? null : [...responsaveis], quadroId]
}

export type TotaisDeVendas = {
  ganhos: number
  perdidos: number
  /** `numeric` chega como texto; `null` quando nenhum ganho tinha valor. */
  valor: number | null
  ganhosComValor: number
  /** Média da criação ao ganho, entre os ganhos do período. */
  segundosAteGanhar: number | null
}

export async function totaisDeVendas(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<TotaisDeVendas> {
  const { rows } = await bancoDeDados().query(SQL_DOS_TOTAIS, parametros(clienteId, periodo, responsaveis, quadroId))
  const r = rows[0] as Record<string, unknown>
  return {
    ganhos: Number(r.ganhos),
    perdidos: Number(r.perdidos),
    valor: numeroOuNulo(r.valor),
    ganhosComValor: Number(r.ganhos_com_valor),
    segundosAteGanhar: numeroOuNulo(r.segundos_ate_ganhar),
  }
}

/** Há algum negócio no alcance desta pessoa, em qualquer data? Decide a tela vazia. */
export async function existeNegocio(clienteId: string, responsaveis: Responsaveis, quadroId: string | null): Promise<boolean> {
  const { rows } = await bancoDeDados().query(SQL_EXISTE, [
    clienteId,
    responsaveis === null ? null : [...responsaveis],
    quadroId,
  ])
  return Boolean((rows[0] as { existe: boolean }).existe)
}

/** Ganhos por mês entre `de` e `ate`, só os meses com ganho. Quem desenha completa. */
export async function ganhosPorMes(
  clienteId: string,
  periodo: Pick<Periodo, 'de' | 'ate'>,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<MesDeVendas[]> {
  const { rows } = await bancoDeDados().query(SQL_DOS_MESES, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    mes: String(r.mes),
    ganhos: Number(r.ganhos),
    valor: numeroOuNulo(r.valor),
  }))
}

export async function motivosDePerda(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<MotivoDePerda[]> {
  const { rows } = await bancoDeDados().query(SQL_DOS_MOTIVOS, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    motivo: r.motivo === null ? null : String(r.motivo),
    n: Number(r.n),
  }))
}

export type VendasDaPessoa = {
  /** `null` = negócios sem responsável. */
  usuarioId: string | null
  ganhos: number
  perdidos: number
  valor: number | null
  segundosAteGanhar: number | null
}

export async function vendasPorPessoa(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<VendasDaPessoa[]> {
  const { rows } = await bancoDeDados().query(SQL_DA_EQUIPE, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    usuarioId: r.usuario_id === null ? null : String(r.usuario_id),
    ganhos: Number(r.ganhos),
    perdidos: Number(r.perdidos),
    valor: numeroOuNulo(r.valor),
    segundosAteGanhar: numeroOuNulo(r.segundos_ate_ganhar),
  }))
}

/** Até onde chegaram os negócios criados no período, num funil só. */
export async function alcanceDosNegocios(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string,
): Promise<AlcanceDosNegocios[]> {
  const { rows } = await bancoDeDados().query(SQL_DO_ALCANCE, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    maiorOrdem: numeroOuNulo(r.maior_ordem),
    ganho: Boolean(r.ganho),
    n: Number(r.n),
  }))
}

// ---------------------------------------------------------------------------
// Os blocos a mais: o que está aberto agora, o que vende e de onde vem.
// ---------------------------------------------------------------------------

/*
 * Foto de agora, sem período: negócio aberto não tem data de fechamento, e
 * "quanto tenho na mesa" é a pergunta de hoje. Etapa é de um funil só.
 */
const SQL_DO_ABERTO = `
select col.id, col.nome, col.ordem,
       count(q.id)::int as n,
       sum(q.valor) as valor
  from public.quadro_colunas col
  left join public.quadro_cartoes q
    on q.coluna_id = col.id
   and q.situacao = 'aberta'
   and q.client_id = $1
   and ($2::uuid[] is null or q.responsavel = any($2::uuid[]))
 where col.quadro_id = $3::uuid
   and col.tipo = 'normal'
 group by col.id, col.nome, col.ordem
 order by col.ordem`

/*
 * O que vendeu, pelo produto de interesse do negócio. Os itens da venda
 * registrada (`venda_itens`) seriam a fonte melhor, mas o papel dos
 * relatórios ainda não lê `vendas`: ver o comentário de `SQL_DA_EQUIPE`.
 */
const SQL_DOS_PRODUTOS = `
with ${LIMITES}
select p.nome as produto, count(*)::int as n, sum(q.valor) as valor
  from public.quadro_cartoes q
  left join public.produtos p on p.id = q.produto_id,
       lim
 where ${DO_RECORTE}
   and q.situacao = 'ganha'
   and q.fechado_em >= lim.ini and q.fechado_em < lim.fim
 group by 1`

const SQL_DA_ORIGEM = `
with ${LIMITES}
select a.campanha, (p.ad_id is not null) as anuncio, count(*)::int as n, sum(q.valor) as valor
  from public.quadro_cartoes q
  left join lateral (
    select pp.ad_id from public.passagens pp
     where pp.contact_id = q.contact_id and pp.client_id = $1
     order by pp.criado_em asc limit 1
  ) p on true
  left join public.anuncios a on a.client_id = $1 and a.ad_id = p.ad_id,
       lim
 where ${DO_RECORTE}
   and q.situacao = 'ganha'
   and q.fechado_em >= lim.ini and q.fechado_em < lim.fim
 group by 1, 2`

export type EtapaEmAberto = { id: string; nome: string; ordem: number; n: number; valor: number | null }

export async function negociosEmAberto(clienteId: string, responsaveis: Responsaveis, quadroId: string): Promise<EtapaEmAberto[]> {
  const { rows } = await bancoDeDados().query(SQL_DO_ABERTO, [
    clienteId,
    responsaveis === null ? null : [...responsaveis],
    quadroId,
  ])
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    ordem: Number(r.ordem),
    n: Number(r.n),
    valor: numeroOuNulo(r.valor),
  }))
}

export type GanhosAgrupados = { rotulo: string | null; anuncio?: boolean; n: number; valor: number | null }

export async function ganhosPorProduto(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<GanhosAgrupados[]> {
  const { rows } = await bancoDeDados().query(SQL_DOS_PRODUTOS, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    rotulo: r.produto ? String(r.produto) : null,
    n: Number(r.n),
    valor: numeroOuNulo(r.valor),
  }))
}

/** Pela primeira passagem de anúncio do contato do negócio. */
export async function ganhosPorOrigem(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<GanhosAgrupados[]> {
  const { rows } = await bancoDeDados().query(SQL_DA_ORIGEM, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    rotulo: r.campanha ? String(r.campanha) : null,
    anuncio: Boolean(r.anuncio),
    n: Number(r.n),
    valor: numeroOuNulo(r.valor),
  }))
}

/*
 * Recebido pelo chat (cobrança no chat, 0141): o dinheiro que entrou por Pix
 * ou link mandado na conversa, separado dos negócios ganhos para a mesma
 * venda nunca ser somada duas vezes.
 *
 * - recebido: cobranças pagas, no dia de `paga_em`;
 * - taxa de pagamento: das criadas no período que já tiveram desfecho, quantas
 *   foram pagas (paga ÷ paga + vencida). Cancelada e ainda aguardando não
 *   entram: nenhuma das duas diz se a pessoa pagaria;
 * - vencido: o que venceu no período sem pagar, dinheiro para ir atrás;
 * - escopo: o responsável do contato; cobrança de contato sem responsável só
 *   entra para quem vê a conta inteira.
 */
const DO_ESCOPO_DA_COBRANCA = `c.cliente_id = $1
     and ($4::uuid[] is null or exists (
       select 1 from public.contacts ct where ct.id = c.contato_id and ct.atribuido_a = any($4::uuid[])
     ))`

const SQL_DO_RECEBIDO = `
with ${LIMITES}
select count(*) filter (where c.status = 'paga' and c.paga_em >= lim.ini and c.paga_em < lim.fim)::int as pagas,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'paga' and c.paga_em >= lim.ini and c.paga_em < lim.fim), 0)::bigint as recebido,
       avg(extract(epoch from (c.paga_em - c.criado_em))) filter (where c.status = 'paga' and c.paga_em >= lim.ini and c.paga_em < lim.fim)::bigint as segundos_ate_pagar,
       count(*) filter (where c.criado_em >= lim.ini and c.criado_em < lim.fim and c.status = 'paga')::int as criadas_pagas,
       count(*) filter (where c.criado_em >= lim.ini and c.criado_em < lim.fim and c.status = 'vencida')::int as criadas_vencidas,
       count(*) filter (where c.status = 'vencida' and c.vence_em >= lim.ini and c.vence_em < lim.fim)::int as vencidas,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'vencida' and c.vence_em >= lim.ini and c.vence_em < lim.fim), 0)::bigint as vencido,
       count(*) filter (where c.status = 'pendente')::int as aguardando,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'pendente'), 0)::bigint as aguardando_valor,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'paga' and c.origem = 'inbox' and c.paga_em >= lim.ini and c.paga_em < lim.fim), 0)::bigint as pela_equipe,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'paga' and c.origem in ('fluxo', 'ia') and c.paga_em >= lim.ini and c.paga_em < lim.fim), 0)::bigint as pela_automacao,
       coalesce(sum(c.valor_centavos) filter (where c.status = 'paga' and c.origem not in ('inbox', 'fluxo', 'ia') and c.paga_em >= lim.ini and c.paga_em < lim.fim), 0)::bigint as por_outros
  from public.cobrancas c, lim
 where ${DO_ESCOPO_DA_COBRANCA}`

// Os itens de `cobrancas.itens` (Cobrar pelo catálogo); `valorCentavos` é o de cada um.
const SQL_VENDIDOS_PELO_CHAT = `
with ${LIMITES}
select i->>'nome' as produto,
       sum((i->>'quantidade')::int)::int as n,
       sum((i->>'quantidade')::int * (i->>'valorCentavos')::bigint)::bigint as valor
  from public.cobrancas c
  cross join lim
  cross join lateral jsonb_array_elements(case when jsonb_typeof(c.itens) = 'array' then c.itens else '[]'::jsonb end) i
 where ${DO_ESCOPO_DA_COBRANCA}
   and c.status = 'paga'
   and c.paga_em >= lim.ini and c.paga_em < lim.fim
   and i ? 'nome' and i ? 'quantidade' and i ? 'valorCentavos'
 group by 1
 order by 3 desc
 limit 20`

const SQL_EXISTE_COBRANCA = `
select exists (select 1 from public.cobrancas c where c.cliente_id = $1) as existe`

export type RecebidoPeloChat = {
  pagas: number
  /** Centavos. */
  recebido: number
  segundosAtePagar: number | null
  /** Das criadas no período com desfecho, quantas pagaram. Nulo sem nenhuma. */
  taxaDePagamento: number | null
  vencidas: number
  vencido: number
  aguardando: number
  aguardandoValor: number
  pelaEquipe: number
  pelaAutomacao: number
  porOutros: number
}

/** O recebido pelo chat no período. Tabela ausente (antes da 0141) é zero. */
export async function recebidoPeloChat(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<RecebidoPeloChat | null> {
  try {
    const { rows } = await bancoDeDados().query(SQL_DO_RECEBIDO, parametros(clienteId, periodo, responsaveis, null).slice(0, 4))
    const r = rows[0] as Record<string, unknown>
    const comDesfecho = Number(r.criadas_pagas) + Number(r.criadas_vencidas)
    return {
      pagas: Number(r.pagas),
      recebido: Number(r.recebido),
      segundosAtePagar: numeroOuNulo(r.segundos_ate_pagar),
      taxaDePagamento: comDesfecho > 0 ? Number(r.criadas_pagas) / comDesfecho : null,
      vencidas: Number(r.vencidas),
      vencido: Number(r.vencido),
      aguardando: Number(r.aguardando),
      aguardandoValor: Number(r.aguardando_valor),
      pelaEquipe: Number(r.pela_equipe),
      pelaAutomacao: Number(r.pela_automacao),
      porOutros: Number(r.por_outros),
    }
  } catch (erro) {
    if (erro instanceof Error && /relation "public\.cobrancas" does not exist/.test(erro.message)) return null
    throw erro
  }
}

/** O que mais saiu nas cobranças pagas pelo chat, por item. Valor em centavos. */
export async function vendidosPeloChat(clienteId: string, periodo: Periodo, responsaveis: Responsaveis): Promise<GanhosAgrupados[]> {
  try {
    const { rows } = await bancoDeDados().query(SQL_VENDIDOS_PELO_CHAT, parametros(clienteId, periodo, responsaveis, null).slice(0, 4))
    return (rows as Record<string, unknown>[]).map((r) => ({ rotulo: String(r.produto), n: Number(r.n), valor: numeroOuNulo(r.valor) }))
  } catch (erro) {
    if (erro instanceof Error && /relation "public\.cobrancas" does not exist/.test(erro.message)) return []
    throw erro
  }
}

/** A conta já cobrou alguma vez pelo chat? Decide se o bloco aparece. */
export async function existeCobranca(clienteId: string): Promise<boolean> {
  try {
    const { rows } = await bancoDeDados().query(SQL_EXISTE_COBRANCA, [clienteId])
    return Boolean((rows[0] as { existe?: boolean } | undefined)?.existe)
  } catch {
    return false
  }
}
