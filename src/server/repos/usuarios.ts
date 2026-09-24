import 'server-only'
import { bancoDoLogin } from '../auth'

/**
 * As pessoas e as contas, do ponto de vista de quem administra a plataforma.
 *
 * **Este repositório fala Postgres direto, e é a exceção da casa.** Todo o resto
 * de `repos/` usa `supabase-js` por cima do PostgREST; as tabelas do Better Auth
 * (`af_usuarios`, `af_sessoes`, `af_membros`) foram deliberadamente deixadas
 * fora da Data API na 0019, `af_contas` guarda hash de senha e `af_sessoes`
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
 * conta nenhuma virar `[{null}]`, e quem não tem conta nenhuma é exatamente o
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
  /** Quantas automações a conta tem, e quantas estão atendendo gente agora. */
  fluxos: number
  noAr: number
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
            ) as membros,
            /*
             * As duas contagens que fazem a lista dizer alguma coisa.
             *
             * Sem elas, quinze cartões idênticos só respondem "existe", e a
             * pergunta de quem administra é outra: esta conta está atendendo
             * gente, ou é um teste esquecido? Subconsulta e não mais um join:
             * o group by já é do json_agg dos membros, e somar outro join
             * multiplicaria as linhas antes de contar.
             * (Sem crase neste comentário: ele mora dentro de um template
             * literal, e uma crase aqui encerra a string do TypeScript.)
             */
            (select count(*) from public.flows f where f.client_id = c.id) as fluxos,
            (select count(*)
               from public.flows f
              where f.client_id = c.id
                and f.versao_publicada_id is not null
                and f.ativo) as no_ar
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
    fluxos: Number(linha.fluxos ?? 0),
    noAr: Number(linha.no_ar ?? 0),
  }))
}

export type MembroDaConta = {
  id: string
  nome: string
  email: string
  papel: string
  /** `disponivel` | `ausente`. É o que decide a quem o Inbox oferece a conversa. */
  presenca: string
}

/**
 * Quem atende nesta conta, e quem está por perto agora.
 *
 * A presença não é enfeite: atribuir uma conversa a quem está de férias é o
 * mesmo que não atribuir, a pessoa continua esperando, e agora com um nome ao
 * lado dando a impressão de que alguém está cuidando.
 *
 * Ordem: disponível primeiro, depois por nome. A lista é usada para escolher, e
 * a escolha certa tem que estar em cima.
 */
export async function membrosDaConta(contaId: string): Promise<MembroDaConta[]> {
  const { rows } = await bancoDoLogin().query(
    `select u.id, u."name" as nome, u.email, m."role" as papel, u."presenca"
       from public.af_membros m
       join public.af_usuarios u on u.id = m."userId"
      where m."organizationId" = $1
        and coalesce(u."banned", false) = false
      order by (u."presenca" <> 'disponivel'), u."name"`,
    [contaId],
  )

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    email: String(linha.email),
    papel: String(linha.papel),
    presenca: String(linha.presenca),
  }))
}

/** Muda a própria presença. Só o dono da sessão chama isto. */
export async function definirPresenca(usuarioId: string, presenca: 'disponivel' | 'ausente') {
  await bancoDoLogin().query('update public.af_usuarios set "presenca" = $1 where id = $2', [
    presenca,
    usuarioId,
  ])
}

/** A presença de uma pessoa só. Nulo = usuário sumiu entre a sessão e a leitura. */
export async function presencaDoUsuario(usuarioId: string): Promise<string | null> {
  const { rows } = await bancoDoLogin().query(
    'select "presenca" from public.af_usuarios where id = $1',
    [usuarioId],
  )
  return rows.length > 0 ? String(rows[0].presenca) : null
}

/**
 * O papel desta pessoa nesta conta, ou `null` se ela não está nela.
 *
 * Existe para "dar acesso" saber que não tem nada a fazer. O plugin de
 * organização recusa membro repetido com um erro que sobe como erro de Server
 * Component, tela genérica, sem dizer o que houve , e o vínculo já foi
 * gravado na primeira tentativa: quem clica de novo está pedindo algo que já
 * está feito, e isso é sucesso, não falha.
 */
export async function papelNaConta(contaId: string, usuarioId: string): Promise<string | null> {
  const { rows } = await bancoDoLogin().query(
    'select "role" from public.af_membros where "organizationId" = $1 and "userId" = $2',
    [contaId, usuarioId],
  )
  return rows.length > 0 ? String(rows[0].role) : null
}

/**
 * Troca o papel de alguém **dentro de uma conta**.
 *
 * Por SQL e não pelo plugin de organização: os endpoints dele exigem a sessão
 * de quem tem permissão na conta, e boa parte do painel ainda entra pela senha
 * única, sem sessão nenhuma. Quem autoriza aqui é `podeAdministrarConta` na
 * ação; esta função só escreve.
 */
export async function definirPapelNaConta(
  contaId: string,
  usuarioId: string,
  papel: 'owner' | 'admin' | 'member',
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  /*
   * **Rebaixar o último dono é recusado** (UI-18).
   *
   * `removerComDestino` já protegia a saída do último `owner` desde sempre, mas a
   * troca de papel não: `owner` -> `member` num clique deixava a conta sem
   * dono nenhum, pela porta ao lado. O caminho de volta é um `insert` na mão,
   * e é o tipo de estado que ninguém percebe ter criado até precisar.
   *
   * A conferência e a escrita são duas idas ao banco, e a corrida entre dois
   * administradores rebaixando o mesmo dono ao mesmo tempo é teórica: são duas
   * pessoas clicando no mesmo segundo na mesma conta. Fechá-la exigiria trava
   * de linha aqui, e o custo não paga, o estado resultante é recuperável por
   * quem administra a plataforma, e a proteção cobre o caso real, que é o
   * clique único.
   */
  if (papel !== 'owner') {
    const { rows } = await bancoDoLogin().query(
      `select "userId" from public.af_membros where "organizationId" = $1 and "role" = 'owner'`,
      [contaId],
    )
    const donos = rows.map((linha) => String(linha.userId))
    if (donos.length === 1 && donos[0] === usuarioId) {
      return {
        ok: false,
        motivo: 'esta é a única pessoa dona da conta, dê a posse a outra antes de rebaixá-la',
      }
    }
  }

  const { rowCount } = await bancoDoLogin().query(
    'update public.af_membros set "role" = $1 where "organizationId" = $2 and "userId" = $3',
    [papel, contaId, usuarioId],
  )
  return (rowCount ?? 0) === 1
    ? { ok: true }
    : { ok: false, motivo: 'esta pessoa não está nesta conta' }
}

/**
 * Tira alguém da conta **e** decide o destino do que era dela (E15, RB-40).
 *
 * Numa transação só: reatribuir e remover são uma decisão, e metade dela
 * gravada (a pessoa saiu, as conversas continuam apontando para ela) é
 * exatamente a referência sem tratamento que a RB-40 proíbe.
 *
 * `destino` nulo quer dizer "deixar sem responsável": conversas voltam para a
 * fila, cartões e atividades abertas ficam sem dono. Com destino, ele precisa
 * ser outra pessoa **desta** conta, conferido aqui dentro, e nunca confiado à
 * tela. Só o que está aberto muda de mão: venda ganha e atividade concluída
 * continuam no nome de quem fez (é histórico).
 */
export async function removerComDestino(
  contaId: string,
  usuarioId: string,
  destino: string | null,
): Promise<
  | { ok: true; conversas: number; cartoes: number; atividades: number }
  | { ok: false; motivo: string }
> {
  if (destino === usuarioId) return { ok: false, motivo: 'escolha outra pessoa para receber' }

  const cliente = await bancoDoLogin().connect()
  try {
    await cliente.query('begin')
    const { rows } = await cliente.query(
      `select "userId", "role" from public.af_membros where "organizationId" = $1 for update`,
      [contaId],
    )
    const alvo = rows.find((linha) => String(linha.userId) === usuarioId)
    if (!alvo) {
      await cliente.query('rollback')
      return { ok: false, motivo: 'esta pessoa não está nesta conta' }
    }
    const donos = rows.filter((linha) => String(linha.role) === 'owner')
    if (String(alvo.role) === 'owner' && donos.length === 1) {
      await cliente.query('rollback')
      return { ok: false, motivo: 'esta é a única pessoa dona da conta, dê a posse a outra antes' }
    }
    if (destino !== null && !rows.some((linha) => String(linha.userId) === destino)) {
      await cliente.query('rollback')
      return { ok: false, motivo: 'quem vai receber não está nesta conta' }
    }

    const conversas = await cliente.query(
      'update public.contacts set atribuido_a = $3 where client_id = $1 and atribuido_a = $2',
      [contaId, usuarioId, destino],
    )
    const cartoes = await cliente.query(
      `update public.quadro_cartoes set responsavel = $3
        where client_id = $1 and responsavel = $2 and situacao = 'aberta'`,
      [contaId, usuarioId, destino],
    )
    const atividades = await cliente.query(
      `update public.atividades set responsavel = $3
        where client_id = $1 and responsavel = $2 and situacao = 'aberta'`,
      [contaId, usuarioId, destino],
    )
    /*
     * As exceções de acesso e as equipes saem junto. O cascade da 0073 só
     * dispara quando o usuário é apagado, e sair da conta não apaga ninguém:
     * sem isto, quem fosse cadastrado de novo meses depois voltaria com a
     * exceção antiga (um `exportar` liberado, por exemplo) sem ninguém ver.
     */
    await cliente.query(
      'delete from public.membro_capacidades where client_id = $1 and usuario_id = $2',
      [contaId, usuarioId],
    )
    await cliente.query(
      'delete from public.equipe_membros where client_id = $1 and usuario_id = $2',
      [contaId, usuarioId],
    )
    await cliente.query(
      'delete from public.af_membros where "organizationId" = $1 and "userId" = $2',
      [contaId, usuarioId],
    )
    await cliente.query('commit')
    return {
      ok: true,
      conversas: conversas.rowCount ?? 0,
      cartoes: cartoes.rowCount ?? 0,
      atividades: atividades.rowCount ?? 0,
    }
  } catch (erro) {
    await cliente.query('rollback').catch(() => {})
    throw erro
  } finally {
    cliente.release()
  }
}

/** O usuário com este e-mail, se existir. É como "cadastrar" vira "vincular". */
export async function acharUsuarioPorEmail(
  email: string,
): Promise<{ id: string; nome: string } | null> {
  const { rows } = await bancoDoLogin().query(
    'select id, "name" as nome from public.af_usuarios where lower(email) = lower($1)',
    [email.trim()],
  )
  return rows.length > 0 ? { id: String(rows[0].id), nome: String(rows[0].nome) } : null
}

/**
 * Nome e foto da **própria** pessoa (tarefa 7.5).
 *
 * Recebe o id de quem chamou, e quem chama é a ação, que o tira da sessão:
 * nenhum caminho aceita id vindo da tela. `imagem` ausente não mexe na foto;
 * `null` tira. Devolve a foto anterior, para a ação apagar o arquivo velho.
 */
export async function atualizarPerfil(
  usuarioId: string,
  campos: { nome: string; imagem?: string | null },
): Promise<{ ok: true; imagemAnterior: string | null } | { ok: false; motivo: string }> {
  const nome = campos.nome.trim()
  if (nome === '') return { ok: false, motivo: 'o nome não pode ficar vazio' }
  if (nome.length > 80) return { ok: false, motivo: 'o nome passa de 80 letras' }

  const { rows } = await bancoDoLogin().query(
    `with antes as (select image from public.af_usuarios where id = $1)
     update public.af_usuarios
        set "name" = $2,
            image = case when $3 then $4 else image end,
            "updatedAt" = now()
      where id = $1
     returning (select image from antes) as anterior`,
    [usuarioId, nome, campos.imagem !== undefined, campos.imagem ?? null],
  )
  if (rows.length === 0) return { ok: false, motivo: 'pessoa não encontrada' }
  return { ok: true, imagemAnterior: rows[0].anterior ? String(rows[0].anterior) : null }
}

/**
 * As organizações em que o login é o **único** dono. Excluir o login deixaria
 * cada uma sem dono, então a exclusão pede para passar a posse antes (A9).
 */
export async function organizacoesSoDele(usuarioId: string): Promise<{ id: string; nome: string }[]> {
  const { rows } = await bancoDoLogin().query(
    `select c.id, c.nome
       from public.af_membros m
       join public.clients c on c.id = m."organizationId"
      where m."userId" = $1 and m."role" = 'owner'
        and (select count(*) from public.af_membros o where o."organizationId" = m."organizationId" and o."role" = 'owner') = 1
      order by c.nome`,
    [usuarioId],
  )
  return rows.map((linha) => ({ id: String(linha.id), nome: String(linha.nome) }))
}
