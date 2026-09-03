'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Um número que conta de zero até o valor quando entra na tela.
 *
 * **O texto original é a fonte, não uma prop separada.** Passa-se `"70%"`,
 * `"24/7"` ou `"1 número"` e o componente descobre sozinho onde estão os
 * dígitos. Manter valor e sufixo em campos separados obrigaria a repetir a
 * mesma informação em dois lugares, e o dia em que um mudasse sem o outro o
 * número exibido estaria errado.
 *
 * A curva é `easeOutExpo`: rápida no começo e quase parada no fim. É o que faz
 * o contador parecer que *chega* num valor em vez de simplesmente parar.
 *
 * Conta uma vez só. Um número que reconta a cada rolagem vira enfeite, e a
 * segunda vez ninguém olha.
 */
export function NumeroQueSobe({ texto, className }: { texto: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [mostrado, setMostrado] = useState(texto)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Sem dígito não há o que contar (e `prefers-reduced-motion` pede parado).
    const digitos = texto.match(/\d+/)
    if (!digitos || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const alvo = Number(digitos[0])
    const inicio = digitos.index ?? 0
    const antes = texto.slice(0, inicio)
    const depois = texto.slice(inicio + digitos[0].length)

    setMostrado(antes + '0' + depois)

    let quadro = 0
    let comecou = 0

    function passo(agora: number) {
      if (!comecou) comecou = agora
      const t = Math.min((agora - comecou) / 1400, 1)
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setMostrado(antes + String(Math.round(alvo * eased)) + depois)
      if (t < 1) quadro = requestAnimationFrame(passo)
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return
        observer.disconnect()
        quadro = requestAnimationFrame(passo)
      },
      { threshold: 0.5 },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(quadro)
    }
  }, [texto])

  return (
    <span ref={ref} className={className}>
      {mostrado}
    </span>
  )
}
