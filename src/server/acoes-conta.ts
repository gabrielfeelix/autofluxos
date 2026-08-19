'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { autenticacao, bancoDoLogin } from './auth'
import { chaveDeLimite, consumirLimite } from './limite'
import { registrar } from './repos/auditoria'
import { definirPresenca } from './repos/usuarios'
import {
  acharUsuario,
  contasDoUsuario,
  destinoAposEntrar,
  ehAdminDaPlataforma,
  existeAlgumUsuario,
  exigirAdminDaPlataforma,
  temSessaoDePainel,
  sessaoAtual,
} from './sessao'

/**
 * O que as telas de login por usuário chamam.
 *
 * Vive separado de `acoes.ts` de propósito: aquele arquivo é o painel operando
 * (fluxo, contato, credencial), este é quem entra e o que pode. Misturar os
 * dois faria toda tela do produto importar o login e vice-versa.
 *
 * **Toda ação daqui confere a autorização por conta própria.** O `proxy.ts`
 * decide se a requisição segue; Server Action é um POST na rota onde ela é
 * usada, e um refactor que a mova de rota sai do matcher em silêncio. Quem
 * autoriza é este arquivo.
 */

/**
 * `email` volta junto do erro pelo mesmo motivo da tela antiga: o formulário é
 * reconstruído a cada tentativa, e redigitar o e-mail depois de errar a senha é
 * castigo sem motivo.
 */
export type EstadoDeConta = { erro?: string; email?: string; nome?: string }

/**
 * A mensagem de erro é sempre a mesma para senha errada e para e-mail que não
 * existe.
 *
 * Diferenciar as duas transforma a tela de login numa lista de quem tem conta
 * aqui — e essa lista, num produto de agência, é a lista de clientes.
 */
const CREDENCIAL_NAO_CONFERE = 'Credenciais não conferem. Verifique e tente de novo.'

function motivo(erro: unknown): string {
  if (erro instanceof Error && erro.message) return erro.message
  return 'não deu para completar a operação'
}

// ---------------------------------------------------------------------------
// Entrar e sair
// ---------------------------------------------------------------------------

export async function acaoEntrar(
  _estado: EstadoDeConta,
  formData: FormData,
): Promise<EstadoDeConta> {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  const cabecalhos = await headers()
  if (!(await consumirLimite(chaveDeLimite('login', cabecalhos)))) {
    return { erro: 'Muitas tentativas, espere alguns minutos antes de tentar novamente.', email }
  }

  try {
    await autenticacao().api.signInEmail({ body: { email, password: senha }, headers: cabecalhos })
  } catch {
    return { erro: CREDENCIAL_NAO_CONFERE, email }
  }

  const sessao = await sessaoAtual()
  if (!sessao) return { erro: CREDENCIAL_NAO_CONFERE, email }

  if (sessao.usuario.banido) {
    await autenticacao().api.signOut({ headers: await headers() })
    return { erro: 'Este acesso está suspenso. Fale com quem administra o painel.', email }
  }

  // `redirect` funciona lançando: precisa ficar fora do `try`, senão o próprio
  // catch o engoliria e a tela responderia "credenciais não conferem" depois de
  // um login que deu certo.
  redirect(await destinoAposEntrar(sessao))
}

export async function acaoSair() {
  await autenticacao().api.signOut({ headers: await headers() })
  redirect('/entrar')
}

// ---------------------------------------------------------------------------
// O primeiro administrador
// ---------------------------------------------------------------------------

/**
 * Cadastra o primeiro usuário da plataforma, e só o primeiro.
 *
 * **Por que existe uma porta de primeira execução:** o convite por e-mail
 * depende de SMTP, e SMTP é global ao projeto compartilhado com a Verandi (ver
 * BANCO-COMPARTILHADO.md) — ligar isso é decisão dos dois produtos, não desta
 * frente. Sem convite, alguém precisa nascer administrador, e não existe
 * administrador para autorizar o primeiro.
 *
 * **Por que isso não é um buraco:** a porta fecha sozinha no instante em que o
 * primeiro usuário existe, e nunca mais abre — a pergunta que a destranca é
 * "não há ninguém cadastrado?", e ela só tem uma resposta afirmativa na vida do
 * sistema. Depois disso, só administrador cria gente, pela área de
 * administração. Enquanto a senha única existir, ela também protege o caminho
 * até aqui.
 */
export async function acaoCriarPrimeiroAdministrador(
  _estado: EstadoDeConta,
  formData: FormData,
): Promise<EstadoDeConta> {
  const nome = String(formData.get('nome') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  const cabecalhos = await headers()
  if (!(await consumirLimite(chaveDeLimite('cadastro', cabecalhos)))) {
    return { erro: 'Muitas tentativas, espere alguns minutos antes de tentar novamente.', email, nome }
  }

  if (nome === '' || email === '') {
    return { erro: 'Nome e e-mail são obrigatórios.', email, nome }
  }

  const sessao = await sessaoAtual()
  const jaTemGente = await existeAlgumUsuario()

  // Depois do primeiro, esta tela vira o cadastro que **um administrador** faz.
  if (jaTemGente && !ehAdminDaPlataforma(sessao)) {
    return { erro: 'O cadastro é feito por quem administra a plataforma.', email, nome }
  }

  /**
   * A porta de primeira execução exige a senha única.
   *
   * O `proxy.ts` já recusa quem chega aqui sem ela, e isto não é redundância
   * inútil: Server Action é um POST na rota onde ela é usada, e a própria
   * documentação do Next avisa que mover a ação de rota a tira do matcher sem
   * ninguém perceber. Uma porta que faz alguém nascer administrador não pode
   * depender de um arquivo de configuração continuar apontando para o lugar
   * certo.
   */
  if (!jaTemGente && !(await temSessaoDePainel())) {
    return { erro: 'O primeiro cadastro é feito de dentro do painel.', email, nome }
  }

  try {
    const criado = await autenticacao().api.signUpEmail({
      body: { name: nome, email, password: senha },
    })

    /**
     * O papel de plataforma entra por SQL, e é o único lugar do código que faz
     * isso.
     *
     * `setRole` do plugin `admin` exige uma sessão de administrador — que é
     * exatamente o que ainda não existe quando o primeiro está nascendo. Fora
     * desta função, o papel sempre passa pelo plugin.
     */
    if (!jaTemGente) {
      await bancoDoLogin().query('update public.af_usuarios set "role" = $1 where id = $2', [
        'admin',
        criado.user.id,
      ])
    }

    await registrar({
      acao: jaTemGente ? 'criou_usuario' : 'criou_primeiro_administrador',
      autorId: sessao?.usuario.id ?? criado.user.id,
      autorEmail: sessao?.usuario.email ?? email,
      alvoTipo: 'usuario',
      alvoId: criado.user.id,
      alvoNome: nome,
      detalhes: { papelDePlataforma: jaTemGente ? '' : 'admin' },
      impersonadoPor: sessao?.impersonadoPor ?? null,
    })
  } catch (erro) {
    return { erro: motivo(erro), email, nome }
  }

  // Quem acabou de nascer administrador entra direto; quem foi cadastrado por
  // um administrador não rouba a sessão de quem o cadastrou.
  if (!jaTemGente) {
    await autenticacao().api.signInEmail({ body: { email, password: senha }, headers: cabecalhos })
    redirect('/admin/contas')
  }

  revalidatePath('/admin/usuarios')
  redirect('/admin/usuarios')
}

// ---------------------------------------------------------------------------
// Companhias
// ---------------------------------------------------------------------------

/**
 * Troca a companhia ativa da sessão.
 *
 * Guardar isso **na sessão** (`af_sessoes."activeOrganizationId"`, migration
 * 0020) e não num cookie próprio é o que faz o servidor nunca precisar
 * acreditar no navegador sobre em qual conta a pessoa está.
 */
export async function acaoTrocarDeCompanhia(contaId: string) {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const contas = await contasDoUsuario(sessao.usuario.id)
  // A lista vem do banco, não do formulário: um `contaId` postado à mão não
  // pode virar acesso a uma conta de que a pessoa não é membro.
  if (!contas.some((conta) => conta.id === contaId)) redirect('/contas')

  await autenticacao().api.setActiveOrganization({
    headers: await headers(),
    body: { organizationId: contaId },
  })

  revalidatePath('/', 'layout')
  redirect(`/clientes/${contaId}`)
}

/**
 * Cria uma companhia nova para quem está logado — o `+ Adicionar nova
 * companhia` do print 24.
 *
 * A forma do retorno é a que o `ModalFormulario` entende: devolver
 * `{ ok: false, erro }` faz o modal mostrar a mensagem em vez de fechar. Sem
 * isso, um nome recusado vira o digest opaco do Next e a pessoa perde o que
 * digitou.
 */
export async function acaoCriarCompanhia(
  formData: FormData,
): Promise<{ ok: boolean; erro?: string } | void> {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  const nome = String(formData.get('nome') ?? '').trim()
  if (nome === '') return { ok: false, erro: 'O nome da companhia é obrigatório.' }

  let id: string
  try {
    const conta = await autenticacao().api.createOrganization({
      headers: await headers(),
      // O slug do plugin é obrigatório; o gatilho da 0020 preenche o dele
      // sozinho quando ninguém manda, mas aqui quem manda é a biblioteca.
      body: { name: nome, slug: sugerirSlug(nome) },
    })
    if (!conta) return { ok: false, erro: 'não deu para criar a companhia' }
    id = conta.id

    await registrar({
      acao: 'criou_conta',
      autorId: sessao.usuario.id,
      autorEmail: sessao.usuario.email,
      contaId: id,
      contaNome: nome,
      alvoTipo: 'client',
      alvoId: id,
      alvoNome: nome,
      impersonadoPor: sessao.impersonadoPor,
    })
  } catch (erro) {
    return { ok: false, erro: motivo(erro) }
  }

  revalidatePath('/', 'layout')
  redirect(`/clientes/${id}`)
}

/**
 * O slug que o plugin exige.
 *
 * Sufixo aleatório sempre, e não só quando colide: descobrir a colisão exigiria
 * uma consulta, e duas contas criadas no mesmo instante passariam as duas por
 * ela antes de qualquer uma gravar. É a mesma escolha do gatilho da 0020.
 */
function sugerirSlug(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base === '' ? 'conta' : base}-${crypto.randomUUID().slice(0, 6)}`
}

// ---------------------------------------------------------------------------
// Área do administrador
// ---------------------------------------------------------------------------

/**
 * "Entrar como" — o administrador abre a conta do cliente.
 *
 * O plugin cria uma **sessão nova**, marcada com `impersonatedBy`, e a do
 * administrador continua guardada para voltar. Prazo de uma hora, definido em
 * `auth.ts`. Nada disso pede a senha de ninguém, e nada disso acontece sem
 * deixar linha na auditoria — que é append-only por construção (0021).
 */
export async function acaoEntrarComo(usuarioId: string) {
  const sessao = await exigirAdminDaPlataforma()
  const alvo = await acharUsuario(usuarioId)
  if (!alvo) redirect('/admin/usuarios')

  await autenticacao().api.impersonateUser({
    headers: await headers(),
    body: { userId: usuarioId },
  })

  const contas = await contasDoUsuario(usuarioId)
  const primeira = contas[0] ?? null
  await registrar({
    acao: 'entrou_como',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId: primeira?.id ?? null,
    contaNome: primeira?.nome ?? '',
    alvoTipo: 'usuario',
    alvoId: alvo.id,
    alvoNome: alvo.nome,
    detalhes: { email: alvo.email, contas: contas.map((conta) => conta.nome) },
    // O ato **é** a impersonação, então quem a abriu é o autor. A coluna marca
    // atos praticados **dentro** de uma, e por isso fica nula aqui.
    impersonadoPor: null,
  })

  revalidatePath('/', 'layout')
  redirect(primeira && contas.length === 1 ? `/clientes/${primeira.id}` : '/contas')
}

/** Volta a ser você. */
export async function acaoPararDeEntrarComo() {
  const sessao = await sessaoAtual()
  if (!sessao?.impersonadoPor) redirect('/')

  const administrador = await acharUsuario(sessao.impersonadoPor)
  await autenticacao().api.stopImpersonating({ headers: await headers() })

  await registrar({
    acao: 'saiu_do_entrar_como',
    autorId: administrador?.id ?? sessao.impersonadoPor,
    autorEmail: administrador?.email ?? '',
    alvoTipo: 'usuario',
    alvoId: sessao.usuario.id,
    alvoNome: sessao.usuario.nome,
    impersonadoPor: null,
  })

  revalidatePath('/', 'layout')
  redirect('/admin/usuarios')
}

/** Os três papéis que o plugin de organização conhece. */
export type PapelDeConta = 'owner' | 'admin' | 'member'

function ehPapelDeConta(valor: string): valor is PapelDeConta {
  return valor === 'owner' || valor === 'admin' || valor === 'member'
}

/** Liga um usuário a uma conta — é como cliente antigo ganha dono. */
export async function acaoVincularMembro(formData: FormData) {
  const sessao = await exigirAdminDaPlataforma()

  const usuarioId = String(formData.get('usuarioId') ?? '')
  const contaId = String(formData.get('contaId') ?? '')
  const papel = String(formData.get('papel') ?? 'member')
  if (usuarioId === '' || contaId === '') return

  // Lista fechada: papel é escrito em `af_membros."role"` e vira decisão de
  // permissão depois. Aceitar o que vier do formulário seria deixar o
  // navegador inventar um papel que o código não conhece.
  if (!ehPapelDeConta(papel)) return

  const alvo = await acharUsuario(usuarioId)
  if (!alvo) return

  await autenticacao().api.addMember({
    body: { userId: usuarioId, role: papel, organizationId: contaId },
  })

  await registrar({
    acao: 'vinculou_membro',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    contaId,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: alvo.nome,
    detalhes: { papel },
    impersonadoPor: sessao.impersonadoPor,
  })

  revalidatePath('/admin/contas')
  revalidatePath('/admin/usuarios')
}

/** Dá ou tira o papel de administrador da plataforma. */
export async function acaoDefinirPapelDePlataforma(formData: FormData) {
  const sessao = await exigirAdminDaPlataforma()

  const usuarioId = String(formData.get('usuarioId') ?? '')
  const papel = String(formData.get('papel') ?? '')
  if (usuarioId === '' || (papel !== 'admin' && papel !== 'user')) return

  // Tirar o próprio papel deixaria a plataforma sem ninguém que administre se
  // ele for o único — e o caminho de volta exigiria SQL na mão.
  if (usuarioId === sessao.usuario.id) return

  const alvo = await acharUsuario(usuarioId)
  if (!alvo) return

  await autenticacao().api.setRole({
    headers: await headers(),
    body: { userId: usuarioId, role: papel },
  })

  await registrar({
    acao: 'trocou_papel',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: alvo.nome,
    detalhes: { papelDePlataforma: papel },
    impersonadoPor: sessao.impersonadoPor,
  })

  revalidatePath('/admin/usuarios')
}

/** Derruba todas as sessões de alguém. É o botão de quando o notebook sumiu. */
export async function acaoRevogarSessoes(formData: FormData) {
  const sessao = await exigirAdminDaPlataforma()
  const usuarioId = String(formData.get('usuarioId') ?? '')
  if (usuarioId === '') return

  const alvo = await acharUsuario(usuarioId)
  if (!alvo) return

  await autenticacao().api.revokeUserSessions({
    headers: await headers(),
    body: { userId: usuarioId },
  })

  await registrar({
    acao: 'revogou_sessoes',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: alvo.nome,
    impersonadoPor: sessao.impersonadoPor,
  })

  revalidatePath('/admin/usuarios')
}

/** Suspende ou devolve o acesso de alguém. */
export async function acaoSuspenderAcesso(formData: FormData) {
  const sessao = await exigirAdminDaPlataforma()
  const usuarioId = String(formData.get('usuarioId') ?? '')
  const suspender = String(formData.get('suspender') ?? '') === '1'
  if (usuarioId === '' || usuarioId === sessao.usuario.id) return

  const alvo = await acharUsuario(usuarioId)
  if (!alvo) return

  if (suspender) {
    await autenticacao().api.banUser({
      headers: await headers(),
      body: { userId: usuarioId, banReason: String(formData.get('motivo') ?? '').trim() },
    })
  } else {
    await autenticacao().api.unbanUser({ headers: await headers(), body: { userId: usuarioId } })
  }

  await registrar({
    acao: suspender ? 'suspendeu_acesso' : 'devolveu_acesso',
    autorId: sessao.usuario.id,
    autorEmail: sessao.usuario.email,
    alvoTipo: 'usuario',
    alvoId: usuarioId,
    alvoNome: alvo.nome,
    detalhes: { motivo: String(formData.get('motivo') ?? '').trim() },
    impersonadoPor: sessao.impersonadoPor,
  })

  revalidatePath('/admin/usuarios')
}

/**
 * Disponível ou ausente — a presença de quem atende.
 *
 * **Não é enfeite.** É o que o Inbox usa para saber a quem oferecer uma
 * conversa: atribuir para quem está de férias é o mesmo que não atribuir, e
 * pior, porque agora há um nome ao lado dando a impressão de que alguém está
 * cuidando.
 *
 * Cada um muda só a própria — nunca a de outro. Marcar alguém como disponível
 * para ele receber conversa é o tipo de gentileza que acaba com lead sem
 * resposta.
 */
export async function acaoDefinirPresenca(presenca: 'disponivel' | 'ausente') {
  const sessao = await sessaoAtual()
  if (!sessao) redirect('/entrar')

  await definirPresenca(sessao.usuario.id, presenca)
  revalidatePath('/', 'layout')
}
