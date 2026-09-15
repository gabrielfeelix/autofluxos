'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * A moldura de três colunas do Inbox, e o interruptor da terceira.
 *
 * ---------------------------------------------------------------------------
 * Por que ela virou componente de cliente
 * ---------------------------------------------------------------------------
 *
 * A coluna da direita — quem é a pessoa, etiquetas, funil, campos coletados —
 * é contexto, não trabalho. Numa janela estreita ela come 300px da conversa,
 * que é onde se lê e se escreve, e há atendimento inteiro que não precisa
 * olhar nada dela.
 *
 * Esconder e mostrar é estado, e estado é cliente. Mas **o conteúdo das três
 * colunas continua sendo servidor**: elas chegam aqui prontas, por `props`, e
 * este arquivo só decide a grade. É a diferença entre tornar cliente a moldura
 * e tornar cliente o Inbox — a segunda mandaria para o navegador a consulta de
 * conversas, os anúncios resolvidos e o histórico inteiro.
 *
 * A escolha **não é gravada**. Gravar exigiria ler o armazenamento antes de
 * pintar, como o tema faz, e diferente do tema o custo de errar aqui é um
 * clique — não uma tela inteira na cor errada.
 */

type EstadoDaFicha = { aberta: boolean; alternar: () => void }

/*
 * O valor padrão serve para o caso de alguém usar `AcoesRapidas` fora da
 * moldura: o botão aparece, não quebra, e não faz nada — em vez de derrubar a
 * árvore com "cannot read property of undefined".
 */
const Contexto = createContext<EstadoDaFicha>({ aberta: true, alternar: () => {} })

export const useFicha = () => useContext(Contexto)

export function MolduraDoInbox({
  fila,
  conversa,
  ficha,
}: {
  fila: ReactNode
  conversa: ReactNode
  /** `null` quando não há conversa aberta: aí não há ficha para mostrar. */
  ficha: ReactNode | null
}) {
  const [aberta, setAberta] = useState(true)
  const mostrandoFicha = Boolean(ficha) && aberta

  return (
    <Contexto.Provider value={{ aberta, alternar: () => setAberta((x) => !x) }}>
      {/*
        A moldura tem **altura máxima**, e é isso que faz o histórico rolar por
        dentro.

        Com `min-h` só, a caixa crescia com a conversa e quem rolava era a
        página inteira: o cabeçalho da conversa e a caixa de resposta subiam
        para fora da tela, e uma conversa longa deixava de ter onde responder
        sem voltar ao topo. As três colunas já tinham `overflow` próprio — o
        que faltava era um teto para elas medirem.

        `h-[calc(100dvh-…)]` desconta o cabeçalho da página e a margem da
        moldura. `dvh` e não `vh`: no celular a barra do navegador entra e sai,
        e `vh` congela a altura da barra escondida — a caixa de resposta ficava
        atrás dela.
      */}
      <div
        className={`grid h-[calc(100dvh-92px)] min-h-[420px] overflow-hidden rounded-[16px] border border-line bg-panel shadow-pop ${
          mostrandoFicha
            ? 'grid-cols-[320px_minmax(380px,1fr)_296px]'
            : 'grid-cols-[320px_minmax(380px,1fr)]'
        }`}
      >
        {fila}
        {conversa}
        {mostrandoFicha && ficha}
      </div>
    </Contexto.Provider>
  )
}
