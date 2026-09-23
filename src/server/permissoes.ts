import 'server-only'
import {
  ehCapacidade,
  ehEscopo,
  ehPapelDaConta,
  filtroDe,
  pode,
  type Acesso,
  type Capacidade,
  type Escopo,
  type FiltroDeEscopo,
  type Politica,
} from '@/core/permissoes'
import { db } from './db'
import { exigirAcessoAoCliente, ehAdminDaPlataforma, type AcessoAoCliente } from './sessao'

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
