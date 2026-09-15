import 'server-only'
import { midiaDoTipo, TETO_DO_ARQUIVO } from '@/core/midia-recebida'
import type { Canal } from '@/channels/types'
import { guardarArquivo } from './repos/midia-recebida'

/**
 * Baixar da Meta e guardar, antes que o prazo feche.
 *
 * ---------------------------------------------------------------------------
 * Por que roda dentro da conversa, e não depois dela
 * ---------------------------------------------------------------------------
 *
 * A tentação é adiar: responder primeiro, guardar depois. Mas o `id` da mídia
 * vive **7 dias** e a função que adia pode morrer — e mídia perdida não volta
 * de lugar nenhum, porque a Meta não guarda cópia (Cloud API Terms 4.5).
 *
 * O custo do caminho escolhido é honesto: o download entra antes de o bot
 * responder, e uma foto grande atrasa a resposta em alguns segundos. Isso cabe
 * porque o produto **já** espera de propósito — `aguardarResposta` segura a
 * resposta pelo atraso desenhado no fluxo, que pode chegar a 25 segundos. Um
 * download com teto de 30s dentro de uma função de 60s é menos espera do que o
 * fluxo já introduz sozinho.
 *
 * Nunca estoura. Quem chama roda depois de a mensagem estar gravada: uma foto
 * que não desceu deixa a conversa sem a foto, e é só isso que ela pode causar.
 */
export async function guardarMidiaRecebida(
  canal: Canal,
  clienteId: string,
  contatoId: string,
  mensagemId: string,
  entrada: { tipo: string | null | undefined; midiaId: string | undefined },
): Promise<void> {
  const midia = midiaDoTipo(entrada.tipo)
  if (!midia || !entrada.midiaId) return

  /*
   * Canal sem download não é erro: só o WhatsApp passa por aqui hoje, e o
   * Instagram entrega mídia por URL própria. Perguntar antes é o que faz a
   * ausência ser silêncio em vez de `canal.baixarMidia is not a function` no
   * log de produção.
   */
  if (!canal.baixarMidia) return

  try {
    const arquivo = await canal.baixarMidia(entrada.midiaId)
    if (!arquivo) return

    /*
     * O teto é conferido **depois** do download porque a Meta só diz o tamanho
     * junto com a URL, e o `file_size` que ela declara nem sempre bate com o
     * que desce. Conferir o que está na mão é o que impede o bucket de recusar
     * a escrita — o limite dele é o mesmo — e transformar isso em erro no log
     * em vez de num aviso na tela.
     *
     * Documento vai até 100 MB na Meta; o nosso teto é 16 MB. O arquivo grande
     * fica registrado como recebido e sem cópia, e a bolha diz isso.
     */
    if (arquivo.bytes.byteLength > TETO_DO_ARQUIVO) {
      console.warn(
        `[midia] arquivo de ${Math.round(arquivo.bytes.byteLength / 1024 / 1024)} MB passou do teto e não foi guardado`,
      )
      return
    }

    await guardarArquivo(clienteId, contatoId, mensagemId, arquivo, midia)
  } catch (erro) {
    console.warn(
      '[midia] não deu para guardar a mídia recebida',
      erro instanceof Error ? erro.message : String(erro),
    )
  }
}
