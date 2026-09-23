/**
 * Quando uma entrada pode ser ligada (A05).
 *
 * Entrada é tudo o que abre um fluxo: palavra-chave, evento, campanha e o
 * interruptor da própria automação. O motor executa só a versão publicada, então
 * ligar uma entrada para um fluxo em rascunho deixava a porta aberta para lugar
 * nenhum: a mensagem casava, o interruptor ficava verde e ninguém respondia.
 *
 * Desligar sempre pode, e por isso a função só é perguntada ao ligar.
 */
export type MotivoDeRecusa = 'destino_nao_publicado' | 'destino_apagado'

export type EstadoDoDestino = { existe: boolean; publicado: boolean }

export const TEXTO_DA_RECUSA: Record<MotivoDeRecusa, string> = {
  destino_nao_publicado:
    'A automação de destino ainda não foi publicada. Publique antes de ligar, senão ninguém recebe resposta.',
  destino_apagado: 'A automação de destino foi apagada. Escolha outra.',
}

export function podeLigar(
  destino: EstadoDoDestino,
): { ok: true } | { ok: false; motivo: MotivoDeRecusa; texto: string } {
  // Apagado vem antes: "publique" não ajuda quem não tem mais o que publicar.
  if (!destino.existe) {
    return { ok: false, motivo: 'destino_apagado', texto: TEXTO_DA_RECUSA.destino_apagado }
  }
  if (!destino.publicado) {
    return {
      ok: false,
      motivo: 'destino_nao_publicado',
      texto: TEXTO_DA_RECUSA.destino_nao_publicado,
    }
  }
  return { ok: true }
}
