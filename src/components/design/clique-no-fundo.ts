'use client'

import { useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react'

/**
 * Fecha o `<dialog>` só no clique que começou e terminou **fora** do quadro.
 *
 * O teste antigo, `evento.target === dialogo`, também vale para o padding do
 * próprio `<dialog>` e para a margem entre título e formulário: em 01/out/2026
 * o clique entre os campos do "Nova chave" abria o aviso de descartar. E
 * arrastar a seleção de um campo até o fundo termina com o `click` no
 * `<dialog>`, o ancestral comum, mesmo sem ninguém ter clicado fora.
 */
export function useCliqueNoFundo(dialogo: RefObject<HTMLDialogElement | null>, fechar: () => void) {
  const comecouFora = useRef(false)

  function fora(evento: { clientX: number; clientY: number; target: EventTarget }) {
    const caixa = dialogo.current
    if (!caixa || evento.target !== caixa) return false
    const r = caixa.getBoundingClientRect()
    return evento.clientX < r.left || evento.clientX > r.right || evento.clientY < r.top || evento.clientY > r.bottom
  }

  return {
    onPointerDown: (evento: PointerEvent<HTMLDialogElement>) => {
      comecouFora.current = fora(evento)
    },
    onClick: (evento: MouseEvent<HTMLDialogElement>) => {
      if (comecouFora.current && fora(evento)) fechar()
      comecouFora.current = false
    },
  }
}
