'use server'

import { revalidatePath } from 'next/cache'
import { podeReagir } from '@/channels/janela'
import { adaptadorDoCanal } from './adaptador-do-canal'
import { confirmarEntrega, contextoDeResposta, registrarSaida } from './repos/conversas'
import { acharMensagemParaReagir } from './repos/leads'
import { exigirAcessoAoCliente } from './sessao'

/**
 * Reagir a uma mensagem da conversa, pelo Inbox.
 *
 * ---------------------------------------------------------------------------
 * Por que reagir merece uma ação própria
 * ---------------------------------------------------------------------------
 *
 * Reagir **não é responder**, e tratá-lo como uma resposta curta erraria em
 * três lugares de uma vez: a janela de 24h não se aplica (o prazo da reação é
 * outro, 30 dias), o bot não deve calar por causa de um "👍" (responder assume
 * a conversa; reagir não), e a linha gravada não é uma mensagem na conversa —
 * é um comentário grudado em outra.
 *
 * ---------------------------------------------------------------------------
 * Os dois prazos da Meta, que são diferentes de propósito
 * ---------------------------------------------------------------------------
 *
 * Responder em texto livre exige que a **pessoa** tenha falado nas últimas 24h.
 * Reagir exige que a **mensagem** tenha menos de 30 dias. São eixos distintos:
 * dá para reagir a uma mensagem de ontem numa conversa parada há uma semana, e
 * não dá para reagir a uma de março numa conversa que está viva agora.
 *
 * Por isso aqui não há `dentroDaJanela`. Pôr a checagem de 24h "por garantia"
 * bloquearia a maioria dos casos legítimos de reagir.
 */
export async function acaoReagir(
  clienteId: string,
  contatoId: string,
  entrada: { waMessageId: string; emoji: string },
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const waMessageId = entrada.waMessageId?.trim() ?? ''
  if (waMessageId === '') return { ok: false, erro: 'não deu para saber a qual mensagem reagir' }

  /*
   * String vazia é **remoção**, e é assim que a Meta faz: não existe endpoint
   * de desreagir. Por isso o emoji não é validado como "não vazio" — o vazio é
   * metade do recurso.
   */
  const emoji = entrada.emoji ?? ''

  /*
   * A mensagem precisa ser desta conversa.
   *
   * O par (contato, cliente) é conferido na leitura pelo mesmo motivo do resto
   * do repo: id vindo da tela não prova de quem ele é. Sem isto, um id de outra
   * conversa mandaria uma reação para o WhatsApp de outra pessoa.
   */
  const alvo = await acharMensagemParaReagir(clienteId, contatoId, waMessageId)
  if (!alvo) return { ok: false, erro: 'esta mensagem não está nesta conversa' }

  /*
   * O teto de 30 dias, conferido aqui e escondido na tela.
   *
   * A tela já não mostra o botão em mensagem velha, e mesmo assim a checagem
   * existe: entre carregar a conversa e clicar pode passar tempo, e a recusa da
   * Meta chegaria em inglês com um número entre parênteses.
   */
  if (!podeReagir(alvo.ts)) {
    return {
      ok: false,
      erro: 'o WhatsApp só deixa reagir a mensagens dos últimos 30 dias, e esta é mais antiga',
    }
  }

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }

  /*
   * O canal pode não ter o recurso.
   *
   * `reagir` é opcional na interface porque só o WhatsApp reage — o Instagram
   * não. Perguntar antes é o que faz a conversa de Instagram dar uma recusa em
   * português em vez de `canal.reagir is not a function`.
   */
  if (!canal.reagir) {
    return { ok: false, erro: 'este canal não tem reação' }
  }

  /*
   * Grava antes de enviar, como todo o resto: uma função que morre no meio não
   * pode deixar na Meta uma reação que a conversa não conhece.
   *
   * `texto` é o próprio emoji — o mesmo que o webhook grava quando a reação
   * vem de lá —, e é o que faz o formato da reação que sai ser igual ao da que
   * chega. Dois formatos fariam a reação do atendente sumir da conversa
   * enquanto a do contato aparece, que é a lição da camada 1.
   */
  const registro = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto: emoji === '' ? '' : emoji,
    reagiuA: waMessageId,
    reacao: emoji,
  })

  try {
    await canal.reagir(contexto.waId, waMessageId, emoji)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para reagir' }
  }

  await confirmarEntrega(registro)

  /*
   * **O bot não cala por uma reação**, e é por isso que não há
   * `definirStatusDaSessao('humano')` aqui — ao contrário de responder e de
   * mandar mídia. Um "👍" não é alguém assumindo o atendimento, e derrubar a
   * automação por causa dele seria a pior surpresa possível: o fluxo para de
   * falar e ninguém sabe por quê.
   */
  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}
