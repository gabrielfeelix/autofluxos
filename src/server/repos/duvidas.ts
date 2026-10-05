import 'server-only'
import { FUSO_DOS_RELATORIOS, type Periodo } from '@/core/relatorios'
import type { DuvidaClassificada, FalaDaConversa, ResolvidaPor } from '@/core/duvidas'
import { bancoDeDados } from '../banco-de-dados'
import type { Responsaveis } from './relatorios'

/**
 * As dúvidas do atendimento: o que a IA não soube (fase 1, só dado que já
 * existia) e as dúvidas classificadas pela passada diária (`public.duvidas`,
 * migration 0125). Regra do produto em `core/duvidas.ts`.
 *
 * Tudo pelo pool direto, como os relatórios: são junções que o PostgREST não
 * faz numa ida só. O pool fala uma conexão por vez, então em sequência.
 */

const LIMITES = `
  lim as (
    select ($2::date::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as ini,
           (($3::date + 1)::timestamp at time zone '${FUSO_DOS_RELATORIOS}') as fim
  )`

const NO_ESCOPO = (coluna: string) => `($4::uuid[] is null or ${coluna} = any($4::uuid[]))`

function parametros(clienteId: string, periodo: Periodo, responsaveis: Responsaveis) {
  return [clienteId, periodo.de, periodo.ate, responsaveis === null ? null : [...responsaveis]]
}

// ---------------------------------------------------------------------------
// Fase 1: o que a IA não soube
// ---------------------------------------------------------------------------

/**
 * O motivo exato que o motor grava quando a IA responde `NAO_SEI` por falta de
 * conhecimento (`efeitos/resolver.ts`). Os outros "não soube" (cota, modelo
 * fora do ar, resposta vazia) são falha técnica, não lacuna de conhecimento, e
 * ensinar resposta não resolveria nenhum deles.
 */
const MOTIVO_SEM_CONHECIMENTO = 'a IA não soube responder, a pergunta saiu do que a empresa informou'

export type PerguntaSemResposta = {
  contatoId: string
  nome: string | null
  /** A última mensagem do cliente antes da passagem: é a pergunta. */
  pergunta: string
  /** A primeira resposta escrita por alguém da equipe depois da passagem. */
  respostaDaEquipe: string | null
  em: string
}

export async function perguntasQueAIANaoSoube(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<PerguntaSemResposta[]> {
  const { rows } = await bancoDeDados().query(
    `with ${LIMITES}
     select c.id as contato_id,
            coalesce(c.nome_real, c.nome) as nome,
            h.criado_em,
            (select coalesce(m.transcricao, m.texto)
               from public.messages m
              where m.contact_id = c.id and m.direcao = 'entrada'
                and m.ts <= h.criado_em
                and coalesce(m.transcricao, m.texto) is not null
              order by m.ts desc limit 1) as pergunta,
            (select m.texto
               from public.messages m
              where m.contact_id = c.id and m.direcao = 'saida'
                and m.payload->'autor'->>'tipo' = 'pessoa'
                and m.ts > h.criado_em and m.texto is not null
              order by m.ts asc limit 1) as resposta
       from public.handoffs h
       join public.sessions s on s.id = h.session_id
       join public.contacts c on c.id = s.contact_id,
            lim
      where c.client_id = $1
        and h.motivo = '${MOTIVO_SEM_CONHECIMENTO}'
        and h.criado_em >= lim.ini and h.criado_em < lim.fim
        and ${NO_ESCOPO('c.atribuido_a')}
      order by h.criado_em desc
      limit 300`,
    parametros(clienteId, periodo, responsaveis),
  )

  return (rows as { contato_id: string; nome: string | null; criado_em: Date; pergunta: string | null; resposta: string | null }[])
    .filter((r) => r.pergunta && r.pergunta.trim() !== '')
    .map((r) => ({
      contatoId: r.contato_id,
      nome: r.nome,
      pergunta: r.pergunta!.trim(),
      respostaDaEquipe: r.resposta?.trim() || null,
      em: new Date(r.criado_em).toISOString(),
    }))
}

// ---------------------------------------------------------------------------
// Fase 2: as dúvidas classificadas
// ---------------------------------------------------------------------------

export type DuvidaDoPeriodo = {
  categoria: string
  tema: string
  pergunta: string
  resolvidaPor: ResolvidaPor
  contatoId: string
  em: string
}

/** As dúvidas do período, já com os apelidos de tema aplicados. */
export async function duvidasDoPeriodo(
  clienteId: string,
  periodo: Periodo,
  responsaveis: Responsaveis,
): Promise<DuvidaDoPeriodo[]> {
  const { rows } = await bancoDeDados().query(
    `with ${LIMITES}
     select d.categoria,
            coalesce(a.para, d.tema) as tema,
            d.pergunta, d.resolvida_por, d.contact_id, d.perguntada_em
       from public.duvidas d
       join public.contacts c on c.id = d.contact_id
       left join public.apelidos_de_tema a
         on a.client_id = d.client_id and a.categoria = d.categoria and a.de = d.tema,
            lim
      where d.client_id = $1
        and d.perguntada_em >= lim.ini and d.perguntada_em < lim.fim
        and ${NO_ESCOPO('c.atribuido_a')}
      order by d.perguntada_em desc
      limit 5000`,
    parametros(clienteId, periodo, responsaveis),
  )
  return (
    rows as {
      categoria: string
      tema: string
      pergunta: string
      resolvida_por: ResolvidaPor
      contact_id: string
      perguntada_em: Date
    }[]
  ).map((r) => ({
    categoria: r.categoria,
    tema: r.tema,
    pergunta: r.pergunta,
    resolvidaPor: r.resolvida_por,
    contatoId: r.contact_id,
    em: new Date(r.perguntada_em).toISOString(),
  }))
}

/**
 * Os temas que a conta já tem, os mais frequentes primeiro: vão no pedido ao
 * modelo para ele reaproveitar o nome em vez de inventar um quase igual.
 */
export async function temasConhecidos(clienteId: string, limite = 60): Promise<{ categoria: string; tema: string }[]> {
  const { rows } = await bancoDeDados().query(
    `select d.categoria, coalesce(a.para, d.tema) as tema, count(*) as n
       from public.duvidas d
       left join public.apelidos_de_tema a
         on a.client_id = d.client_id and a.categoria = d.categoria and a.de = d.tema
      where d.client_id = $1 and d.perguntada_em > now() - interval '90 days'
      group by 1, 2
      order by n desc
      limit $2`,
    [clienteId, limite],
  )
  return rows as { categoria: string; tema: string }[]
}

/**
 * Renomear um tema, ou juntá-lo a outro (renomear para um nome que já existe).
 * O apelido vale para o que já foi gravado e para o que vier: quem apontava
 * para o nome velho passa a apontar para o novo, e nada fica em cadeia.
 */
export async function renomearTema(clienteId: string, categoria: string, de: string, para: string): Promise<void> {
  const banco = bancoDeDados()
  await banco.query(
    `update public.apelidos_de_tema set para = $4
      where client_id = $1 and categoria = $2 and para = $3`,
    [clienteId, categoria, de, para],
  )
  await banco.query(
    `insert into public.apelidos_de_tema (client_id, categoria, de, para)
     values ($1, $2, $3, $4)
     on conflict (client_id, categoria, de) do update set para = excluded.para`,
    [clienteId, categoria, de, para],
  )
  // Os apelidos que caíram em si mesmos ("x" → "x") não dizem nada.
  await banco.query(`delete from public.apelidos_de_tema where client_id = $1 and de = para`, [clienteId])
}

// ---------------------------------------------------------------------------
// A passada: o que ainda não foi lido
// ---------------------------------------------------------------------------

/** Até onde a passada olha para trás na primeira vez: 90 dias, como o Intercom. */
const DIAS_DE_HISTORICO = 90
/** Conversa ainda em andamento espera: a dúvida pode ser respondida daqui a pouco. */
const MINUTOS_DE_SOSSEGO = 30
/** Falas por leitura. O que passar disso fica para a próxima passada. */
const FALAS_POR_CONVERSA = 60

export type ConversaPendente = { contatoId: string; clienteId: string; desde: string }

export async function conversasPendentes(limite: number): Promise<ConversaPendente[]> {
  const { rows } = await bancoDeDados().query(
    `select c.id as contato_id, c.client_id,
            coalesce(l.ate, now() - interval '${DIAS_DE_HISTORICO} days') as desde
       from public.contacts c
       left join public.duvidas_lidas l on l.contact_id = c.id
      where exists (
              select 1 from public.messages m
               where m.contact_id = c.id and m.direcao = 'entrada'
                 and m.ts > coalesce(l.ate, now() - interval '${DIAS_DE_HISTORICO} days'))
        and not exists (
              select 1 from public.messages m
               where m.contact_id = c.id and m.ts > now() - interval '${MINUTOS_DE_SOSSEGO} minutes')
      order by c.client_id
      limit $1`,
    [limite],
  )
  return (rows as { contato_id: string; client_id: string; desde: Date }[]).map((r) => ({
    contatoId: r.contato_id,
    clienteId: r.client_id,
    desde: new Date(r.desde).toISOString(),
  }))
}

/** As falas de texto depois de `desde`, em ordem, com quem disse. */
export async function falasDesde(contatoId: string, desde: string): Promise<FalaDaConversa[]> {
  const { rows } = await bancoDeDados().query(
    `select m.direcao, m.payload->'autor'->>'tipo' as autor, coalesce(m.transcricao, m.texto) as texto, m.ts
       from public.messages m
      where m.contact_id = $1 and m.ts > $2
        and coalesce(m.transcricao, m.texto) is not null
      order by m.ts asc
      limit ${FALAS_POR_CONVERSA}`,
    [contatoId, desde],
  )
  return (rows as { direcao: string; autor: string | null; texto: string; ts: Date }[]).map((r) => ({
    quem: r.direcao === 'entrada' ? 'cliente' : r.autor === 'pessoa' ? 'equipe' : 'ia',
    texto: r.texto,
    em: new Date(r.ts).toISOString(),
  }))
}

/** Grava as dúvidas de uma leva, com os apelidos da conta já aplicados. */
export async function gravarDuvidas(
  clienteId: string,
  duvidas: readonly DuvidaClassificada[],
): Promise<void> {
  if (duvidas.length === 0) return
  const valores: unknown[] = []
  const linhas = duvidas.map((d, i) => {
    const b = i * 7
    valores.push(clienteId, d.conversa, d.categoria, d.tema, d.pergunta, d.resolvidaPor, d.em)
    return `($${b + 1}::uuid, $${b + 2}::uuid, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::timestamptz)`
  })
  await bancoDeDados().query(
    `insert into public.duvidas (client_id, contact_id, categoria, tema, pergunta, resolvida_por, perguntada_em)
     select v.client_id, v.contact_id, v.categoria, coalesce(a.para, v.tema), v.pergunta, v.resolvida_por, v.em
       from (values ${linhas.join(', ')}) as v (client_id, contact_id, categoria, tema, pergunta, resolvida_por, em)
       left join public.apelidos_de_tema a
         on a.client_id = v.client_id and a.categoria = v.categoria and a.de = v.tema`,
    valores,
  )
}

export async function marcarLida(contatoId: string, clienteId: string, ate: string): Promise<void> {
  await bancoDeDados().query(
    `insert into public.duvidas_lidas (contact_id, client_id, ate) values ($1, $2, $3)
     on conflict (contact_id) do update set ate = greatest(public.duvidas_lidas.ate, excluded.ate)`,
    [contatoId, clienteId, ate],
  )
}
