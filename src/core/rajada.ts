/**
 * Mensagens em rajada: "Olá", "Tudo bem", "?" em três envios seguidos.
 *
 * Cada uma chegava num webhook próprio e acordava o bot sozinha, e a pessoa
 * recebia três respostas para uma frase só. Desde 1/out/2026 a Meta cobra cada
 * mensagem de serviço, então a rajada passou a custar também.
 *
 * A regra: texto espera `JANELA_DA_RAJADA_MS` antes de fazer a conversa andar.
 * Se outro texto da mesma pessoa chegou nesse meio tempo, este desiste e quem
 * chegou por último responde pelos dois. Só texto conta: clique em botão é
 * resposta fechada e não espera, e foto ou áudio têm fluxo próprio.
 */
export const JANELA_DA_RAJADA_MS = 3_000

/**
 * Até onde olhar para trás ao juntar a rajada. Uma frase partida em vários
 * envios cabe folgada; uma mensagem de uma hora atrás que ficou sem resposta
 * não é parte da mesma pergunta.
 */
const ALCANCE_DA_RAJADA_MS = 2 * 60_000

type MensagemDaRajada = {
  direcao: 'entrada' | 'saida'
  texto: string | null
  ts: string
}

/**
 * O que a pessoa disse desde a última resposta, numa linha por envio.
 *
 * Recebe a conversa em ordem cronológica, já com a mensagem atual. Pega as
 * entradas do fim, para na primeira saída, e descarta o que ficou longe demais
 * da última. `null` quando não há texto nenhum para juntar.
 */
export function textoDaRajada(
  mensagens: readonly MensagemDaRajada[],
  alcanceMs: number = ALCANCE_DA_RAJADA_MS,
): string | null {
  const ultima = mensagens.at(-1)
  if (!ultima || ultima.direcao !== 'entrada') return null
  const limite = Date.parse(ultima.ts) - alcanceMs

  const textos: string[] = []
  for (const m of [...mensagens].reverse()) {
    if (m.direcao !== 'entrada' || Date.parse(m.ts) < limite) break
    const texto = m.texto?.trim()
    if (texto) textos.unshift(texto)
  }
  return textos.length > 0 ? textos.join('\n') : null
}
