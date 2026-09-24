import 'server-only'
import type { AlcanceDosNegocios, MesDeVendas, MotivoDePerda } from '@/core/analise-de-vendas'
import { FUSO_DOS_RELATORIOS, type Periodo } from '@/core/relatorios'
import { bancoDoLogin } from '../auth'
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
       count(q.valor) filter (where q.situacao = 'ganha')::int as ganhos_com_valor
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

const SQL_DA_EQUIPE = `
with ${LIMITES}
select q.responsavel as usuario_id,
       count(*) filter (where q.situacao = 'ganha')::int as ganhos,
       count(*) filter (where q.situacao = 'perdida')::int as perdidos,
       sum(q.valor) filter (where q.situacao = 'ganha') as valor,
       avg(extract(epoch from (q.fechado_em - q.criado_em))) filter (where q.situacao = 'ganha')::bigint as segundos_ate_ganhar
  from public.quadro_cartoes q, lim
 where ${DO_RECORTE}
   and ${FECHADO_NO_PERIODO}
 group by q.responsavel
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
}

export async function totaisDeVendas(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
  quadroId: string | null,
): Promise<TotaisDeVendas> {
  const { rows } = await bancoDoLogin().query(SQL_DOS_TOTAIS, parametros(clienteId, periodo, responsaveis, quadroId))
  const r = rows[0] as Record<string, unknown>
  return {
    ganhos: Number(r.ganhos),
    perdidos: Number(r.perdidos),
    valor: numeroOuNulo(r.valor),
    ganhosComValor: Number(r.ganhos_com_valor),
  }
}

/** Há algum negócio no alcance desta pessoa, em qualquer data? Decide a tela vazia. */
export async function existeNegocio(clienteId: string, responsaveis: Responsaveis, quadroId: string | null): Promise<boolean> {
  const { rows } = await bancoDoLogin().query(SQL_EXISTE, [
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
  const { rows } = await bancoDoLogin().query(SQL_DOS_MESES, parametros(clienteId, periodo, responsaveis, quadroId))
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
  const { rows } = await bancoDoLogin().query(SQL_DOS_MOTIVOS, parametros(clienteId, periodo, responsaveis, quadroId))
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
  const { rows } = await bancoDoLogin().query(SQL_DA_EQUIPE, parametros(clienteId, periodo, responsaveis, quadroId))
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
  const { rows } = await bancoDoLogin().query(SQL_DO_ALCANCE, parametros(clienteId, periodo, responsaveis, quadroId))
  return (rows as Record<string, unknown>[]).map((r) => ({
    maiorOrdem: numeroOuNulo(r.maior_ordem),
    ganho: Boolean(r.ganho),
    n: Number(r.n),
  }))
}
