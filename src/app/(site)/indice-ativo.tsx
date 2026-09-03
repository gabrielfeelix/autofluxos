'use client'

import { useEffect } from 'react'

/**
 * Acende o item do índice correspondente à seção que está na tela.
 *
 * **Um observer sobre as seções, não a posição do scroll.** As seções têm
 * alturas diferentes e o texto quebra em mais linhas em telas estreitas;
 * calcular por `scrollY` significaria remedir tudo a cada `resize`. O
 * navegador já sabe quem está visível.
 *
 * Manipula a classe direto no DOM em vez de estado do React: o índice é uma
 * lista estática renderizada no servidor, e re-renderizá-la a cada rolagem
 * para trocar uma classe seria trabalho jogado fora.
 */
export function IndiceAtivo({
  seletorSecao,
  classeAtivo,
}: {
  seletorSecao: string | undefined
  classeAtivo: string | undefined
}) {
  useEffect(() => {
    if (!seletorSecao || !classeAtivo) return

    const secoes = Array.from(document.querySelectorAll<HTMLElement>(`.${seletorSecao}`))
    if (secoes.length === 0) return

    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          const id = entrada.target.id
          for (const link of document.querySelectorAll(`a[href="#${id}"]`)) {
            // Apaga os irmãos antes de acender este: dois ativos ao mesmo
            // tempo é o defeito clássico deste padrão.
            for (const outro of document.querySelectorAll(`.${classeAtivo}`)) {
              outro.classList.remove(classeAtivo)
            }
            link.classList.add(classeAtivo)
          }
        }
      },
      // Faixa estreita no meio da tela: com a faixa cheia, duas seções ficam
      // visíveis ao mesmo tempo e o destaque pisca entre elas.
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 },
    )

    for (const secao of secoes) observer.observe(secao)
    return () => observer.disconnect()
  }, [seletorSecao, classeAtivo])

  return null
}
