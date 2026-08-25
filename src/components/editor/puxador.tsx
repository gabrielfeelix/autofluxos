'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * A borda que se arrasta para mudar a largura de um painel.
 *
 * **O pedido foi "puxar um pouco para a esquerda", e não "minimizar".** A barra
 * de blocos tem largura fixa desde sempre, e ela é grande demais para quem já
 * decorou os dez blocos e pequena demais para quem está aprendendo — duas
 * pessoas diferentes, um número só. Recolher inteiro não serve: quem pediu
 * disse, com todas as letras, que não reduziria a zero.
 *
 * Três decisões que o gesto exige e que não são óbvias:
 *
 * **`setPointerCapture`.** Sem ele, arrastar rápido tira o ponteiro de cima da
 * borda e o navegador para de mandar os eventos — a barra "solta" no meio do
 * caminho e volta a se mexer sozinha quando o mouse passa por perto de novo.
 * Com a captura, o elemento continua recebendo tudo até soltar o botão.
 *
 * **Teclado.** Uma borda que só responde ao mouse é um controle que não existe
 * para quem navega por tab. `role="separator"` com as setas é o padrão de
 * `aria`, e custa cinco linhas.
 *
 * **Duplo clique volta ao padrão.** Quem arrastou longe demais precisa de um
 * jeito de desfazer que não seja mirar no número antigo.
 */
export function PuxadorDeLargura({
  largura,
  aoMudar,
  minima,
  maxima,
  padrao,
  rotulo,
}: {
  largura: number
  aoMudar: (largura: number) => void
  minima: number
  maxima: number
  /** Para onde o duplo clique volta. */
  padrao: number
  /** Lido por quem navega por teclado: "Largura da barra de blocos". */
  rotulo: string
}) {
  const arrastando = useRef(false)
  const dentro = useCallback(
    (valor: number) => Math.round(Math.min(maxima, Math.max(minima, valor))),
    [minima, maxima],
  )

  /*
   * Enquanto arrasta, o cursor e a seleção valem para a **janela inteira**.
   *
   * Sem isso, passar por cima de um texto durante o arraste começa a selecioná-lo
   * e o cursor fica piscando entre a seta e a barra — o gesto parece que
   * quebrou, e o texto selecionado por acidente some no clique seguinte.
   */
  useEffect(() => {
    return () => {
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={rotulo}
      aria-valuenow={largura}
      aria-valuemin={minima}
      aria-valuemax={maxima}
      tabIndex={0}
      title="Arraste para mudar a largura · duplo clique volta ao padrão"
      onPointerDown={(evento) => {
        // Só o botão principal: arrastar com o botão do meio cola texto no
        // Linux, e com o direito abre o menu por cima do gesto.
        if (evento.button !== 0) return
        evento.preventDefault()
        evento.currentTarget.setPointerCapture(evento.pointerId)
        arrastando.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
      }}
      onPointerMove={(evento) => {
        if (!arrastando.current) return
        // A largura é a distância do ponteiro até a borda esquerda do painel,
        // e não um acumulado de deltas: acumular perde sincronia quando o
        // cursor bate no limite e o painel para de acompanhar.
        const caixa = evento.currentTarget.parentElement?.getBoundingClientRect()
        if (!caixa) return
        aoMudar(dentro(evento.clientX - caixa.left))
      }}
      onPointerUp={(evento) => {
        arrastando.current = false
        evento.currentTarget.releasePointerCapture(evento.pointerId)
        document.body.style.removeProperty('cursor')
        document.body.style.removeProperty('user-select')
      }}
      onDoubleClick={() => aoMudar(padrao)}
      onKeyDown={(evento) => {
        const passo = evento.shiftKey ? 32 : 8
        if (evento.key === 'ArrowLeft') {
          evento.preventDefault()
          aoMudar(dentro(largura - passo))
        }
        if (evento.key === 'ArrowRight') {
          evento.preventDefault()
          aoMudar(dentro(largura + passo))
        }
        if (evento.key === 'Home') {
          evento.preventDefault()
          aoMudar(padrao)
        }
      }}
      /*
       * A área de agarrar é maior do que a linha que se vê.
       *
       * A borda tem 1px; um alvo de 1px não se acerta. O elemento tem 9px e fica
       * meio dentro, meio fora, com a marca visível só no hover e no foco —
       * mostrar sempre poria uma faixa clara no meio de uma tela escura para
       * anunciar algo que quase ninguém vai usar.
       */
      className="group/puxador absolute inset-y-0 -right-1 z-10 w-[9px] cursor-col-resize touch-none"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-accent/0 transition group-hover/puxador:bg-accent/50 group-focus-visible/puxador:bg-accent"
      />
    </div>
  )
}
