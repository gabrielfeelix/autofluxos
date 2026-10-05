'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Quanto o mouse precisa repousar antes da dica aparecer. */
const ESPERA_MS = 450
/** Quantos ancestrais subir procurando o elemento que corta o texto. */
const SUBIDA = 4

type Dica = { texto: string; x: number; topo: number; base: number }

/** O elemento corta o texto com reticências (uma linha ou `line-clamp`) e está de fato cortado? */
function cortado(el: HTMLElement): boolean {
  const estilo = getComputedStyle(el)
  const umaLinha = estilo.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1
  const variasLinhas =
    estilo.getPropertyValue('-webkit-line-clamp') !== 'none' &&
    estilo.getPropertyValue('-webkit-line-clamp') !== '' &&
    el.scrollHeight > el.clientHeight + 1
  return umaLinha || variasLinhas
}

function achar(alvo: EventTarget | null): HTMLElement | null {
  let el = alvo instanceof HTMLElement ? alvo : null
  for (let i = 0; el && i < SUBIDA; i++, el = el.parentElement) {
    // Quem já tem `title` ganha a dica nativa; duas ao mesmo tempo seria ruído.
    if (el.title) return null
    if (cortado(el)) return el
  }
  return null
}

/**
 * Texto cortado com "…" mostra o texto inteiro quando o mouse repousa nele,
 * no sistema todo, sem cada tela precisar lembrar de pôr `title`.
 *
 * Um ouvinte só, no documento: a cada `pointerover` sobe até alguns
 * ancestrais procurando quem corta o texto (`text-overflow: ellipsis` ou
 * `line-clamp`) e **só age se ele estiver mesmo cortado**, então um nome curto
 * não ganha dica nenhuma. Toque não conta: no celular não há repouso de mouse.
 */
export function DicaDoTruncado() {
  const [dica, setDica] = useState<Dica | null>(null)

  useEffect(() => {
    let espera: ReturnType<typeof setTimeout> | null = null
    let atual: HTMLElement | null = null

    const esconder = () => {
      if (espera) clearTimeout(espera)
      espera = null
      atual = null
      setDica(null)
    }

    const sobre = (evento: PointerEvent) => {
      if (evento.pointerType === 'touch') return
      const el = achar(evento.target)
      if (el === atual) return
      esconder()
      if (!el) return
      atual = el
      espera = setTimeout(() => {
        const texto = (el.innerText || el.textContent || '').trim()
        if (!texto || !el.isConnected) return
        const caixa = el.getBoundingClientRect()
        setDica({ texto, x: caixa.left + caixa.width / 2, topo: caixa.top, base: caixa.bottom })
      }, ESPERA_MS)
    }

    document.addEventListener('pointerover', sobre, true)
    document.addEventListener('pointerdown', esconder, true)
    document.addEventListener('scroll', esconder, true)
    window.addEventListener('blur', esconder)
    return () => {
      esconder()
      document.removeEventListener('pointerover', sobre, true)
      document.removeEventListener('pointerdown', esconder, true)
      document.removeEventListener('scroll', esconder, true)
      window.removeEventListener('blur', esconder)
    }
  }, [])

  if (!dica) return null
  // Acima do texto; sem espaço em cima, embaixo. Nunca fora da tela pelos lados.
  const acima = dica.topo > 64
  const largura = Math.min(320, window.innerWidth - 24)
  const esquerda = Math.max(12, Math.min(dica.x - largura / 2, window.innerWidth - largura - 12))
  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: esquerda,
        width: largura,
        top: acima ? undefined : dica.base + 8,
        bottom: acima ? window.innerHeight - dica.topo + 8 : undefined,
      }}
      className={`pointer-events-none z-[100] flex ${acima ? 'items-end' : 'items-start'} justify-center`}
    >
      <span className="max-w-full rounded-[8px] bg-[#131922] px-2.5 py-1.5 text-[12px] leading-[1.45] font-medium break-words whitespace-pre-line text-white shadow-[0_8px_24px_rgba(19,25,34,0.28)]">
        {dica.texto}
      </span>
    </div>,
    document.body,
  )
}
