'use server'

import { revalidatePath } from 'next/cache'
import { CAPACIDADES, ehCapacidade, ehEscopo, ehPapelDaConta, type Politica } from '@/core/permissoes'
import { conferirExcecoes } from '@/core/funcoes'
import { baseDaPessoa, exigirHierarquia } from './pessoas'
import {
  arquivarEquipe,
  criarEquipe,
  definirCapacidades,
  definirEquipesDoMembro,
  pendenciasDoMembro,
} from './repos/equipes'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * A tela de acesso (UI-18), em arquivo próprio.
 *
 * Separada de `acoes-conta.ts` porque aquele arquivo é de **autenticação** ,
 * entrar, sair, cadastrar, impersonar, e isto é **autorização**. São camadas
 * diferentes com fronteiras diferentes, e juntá-las é como se perde a distinção
 * entre "quem é" e "o que pode".
 *
 * Toda ação aqui exige `configurar_empresa`, que é o poder de dar poder. Ela
 * nasceu fechada para `member` na T2.1 justamente por isto: quem pudesse editar
 * a própria permissão sairia do papel em que foi posto no primeiro clique.
 */

function ajustes(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/ajustes/equipe`)
}

export async function acaoCriarEquipe(
  clienteId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string; id?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const r = await criarEquipe(clienteId, nome)
  if (!r.ok) return { ok: false, erro: r.motivo }

  ajustes(clienteId)
  return { ok: true, id: r.id }
}

export async function acaoArquivarEquipe(
  clienteId: string,
  equipeId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const r = await arquivarEquipe(clienteId, equipeId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  ajustes(clienteId)
  return { ok: true }
}

/**
 * Salva o acesso de uma pessoa: equipes e capacidades, numa operação só.
 *
 * **As duas juntas porque a tela as edita juntas.** Salvar capacidade sem
 * equipe deixaria alguém com escopo `equipe` e nenhuma equipe, que é acesso a
 * nada, e parece bug em vez de configuração.
 */
export async function acaoSalvarAcesso(
  clienteId: string,
  usuarioId: string,
  dados: {
    papel: string
    equipes: string[]
    /** Capacidade -> escopo. O que não vier fica com a política do papel. */
    capacidades: Record<string, string>
  },
): Promise<{ ok: boolean; erro?: string }> {
  // Regra de hierarquia: só quem está acima mexe no acesso desta pessoa.
  const permitido = await exigirHierarquia(clienteId, usuarioId)
  if ('ok' in permitido) return permitido
  // O papel vem do banco, e não da tela: quem muda papel é a troca de função.
  dados = { ...dados, papel: permitido.alvo.papel }

  if (!ehPapelDaConta(dados.papel)) return { ok: false, erro: 'esse papel não existe' }

  /*
   * O escopo chega da tela e é **conferido contra a lista fechada** antes de
   * chegar ao banco. O `check` da 0073 recusaria de qualquer forma, mas a
   * recusa dele vem como erro de Postgres, e a pessoa merece uma frase.
   */
  const desejado: Partial<Politica> = {}
  for (const [chave, escopo] of Object.entries(dados.capacidades)) {
    if (!ehCapacidade(chave)) return { ok: false, erro: 'essa capacidade não existe' }
    if (!ehEscopo(escopo)) return { ok: false, erro: 'esse escopo não existe' }
    desejado[chave] = escopo
  }

  // A base é a função da pessoa (A7) quando ela está gravada; sem a tabela, o papel.
  const base = await baseDaPessoa(clienteId, usuarioId, dados.papel)
  // Ninguém concede o que não tem: a política resultante cabe na de quem pede.
  const resultado = Object.fromEntries(CAPACIDADES.map((c) => [c, desejado[c] ?? base[c]])) as Politica
  const cabe = conferirExcecoes(permitido.ator, resultado)
  if (!cabe.ok) return { ok: false, erro: cabe.motivo }

  const quem = await sessaoAtual()

  const daEquipe = await definirEquipesDoMembro(clienteId, usuarioId, dados.equipes)
  if (!daEquipe.ok) return { ok: false, erro: daEquipe.motivo }

  const dasCapacidades = await definirCapacidades(
    clienteId,
    usuarioId,
    desejado,
    base,
    quem?.usuario.id ?? null,
  )
  if (!dasCapacidades.ok) return { ok: false, erro: dasCapacidades.motivo }

  ajustes(clienteId)
  return { ok: true }
}

/**
 * O que fica pendurado se esta pessoa sair.
 *
 * A RB-40 manda decidir o destino das atribuições e atividades abertas, e
 * **nunca deixar referências sem tratamento**. A tela pergunta antes de
 * remover; esta ação é o que ela usa para saber o que perguntar.
 */
export async function acaoPendenciasDoMembro(
  clienteId: string,
  usuarioId: string,
): Promise<{
  ok: boolean
  conversas?: number
  cartoes?: number
  atividades?: number
  erro?: string
}> {
  const permitido = await exigirHierarquia(clienteId, usuarioId)
  if ('ok' in permitido) return permitido

  const r = await pendenciasDoMembro(clienteId, usuarioId)
  return { ok: true, ...r }
}
