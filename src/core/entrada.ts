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

/**
 * Publicação e entrada são duas perguntas (A03), e a tela responde as duas por
 * escrito. O selo único (`ATIVA`/`RASCUNHO`/`DESLIGADO`) obrigava a deduzir uma
 * pela outra, e "DESLIGADO" escondia que a versão continuava publicada.
 */
export function rotulosDoEstado(estado: {
  /** Número da versão no ar, ou `null` quando nunca foi publicada. */
  versao: number | null
  ativo: boolean
  /** O rascunho difere do publicado. Só o editor sabe. */
  comMudancas?: boolean
}): { publicacao: string; entrada: string } {
  const publicacao =
    estado.versao === null
      ? 'Nunca publicada'
      : `Publicada v${estado.versao}${estado.comMudancas ? ' · com mudanças' : ''}`
  return { publicacao, entrada: estado.ativo ? 'Entrada ligada' : 'Entrada desligada' }
}

/** O que acontece ao desligar, dito na hora em que acontece. */
export const AVISO_AO_DESLIGAR =
  'Novas conversas não entram mais. Quem já está no meio continua na versão em que começou.'
