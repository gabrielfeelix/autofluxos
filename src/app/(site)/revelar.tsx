'use client'

import { useEffect } from 'react'

/**
 * Duas coisas que só existem no cliente, num componente só.
 *
 * **Revelação no scroll.** Todo elemento com `data-revela` entra deslocado e
 * ganha `data-revelado` quando cruza a tela. O CSS faz o resto. Um observer
 * único para a página inteira — um por elemento seria dezenas de observers
 * fazendo o mesmo trabalho.
 *
 * **Borda do cabeçalho.** Ela só aparece depois que a página rola; parada no
 * topo, seria uma linha cortando a capa ao meio.
 *
 * As duas classes chegam por prop **já resolvidas pelo CSS Module**. Escrever
 * `'cabecalhoRolado'` literal aqui não funcionaria: o módulo gera um nome com
 * hash, e a classe literal não casa com regra nenhuma.
 *
 * Quem pediu `prefers-reduced-motion` não recebe observer nenhum: o CSS já
 * neutraliza os dois estados, e observar seria trabalho para nada.
 */
export function Revelar({
  seletorCabecalho,
  classeRolado,
}: {
  // Vêm de um CSS Module, e o tipo gerado admite `undefined` — um nome de
  // classe que não existe no arquivo devolve isso em vez de quebrar o build.
  seletorCabecalho: string | undefined
  classeRolado: string | undefined
}) {
  useEffect(() => {
    const paradoPorPreferencia = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let desligarObserver: (() => void) | undefined

    if (!paradoPorPreferencia) {
      const observer = new IntersectionObserver(
        (entradas) => {
          for (const entrada of entradas) {
            if (!entrada.isIntersecting) continue
            const el = entrada.target as HTMLElement
            // O atraso é do próprio elemento: irmãos numa grade entram em
            // cascata em vez de todos de uma vez.
            const atraso = Number(el.dataset.atraso ?? 0)
            window.setTimeout(() => el.setAttribute('data-revelado', ''), atraso)
            observer.unobserve(el)
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.1 },
      )
      for (const alvo of document.querySelectorAll('[data-revela]')) observer.observe(alvo)
      desligarObserver = () => observer.disconnect()
    }

    const topo = seletorCabecalho ? document.querySelector<HTMLElement>(`.${seletorCabecalho}`) : null
    const aoRolar = () => {
      if (!topo || !classeRolado) return
      topo.classList.toggle(classeRolado, window.scrollY > 8)
    }
    aoRolar()
    window.addEventListener('scroll', aoRolar, { passive: true })

    return () => {
      desligarObserver?.()
      window.removeEventListener('scroll', aoRolar)
    }
  }, [seletorCabecalho, classeRolado])

  return null
}
