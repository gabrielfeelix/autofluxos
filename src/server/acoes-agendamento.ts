'use server'

import { conferirAgendamento, MOTIVO_DA_RECUSA } from '@/core/agendamento'
import { agendar, cancelarAgendada, type MensagemAgendada } from './repos/mensagens-agendadas'
import { contextoDeResposta } from './repos/conversas'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * Marcar uma mensagem para depois.
 *
 * ---------------------------------------------------------------------------
 * O que esta ação NÃO confere, e por quê
 * ---------------------------------------------------------------------------
 *
 * Ela não recusa horário fora da janela de 24h. A janela **reabre** toda vez
 * que o cliente escreve, e recusar aqui impediria o caso normal: marcar uma
 * resposta para amanhã numa conversa que vai continuar hoje à noite.
 *
 * O que existe é aviso na tela antes de marcar, e a conferência de verdade no
 * instante do envio (`enviar-agendadas.ts`), onde a recusa da Meta fica
 * guardada em `erro` e aparece na conversa. Prometer na hora de marcar algo que
 * só se sabe na hora de mandar seria adivinhação com cara de garantia.
 */
export async function acaoAgendarMensagem(
  clienteId: string,
  contatoId: string,
  formData: FormData,
): Promise<{ ok: boolean; erro?: string; agendada?: MensagemAgendada }> {
  await exigirAcessoAoCliente(clienteId)

  const texto = String(formData.get('texto') ?? '')
  const quandoBruto = String(formData.get('quando') ?? '').trim()
  const quando = quandoBruto === '' ? null : new Date(quandoBruto)

  const recusa = conferirAgendamento({ texto, quando }, new Date())
  if (recusa) return { ok: false, erro: MOTIVO_DA_RECUSA[recusa] }

  /*
   * Confere que dá para responder este contato **antes** de aceitar.
   *
   * Não é a janela de 24h: é o número conectado. Marcar mensagem para um
   * contato cuja conta perdeu o canal cria uma linha que vai falhar sozinha
   * daqui a horas, longe de quem poderia consertar. Aqui o erro chega enquanto
   * a pessoa ainda está olhando.
   */
  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) {
    return { ok: false, erro: 'este contato não tem um número conectado para responder' }
  }

  const quem = await sessaoAtual()

  /*
   * O modelo é opcional, e só vale fora da janela.
   *
   * Vem vazio quando quem agendou marcou um horário que ainda cabe nas 24h: o
   * texto livre é mais barato e não gasta cota da Meta, então promover a modelo
   * sem pedido seria gastar o dinheiro do cliente por conta própria.
   *
   * Não é conferido aqui de propósito. O envio confere o modelo no instante em
   * que for usar, porque a Meta pausa modelo por qualidade sem avisar e entre
   * marcar e enviar pode ter passado uma semana. Ver `enviar-agendadas.ts`.
   */
  const templateId = String(formData.get('templateId') ?? '').trim() || null

  const agendada = await agendar({
    clienteId,
    contatoId,
    texto: texto.trim(),
    templateId,
    // `quando` já é um instante absoluto, o navegador resolveu o fuso de quem
    // marcou antes de mandar. Daqui para a frente não há fuso para errar.
    quando: (quando as Date).toISOString(),
    criadaPor: quem?.usuario.id ?? null,
    criadaPorNome: quem?.usuario.nome ?? null,
  })

  // Sem recarregar: a linha já apareceu no clique (`inbox/agendadas-local.ts`)
  // e troca o id provisório por este. Ver `gestoSemRecarregar`.
  return { ok: true, agendada }
}

/**
 * Cancelar antes de sair.
 *
 * Só alcança o que ainda está `agendada`, ver `cancelarAgendada`. Cancelar uma
 * que já saiu não é possível e não deve parecer possível: a tela diz que ela já
 * foi, em vez de marcar como cancelada algo que o cliente leu.
 */
export async function acaoCancelarAgendada(
  clienteId: string,
  id: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const deu = await cancelarAgendada(clienteId, id)
  if (!deu) return { ok: false, erro: 'esta mensagem já saiu ou já tinha sido cancelada' }

  // Sem recarregar: a tela tira a linha quando este "ok" chega
  // (`inbox/agendadas-local.ts`). Ver `gestoSemRecarregar`.
  return { ok: true }
}
