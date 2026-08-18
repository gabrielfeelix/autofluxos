import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { autenticacao, bancoDoLogin } from './auth'

/**
 * Quem está aí do outro lado.
 *
 * Este arquivo é a **fronteira de autorização** do login por usuário. Nenhuma
 * tela pergunta ao Better Auth direto: todas passam por aqui, porque a resposta
 * a "quem é" e a "pode?" precisa ter um lugar só. Espalhar a pergunta é o
 * caminho conhecido para uma tela nova esquecer de fazê-la.
 *
 * **O `proxy.ts` não substitui isto.** Ele decide se a requisição segue, e a
 * própria documentação do Next avisa que Server Action muda de rota com um
 * refactor e sai da cobertura do matcher sem ninguém perceber. Quem autoriza é
 * o servidor que renderiza ou executa, e é este módulo.
 */

/** O papel de **plataforma** — administrador da 4YU. Mora em `af_usuarios.role`. */
const PAPEL_ADMIN = 'admin'

export type UsuarioDaSessao = {
  id: string
  nome: string
  email: string
  /** `admin` = administrador da 4YU. Nulo = usuário comum, dono ou membro de conta. */
  papelDePlataforma: string | null
  banido: boolean
}

export type SessaoAtual = {
  usuario: UsuarioDaSessao
  /** Conta que esta sessão está vendo agora. Nulo = nenhuma escolhida ainda. */
  contaAtivaId: string | null
  /**
   * Id do administrador que abriu esta sessão como outra pessoa.
   * Nulo = é a própria pessoa. É o que a faixa no topo da tela lê.
   */
  impersonadoPor: string | null
}

/**
 * A sessão de agora, ou `null`.
 *
 * **Falha fechada, e de propósito.** Sem `DATABASE_URL`, ou com o banco fora,
 * `getSession` estoura — e uma exceção aqui derrubaria também as telas que hoje
 * funcionam pela senha única, que não têm nada a ver com este sistema. Devolver
 * `null` degrada para "ninguém está logado", que é o lado seguro: quem depende
 * de sessão não entra, e quem não depende continua de pé.
 *
 * O `console.error` existe para a degradação não ser silenciosa. Um painel que
 * manda todo mundo para o login sem dizer por quê é o pior tipo de bug de
 * autenticação: parece comportamento, não parece falha.
 */
export async function sessaoAtual(): Promise<SessaoAtual | null> {
  try {
    const resposta = await autenticacao().api.getSession({ headers: await headers() })
    if (!resposta) return null

    const { user, session } = resposta
    return {
      usuario: {
        id: user.id,
        nome: user.name,
        email: user.email,
        papelDePlataforma: user.role ?? null,
        banido: Boolean(user.banned),
      },
      contaAtivaId: session.activeOrganizationId ?? null,
      impersonadoPor: session.impersonatedBy ?? null,
    }
  } catch (erro) {
    console.error(
      '[sessao] não deu para ler a sessão — tratando como deslogado',
      erro instanceof Error ? erro.message : erro,
    )
    return null
  }
}

/** Sessão obrigatória. Sem ela, vai para a tela de entrar. */
export async function exigirUsuario(): Promise<SessaoAtual> {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')
  return sessao
}

/**
 * O papel de plataforma vem como lista separada por vírgula.
 *
 * É o formato do plugin `admin` (`role: 'admin,suporte'`), e comparar a string
 * inteira com `'admin'` daria falso justamente para quem tem mais de um papel —
 * o erro apareceria no dia em que alguém ganhasse o segundo.
 */
export function ehAdminDaPlataforma(sessao: SessaoAtual | null): boolean {
  if (!sessao || sessao.usuario.banido) return false
  return (sessao.usuario.papelDePlataforma ?? '')
    .split(',')
    .map((papel) => papel.trim())
    .includes(PAPEL_ADMIN)
}

/**
 * Área do administrador da 4YU.
 *
 * Quem não é administrador é mandado para a raiz, e não recebe 403: dizer
 * "existe uma área de administração e você não entra" é contar da existência
 * dela para quem não precisa saber.
 */
export async function exigirAdminDaPlataforma(): Promise<SessaoAtual> {
  const sessao = await exigirUsuario()
  if (!ehAdminDaPlataforma(sessao)) redirect('/')
  return sessao
}

export type ContaDoUsuario = {
  id: string
  nome: string
  slug: string
  logoUrl: string
  /** `owner`, `admin` ou `member` — o papel **dentro desta conta**. */
  papel: string
}

/**
 * As companhias desta pessoa, com o papel dela em cada uma.
 *
 * É o que sustenta o seletor no rodapé da barra lateral (print 24, `+
 * Adicionar nova companhia`). Sai de uma junção porque o endpoint de listar
 * organizações do plugin devolve as contas **sem** o papel, e o papel é
 * metade da resposta: "quais contas eu vejo" e "o que eu posso fazer nelas"
 * são a mesma pergunta na hora de desenhar o menu.
 */
export async function contasDoUsuario(usuarioId: string): Promise<ContaDoUsuario[]> {
  const { rows } = await bancoDoLogin().query(
    `select c.id, c.nome, c.slug, coalesce(c.logo_url, '') as logo_url, m."role" as papel
       from public.af_membros m
       join public.clients c on c.id = m."organizationId"
      where m."userId" = $1
      order by c.nome`,
    [usuarioId],
  )

  return rows.map((linha) => ({
    id: String(linha.id),
    nome: String(linha.nome),
    slug: String(linha.slug),
    logoUrl: String(linha.logo_url),
    papel: String(linha.papel),
  }))
}

/**
 * O papel desta pessoa nesta conta, ou `null` se ela não é membro.
 *
 * **É esta função que fecha o furo que o handoff descreve**: hoje todo
 * repositório assume "quem está logado pode tudo em qualquer cliente". Ela é a
 * pergunta que falta. A varredura que a espalha por todas as rotas é frente
 * própria — aqui ela nasce, e as telas novas já a usam.
 *
 * Administrador da 4YU **não** é tratado como membro por atalho: para agir
 * dentro de uma conta ele usa o "entrar como", que deixa rastro. Um atalho aqui
 * seria exatamente o acesso sem registro que a 0021 existe para impedir.
 */
export async function papelNaConta(usuarioId: string, contaId: string): Promise<string | null> {
  const { rows } = await bancoDoLogin().query(
    'select "role" from public.af_membros where "userId" = $1 and "organizationId" = $2',
    [usuarioId, contaId],
  )
  return rows.length > 0 ? String(rows[0].role) : null
}

/**
 * Já existe alguém cadastrado?
 *
 * O cadastro do primeiro administrador precisa saber disso **antes** de existir
 * qualquer sessão — é a pergunta que não dá para fazer autenticado. Depois do
 * primeiro usuário a resposta nunca mais muda, e é ela que fecha a porta.
 */
export async function existeAlgumUsuario(): Promise<boolean> {
  const { rows } = await bancoDoLogin().query(
    'select 1 from public.af_usuarios limit 1',
  )
  return rows.length > 0
}

/** Quem abriu a impersonação, para a faixa dizer o nome e não só o id. */
export async function acharUsuario(id: string): Promise<UsuarioDaSessao | null> {
  const { rows } = await bancoDoLogin().query(
    'select id, "name", email, "role", "banned" from public.af_usuarios where id = $1',
    [id],
  )
  if (rows.length === 0) return null

  const linha = rows[0]
  return {
    id: String(linha.id),
    nome: String(linha.name),
    email: String(linha.email),
    papelDePlataforma: linha.role === null ? null : String(linha.role),
    banido: Boolean(linha.banned),
  }
}
