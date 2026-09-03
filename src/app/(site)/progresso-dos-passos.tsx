'use client'

import { useEffect, useState } from 'react'

/**
 * O contador que acompanha a rolagem dos passos.
 *
 * A coluna da esquerda gruda enquanto os quatro cards passam, e parada ela diz
 * a mesma coisa por três telas de rolagem. Este componente a faz responder:
 * mostra em que passo o leitor está e quanto falta.
 *
 * **Um observer sobre os cards, não a posição do scroll.** Calcular por
 * `scrollY` exigiria saber onde cada card começa, o que muda com a largura da
 * tela e com o texto que quebra em mais linhas. O observer pergunta ao
 * navegador quem está no meio da tela, e o navegador já sabe.
 *
 * A faixa é estreita de propósito (`-45% 0px`): sem isso dois cards ficam
 * visíveis ao mesmo tempo e o número pisca entre eles.
 */
export function ProgressoDosPassos({
  seletorPasso,
  classes,
  rotulos,
}: {
  seletorPasso: string | undefined
  classes: {
    caixa: string | undefined
    conta: string | undefined
    atual: string | undefined
    total: string | undefined
    trilho: string | undefined
    segmento: string | undefined
    segmentoAtivo: string | undefined
    rotulo: string | undefined
  }
  rotulos: string[]
}) {
  const [atual, setAtual] = useState(0)

  useEffect(() => {
    if (!seletorPasso) return
    const passos = Array.from(document.querySelectorAll(`.${seletorPasso}`))
    if (passos.length === 0) return

    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue
          const i = passos.indexOf(entrada.target)
          if (i >= 0) setAtual(i)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )

    for (const passo of passos) observer.observe(passo)
    return () => observer.disconnect()
  }, [seletorPasso])

  const total = rotulos.length

  return (
    <div className={classes.caixa}>
      <div className={classes.conta}>
        <span className={classes.atual}>{String(atual + 1).padStart(2, '0')}</span>
        <span className={classes.total}>/ {String(total).padStart(2, '0')}</span>
      </div>

      <div className={classes.trilho} aria-hidden>
        {rotulos.map((rotulo, i) => (
          <span
            key={rotulo}
            className={`${classes.segmento} ${i <= atual ? classes.segmentoAtivo : ''}`}
          />
        ))}
      </div>

      <p className={classes.rotulo}>{rotulos[atual]}</p>
    </div>
  )
}
