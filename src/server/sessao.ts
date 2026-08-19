import 'server-only'
import { cookies, headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import {
  COOKIE_PAINEL,
  basicAuthConfere,
  conferirSessao,
  segredoDeSessao,
} from '@/lib/painel-auth'
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

/**
 * Para onde a pessoa vai quando entra — e para onde a tela de entrar a manda se
 * ela já estava logada.
 *
 * Mora aqui, e não junto das ações, porque **duas** telas precisam da mesma
 * resposta: a que acabou de autenticar e a que descobre uma sessão já aberta.
 * Duas cópias divergem no dia em que o administrador ganhar uma tela inicial
 * própria.
 */
export async function destinoAposEntrar(sessao: SessaoAtual): Promise<string> {
  if (ehAdminDaPlataforma(sessao)) return '/admin/contas'

  const [primeira, ...resto] = await contasDoUsuario(sessao.usuario.id)
  // Uma conta só é o caso comum, e mandar essa pessoa para um seletor de um
  // item é fazê-la clicar para confirmar o óbvio.
  if (primeira && resto.length === 0) return `/clientes/${primeira.id}`
  return '/contas'
}

/**
 * A senha única ainda vale nesta requisição?
 *
 * O `proxy.ts` já respondeu isso para deixar a requisição passar, e este módulo
 * precisa da mesma resposta para decidir se quem chegou pode ver a conta. São
 * perguntas diferentes com a mesma conta a pagar: sem isto, o operador de hoje
 * — que entra pela senha e não tem usuário nenhum — perderia o painel inteiro
 * no instante em que a moldura do cliente passasse a exigir sessão de usuário.
 */
export async function temSessaoDePainel(): Promise<boolean> {
  const senha = process.env.PAINEL_SENHA
  // Sem senha configurada ela não é uma porta. Em desenvolvimento o painel
  // segue aberto, como no proxy: quem clonou o repositório ainda não tem
  // credencial nenhuma.
  if (!senha) return process.env.NODE_ENV !== 'production'

  const cabecalhos = await headers()
  if (basicAuthConfere(cabecalhos.get('authorization'), senha)) return true

  const cookie = (await cookies()).get(COOKIE_PAINEL)?.value ?? ''
  return conferirSessao(cookie, segredoDeSessao(senha))
}

export type AcessoAoCliente = {
  /** Nulo quando quem entrou foi a senha única do time. */
  sessao: SessaoAtual | null
  /** `owner`, `admin`, `member` — ou nulo para administrador da 4YU e senha única. */
  papel: string | null
  viaSenhaUnica: boolean
}

/**
 * Pode ver esta conta?
 *
 * **A sessão de usuário tem precedência sobre a senha única.** Quem entrou como
 * pessoa vê o que aquela pessoa vê, e não o painel inteiro — senão o login por
 * usuário seria decoração por cima do acesso total que já existe. Para agir
 * dentro da conta de um cliente, o administrador usa o "entrar como", que
 * deixa rastro na auditoria.
 *
 * O administrador da 4YU passa mesmo sem ser membro **enquanto a senha única
 * existir**: hoje ele já alcança tudo, e fechar essa porta antes de a varredura
 * de isolamento terminar trocaria um furo conhecido por um painel quebrado. No
 * dia em que a senha única sair (docs/HANDOFF.md §4, passo 6), esta linha é a
 * que estreita para "só impersonando".
 *
 * Quem não pode recebe **404**, e não 403: confirmar que a conta existe já é
 * contar de um cliente para quem não é dele.
 */
export async function exigirAcessoAoCliente(contaId: string): Promise<AcessoAoCliente> {
  const acesso = await conferirAcessoAoCliente(contaId)
  if (acesso) return acesso

  // Sem sessão nenhuma é "entre"; com sessão e sem direito é "não existe".
  if (await sessaoAtual()) notFound()
  redirect('/entrar')
}

/**
 * A mesma pergunta, sem redirecionar — é a forma que serve a rota de API.
 *
 * Rota de API não redireciona nem renderiza 404: ela responde status. Ter as
 * duas formas em cima da mesma função é o que impede a regra de divergir entre
 * a tela e a API que a alimenta, que é como um caminho fica aberto depois de o
 * outro fechar.
 */
export async function conferirAcessoAoCliente(contaId: string): Promise<AcessoAoCliente | null> {
  const sessao = await sessaoAtual()

  if (sessao) {
    const papel = await papelNaConta(sessao.usuario.id, contaId)
    if (papel !== null) return { sessao, papel, viaSenhaUnica: false }
    if (ehAdminDaPlataforma(sessao)) return { sessao, papel: null, viaSenhaUnica: false }
    return null
  }

  if (await temSessaoDePainel()) return { sessao: null, papel: null, viaSenhaUnica: true }
  return null
}

/**
 * Pode **administrar** esta conta — mexer em quem entra nela?
 *
 * `exigirAcessoAoCliente` responde "pode ver"; isto responde "pode mexer na
 * equipe". São perguntas diferentes e a distância entre elas é escalada de
 * privilégio: um `member` que pudesse cadastrar gente criaria a própria conta
 * de administrador e sairia do papel em que foi posto.
 *
 * `owner` e `admin` da conta passam. O administrador da 4YU e a senha única
 * também — os dois já alcançam tudo hoje, e recusar aqui quebraria o painel
 * antes de a senha única sair.
 */
export function podeAdministrarConta(acesso: AcessoAoCliente): boolean {
  if (acesso.papel === 'owner' || acesso.papel === 'admin') return true
  // Papel nulo com sessão é administrador da 4YU; papel nulo sem sessão é a
  // senha única. Ver `conferirAcessoAoCliente`.
  return acesso.papel === null
}

/**
 * A visão de quem opera a 4YU: a lista de todos os clientes e o que nasce dela.
 *
 * Criar cliente não tem `clienteId` para conferir — o cliente ainda não existe.
 * A pergunta certa é outra: **quem pode criar?** Hoje, quem já enxerga a
 * carteira inteira, que é o operador da senha única e o administrador da
 * plataforma. Um dono de conta cria companhia por `/contas`, que é caminho
 * dele e passa pelo plugin.
 */
export async function exigirOperadorDa4YU(): Promise<void> {
  const sessao = await sessaoAtual()

  if (sessao) {
    if (!ehAdminDaPlataforma(sessao)) redirect('/contas')
    return
  }

  if (await temSessaoDePainel()) return
  redirect('/entrar')
}
