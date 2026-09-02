'use client'

import { useEffect, useRef } from 'react'

/**
 * O cursor da landing: um anel que persegue o ponteiro com atraso.
 *
 * **São dois elementos, e a distância entre eles é o efeito.** O ponto segue o
 * mouse na hora; o anel chega depois, interpolando 14% da distância a cada
 * quadro. Quando o ponteiro para, o anel alcança e os dois viram um só. Quando
 * corre, o anel fica para trás e se estica na direção do movimento — é o mesmo
 * truque que os sites de referência usam, e o que faz o cursor parecer um
 * objeto com massa em vez de um sprite colado.
 *
 * Sobre elemento clicável o anel infla e some por dentro, virando um contorno
 * ao redor do que vai ser clicado.
 *
 * Três coisas que ele não faz, de propósito:
 *
 * - **Não aparece em telefone.** `pointer: fine` no CSS: quem toca a tela não
 *   tem cursor para substituir, e um anel perseguindo o dedo é ruído.
 * - **Não some com o cursor do sistema em campo de texto.** O CSS mantém o
 *   `cursor` nativo em `input` e `textarea`, porque a barra de inserção diz
 *   onde a letra vai cair e nenhum anel substitui isso.
 * - **Não roda com `prefers-reduced-motion`.** Movimento perseguindo o
 *   ponteiro é exatamente o que essa preferência pede para desligar.
 */
export function Cursor({ classePonto, classeAnel, classeAtivo }: {
  classePonto: string | undefined
  classeAnel: string | undefined
  classeAtivo: string | undefined
}) {
  const refPonto = useRef<HTMLDivElement>(null)
  const refAnel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!classePonto || !classeAnel || !classeAtivo) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Sem ponteiro fino não há cursor a substituir.
    if (!window.matchMedia('(pointer: fine)').matches) return

    const ponto = refPonto.current
    const anel = refAnel.current
    if (!ponto || !anel) return

    let alvoX = window.innerWidth / 2
    let alvoY = window.innerHeight / 2
    let anelX = alvoX
    let anelY = alvoY
    let visivel = false
    let quadro = 0

    function laco() {
      // 0.14 por quadro: o anel alcança em ~8 quadros parado, e fica visivelmente
      // atrás em movimento. Mais alto gruda, mais baixo parece solto.
      anelX += (alvoX - anelX) * 0.14
      anelY += (alvoY - anelY) * 0.14

      // A distância vira esticada: o anel se alonga na direção em que corre.
      const dx = alvoX - anelX
      const dy = alvoY - anelY
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 90)
      const estica = 1 + dist / 190
      const angulo = (Math.atan2(dy, dx) * 180) / Math.PI

      anel!.style.transform = `translate(${anelX}px, ${anelY}px) translate(-50%, -50%) rotate(${angulo}deg) scaleX(${estica}) scaleY(${1 / estica})`
      ponto!.style.transform = `translate(${alvoX}px, ${alvoY}px) translate(-50%, -50%)`

      quadro = requestAnimationFrame(laco)
    }

    function aoMover(e: PointerEvent) {
      alvoX = e.clientX
      alvoY = e.clientY

      if (!visivel) {
        visivel = true
        // Nasce onde o mouse está, senão o anel voa da última posição.
        anelX = alvoX
        anelY = alvoY
        ponto!.style.opacity = '1'
        anel!.style.opacity = '1'
      }

      // Sobre o que é clicável, o anel vira contorno.
      const alvo = e.target as Element | null
      const clicavel = alvo?.closest('a, button, summary, [role="button"]') != null
      anel!.classList.toggle(classeAtivo!, clicavel)
    }

    function aoSair() {
      visivel = false
      ponto!.style.opacity = '0'
      anel!.style.opacity = '0'
    }

    document.addEventListener('pointermove', aoMover)
    document.addEventListener('pointerleave', aoSair)
    quadro = requestAnimationFrame(laco)

    // A classe no <html> é quem esconde o cursor do sistema. Fica aqui e não no
    // CSS para que, se o JS falhar, o usuário continue com um cursor visível.
    document.documentElement.classList.add('temCursorProprio')

    return () => {
      cancelAnimationFrame(quadro)
      document.removeEventListener('pointermove', aoMover)
      document.removeEventListener('pointerleave', aoSair)
      document.documentElement.classList.remove('temCursorProprio')
    }
  }, [classePonto, classeAnel, classeAtivo])

  return (
    <>
      <div ref={refPonto} className={classePonto} aria-hidden />
      <div ref={refAnel} className={classeAnel} aria-hidden />
    </>
  )
}
