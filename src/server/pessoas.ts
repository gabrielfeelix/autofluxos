import 'server-only'
import {
  FUNCOES_PADRAO,
  NIVEL_DA_FUNCAO,
  NIVEL_DO_SUPORTE,
  PAPEL_DA_FUNCAO,
  funcaoDerivada,
  podeEditarPessoa,
  podeGerenciarPessoas,
  type IdDaFuncao,
  type NaHierarquia,
} from '@/core/funcoes'
import { CAPACIDADES, POLITICAS, ehPapelDaConta, escopoDe, type Acesso, type Politica } from '@/core/permissoes'
import { acessoCompleto, type AcessoCompleto } from './permissoes'
import { capacidadesPorMembro, definirCapacidades, equipesPorMembro } from './repos/equipes'
import { funcoesGravadas, funcoesVigentes, gravarFuncaoDoMembro } from './repos/funcoes'
import { definirPapelNaConta } from './repos/usuarios'
import { bancoDoLogin } from './auth'
import { ehAdminDaPlataforma } from './sessao'

/**
 * A hierarquia de funções aplicada à organização (plano da administração, §2).
 *
 * `core/funcoes.ts` decide; aqui se lê do banco quem é cada um e se grava a
 * troca. **Toda ação da tela Pessoas passa por `exigirHierarquia`**, e não só
 * esconde botão: a tela filtra pelo mesmo `podeVerPessoa`, mas quem manda é
 * o servidor.
 */

export type PessoaNaHierarquia = NaHierarquia & {
  papel: string
  funcao: IdDaFuncao
  sobrescritas: Partial<Politica>
  politica: Politica
}

function efetiva(regras: Acesso): Politica {
  return Object.fromEntries(CAPACIDADES.map((capacidade) => [capacidade, escopoDe(regras, capacidade)])) as Politica
}

/** Todos os membros da organização, com função, nível, equipes e política. */
export async function pessoasNaHierarquia(clienteId: string): Promise<Map<string, PessoaNaHierarquia>> {
  const [{ rows }, equipes, sobrescritas, funcoes, gravadas] = await Promise.all([
    bancoDoLogin().query(`select "userId" as usuario, "role" as papel from public.af_membros where "organizationId" = $1`, [clienteId]),
    equipesPorMembro(clienteId).catch(() => new Map<string, string[]>()),
    capacidadesPorMembro(clienteId).catch(() => new Map<string, Partial<Politica>>()),
    funcoesVigentes(),
    funcoesGravadas(clienteId).catch(() => new Map<string, IdDaFuncao>()),
  ])

  const saida = new Map<string, PessoaNaHierarquia>()
  for (const linha of rows as { usuario: string; papel: string }[]) {
    const usuarioId = String(linha.usuario)
    const papel = ehPapelDaConta(linha.papel) ? linha.papel : 'member'
    const gravada = funcoes.daTabela ? gravadas.get(usuarioId) : undefined
    const regras: Acesso = {
      papel,
      usuarioId,
      sobrescritas: sobrescritas.get(usuarioId) ?? {},
      politicaBase: gravada ? funcoes.porId[gravada].capacidades : undefined,
    }
    const politica = efetiva(regras)
    const funcao = gravada ?? funcaoDerivada(papel, politica, funcoes.porId)
    saida.set(usuarioId, {
      usuarioId,
      papel,
      funcao,
      nivel: NIVEL_DA_FUNCAO[funcao],
      equipes: equipes.get(usuarioId) ?? [],
      sobrescritas: regras.sobrescritas ?? {},
      politica,
    })
  }
  return saida
}

export type Ator = NaHierarquia & { politica: Politica; acesso: AcessoCompleto; suporte: boolean }

/** Quem está pedindo, na hierarquia desta organização. */
export async function atorNaOrganizacao(clienteId: string): Promise<Ator> {
  const acesso = await acessoCompleto(clienteId)
  const usuarioId = acesso.sessao.usuario.id
  if (acesso.papel === null && ehAdminDaPlataforma(acesso.sessao)) {
    return { usuarioId, nivel: NIVEL_DO_SUPORTE, equipes: [], politica: POLITICAS.owner, acesso, suporte: true }
  }
  const pessoas = await pessoasNaHierarquia(clienteId)
  const eu = pessoas.get(usuarioId)
  if (!eu) return { usuarioId, nivel: 0, equipes: [], politica: efetiva(acesso.regras), acesso, suporte: false }
  return { usuarioId, nivel: eu.nivel, equipes: eu.equipes, politica: eu.politica, acesso, suporte: false }
}

/**
 * A porta de toda ação da tela Pessoas: quem pede gerencia pessoas e está
 * acima de quem é mexido (`podeEditarPessoa`). Devolve os dois já lidos.
 */
export async function exigirHierarquia(
  clienteId: string,
  usuarioId: string,
): Promise<{ ator: Ator; alvo: PessoaNaHierarquia } | { ok: false; erro: string }> {
  const ator = await atorNaOrganizacao(clienteId)
  if (!podeGerenciarPessoas(ator)) return { ok: false, erro: 'só gestor, administrador ou proprietário mexe em pessoas' }
  const alvo = (await pessoasNaHierarquia(clienteId)).get(usuarioId)
  if (!alvo) return { ok: false, erro: 'esta pessoa não está nesta organização' }
  if (!podeEditarPessoa(ator, alvo)) {
    return { ok: false, erro: ator.usuarioId === usuarioId ? 'a sua própria função muda pelas mãos de quem está acima de você' : 'você só mexe em quem está abaixo de você' }
  }
  return { ator, alvo }
}

/**
 * Troca a função de alguém, gravando nos dois lugares que a leem.
 *
 * - `af_membros.role`: o papel do Better Auth que acompanha a função;
 * - com a tabela de funções, `af_membros.funcao_id`, e as exceções zeradas
 *   (a função nova vale inteira);
 * - sem a tabela, a política da função vira exceção sobre o papel, que é como
 *   Gestor e Atendente sempre existiram.
 *
 * Dar Proprietário **passa a posse**: quem era dono vira Administrador. O
 * banco recusa ficar sem dono (`definirPapelNaConta`), então a ordem é
 * promover primeiro e rebaixar depois.
 */
export async function definirFuncaoDoMembro(
  clienteId: string,
  usuarioId: string,
  funcao: IdDaFuncao,
  autor: string | null,
): Promise<{ ok: true; donosAnteriores: string[] } | { ok: false; motivo: string }> {
  const funcoes = await funcoesVigentes()
  const aplicar = async (alvo: string, nova: IdDaFuncao) => {
    const papel = PAPEL_DA_FUNCAO[nova]
    const r = await definirPapelNaConta(clienteId, alvo, papel)
    if (!r.ok) return r
    const gravou = funcoes.daTabela && (await gravarFuncaoDoMembro(clienteId, alvo, nova))
    const desejada = gravou ? POLITICAS[papel] : (funcoes.porId[nova]?.capacidades ?? FUNCOES_PADRAO[nova].capacidades)
    return definirCapacidades(clienteId, alvo, desejada, POLITICAS[papel], autor)
  }

  const r = await aplicar(usuarioId, funcao)
  if (!r.ok) return r

  const donosAnteriores: string[] = []
  if (funcao === 'proprietario') {
    const { rows } = await bancoDoLogin().query(
      `select "userId" as usuario from public.af_membros where "organizationId" = $1 and "role" = 'owner' and "userId" <> $2`,
      [clienteId, usuarioId],
    )
    for (const linha of rows as { usuario: string }[]) {
      const rebaixou = await aplicar(String(linha.usuario), 'administrador')
      if (!rebaixou.ok) return rebaixou
      donosAnteriores.push(String(linha.usuario))
    }
  }
  return { ok: true, donosAnteriores }
}

/** A política de base desta pessoa: a da função gravada (com a tabela) ou a do papel. */
export async function baseDaPessoa(clienteId: string, usuarioId: string, papel: string): Promise<Politica> {
  const [funcoes, gravadas] = await Promise.all([funcoesVigentes(), funcoesGravadas(clienteId).catch(() => new Map<string, IdDaFuncao>())])
  const gravada = funcoes.daTabela ? gravadas.get(usuarioId) : undefined
  if (gravada) return funcoes.porId[gravada].capacidades
  return POLITICAS[ehPapelDaConta(papel) ? papel : 'member']
}
