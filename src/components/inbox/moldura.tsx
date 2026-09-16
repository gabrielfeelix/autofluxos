'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { LARGURA_DA_FILA } from '@/components/design/tema'

/**
 * A moldura do Inbox: a barra de filtros em cima, três colunas embaixo.
 *
 * ---------------------------------------------------------------------------
 * A barra atravessa, e as colunas ficam embaixo dela
 * ---------------------------------------------------------------------------
 *
 * Busca e filtros moravam dentro da coluna da esquerda, empilhados. Numa coluna
 * de 320px isso é um campo de busca curto e pílulas quebrando em três linhas —
 * e come a altura de quatro conversas na lista, que é para o que a coluna
 * existe.
 *
 * Em cima e atravessando a largura toda, a busca fica larga, os filtros cabem
 * numa linha só, e a lista recomeça do topo. É o desenho do produto que serviu
 * de referência, e o motivo dele é esse.
 *
 * A `Fila` desenha as duas partes — a barra e a lista — e entrega as duas como
 * **irmãs**, num fragmento. Elas caem direto na grade daqui: a barra com
 * `col-span-full` na primeira faixa, a lista na segunda. Envolver as duas num
 * `<div>` tiraria a barra da grade e ela deixaria de atravessar.
 *
 * ---------------------------------------------------------------------------
 * O que é estado aqui, e o que continua do servidor
 * ---------------------------------------------------------------------------
 *
 * Esconder a ficha do contato é estado, e estado é cliente. Mas **o conteúdo
 * das três colunas continua sendo servidor**: elas chegam prontas, por `props`.
 * É a diferença entre tornar cliente a moldura e tornar cliente o Inbox — a
 * segunda mandaria para o navegador a consulta de conversas, os anúncios
 * resolvidos e o histórico inteiro.
 *
 * A ficha **não é gravada**: é um gesto por conversa. A largura da coluna é,
 * porque é preferência de trabalho — ver `LARGURA_DA_FILA`.
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
  temFicha,
}: {
  /** A barra de filtros e a lista, nesta ordem, como irmãs. */
  fila: ReactNode
  /**
   * A coluna do meio — e, quando `temFicha`, a da ficha junto, como irmãs de
   * grade.
   *
   * As duas vêm pelo mesmo nó porque nascem da mesma espera: elas lêem o mesmo
   * contato, e separá-las faria a ficha ser a peça que segura a tela enquanto
   * a conversa já chegou. Ver `ColunaDaConversa` no `page.tsx`.
   */
  conversa: ReactNode
  /** Só para quem ainda passa a ficha por fora. Prefira `conversa` + `temFicha`. */
  ficha?: ReactNode | null
  /**
   * Reservar a terceira coluna da grade.
   *
   * É booleano, e não `Boolean(ficha)`, porque a ficha pode estar dentro de um
   * `<Suspense>` que ainda não resolveu: perguntar "o nó existe?" responderia
   * não enquanto ela carrega, a coluna nasceria sem largura e a grade saltaria
   * de duas para três colunas na frente da pessoa quando a conversa chegasse.
   */
  temFicha?: boolean
}) {
  const [aberta, setAberta] = useState(true)
  const mostrandoFicha = (temFicha ?? Boolean(ficha)) && aberta

  return (
    <Contexto.Provider value={{ aberta, alternar: () => setAberta((x) => !x) }}>
      {/*
        A moldura tem **altura máxima**, e é isso que faz o histórico rolar por
        dentro.

        Com `min-h` só, a caixa crescia com a conversa e quem rolava era a
        página inteira: o cabeçalho da conversa e a caixa de resposta subiam
        para fora da tela, e uma conversa longa deixava de ter onde responder
        sem voltar ao topo. As colunas já tinham `overflow` próprio — o que
        faltava era um teto para elas medirem.

        No computador o teto é `h-full`: a casca do cliente é `h-screen`, então
        "cheio" já é a janela menos nada — a tela encosta no topo. No celular a
        casca cresce com o conteúdo e não há altura de que herdar, então ali a
        conta é em `dvh`, descontando a faixa de navegação que a barra lateral
        vira nessa largura.

        `dvh` e não `vh`: no celular a barra do navegador entra e sai, e `vh`
        congela a altura da barra escondida — a caixa de resposta ficava atrás
        dela.
      */}
      <div
        style={{
          /*
            A largura da primeira coluna é variável de CSS, e não estado do
            React. Durante o arrasto quem escreve nela é o `pointermove` direto
            no `<html>` (ver `PuxadorDaFila`): um `setState` por quadro
            renderizaria a lista inteira sessenta vezes por segundo para mudar
            uma medida que o CSS resolve sozinho.

            O padrão vive dentro do próprio `var()`: sem nada gravado, não há
            variável, e o CSS cai nele.
          */
          gridTemplateColumns: `var(${LARGURA_DA_FILA.variavel}, ${LARGURA_DA_FILA.padrao}px) minmax(380px, 1fr)${
            mostrandoFicha ? ' 296px' : ''
          }`,
          gridTemplateRows: 'auto minmax(0, 1fr)',
        }}
        /*
          Sem canto redondo, sem sombra e sem borda externa: ela não é um cartão
          sobre a página, ela **é** a página. Quem a separa da barra lateral é a
          borda que a barra já tem — desenhar outra aqui daria uma linha dupla.
        */
        className="grid h-[calc(100dvh-132px)] min-h-[420px] overflow-hidden bg-panel md:h-full"
      >
        {fila}
        {conversa}
        {mostrandoFicha && ficha}
      </div>
    </Contexto.Provider>
  )
}
