'use server'

import { revalidatePath } from 'next/cache'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { ehEspecie, type Produto } from '@/core/produtos'
import {
  arquivarProduto,
  criarProduto,
  listarProdutos,
  renomearProduto,
} from './repos/produtos'
import { avaliarCartao, definirInteresse } from './repos/quadros'
import { ehTemperaturaDoCartao } from '@/core/quadros'
import { exigirCapacidade, recusou } from './permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações do catálogo e da oportunidade (T5.1).
 *
 * **Que capacidade cada uma exige, e por quê.** O catálogo é configuração da
 * operação: quem cadastra "Plano Ouro" está definindo o vocabulário que toda a
 * equipe vai usar em venda e em segmento, e renomear afeta o que todo mundo
 * enxerga. Por isso `configurar_operacao`, e não `atender`.
 *
 * Já **avaliar a temperatura e apontar o interesse** de uma negociação são
 * trabalho de quem atende, sobre a própria negociação: exigir configuração ali
 * trancaria o vendedor para fora do próprio funil.
 */

export type RespostaDoCatalogo = { ok: true; produtos: Produto[] } | { ok: false; erro: string }

function recarregar(clienteId: string): void {
  revalidatePath(`/clientes/${clienteId}/ajustes/produtos`)
  revalidatePath(`/clientes/${clienteId}/quadros`)
}

export async function acaoListarProdutos(clienteId: string): Promise<RespostaDoCatalogo> {
  // 'atender' e não 'configurar_operacao': quem registra uma venda precisa ler
  // o catálogo para escolher o item, e não deve poder editá-lo por isso.
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  return { ok: true, produtos: await listarProdutos(clienteId) }
}

export async function acaoCriarProduto(
  clienteId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const especie = String(formData.get('especie') ?? 'produto')
  // A espécie chega da tela. Recusar aqui devolve frase; deixar passar
  // devolveria o erro do `check` da 0079, que é texto de Postgres.
  if (!ehEspecie(especie)) return { erro: 'escolha produto ou serviço' }

  const r = await criarProduto(clienteId, String(formData.get('nome') ?? ''), especie)
  if (!r.ok) return { erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

export async function acaoRenomearProduto(
  clienteId: string,
  produtoId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const r = await renomearProduto(clienteId, produtoId, String(formData.get('nome') ?? ''))
  if (!r.ok) return { erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

/**
 * Arquiva ou desarquiva.
 *
 * Não existe ação de apagar, e a ausência é deliberada: apagar zeraria o
 * `produto_id` das vendas e a pergunta "quem comprou o Plano Ouro" passaria a
 * responder menos que a verdade, sem aviso nenhum na tela.
 */
export async function acaoArquivarProduto(
  clienteId: string,
  produtoId: string,
  arquivar: boolean,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return acesso

  const r = await arquivarProduto(clienteId, produtoId, arquivar)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

/**
 * A temperatura **desta oportunidade** (0079).
 *
 * String vazia é "não avaliada", e é escolha legítima da tela: quem avaliou
 * errado desfaz. Por isso o parâmetro não é `Temperatura` puro.
 */
export async function acaoAvaliarOportunidade(
  clienteId: string,
  cartaoId: string,
  temperatura: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  if (temperatura !== '' && !ehTemperaturaDoCartao(temperatura)) {
    return { ok: false, erro: 'essa temperatura não existe' }
  }

  const quem = await sessaoAtual()
  const r = await avaliarCartao(
    clienteId,
    cartaoId,
    temperatura === '' ? null : temperatura,
    quem?.usuario.nome ?? null,
  )
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}

/** O interesse da oportunidade. String vazia tira o vínculo. */
export async function acaoDefinirInteresse(
  clienteId: string,
  cartaoId: string,
  produtoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return acesso

  const r = await definirInteresse(clienteId, cartaoId, produtoId === '' ? null : produtoId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  recarregar(clienteId)
  return { ok: true }
}
