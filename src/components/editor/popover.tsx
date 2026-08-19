'use client'

import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * Um painel flutuante ancorado num botão — **por portal, e medido**.
 *
 * A primeira versão dos seletores de emoji e de variável era `position:
 * absolute` dentro do próprio painel do editor, e o efeito foi o mesmo que o
 * `Dropdown` já tinha sofrido: a coluna da direita tem rolagem própria, e um
 * filho mais largo que ela não fica por cima — ele **alarga o conteúdo**, cria
 * rolagem horizontal e empurra a tela inteira para o lado.
 *
 * Absoluto não resolve isso com truque de CSS nenhum: enquanto o painel for o
 * contêiner de rolagem, o que passar da largura dele conta como conteúdo. A
 * saída é sair do fluxo de vez — portal no `<body>` e `position: fixed`, com a
 * posição medida a partir do botão.
 *
 * O que ele faz por conta própria, e cada item veio de um defeito visto:
 *
 * - **centraliza no botão** e encosta na borda da janela sem passar dela;
 * - **vira para cima** quando não cabe embaixo (o painel do editor tem campo
 *   perto do rodapé, e abrir para baixo ali desenha fora da área visível);
 * - **acompanha a rolagem** com `capture`, porque quem rola quase nunca é a
 *   janela: é a coluna do editor;
 * - **fecha ao clicar fora ou no `Esc`**, ignorando o próprio botão — senão o
 *   clique que fecha e o que reabre acontecem no mesmo gesto.
 *
 * Desenha sempre no `<body>`. Dentro de um `<dialog>` isso ficaria atrás dele
 * (o modal vive na camada de topo do navegador) — e não fica porque nenhum
 * campo com variável ou emoji mora dentro de modal hoje. Se um dia morar, o
 * caminho é o do `Dropdown`: procurar o `dialog` mais próximo e portar para lá.
 */
export function Popover({
  aberto,
  gatilho,
  largura,
  altura,
  aoFechar,
  children,
}: {
  aberto: boolean
  /** O botão que abriu. A posição sai do retângulo dele. */
  gatilho: RefObject<HTMLElement | null>
  largura: number
  /** Altura estimada, só para decidir se abre para baixo ou para cima. */
  altura: number
  aoFechar: () => void
  children: ReactNode
}) {
  const [caixa, setCaixa] = useState<{ top: number; left: number } | null>(null)
  const painel = useRef<HTMLDivElement>(null)

  /**
   * Medir e escutar num efeito só, com a função declarada **dentro** dele.
   *
   * Um `useCallback` aqui lendo `gatilho.current` — um `ref` que chega por prop
   * — é justamente o caso que o compilador do React recusa memorizar, e a
   * alternativa (função solta no corpo) refaria os `addEventListener` a cada
   * render. Dentro do efeito, as duas coisas ficam certas.
   *
   * `useLayoutEffect` para a primeira medida acontecer antes de pintar: com
   * `useEffect` o painel aparece um quadro no canto e pula para o lugar.
   */
  useLayoutEffect(() => {
    if (!aberto) return

    const medir = () => {
      const alvo = gatilho.current
      if (!alvo) return

      const r = alvo.getBoundingClientRect()
      const cabeAbaixo = window.innerHeight - r.bottom > altura + 12
      const centro = r.left + r.width / 2 - largura / 2

      setCaixa({
        top: cabeAbaixo ? r.bottom + 6 : Math.max(8, r.top - altura - 6),
        // Centralizado no botão, mas nunca fora da janela: os campos do editor
        // ficam colados na borda direita, e centralizar sem limite desenharia
        // metade do painel fora da tela.
        left: Math.max(8, Math.min(centro, window.innerWidth - largura - 8)),
      })
    }

    medir()

    const fechar = (evento: MouseEvent) => {
      const alvo = evento.target as Node
      if (painel.current?.contains(alvo)) return
      // O próprio botão fica de fora: sem isso, o clique que fecha e o que
      // reabre acontecem no mesmo gesto, e o painel nunca abre.
      if (gatilho.current?.contains(alvo)) return
      aoFechar()
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar()
    }

    // `capture` porque quem rola quase nunca é a janela: é a coluna do editor.
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto, gatilho, largura, altura, aoFechar])

  if (!aberto || !caixa) return null

  return createPortal(
    <div
      ref={painel}
      style={{ position: 'fixed', top: caixa.top, left: caixa.left, width: largura, zIndex: 95 }}
      className="rounded-[12px] border border-accent/25 bg-[#111924] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.48),0_2px_8px_rgba(0,0,0,0.28)]"
    >
      {children}
    </div>,
    document.body,
  )
}
