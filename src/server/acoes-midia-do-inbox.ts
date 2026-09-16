'use server'

import { podeResponderAgora } from './distribuir-atendimento'
import { revalidatePath } from 'next/cache'
import { dentroDaJanela } from '@/channels/janela'
import { autorDaPessoa } from '@/core/autor-da-mensagem'
import { LIMITE_LEGENDA, TIPOS_DE_MIDIA, type TipoDeMidia } from '@/core/flow/schema'
import { adaptadorDoCanal } from './adaptador-do-canal'
import {
  confirmarEntrega,
  contextoDeResposta,
  definirStatusDaSessao,
  registrarSaida,
} from './repos/conversas'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * Mandar foto, vídeo, áudio ou PDF pela caixa de resposta do Inbox.
 *
 * ---------------------------------------------------------------------------
 * A peça que faltava, e por que ela faltava
 * ---------------------------------------------------------------------------
 *
 * O adaptador já sabia enviar mídia desde a Fase 11 do motor, `enviarMidia`
 * existe em `channels/cloud-api.ts` e o bloco de mídia do fluxo usa há meses.
 * O que nunca existiu foi **alguém do atendimento** poder mandar: a caixa do
 * Inbox só produzia texto. Quem atende não conseguia mandar uma foto de tabela
 * de preço nem o PDF do contrato, as duas coisas que mais se manda num
 * atendimento de verdade.
 *
 * ---------------------------------------------------------------------------
 * O arquivo já está no Storage quando esta ação roda
 * ---------------------------------------------------------------------------
 *
 * A tela sobe direto para o Storage com URL assinada (`acaoPrepararEnvioDeArquivo`)
 * e só então chama aqui, com a URL pública. **Não é otimização**: um `File`
 * atravessando Server Action bate no teto de 1 MB do Next, e um vídeo de 12 MB
 * morreria no caminho sem erro que ajude.
 *
 * O caminho é o mesmo do Acervo de propósito, mesmo bucket, mesma validação de
 * tipo e tamanho, mesma limpeza quando o cliente é apagado. Um segundo lugar
 * para guardar arquivo seria um segundo lugar para vazar e um segundo lugar
 * para esquecer na LGPD.
 */
export async function acaoEnviarMidiaDoInbox(
  clienteId: string,
  contatoId: string,
  entrada: { url: string; midia: string; legenda?: string; nomeArquivo?: string },
): Promise<{ ok: boolean; erro?: string }> {
  const acesso = await exigirAcessoAoCliente(clienteId)

  /*
   * A mesma trava do texto: mandar foto na conversa de outra pessoa é o mesmo
   * atropelo que mandar texto. Ver `podeResponderAgora`.
   */
  const trava = await podeResponderAgora(clienteId, contatoId, acesso.sessao.usuario.id)
  if (!trava.ok) return trava

  const url = entrada.url?.trim() ?? ''
  if (url === '') return { ok: false, erro: 'o arquivo não terminou de subir' }

  if (!TIPOS_DE_MIDIA.includes(entrada.midia as TipoDeMidia)) {
    return { ok: false, erro: 'tipo de arquivo que o WhatsApp não envia' }
  }
  const midia = entrada.midia as TipoDeMidia

  /*
   * Áudio não aceita legenda na Cloud API. Recusar aqui em vez de deixar a
   * Meta recusar dá o motivo em português, e no momento em que a pessoa ainda
   * está olhando o que escreveu.
   */
  const legenda = (entrada.legenda ?? '').trim()
  if (legenda !== '' && midia === 'audio') {
    return { ok: false, erro: 'áudio não leva legenda no WhatsApp' }
  }
  if (legenda.length > LIMITE_LEGENDA) {
    return {
      ok: false,
      erro: `a legenda aceita ${LIMITE_LEGENDA} caracteres, e esta tem ${legenda.length}`,
    }
  }

  const contexto = await contextoDeResposta(clienteId, contatoId)
  if (!contexto) return { ok: false, erro: 'este lead não tem um número conectado para responder' }

  /*
   * A janela de 24h vale para mídia igual ao texto, a Meta recusa os dois
   * fora dela. Conferir aqui evita gastar upload e dá o motivo certo em vez do
   * erro cru da Meta.
   */
  if (!dentroDaJanela(contexto.ultimaEntradaEm)) {
    return {
      ok: false,
      erro: contexto.ultimaEntradaEm
        ? 'passaram mais de 24h desde a última mensagem dela, e o WhatsApp só deixa retomar por um modelo aprovado'
        : 'esta pessoa nunca escreveu, e o WhatsApp não deixa começar a conversa assim',
    }
  }

  let canal
  try {
    canal = await adaptadorDoCanal(contexto.canal)
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) }
  }

  /*
   * Grava antes de enviar, como o texto: uma função que morre no meio não pode
   * apagar do histórico algo que já saiu. O `payload` guarda o tipo e a URL,
   * é o que faz a conversa saber desenhar a foto em vez de uma linha vazia.
   */
  const quemResponde = await sessaoAtual()
  const registro = await registrarSaida({
    contatoId,
    sessaoId: contexto.sessaoId,
    texto: legenda,
    /*
     * `midia` em português, e não o `type` da Meta: é o formato que
     * `anexoDoPayload` já lê para desenhar a bolha, o mesmo que o bloco de
     * mídia do fluxo grava. Inventar um segundo formato aqui faria a foto que
     * o atendente mandou não aparecer na conversa, enquanto a do bot aparece.
     */
    payload: {
      midia,
      url,
      ...(entrada.nomeArquivo ? { nomeArquivo: entrada.nomeArquivo } : {}),
    },
    // O autor é somado ao `payload` acima, não o substitui, senão a foto
    // sumiria da conversa para o nome caber.
    autor: autorDaPessoa(quemResponde?.usuario),
  })

  try {
    await canal.enviarMidia(contexto.waId, {
      midia,
      url,
      ...(legenda !== '' ? { legenda } : {}),
      ...(entrada.nomeArquivo ? { nomeArquivo: entrada.nomeArquivo } : {}),
    })
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : 'não deu para enviar' }
  }

  await confirmarEntrega(registro)
  if (contexto.sessaoId) await definirStatusDaSessao(contexto.sessaoId, 'humano')

  void quemResponde

  revalidatePath(`/clientes/${clienteId}/inbox`)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}
