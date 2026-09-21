'use server'

import { revalidatePath } from 'next/cache'
import { validarSegmento } from '@/core/segmentos'
import {
  apagarSegmento,
  criarSegmento,
  listarSegmentos,
  salvarRegra,
  type SegmentoSalvo,
} from './repos/segmentos'
import { consultarContatos } from './consultas/contatos'
import { avaliarElegibilidade, type Previa } from './servicos/elegibilidade'
import { exigirCapacidade, filtroDoAcesso, recusou } from './permissoes'
import { pode } from '@/core/permissoes'
import { sessaoAtual } from './sessao'

/**
 * As ações de segmento (T6.2).
 *
 * **A capacidade é `exportar`**, e a escolha merece explicação: a lista de
 * `core/permissoes.ts` a descreve como "exportar, criar segmento compartilhado,
 * transmitir". Um segmento compartilhado é o que alimenta uma transmissão, e
 * quem pode montar o público de um disparo está a um clique de alcançar a base
 * inteira, é o mesmo poder do CSV, por outra porta.
 *
 * **`podeLerValores` é conferido no servidor**, e passado à validação. Esconder
 * o campo de valor no editor não impede ninguém de mandar a condição direto,
 * que é literalmente o A19.
 */

export type RespostaDoSegmento = { ok: boolean; erro?: string }

export type RespostaDaPrevia =
  | { ok: true; previa: Previa; explicacao: string; amostra: { nome: string | null }[] }
  | { ok: false; erro: string }

export async function acaoListarSegmentos(
  clienteId: string,
): Promise<{ ok: true; segmentos: SegmentoSalvo[] } | { ok: false; erro: string }> {
  const acesso = await exigirCapacidade(clienteId, 'atender', 'proprios')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  return { ok: true, segmentos: await listarSegmentos(clienteId) }
}

export async function acaoCriarSegmento(
  clienteId: string,
  nome: string,
  regraBruta: unknown,
): Promise<RespostaDoSegmento> {
  const acesso = await exigirCapacidade(clienteId, 'exportar', 'todos')
  if (recusou(acesso)) return acesso

  const validada = validarSegmento(regraBruta, {
    podeLerValores: pode(acesso.regras, 'ler_valores'),
  })
  if (!validada.ok) return { ok: false, erro: validada.motivo }

  const quem = await sessaoAtual()
  const r = await criarSegmento(clienteId, nome, validada.segmento, quem?.usuario.nome ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/leads/segmentos`)
  return { ok: true }
}

export async function acaoSalvarSegmento(
  clienteId: string,
  segmentoId: string,
  nome: string,
  regraBruta: unknown,
): Promise<RespostaDoSegmento> {
  const acesso = await exigirCapacidade(clienteId, 'exportar', 'todos')
  if (recusou(acesso)) return acesso

  const validada = validarSegmento(regraBruta, {
    podeLerValores: pode(acesso.regras, 'ler_valores'),
  })
  if (!validada.ok) return { ok: false, erro: validada.motivo }

  /*
   * **Salvar aqui não mexe em transmissão nenhuma** (RB-38).
   *
   * Uma transmissão já confirmada tem a lista congelada em
   * `transmissao_destinatarios`; editar a regra depois não acrescenta ninguém
   * ao lote. Se este caminho reenfileirasse destinatários, mudar um segmento
   * mandaria mensagem para gente que ninguém confirmou.
   */
  const r = await salvarRegra(clienteId, segmentoId, validada.segmento, nome)
  if (!r.ok) return { ok: false, erro: r.motivo }

  revalidatePath(`/clientes/${clienteId}/leads/segmentos`)
  return { ok: true }
}

export async function acaoApagarSegmento(
  clienteId: string,
  segmentoId: string,
): Promise<RespostaDoSegmento> {
  const acesso = await exigirCapacidade(clienteId, 'exportar', 'todos')
  if (recusou(acesso)) return acesso

  await apagarSegmento(clienteId, segmentoId)
  revalidatePath(`/clientes/${clienteId}/leads/segmentos`)
  return { ok: true }
}

/**
 * A prévia explicável (UI-14, RB-39).
 *
 * Devolve os **três** números que a regra exige: correspondentes, elegíveis e
 * excluídos por motivo. Um total só esconderia a pergunta de quem dispara: por
 * que 40 dos 52 vão receber?
 */
export async function acaoPrevisualizarSegmento(
  clienteId: string,
  regraBruta: unknown,
  opcoes: { comModelo: boolean },
): Promise<RespostaDaPrevia> {
  const acesso = await exigirCapacidade(clienteId, 'exportar', 'todos')
  if (recusou(acesso)) return { ok: false, erro: acesso.erro ?? 'sem acesso' }

  const podeLerValores = pode(acesso.regras, 'ler_valores')
  const validada = validarSegmento(regraBruta, { podeLerValores })
  if (!validada.ok) return { ok: false, erro: validada.motivo }

  // O escopo entra na consulta: a prévia de quem só enxerga a própria equipe
  // conta a equipe dele, e não a conta inteira.
  const encontrados = await consultarContatos({
    clienteId,
    segmento: validada.segmento,
    escopo: filtroDoAcesso(acesso, 'exportar'),
    porPagina: TETO_DA_PREVIA,
  })

  const previa = await avaliarElegibilidade(
    clienteId,
    encontrados.contatos.map((c) => c.contatoId),
    { comModelo: opcoes.comModelo },
  )

  const { explicarSegmento } = await import('@/core/segmentos')

  return {
    ok: true,
    previa,
    explicacao: explicarSegmento(validada.segmento),
    // Uma amostra curta: a prévia precisa mostrar **quem**, não só quantos.
    // Um número sozinho é o que ninguém confere antes de confirmar.
    amostra: encontrados.contatos.slice(0, 8).map((c) => ({ nome: c.nome })),
  }
}

/**
 * Quantos contatos a prévia avalia.
 *
 * A elegibilidade custa uma consulta por lote, e a prévia é interativa: acima
 * disto ela deixaria de responder enquanto alguém edita a regra. A produção
 * tem 27 contatos medidos em setembro de 2026, então o teto sobra com folga.
 */
const TETO_DA_PREVIA = 2000
