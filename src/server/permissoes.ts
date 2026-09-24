import 'server-only'
import { cache } from 'react'
import {
  ehCapacidade,
  ehEscopo,
  ehPapelDaConta,
  filtroDe,
  pode,
  type Acesso,
  type AlcanceDeConversas,
  type Capacidade,
  type Escopo,
  type FiltroDeEscopo,
  type Politica,
} from '@/core/permissoes'
import { db } from './db'
import {
  contasDoUsuario,
  exigirAcessoAoCliente,
  ehAdminDaPlataforma,
  type AcessoAoCliente,
  type ContaDoUsuario,
  type SessaoAtual,
} from './sessao'
import { destinoNaConta } from '@/components/design/secoes-do-cliente'
import { responsaveisDoEscopo } from './repos/relatorios'

/**
 * A autorização de negócio (RB-40 a RB-42).
 *
 * ---------------------------------------------------------------------------
 * Onde este arquivo entra
 * ---------------------------------------------------------------------------
 *
 * `sessao.ts` responde **"esta pessoa alcança esta empresa?"**. Este arquivo
 * responde a seguinte: **"e o que ela pode fazer dentro dela?"**.
 *
 * As duas são necessárias e nenhuma substitui a outra. Passar a primeira e
 * pular a segunda é exatamente o estado anterior à T2.1: `acoes-crm.ts` tinha
 * dezoito ações e zero conferências de papel.
 *
 * ---------------------------------------------------------------------------
 * `service_role` não é isolamento (RB-42)
 * ---------------------------------------------------------------------------
 *
 * Todo acesso ao banco daqui para dentro usa a chave secreta, que **ignora
 * RLS**. Isso quer dizer que as tabelas não defendem ninguém: quem defende é
 * este código, e o `client_id` em cada consulta. A RLS ligada e sem política
 * (0001) é a rede que impede a Data API de servir qualquer coisa, não é a
 * autorização da aplicação.
 *
 * Consequência prática, e ela é a razão de as funções abaixo receberem
 * `clienteId` sempre: uma consulta que esqueça o `client_id` não é recusada
 * pelo banco. Ela devolve a conta do vizinho.
 */

export type AcessoCompleto = AcessoAoCliente & {
  /** O que decide as permissões. É o que vai para `core/permissoes.ts`. */
  regras: Acesso
}

/**
 * Lê papel, equipes e sobrescritas, a entrada de toda decisão.
 *
 * Duas idas ao banco, em paralelo, e não uma junção: as tabelas são
 * independentes e a junção devolveria o produto cartesiano de equipes por
 * capacidades, que é mais linhas para montar a mesma resposta.
 *
 * **Falha fechada.** Se a leitura das equipes ou das capacidades estourar, a
 * pessoa fica sem elas, o que a deixa com a política do papel e sem escopo de
 * equipe, nunca com mais. Degradar para cima seria abrir a conta por causa de
 * uma consulta lenta.
 */
export async function acessoCompleto(clienteId: string): Promise<AcessoCompleto> {
  const acesso = await exigirAcessoAoCliente(clienteId)
  return { ...acesso, regras: await regrasDe(acesso, clienteId) }
}

async function regrasDe(acesso: AcessoAoCliente, clienteId: string): Promise<Acesso> {
  const usuarioId = acesso.sessao.usuario.id
  const admin = ehAdminDaPlataforma(acesso.sessao)

  // O administrador da 4YU passa por tudo, e a decisão é de `sessao.ts`. Ler
  // equipe e sobrescrita dele seria duas consultas para um resultado que já
  // está definido.
  if (admin) {
    return { papel: null, ehAdminDaPlataforma: true, usuarioId }
  }

  const papel = acesso.papel !== null && ehPapelDaConta(acesso.papel) ? acesso.papel : null

  const [equipes, sobrescritas] = await Promise.all([
    equipesDoUsuario(clienteId, usuarioId),
    sobrescritasDoUsuario(clienteId, usuarioId),
  ])

  return { papel, usuarioId, equipes, sobrescritas }
}

/** As equipes desta pessoa nesta conta. Arquivada não conta. */
export async function equipesDoUsuario(
  clienteId: string,
  usuarioId: string,
): Promise<string[]> {
  const { data, error } = await db()
    .from('equipe_membros')
    .select('equipe_id, equipes!inner(arquivada_em)')
    .eq('client_id', clienteId)
    .eq('usuario_id', usuarioId)
    .is('equipes.arquivada_em', null)

  if (error) {
    // Falha fechada: sem equipe, o escopo `equipe` não alcança nada.
    console.error('[permissoes] não deu para ler as equipes:', error.message)
    return []
  }

  return (data as { equipe_id: string }[]).map((linha) => linha.equipe_id)
}

/**
 * A diferença entre o que o papel dá e o que esta pessoa tem.
 *
 * **Ausência é "usa a política do papel", e não "nenhum"**, é o que preserva
 * o acesso de quem já existe (ver a 0073). Linha inválida é ignorada em vez de
 * derrubar a leitura: uma capacidade que esta versão do código não conhece é
 * um deploy pela metade, e travar a conta por causa dela seria a resposta
 * errada.
 */
export async function sobrescritasDoUsuario(
  clienteId: string,
  usuarioId: string,
): Promise<Partial<Politica>> {
  const { data, error } = await db()
    .from('membro_capacidades')
    .select('capacidade, escopo')
    .eq('client_id', clienteId)
    .eq('usuario_id', usuarioId)

  if (error) {
    console.error('[permissoes] não deu para ler as capacidades:', error.message)
    return {}
  }

  const saida: Partial<Politica> = {}
  for (const linha of data as { capacidade: string; escopo: string }[]) {
    if (ehCapacidade(linha.capacidade) && ehEscopo(linha.escopo)) {
      saida[linha.capacidade] = linha.escopo
    }
  }
  return saida
}

/**
 * Onde esta pessoa cai ao entrar nesta conta, já com o caminho inteiro.
 *
 * Recebe o usuário e o papel explícitos, e não lê a sessão do cookie: o login
 * chama isto **na mesma requisição** que acabou de autenticar, quando o cookie
 * novo ainda não voltou do navegador. Equipe não entra porque a tela inicial
 * só depende do escopo, e escopo sai de papel e sobrescrita.
 */
export async function caminhoNaConta(
  usuarioId: string,
  conta: Pick<ContaDoUsuario, 'id' | 'papel'>,
  secao?: string | null,
): Promise<string> {
  const papel = ehPapelDaConta(conta.papel) ? conta.papel : null
  const sobrescritas = papel ? await sobrescritasDoUsuario(conta.id, usuarioId) : {}
  return `/clientes/${conta.id}${destinoNaConta({ papel, usuarioId, sobrescritas }, secao)}`
}

/**
 * Para onde a pessoa vai quando entra, e para onde a tela de entrar a manda se
 * ela já estava logada.
 *
 * Mora aqui, e não junto das ações, porque **várias** telas precisam da mesma
 * resposta: a que acabou de autenticar, a que descobre uma sessão já aberta, o
 * cadastro e o `/voltar`. Saiu de `sessao.ts` quando passou a depender do
 * acesso da pessoa: quem só atende as próprias conversas entra pelo Inbox.
 */
export async function destinoAposEntrar(sessao: SessaoAtual): Promise<string> {
  if (ehAdminDaPlataforma(sessao)) return '/admin'

  const [primeira, ...resto] = await contasDoUsuario(sessao.usuario.id)
  // Uma conta só é o caso comum, e mandar essa pessoa para um seletor de um
  // item é fazê-la clicar para confirmar o óbvio.
  if (primeira && resto.length === 0) return caminhoNaConta(sessao.usuario.id, primeira)
  return '/contas'
}

// ---------------------------------------------------------------------------
// A porta que as ações usam
// ---------------------------------------------------------------------------

/**
 * A recusa é **sempre a mesma frase**, e de propósito.
 *
 * "Você não pode registrar venda" e "você não pode ler valores" contam, para
 * quem não tem nenhuma das duas, qual das duas existe. Mensagem única não dá
 * mapa do sistema para quem está tentando descobri-lo (RB-42).
 */
export const SEM_PERMISSAO = 'você não tem permissão para isso'

export type Recusa = { ok: false; erro: string }

/**
 * **A função que toda ação chama.**
 *
 * Devolve o acesso quando pode, e a recusa quando não, em vez de estourar,
 * porque Server Action que estoura vira "Alguma coisa quebrou aqui" na tela, e
 * o certo aqui é uma frase.
 *
 * Ela já faz `exigirAcessoAoCliente` por dentro: uma ação que chame só esta
 * função está com as duas fronteiras cobertas, e não há como lembrar de uma e
 * esquecer a outra.
 */
export async function exigirCapacidade(
  clienteId: string,
  capacidade: Capacidade,
  minimo: Escopo = 'proprios',
): Promise<AcessoCompleto | Recusa> {
  const acesso = await acessoCompleto(clienteId)
  if (!pode(acesso.regras, capacidade, minimo)) return { ok: false, erro: SEM_PERMISSAO }
  return acesso
}

/** `exigirCapacidade` devolveu recusa? O estreitamento que o TypeScript entende. */
export function recusou(r: AcessoCompleto | Recusa): r is Recusa {
  return 'ok' in r && r.ok === false
}

/**
 * A versão para páginas: devolve `null` na recusa, e a página mostra
 * `SemAcesso` com o motivo (E7).
 *
 * Era 404, pela ideia de não confirmar que a tela existe. Só que quem chega
 * aqui já é membro da conta (a fronteira da empresa continua em
 * `exigirAcessoAoCliente`, que segue 404) e vê o menu: o 404 fazia a pessoa
 * achar que o link quebrou. Rota de API não usa esta: ela responde status, e
 * usa `exigirCapacidade`.
 */
export async function capacidadeNaPagina(
  clienteId: string,
  capacidade: Capacidade,
  minimo: Escopo = 'proprios',
): Promise<AcessoCompleto | null> {
  const r = await exigirCapacidade(clienteId, capacidade, minimo)
  return recusou(r) ? null : r
}

/**
 * O filtro de escopo desta pessoa para esta capacidade.
 *
 * É o que a consulta aplica **antes** de paginar. Filtrar depois de ler
 * entrega os dados ao processo que não deveria tê-los e conta errado qualquer
 * total, que é o A19.
 */
export function filtroDoAcesso(
  acesso: AcessoCompleto,
  capacidade: Capacidade,
): FiltroDeEscopo {
  return filtroDe(acesso.regras, capacidade)
}

/**
 * O alcance de conversas e contatos desta pessoa, pronto para a consulta.
 *
 * Mesma capacidade do menu (`atender`): quem atende só os próprios vê os dele,
 * o gestor vê os da equipe, e quem tem `todos` vê a conta inteira. Em todos os
 * casos restritos, a fila sem dono continua visível (ver `AlcanceDeConversas`).
 */
export async function alcanceDeConversas(
  clienteId: string,
  acesso: AcessoCompleto,
): Promise<AlcanceDeConversas> {
  const escopo = filtroDoAcesso(acesso, 'atender')
  if (escopo.tipo === 'tudo') return { tipo: 'tudo' }
  if (escopo.tipo === 'impossivel') return { tipo: 'nada' }
  const donos = await responsaveisDoEscopo(clienteId, escopo)
  return donos === null ? { tipo: 'tudo' } : { tipo: 'donos', donos }
}

/**
 * O alcance de quem está logado nesta conta, uma vez por requisição.
 *
 * A página, a rota da conversa e as ações perguntam a mesma coisa; `cache`
 * faz as três lerem papel, equipe e sobrescrita uma vez só.
 */
export const meuAlcance = cache(async (clienteId: string): Promise<AlcanceDeConversas> => {
  return alcanceDeConversas(clienteId, await acessoCompleto(clienteId))
})
