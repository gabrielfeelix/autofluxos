import 'server-only'
import { bancoDoLogin } from '../auth'

/**
 * As pessoas e as contas, do ponto de vista de quem administra a plataforma.
 *
 * **Este repositório fala Postgres direto, e é a exceção da casa.** Todo o resto
 * de `repos/` usa `supabase-js` por cima do PostgREST; as tabelas do Better Auth
 * (`af_usuarios`, `af_sessoes`, `af_membros`) foram deliberadamente deixadas
 * fora da Data API na 0019 — `af_contas` guarda hash de senha e `af_sessoes`
 * guarda token, e expor isso pelo PostgREST seria o pior vazamento possível
 * deste projeto. Quem já tem conexão com elas é o pool do login, e é ele que
 * este arquivo reaproveita.
 *
 * Consequência prática: aqui se escreve SQL. Identificador nunca vem de fora,
 * valor sempre vai como `$1`.
 */

export type UsuarioListado = {
  id: string
  nome: string
  email: string
  /** `admin` = administrador da 4YU. Vazio = usuário comum. */
  papelDePlataforma: string
  banido: boolean
  motivoDoBanimento: string
  criadoEm: string
  /** Quantas sessões ainda válidas. É o que dá sentido a "revogar sessões". */
  sessoesAtivas: number
  contas: { id: string; nome: string; papel: string }[]
}

/**
 * Todo mundo, com as contas de cada um.
 *
 * A junção acontece no banco e não em três consultas no Next porque a resposta
 * é uma tela só. `json_agg` com `filter` é o que evita a linha de quem não tem
 * conta nenhuma virar `[{null}]` — e quem não tem conta nenhuma é exatamente o
 * usuário recém-criado, que é quem mais aparece nesta tela.
 */
export async function listarUsuarios(): Promise<UsuarioListado[]> {
  const { rows } = await bancoDoLogin().query(
    `select u.id,
            u."name"                        as nome,
            u.email,
            coalesce(u."role", '')          as papel,
            coalesce(u."banned", false)     as banido,
            coalesce(u."banReason", '')     as motivo,
            u."createdAt"                   as criado_em,
            (select count(*)::int
               from public.af_sessoes s
              where s."userId" = u.id and s."expiresAt" > now()) as sessoes,
            coalesce(
              json_agg(
                json_build_object('id', c.id, 'nome', c.nome, 'papel', m."role")
                order by c.nome
              ) filter (where c.id is not null),
              '[]'
            ) as contas
       from public.af_usuarios u
       left join public.af_membros m on m."userId" = u.id
       left join public.clients c    on c.id = m."organizationId"
      group by u.id
      order by u."createdAt"`,
  )

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    email: String(linha.email),
    papelDePlataforma: String(linha.papel),
    banido: Boolean(linha.banido),
    motivoDoBanimento: String(linha.motivo),
    criadoEm: new Date(linha.criado_em).toISOString(),
    sessoesAtivas: Number(linha.sessoes),
    contas: (linha.contas as { id: string; nome: string; papel: string }[]).map((conta) => ({
      id: String(conta.id),
      nome: String(conta.nome),
      papel: String(conta.papel),
    })),
  }))
}

export type ContaComMembros = {
  id: string
  nome: string
  slug: string
  logoUrl: string
  membros: { id: string; nome: string; email: string; papel: string }[]
}

/**
 * As contas com quem entra nelas.
 *
 * A lista inclui conta **sem membro nenhum** de propósito: são os clientes
 * criados antes do login existir, e são justamente os que precisam de ação. Uma
 * lista que só mostra o que já está resolvido esconde o trabalho.
 */
export async function listarContasComMembros(): Promise<ContaComMembros[]> {
  const { rows } = await bancoDoLogin().query(
    `select c.id,
            c.nome,
            c.slug,
            coalesce(c.logo_url, '') as logo_url,
            coalesce(
              json_agg(
                json_build_object('id', u.id, 'nome', u."name", 'email', u.email, 'papel', m."role")
                order by m."role", u."name"
              ) filter (where u.id is not null),
              '[]'
            ) as membros
       from public.clients c
       left join public.af_membros m  on m."organizationId" = c.id
       left join public.af_usuarios u on u.id = m."userId"
      group by c.id
      order by c.nome`,
  )

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    slug: String(linha.slug),
    logoUrl: String(linha.logo_url),
    membros: (linha.membros as ContaComMembros['membros']).map((membro) => ({
      id: String(membro.id),
      nome: String(membro.nome),
      email: String(membro.email),
      papel: String(membro.papel),
    })),
  }))
}
