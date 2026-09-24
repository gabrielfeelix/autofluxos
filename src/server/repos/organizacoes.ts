import 'server-only'
import { cache } from 'react'
import { bancoDoLogin } from '../auth'
import { chaveDoMes } from './plano'

/**
 * As organizações vistas pela administração da plataforma.
 *
 * Uma consulta só junta o que a tabela mostra (pessoas, automações no ar, quem
 * espera, conversas do mês): a tela de Organizações é a que mais se abre na
 * administração, e cinco idas ao banco por abertura somariam na hora errada.
 *
 * `suspensa_em` é lido por `to_jsonb(c) ->> 'suspensa_em'`, e não pelo nome da
 * coluna, **de propósito**: a coluna nasce numa migration nova (A6), e até ela
 * ser aplicada em produção a leitura precisa devolver nulo em vez de derrubar
 * a tela com "column does not exist".
 */

export type OrganizacaoListada = {
  id: string
  nome: string
  responsavel: string
  email: string
  telefone: string
  logoUrl: string
  plano: string
  criadaEm: string
  suspensaEm: string | null
  pessoas: number
  automacoesNoAr: number
  contatos: number
  esperando: number
  ultimaAtividade: string | null
  conversasNoMes: number
  canais: number
}

export async function listarOrganizacoes(opcoes: { id?: string } = {}): Promise<OrganizacaoListada[]> {
  const mes = chaveDoMes(new Date())
  const { rows } = await bancoDoLogin().query(
    `select c.id,
            c.nome,
            coalesce(c.responsavel, '') as responsavel,
            coalesce(c.email, '') as email,
            coalesce(c.telefone, '') as telefone,
            coalesce(c.logo_url, '') as logo_url,
            coalesce(c.plano, '') as plano,
            c.criado_em,
            to_jsonb(c) ->> 'suspensa_em' as suspensa_em,
            (select count(*)::int from public.af_membros m where m."organizationId" = c.id) as pessoas,
            (select count(*)::int
               from public.flows f
              where f.client_id = c.id and f.versao_publicada_id is not null and f.ativo) as no_ar,
            (select count(*)::int
               from public.channels ch
              where ch.client_id = c.id and ch.desembarcado_em is null) as canais,
            coalesce(r.contatos, 0)::int as contatos,
            coalesce(r.esperando_pessoa, 0)::int as esperando,
            r.ultima_atividade,
            coalesce(cc.conversas, 0)::int as conversas
       from public.clients c
       left join public.resumo_clientes r on r.client_id = c.id
       left join public.consumo_de_conversas cc on cc.client_id = c.id and cc.mes = $1
      where ($2::uuid is null or c.id = $2::uuid)
      order by c.nome`,
    [mes, opcoes.id ?? null],
  )

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    responsavel: String(linha.responsavel),
    email: String(linha.email),
    telefone: String(linha.telefone),
    logoUrl: String(linha.logo_url),
    plano: String(linha.plano),
    criadaEm: new Date(linha.criado_em).toISOString(),
    suspensaEm: linha.suspensa_em ? new Date(linha.suspensa_em).toISOString() : null,
    pessoas: Number(linha.pessoas),
    automacoesNoAr: Number(linha.no_ar),
    contatos: Number(linha.contatos),
    esperando: Number(linha.esperando),
    ultimaAtividade: linha.ultima_atividade ? new Date(linha.ultima_atividade).toISOString() : null,
    conversasNoMes: Number(linha.conversas),
    canais: Number(linha.canais),
  }))
}

export async function acharOrganizacao(id: string): Promise<OrganizacaoListada | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null
  const [organizacao] = await listarOrganizacoes({ id })
  return organizacao ?? null
}

export type PessoaDaOrganizacao = {
  id: string
  nome: string
  email: string
  papel: string
  /** A função gravada (A7). Nula enquanto a coluna não existe ou não foi preenchida. */
  funcaoId: string | null
  banido: boolean
  desde: string
  ultimoAcesso: string | null
}

/**
 * Quem tem acesso a esta organização, com o último acesso de cada um.
 *
 * `funcao_id` vem por `to_jsonb(m)` pelo mesmo motivo de `suspensa_em`: a
 * coluna chega com a migration das funções (A7) e a tela não pode cair antes.
 */
export async function pessoasDaOrganizacao(id: string): Promise<PessoaDaOrganizacao[]> {
  const { rows } = await bancoDoLogin().query(
    `select u.id,
            u."name" as nome,
            u.email,
            m."role" as papel,
            to_jsonb(m) ->> 'funcao_id' as funcao_id,
            coalesce(u."banned", false) as banido,
            m."createdAt" as desde,
            (select max(s."createdAt") from public.af_sessoes s where s."userId" = u.id) as ultimo
       from public.af_membros m
       join public.af_usuarios u on u.id = m."userId"
      where m."organizationId" = $1
      order by case m."role" when 'owner' then 0 when 'admin' then 1 else 2 end, u."name"`,
    [id],
  )
  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    email: String(linha.email),
    papel: String(linha.papel),
    funcaoId: linha.funcao_id ? String(linha.funcao_id) : null,
    banido: Boolean(linha.banido),
    desde: new Date(linha.desde).toISOString(),
    ultimoAcesso: linha.ultimo ? new Date(linha.ultimo).toISOString() : null,
  }))
}

export type CanalDaOrganizacao = { id: string; tipo: string; nome: string; status: string; desde: string }

/** Os canais ligados (WhatsApp, Instagram), para o Resumo. */
export async function canaisDaOrganizacao(id: string): Promise<CanalDaOrganizacao[]> {
  const { rows } = await bancoDoLogin().query(
    `select ch.id, ch.provider, ch.status, ch.criado_em,
            coalesce(nullif(ch.verified_name, ''), '') as verificado,
            coalesce(nullif(ch.display_phone_number, ''), '') as numero,
            coalesce(nullif(ch.ig_username, ''), '') as instagram
       from public.channels ch
      where ch.client_id = $1 and ch.desembarcado_em is null
      order by ch.criado_em`,
    [id],
  )
  return rows.map((linha) => {
    const instagram = String(linha.instagram)
    const tipo = instagram || String(linha.provider).includes('instagram') ? 'Instagram' : 'WhatsApp'
    return {
      id: String(linha.id),
      tipo,
      nome: instagram ? `@${instagram}` : [String(linha.verificado), String(linha.numero)].filter(Boolean).join(' · ') || 'número sem nome',
      status: String(linha.status ?? ''),
      desde: new Date(linha.criado_em).toISOString(),
    }
  })
}

/** Grava a suspensão. Devolve `false` quando a coluna ainda não existe (A6 não aplicada). */
export async function definirSuspensao(id: string, suspensa: boolean): Promise<{ ok: boolean; motivo?: string }> {
  try {
    await bancoDoLogin().query(`update public.clients set suspensa_em = $2 where id = $1`, [
      id,
      suspensa ? new Date().toISOString() : null,
    ])
    return { ok: true }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : ''
    if (/suspensa_em/.test(mensagem) && /does not exist|não existe/.test(mensagem)) {
      return { ok: false, motivo: 'a suspensão chega com a migration de planos, que ainda não foi aplicada neste banco' }
    }
    return { ok: false, motivo: mensagem || 'não deu para gravar' }
  }
}

/** Esta organização está suspensa? Falha aberta: sem a coluna, ninguém está. */
export const organizacaoSuspensa = cache(async (id: string): Promise<boolean> => {
  try {
    const { rows } = await bancoDoLogin().query(
      `select to_jsonb(c) ->> 'suspensa_em' as suspensa_em from public.clients c where c.id = $1`,
      [id],
    )
    return !!rows[0]?.suspensa_em
  } catch {
    return false
  }
})
