import 'server-only'
import { conectorAgendaPro } from '@/agendas/agendapro'
import { conectorClinicaNasNuvens } from '@/agendas/clinica-nas-nuvens'
import { lerSegredo } from '@/agendas/comum'
import { conectorEvo } from '@/agendas/evo'
import { conectorFeegow } from '@/agendas/feegow'
import { conectorTrinks } from '@/agendas/trinks'
import type { ConectorDeAgenda, PessoaDaAgenda, ResultadoDaAgenda } from '@/agendas/types'
import type { OperacaoDeAgenda } from '@/core/ferramentas'
import type { AgendaComConector } from '@/core/sistemas-dos-ramos'
import { agendaAtivaDaConta } from './repos/agendas'
import { lerCredencial } from './repos/conexoes'
import { acharContato } from './repos/conversas'

/**
 * A agenda de fora da conta, para a IA (docs/SEGMENTOS-NOVOS.md §2).
 *
 * O modelo escolhe a operação e os ids; **quem** sofre a ação é sempre o
 * contato da conversa, lido aqui pelo `contatoId`. Desmarcar só passa se a
 * marcação estiver entre as que `minhas` devolve para essa pessoa agora: id
 * visto em outra conversa ou digitado por alguém não desmarca nada.
 */

/** As credenciais e os ajustes, como a tela grava. Monta o conector certo. */
export function montarConector(
  plataforma: AgendaComConector,
  segredo: Record<string, string>,
  ajustes: Record<string, string | number>,
): ConectorDeAgenda {
  const n = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v))
  switch (plataforma) {
    case 'feegow':
      return conectorFeegow(segredo.token ?? '', {
        localId: n(ajustes.localId),
        unidadeId: n(ajustes.unidadeId),
        motivoDeCancelamento: n(ajustes.motivoDeCancelamento),
      })
    case 'clinica_nas_nuvens':
      return conectorClinicaNasNuvens(
        { clientId: segredo.clientId ?? '', clientSecret: segredo.clientSecret ?? '', cid: segredo.cid ?? '' },
        {
          idLocalAgenda: n(ajustes.idLocalAgenda),
          idTipoConsulta: n(ajustes.idTipoConsulta),
          idTipoConvenioParticular: n(ajustes.idTipoConvenioParticular),
        },
      )
    case 'trinks':
      return conectorTrinks(segredo.chave ?? '', { estabelecimentoId: String(ajustes.estabelecimentoId ?? '') })
    case 'agendapro':
      return conectorAgendaPro(segredo.chave ?? '', { locationId: n(ajustes.locationId) })
    case 'evo':
      return conectorEvo({ dns: String(ajustes.dns ?? ''), chave: segredo.chave ?? '' }, { idBranch: n(ajustes.idBranch) })
  }
}

async function conectorDaConta(clienteId: string): Promise<ResultadoDaAgenda<ConectorDeAgenda>> {
  const agenda = await agendaAtivaDaConta(clienteId)
  if (!agenda?.conexaoId) return { ok: false, motivo: 'a conta não tem agenda conectada' }
  const credencial = await lerCredencial(agenda.conexaoId, clienteId)
  if (!credencial) return { ok: false, motivo: 'a credencial da agenda não pôde ser lida' }
  return { ok: true, valor: montarConector(agenda.plataforma, lerSegredo(credencial.valor), agenda.ajustes) }
}

/** O que volta ao modelo quando o sistema precisa de um documento para achar a pessoa. */
function pedido(r: { motivo: string; pedir?: 'cpf' | 'nascimento' }) {
  const oQue = r.pedir === 'cpf' ? 'o CPF' : 'a data de nascimento'
  return {
    ok: true as const,
    json: { precisa: r.pedir, aviso: `Peça ${oQue} da pessoa e chame a mesma consulta de novo com ele.` },
  }
}

export async function executarNaAgenda(
  operacao: OperacaoDeAgenda,
  valores: Record<string, string>,
  opcoes: { clienteId?: string; contatoId?: string },
): Promise<{ ok: true; json: unknown } | { ok: false; motivo: string }> {
  if (!opcoes.clienteId) return { ok: false, motivo: 'a consulta à agenda só funciona numa conta' }
  const c = await conectorDaConta(opcoes.clienteId)
  if (!c.ok) return c
  const agenda = c.valor

  if (operacao === 'servicos') {
    const r = await agenda.servicos()
    return r.ok ? { ok: true, json: r.valor } : r
  }

  if (operacao === 'horarios') {
    const r = await agenda.horarios({
      de: valores.de ?? '',
      ate: valores.ate ?? valores.de ?? '',
      ...(valores.servico ? { servicoId: valores.servico } : {}),
      ...(valores.profissional ? { profissionalId: valores.profissional } : {}),
    })
    return r.ok ? { ok: true, json: r.valor } : r
  }

  // Daqui para baixo a operação é sobre alguém, e esse alguém é o contato.
  const contato = opcoes.contatoId ? await acharContato(opcoes.contatoId) : null
  if (!contato) {
    return { ok: true, json: { aviso: 'No teste não há pessoa na conversa: a consulta da agenda pessoal só funciona numa conversa de verdade.' } }
  }
  const pessoa: PessoaDaAgenda = {
    telefone: contato.waId,
    nome: contato.nomeReal ?? contato.nome ?? '',
    ...(valores.cpf ? { cpf: valores.cpf } : {}),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(valores.nascimento ?? '') ? { nascimento: valores.nascimento } : {}),
  }

  if (operacao === 'minhas') {
    const r = await agenda.minhas(pessoa)
    if (!r.ok) return r.pedir ? pedido(r) : r
    return { ok: true, json: { marcacoes: r.valor } }
  }

  if (operacao === 'marcar') {
    const r = await agenda.marcar(valores.horario_id ?? '', pessoa)
    if (!r.ok) return r.pedir ? pedido(r) : r
    return { ok: true, json: { marcacao: r.valor } }
  }

  // desmarcar: a marcação tem que ser desta pessoa, conferido agora.
  const minhas = await agenda.minhas(pessoa)
  if (!minhas.ok) return minhas.pedir ? pedido(minhas) : minhas
  const alvo = valores.marcacao_id ?? ''
  if (!minhas.valor.some((m) => m.marcacaoId === alvo)) {
    return { ok: false, motivo: 'essa marcação não está entre as da pessoa' }
  }
  const r = await agenda.desmarcar(alvo, pessoa)
  return r.ok ? { ok: true, json: { desmarcado: true } } : r
}
