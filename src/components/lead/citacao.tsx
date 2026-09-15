'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * A mensagem que a caixa de resposta está citando.
 *
 * ---------------------------------------------------------------------------
 * Por que contexto, e não uma propriedade
 * ---------------------------------------------------------------------------
 *
 * Quem escolhe citar é um botão **dentro de uma mensagem**, lá no meio da
 * conversa; quem usa a escolha é a caixa de resposta, no rodapé. Os dois são
 * irmãos distantes de um Server Component, e a página que os monta não pode
 * segurar esse estado sem virar cliente inteira — o que custaria o render no
 * servidor de uma conversa de 500 mensagens.
 *
 * O provedor é um Client Component fino que envolve os dois e **recebe o
 * conteúdo já renderizado no servidor** como `children`. É o padrão que o Next
 * documenta para exatamente isto: interatividade na borda, HTML do servidor por
 * dentro.
 *
 * ---------------------------------------------------------------------------
 * Trocar de conversa limpa a citação
 * ---------------------------------------------------------------------------
 *
 * Quem garante é a `key` no provedor, na página. Sem ela, citar uma mensagem,
 * mudar de conversa e responder mandaria a resposta citando uma mensagem de
 * **outra** pessoa — id que a Meta recusa na melhor das hipóteses, e a pior é
 * ela aceitar.
 */

export type CitacaoEscolhida = {
  /** O `wa_message_id` — o id da Meta, que é o que ela entende. */
  waMessageId: string
  /** Só para desenhar a prévia acima do campo. */
  texto: string | null
  deQuem: string
}

type Valor = {
  citando: CitacaoEscolhida | null
  citar: (escolha: CitacaoEscolhida) => void
  limpar: () => void
}

const Contexto = createContext<Valor | null>(null)

export function ProvedorDeCitacao({ children }: { children: ReactNode }) {
  const [citando, setCitando] = useState<CitacaoEscolhida | null>(null)

  const valor = useMemo<Valor>(
    () => ({ citando, citar: setCitando, limpar: () => setCitando(null) }),
    [citando],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/**
 * `null` fora do provedor, e isso é de propósito.
 *
 * A caixa de resposta é usada também na tela da Ficha, que pode não ter o
 * provedor. Devolver `null` em vez de estourar deixa citar ser um recurso que
 * existe onde foi montado, e não uma dependência obrigatória de quem só quer
 * responder.
 */
export function useCitacao(): Valor | null {
  return useContext(Contexto)
}
