/**
 * Funções e a regra de hierarquia (plano da administração, 24/set/2026, §2).
 *
 * ---------------------------------------------------------------------------
 * Função é o nome que a interface usa para "papel"
 * ---------------------------------------------------------------------------
 *
 * Uma função é um conjunto nomeado de capacidades com escopo, e tem um
 * **nível**: Proprietário 4, Administrador 3, Gestor 2, Atendente 1. O nível
 * é o que decide quem mexe em quem.
 *
 * No banco, `af_membros.role` continua `owner`/`admin`/`member` (é do plugin
 * de organização do Better Auth). A função é derivada dele e das exceções da
 * pessoa enquanto a tabela `funcoes` (A7) não existe; quando existe, a função
 * vem gravada em `af_membros.funcao_id`. Os dois caminhos passam por aqui.
 *
 * ---------------------------------------------------------------------------
 * A regra de hierarquia
 * ---------------------------------------------------------------------------
 *
 *  1. Você só vê e edita pessoas de nível abaixo do seu. O gestor vê ele
 *     mesmo e os atendentes da equipe dele; não vê administradores.
 *  2. Você só atribui funções até o seu nível.
 *  3. O Proprietário é um só, e só ele passa a posse adiante.
 *
 * O administrador da plataforma (Suporte 4YU) não é função de organização:
 * ele está fora da escada, com nível 5, e passa por todas as regras.
 *
 * Puro de propósito, como `permissoes.ts`: a mesma regra vale na tela (o que
 * aparece) e no servidor (o que é aceito), e é testada sem banco.
 */

import {
  CAPACIDADES,
  MODELOS_EXTRA,
  POLITICAS,
  alcancaPeloMenos,
  type PapelDaConta,
  type Politica,
} from './permissoes'

export const FUNCOES = ['proprietario', 'administrador', 'gestor', 'atendente'] as const

export type IdDaFuncao = (typeof FUNCOES)[number]

export function ehFuncao(valor: string): valor is IdDaFuncao {
  return (FUNCOES as readonly string[]).includes(valor)
}

export const NIVEL_DA_FUNCAO: Record<IdDaFuncao, number> = {
  proprietario: 4,
  administrador: 3,
  gestor: 2,
  atendente: 1,
}

/** O nível do administrador da plataforma: acima de qualquer função. */
export const NIVEL_DO_SUPORTE = 5

export const ROTULO_DA_FUNCAO: Record<IdDaFuncao, string> = {
  proprietario: 'Proprietário',
  administrador: 'Administrador',
  gestor: 'Gestor',
  atendente: 'Atendente',
}

export const DESCRICAO_DA_FUNCAO: Record<IdDaFuncao, string> = {
  proprietario: 'Dono da organização. Faz tudo, inclusive passar a posse adiante.',
  administrador: 'Faz tudo na organização, menos mexer no proprietário.',
  gestor: 'Cuida da equipe dele: vê e atende as conversas da equipe e promove atendentes.',
  atendente: 'Atende as conversas dele e as que estão sem dono.',
}

export type Funcao = {
  id: IdDaFuncao
  nome: string
  nivel: number
  descricao: string
  capacidades: Politica
}

/**
 * As funções como o código as conhece, que é o que vale sem a tabela.
 *
 * Proprietário e Administrador têm a política do `owner`/`admin` de hoje;
 * Gestor e Atendente são os modelos `gestor`/`operador` que a tela de acesso
 * já aplicava como exceção por pessoa.
 */
export const FUNCOES_PADRAO: Record<IdDaFuncao, Funcao> = {
  proprietario: { id: 'proprietario', nome: ROTULO_DA_FUNCAO.proprietario, nivel: 4, descricao: DESCRICAO_DA_FUNCAO.proprietario, capacidades: POLITICAS.owner },
  administrador: { id: 'administrador', nome: ROTULO_DA_FUNCAO.administrador, nivel: 3, descricao: DESCRICAO_DA_FUNCAO.administrador, capacidades: POLITICAS.admin },
  gestor: { id: 'gestor', nome: ROTULO_DA_FUNCAO.gestor, nivel: 2, descricao: DESCRICAO_DA_FUNCAO.gestor, capacidades: MODELOS_EXTRA.gestor },
  atendente: { id: 'atendente', nome: ROTULO_DA_FUNCAO.atendente, nivel: 1, descricao: DESCRICAO_DA_FUNCAO.atendente, capacidades: MODELOS_EXTRA.operador },
}

/** O papel do Better Auth que acompanha cada função. */
export const PAPEL_DA_FUNCAO: Record<IdDaFuncao, PapelDaConta> = {
  proprietario: 'owner',
  administrador: 'admin',
  gestor: 'member',
  atendente: 'member',
}

/** `a` cabe dentro de `b`? Toda capacidade de `a` alcança no máximo o que `b` alcança. */
export function politicaCabe(a: Politica, b: Politica): boolean {
  return CAPACIDADES.every((capacidade) => alcancaPeloMenos(b[capacidade], a[capacidade]))
}

/**
 * A função de quem não tem função gravada, pela política efetiva.
 *
 * `owner` e `admin` são diretos. `member` é classificado pelo que ele de fato
 * alcança: se cabe no atendente, é atendente; se cabe no gestor, é gestor; se
 * passa disso, é administrador. É o que faz o `member` sem exceção (que
 * configura operação e atende todos) virar Administrador, como o plano manda,
 * e o que impede alguém de ganhar exceção acima do gestor e continuar sendo
 * tratado como gestor na hierarquia.
 */
export function funcaoDerivada(
  papel: PapelDaConta,
  politicaEfetiva: Politica,
  funcoes: Record<IdDaFuncao, Funcao> = FUNCOES_PADRAO,
): IdDaFuncao {
  if (papel === 'owner') return 'proprietario'
  if (papel === 'admin') return 'administrador'
  if (politicaCabe(politicaEfetiva, funcoes.atendente.capacidades)) return 'atendente'
  if (politicaCabe(politicaEfetiva, funcoes.gestor.capacidades)) return 'gestor'
  return 'administrador'
}

// ---------------------------------------------------------------------------
// A hierarquia
// ---------------------------------------------------------------------------

/** Quem está agindo, ou sobre quem se age, visto pela hierarquia. */
export type NaHierarquia = {
  usuarioId: string
  nivel: number
  equipes: readonly string[]
}

function compartilhaEquipe(a: NaHierarquia, b: NaHierarquia): boolean {
  return a.equipes.some((equipe) => b.equipes.includes(equipe))
}

/**
 * Regra 1: quem esta pessoa **vê** na tela Pessoas.
 *
 * Todo mundo se vê. Fora isso, só nível abaixo; e o gestor, só quem divide
 * equipe com ele (é "a equipe dele").
 */
export function podeVerPessoa(ator: NaHierarquia, alvo: NaHierarquia): boolean {
  if (ator.usuarioId === alvo.usuarioId) return true
  if (ator.nivel >= NIVEL_DO_SUPORTE) return true
  if (ator.nivel <= alvo.nivel) return false
  if (ator.nivel === NIVEL_DA_FUNCAO.gestor) return compartilhaEquipe(ator, alvo)
  return true
}

/**
 * Regra 1 também: quem esta pessoa **edita**.
 *
 * Ninguém edita a si mesmo por aqui (a própria função muda por outra mão, e
 * isso impede alguém de se promover). O suporte edita qualquer um.
 */
export function podeEditarPessoa(ator: NaHierarquia, alvo: NaHierarquia): boolean {
  if (ator.nivel >= NIVEL_DO_SUPORTE) return true
  if (ator.usuarioId === alvo.usuarioId) return false
  if (ator.nivel < NIVEL_DA_FUNCAO.gestor) return false
  return podeVerPessoa(ator, alvo)
}

/**
 * Regra 2 e 3: quais funções esta pessoa **atribui**.
 *
 * Até o próprio nível, e o Proprietário só pelo proprietário (que, ao dar,
 * passa a posse e vira Administrador) ou pelo suporte.
 */
export function podeAtribuirFuncao(ator: Pick<NaHierarquia, 'nivel'>, funcao: IdDaFuncao): boolean {
  if (ator.nivel >= NIVEL_DO_SUPORTE) return true
  if (ator.nivel < NIVEL_DA_FUNCAO.gestor) return false
  if (funcao === 'proprietario') return ator.nivel === NIVEL_DA_FUNCAO.proprietario
  return NIVEL_DA_FUNCAO[funcao] <= ator.nivel
}

export function funcoesAtribuiveis(ator: Pick<NaHierarquia, 'nivel'>): IdDaFuncao[] {
  return FUNCOES.filter((funcao) => podeAtribuirFuncao(ator, funcao))
}

/** Quem abre a tela Pessoas para mexer (gestor para cima). */
export function podeGerenciarPessoas(ator: Pick<NaHierarquia, 'nivel'>): boolean {
  return ator.nivel >= NIVEL_DA_FUNCAO.gestor
}

/**
 * A decisão completa de "trocar a função de alguém", do jeito que o servidor
 * confere. Devolve o motivo em português quando recusa.
 */
export function conferirTrocaDeFuncao(
  ator: NaHierarquia,
  alvo: NaHierarquia,
  nova: IdDaFuncao,
): { ok: true } | { ok: false; motivo: string } {
  if (!podeEditarPessoa(ator, alvo)) {
    return {
      ok: false,
      motivo:
        ator.usuarioId === alvo.usuarioId
          ? 'a sua própria função muda pelas mãos de quem está acima de você'
          : 'você só mexe em quem está abaixo de você',
    }
  }
  if (!podeAtribuirFuncao(ator, nova)) return { ok: false, motivo: 'você só atribui funções até a sua' }
  return { ok: true }
}

/**
 * Exceções por pessoa: a política resultante não pode passar da de quem dá.
 * Ninguém concede o que não tem. O suporte passa.
 */
export function conferirExcecoes(
  ator: { nivel: number; politica: Politica },
  resultado: Politica,
): { ok: true } | { ok: false; motivo: string } {
  if (ator.nivel >= NIVEL_DO_SUPORTE) return { ok: true }
  if (!politicaCabe(resultado, ator.politica)) return { ok: false, motivo: 'você não pode dar um acesso que você mesmo não tem' }
  return { ok: true }
}
