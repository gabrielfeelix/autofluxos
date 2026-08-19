/**
 * O que dizer na prévia quando a mensagem não tem texto.
 *
 * A fila dizia **"mídia ou mensagem sem texto"** para foto, áudio, figurinha e
 * PDF igualmente — a mesma frase para quatro coisas que pedem reações
 * diferentes. Áudio de um minuto e figurinha de "obrigado" não têm a mesma
 * urgência, e quem decide o que abrir primeiro decidia no escuro.
 *
 * O tipo sempre esteve no `payload` que a Meta manda; a 0023 é que o trouxe
 * para a view. Isto aqui é só a tradução.
 */

/** Os `type` da Cloud API, em português e com o ícone que a lista mostra. */
const NOME_DO_TIPO: Record<string, string> = {
  audio: '🎤 áudio',
  image: '📷 foto',
  video: '🎬 vídeo',
  document: '📄 documento',
  sticker: '💬 figurinha',
  location: '📍 localização',
  contacts: '👤 contato',
  // Estes três chegam quando alguém reage, responde a um anúncio ou encaminha
  // um pedido — não são "mídia", e chamá-los de mídia confundiria mais do que
  // a frase genérica que eles substituem.
  reaction: '❤️ reação',
  order: '🛒 pedido',
  button: '🔘 botão',
}

/**
 * A prévia de uma mensagem sem texto.
 *
 * `null` para tipo desconhecido e para saída nossa (que não tem `type` da
 * Meta): quem chama decide a frase genérica, porque ela depende de haver
 * mensagem ou não.
 */
export function nomeDoTipo(tipo: string | null): string | null {
  if (!tipo) return null
  return NOME_DO_TIPO[tipo] ?? null
}
