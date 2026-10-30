'use server'

import { lerSegredo } from '@/agendas/comum'
import { FICHAS_DOS_SISTEMAS, ehSistemaDoRamo, temConector } from '@/core/sistemas-dos-ramos'
import { montarConector } from './agenda-externa'
import { exigirCapacidade, recusou } from './permissoes'
import { agendasDaConta, salvarAgenda } from './repos/agendas'
import { criarConexao, lerCredencial, listarConexoes, trocarValor } from './repos/conexoes'
import { registrarPedidoDeLoja } from './repos/lojas'

type Resposta = { ok: true; resumo?: string } | { ok: false; motivo: string }

/**
 * Configurações > Integrações > Sistemas do ramo (docs/SEGMENTOS-NOVOS.md §2).
 *
 * Conectar confere a chave **antes** de gravar: credencial guardada sem ser
 * testada é a que aparece como "ligada" e falha no meio de uma conversa. Os
 * campos marcados como segredo vão juntos, num JSON, para o cofre; o resto vai
 * para `agendas_conectadas.ajustes`.
 */
export async function acaoConectarAgenda(
  clienteId: string,
  plataforma: string,
  valores: Record<string, string>,
): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  if (!ehSistemaDoRamo(plataforma) || !temConector(plataforma)) return { ok: false, motivo: 'esse sistema ainda não conecta' }

  const ficha = FICHAS_DOS_SISTEMAS[plataforma]
  const segredo: Record<string, string> = {}
  const ajustes: Record<string, string | number> = {}
  for (const campo of ficha.campos) {
    const valor = (valores[campo.id] ?? '').trim()
    if (valor === '') {
      if (campo.obrigatorio) return { ok: false, motivo: `preencha ${campo.rotulo.toLowerCase()}` }
      continue
    }
    if (valor.length > 500) return { ok: false, motivo: `${campo.rotulo} está longo demais` }
    if (campo.numero && !/^\d{1,12}$/.test(valor)) return { ok: false, motivo: `${campo.rotulo} precisa ser um número` }
    if (campo.segredo) segredo[campo.id] = valor
    else ajustes[campo.id] = campo.numero ? Number(valor) : valor
  }

  const conferido = await montarConector(plataforma, segredo, ajustes).conferir()
  if (!conferido.ok) return { ok: false, motivo: conferido.motivo }

  const nome = `${ficha.nome} (agenda)`
  const valor = JSON.stringify(segredo)
  const existente = (await listarConexoes(clienteId)).find((c) => c.nome === nome)
  try {
    const conexaoId = existente
      ? (await trocarValor(existente.id, clienteId, valor), existente.id)
      : (await criarConexao({ clienteId, nome, tipo: 'bearer', valor })).id
    // Uma agenda por vez responde à IA: as outras ficam guardadas, desligadas.
    for (const outra of await agendasDaConta(clienteId)) {
      if (outra.plataforma !== plataforma && outra.ativo) {
        await salvarAgenda({ clienteId, plataforma: outra.plataforma, conexaoId: outra.conexaoId, ajustes: outra.ajustes, ativo: false })
      }
    }
    await salvarAgenda({ clienteId, plataforma, conexaoId, ajustes, ativo: true, conferidoEm: new Date() })
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : 'não foi possível salvar' }
  }
  return { ok: true, resumo: conferido.valor.resumo }
}

export async function acaoTestarAgenda(clienteId: string, plataforma: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  const agenda = (await agendasDaConta(clienteId)).find((a) => a.plataforma === plataforma)
  if (!agenda?.conexaoId) return { ok: false, motivo: 'essa agenda não está conectada' }
  const credencial = await lerCredencial(agenda.conexaoId, clienteId)
  if (!credencial) return { ok: false, motivo: 'a credencial não pôde ser lida' }
  const r = await montarConector(agenda.plataforma, lerSegredo(credencial.valor), agenda.ajustes).conferir()
  if (!r.ok) return r
  await salvarAgenda({ clienteId, plataforma: agenda.plataforma, conexaoId: agenda.conexaoId, ajustes: agenda.ajustes, ativo: agenda.ativo, conferidoEm: new Date() })
  return { ok: true, resumo: r.valor.resumo }
}

export async function acaoDesligarAgenda(clienteId: string, plataforma: string): Promise<Resposta> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  const agenda = (await agendasDaConta(clienteId)).find((a) => a.plataforma === plataforma)
  if (!agenda) return { ok: true }
  await salvarAgenda({ clienteId, plataforma: agenda.plataforma, conexaoId: agenda.conexaoId, ajustes: agenda.ajustes, ativo: false })
  return { ok: true }
}

export async function acaoSolicitarSistema(clienteId: string, plataforma: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const acesso = await exigirCapacidade(clienteId, 'configurar_operacao', 'todos')
  if (recusou(acesso)) return { ok: false, motivo: acesso.erro ?? 'sem permissão' }
  if (!ehSistemaDoRamo(plataforma)) return { ok: false, motivo: 'esse sistema não está na lista' }
  return registrarPedidoDeLoja(clienteId, plataforma)
}
