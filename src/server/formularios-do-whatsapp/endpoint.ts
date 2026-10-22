import 'server-only'
import {
  janelaDeDias,
  opcoesDeDias,
  opcoesDeHorarios,
  resumoDaMarcacao,
  rotuloDoDia,
  TELA_CONFIRMADO,
  TELA_DIA,
  TELA_HORARIO,
  type MarcacaoDoFormulario,
} from '@/core/formulario-de-agendamento'
import { acharLead } from '../repos/leads'
import type { FormularioDoWhatsapp } from '../repos/formularios-do-whatsapp'
import { chaveDaAgenda, horariosLivres, marcarNaAgenda, pessoaNaAgenda } from './agenda'
import { lerTokenDoFormulario, type DadosDoToken } from './token'

/**
 * O que o endpoint responde a cada chamada da Meta, já decifrada. A rota
 * cuida da assinatura e da criptografia; daqui para baixo é conversa com a
 * agenda.
 *
 * Toda falha da agenda vira a tela de agora com uma frase (`error_message`),
 * nunca erro HTTP: erro HTTP mostra à pessoa uma mensagem genérica da Meta e
 * pode desligar o botão da mensagem.
 */

export type RespostaDoEndpoint =
  | { status: 200; corpo: unknown }
  /** O token venceu ou não é deste formulário: a Meta desliga o botão. */
  | { status: 427 }

/** Quem marcou, para a conversa seguir sem esperar o "Concluir". */
export type AoMarcar = (token: DadosDoToken, marcacao: MarcacaoDoFormulario) => void

type Pedido = {
  action?: unknown
  screen?: unknown
  data?: Record<string, unknown>
  flow_token?: unknown
}

const FALHA_DA_AGENDA = 'Não foi possível consultar a agenda agora. Tente de novo em instantes.'
const SEM_HORARIO = 'Não há horário livre nos próximos dias. Responda na conversa que a equipe ajuda.'
const AGENDA_DESLIGADA = 'A agenda não está disponível. Responda na conversa que a equipe ajuda.'

const texto = (v: unknown) => (typeof v === 'string' ? v : '')

export async function responderAoFormulario(
  formulario: FormularioDoWhatsapp,
  bruto: unknown,
  aoMarcar: AoMarcar,
  agora = new Date(),
): Promise<RespostaDoEndpoint> {
  const pedido = (bruto && typeof bruto === 'object' ? bruto : {}) as Pedido
  const acao = texto(pedido.action)

  if (acao === 'ping') return { status: 200, corpo: { data: { status: 'active' } } }

  // A Meta avisa que a nossa resposta anterior não serviu. Só registra.
  if (pedido.data && 'error' in pedido.data) {
    console.warn('[formulario] a Meta recusou uma resposta:', texto(pedido.data.error), texto(pedido.data.error_message))
    return { status: 200, corpo: { data: { acknowledged: true } } }
  }

  const token = lerTokenDoFormulario(pedido.flow_token, agora)
  if (!token.ok || token.dados.formularioId !== formulario.id) return { status: 427 }

  const chave = await chaveDaAgenda(formulario.clienteId)
  if (!chave) return tela(TELA_DIA, { dias: [] }, AGENDA_DESLIGADA)

  const dias = async (aviso?: string) => {
    const { de, ate } = janelaDeDias(agora)
    const opcoes = opcoesDeDias(await horariosLivres(chave, de, ate))
    return tela(TELA_DIA, { dias: opcoes }, opcoes.length === 0 ? SEM_HORARIO : aviso)
  }

  const horarios = async (dia: string, aviso?: string) => {
    const opcoes = opcoesDeHorarios(await horariosLivres(chave, dia, dia), dia)
    if (opcoes.length === 0) return dias('Esse dia não tem mais horário livre. Escolha outro.')
    return tela(TELA_HORARIO, { dia, dia_rotulo: rotuloDoDia(dia), horarios: opcoes }, aviso)
  }

  const telaAtual = texto(pedido.screen)
  try {
    if (acao !== 'data_exchange') return await dias()

    if (telaAtual === TELA_DIA) {
      const dia = texto(pedido.data?.dia)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return await dias('Escolha um dia.')
      return await horarios(dia)
    }

    if (telaAtual === TELA_HORARIO) {
      const dia = texto(pedido.data?.dia)
      const sessaoId = texto(pedido.data?.sessao)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return await dias()
      const escolhido = (await horariosLivres(chave, dia, dia)).find((h) => h.sessaoId === sessaoId)
      if (!escolhido) return await horarios(dia, 'Esse horário acabou de lotar. Escolha outro.')

      const lead = await acharLead(formulario.clienteId, token.dados.contatoId)
      if (!lead) return { status: 427 }
      const pessoaId = await pessoaNaAgenda(chave, lead.waId, lead.nome?.trim() || 'Cliente')
      const marcado = await marcarNaAgenda(chave, pessoaId, escolhido.sessaoId)
      if (!marcado.ok) return await horarios(dia, marcado.motivo)

      const marcacao: MarcacaoDoFormulario = {
        participacao_id: marcado.participacaoId,
        sessao_id: escolhido.sessaoId,
        resumo: resumoDaMarcacao(escolhido),
      }
      aoMarcar(token.dados, marcacao)
      return tela(TELA_CONFIRMADO, marcacao)
    }

    return await dias()
  } catch (erro) {
    console.error('[formulario] a agenda falhou:', erro instanceof Error ? erro.message : erro)
    if (telaAtual === TELA_HORARIO) {
      const dia = texto(pedido.data?.dia)
      return tela(TELA_HORARIO, { dia, dia_rotulo: rotuloDoDia(dia), horarios: [] }, FALHA_DA_AGENDA)
    }
    return tela(TELA_DIA, { dias: [] }, FALHA_DA_AGENDA)
  }
}

function tela(screen: string, data: Record<string, unknown>, aviso?: string): RespostaDoEndpoint {
  return { status: 200, corpo: { screen, data: aviso ? { ...data, error_message: aviso } : data } }
}
