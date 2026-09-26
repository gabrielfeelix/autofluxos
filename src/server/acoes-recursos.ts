'use server'

import { revalidatePath } from 'next/cache'
import { ehObjetivo } from '@/core/objetivo-da-conta'
import { ehNicho, pacoteDo } from '@/core/nichos'
import { registrar } from './repos/auditoria'
import { definirCrmAtivo, definirLojaAtiva, definirNicho, definirObjetivo, nichoDaConta } from './repos/recursos'
import { exigirCapacidade, recusou } from './permissoes'

/**
 * As ações de objetivo e recursos (T7.1).
 *
 * A capacidade é `configurar_operacao` nas duas, e é a leitura direta da lista
 * de `core/permissoes.ts`: "bot, regras, campos e processos: muda como a
 * operação funciona". Ligar o CRM muda o menu de **todo mundo** na conta, então
 * não é decisão de quem atende. O §4.2 diz o mesmo em palavras: "botão Ativar
 * CRM para gestores".
 *
 * O escopo é `todos` porque o alvo é a conta, e não um registro: `proprios`
 * aqui não quereria dizer nada, e deixaria passar quem só pode mexer no que é
 * seu.
 */

export type RespostaDeRecursos = { ok: boolean; erro?: string }

export async function acaoDefinirObjetivo(
  clienteId: string,
  objetivo: string,
): Promise<RespostaDeRecursos> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  // A lista fechada é conferida aqui e no check da 0084. Sem esta linha, o
  // banco recusaria com 23514 e a tela mostraria um erro de Postgres a quem
  // escolheu numa lista de três itens.
  if (!ehObjetivo(objetivo)) return { ok: false, erro: 'esse objetivo não existe' }

  const r = await definirObjetivo(clienteId, objetivo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  // A tela inicial muda de conteúdo: é ela que cobra os passos.
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath(`/clientes/${clienteId}/ajustes/recursos`)
  return { ok: true }
}

/**
 * Liga ou desliga o CRM no menu.
 *
 * **Desligar não apaga nada**, e a frase vai para a tela junto do botão: o §4.2
 * é explícito, e `desligarApagaDado` existe em `core/` para essa promessa ter
 * onde ser testada.
 */
export async function acaoDefinirCrm(
  clienteId: string,
  ativo: boolean,
): Promise<RespostaDeRecursos> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const r = await definirCrmAtivo(clienteId, ativo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  /*
   * A barra lateral inteira muda, então a revalidação é do layout e não de uma
   * tela. `layout` alcança as filhas, que é o que faz o item aparecer ou sumir
   * sem a pessoa precisar recarregar.
   *
   * **Nenhum cartão é criado nem apagado aqui** (RB-19 e §4.2): ligar o CRM não
   * popula retroativamente, e desligar não remove. Quem quiser trazer o
   * histórico usa a importação, que é outra ação e tem prévia de quantidade.
   */
  revalidatePath(`/clientes/${clienteId}`, 'layout')
  return { ok: true }
}

/**
 * Liga ou desliga a Loja no menu (0103, plano de navegação 5.6).
 *
 * Mesmo desenho de `acaoDefinirCrm`: a barra inteira muda, então a
 * revalidação é do layout. **Desligar não apaga nada**: nem o catálogo, nem a
 * loja cadastrada. Loja conectada continua no menu mesmo desligada aqui
 * (`mostraLoja`), porque é o único lugar de desligá-la.
 */
export async function acaoDefinirLoja(
  clienteId: string,
  ativa: boolean,
): Promise<RespostaDeRecursos> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const r = await definirLojaAtiva(clienteId, ativa)
  if (!r.ok) return { ok: false, erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}`, 'layout')
  return { ok: true }
}

/**
 * Troca o tipo de negócio da conta (PLANO-NICHOS 1.4 e 3.3). Vazio volta para
 * "sem tipo", o sistema de antes.
 *
 * Muda palavras, menu e sugestões: **não apaga nada e não instala nada**. A
 * porta é `configurar_empresa` (dono e administrador), e não a da operação:
 * trocar o tipo muda a tela de todo mundo na conta. Toda troca vai para a
 * auditoria, com de onde e para onde.
 */
export async function acaoDefinirNicho(clienteId: string, nicho: string): Promise<RespostaDeRecursos> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_empresa', 'todos')
  if (recusou(acesso)) return acesso

  const novo = nicho === '' ? null : nicho
  if (novo !== null && !ehNicho(novo)) return { ok: false, erro: 'esse tipo de negócio não existe' }

  const anterior = await nichoDaConta(clienteId)
  if (anterior === novo) return { ok: true }
  const r = await definirNicho(clienteId, novo)
  if (!r.ok) return { ok: false, erro: r.motivo }

  await registrar({
    acao: 'trocou_tipo_de_negocio',
    autorId: acesso.sessao.usuario.id,
    autorEmail: acesso.sessao.usuario.email,
    contaId: clienteId,
    alvoTipo: 'client',
    alvoId: clienteId,
    detalhes: { de: anterior ?? '', para: novo ?? '', nome: pacoteDo(novo)?.nome ?? 'Sem tipo' },
    impersonadoPor: acesso.sessao.impersonadoPor,
  })

  // O menu, os títulos e as galerias de toda a conta mudam.
  revalidatePath(`/clientes/${clienteId}`, 'layout')
  return { ok: true }
}
