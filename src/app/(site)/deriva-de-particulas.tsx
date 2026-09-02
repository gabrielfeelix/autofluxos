'use client'

import { useEffect, useRef } from 'react'

type Particula = {
  x: number
  y: number
  /** Velocidade em píxeis por segundo, não por quadro — ver o laço. */
  vx: number
  vy: number
  raio: number
  brilho: number
}

/**
 * O campo de partículas da capa.
 *
 * **Ele é uma rede que se liga, não poeira flutuando.** A diferença é o
 * produto: o AutoFluxos liga blocos numa conversa, e a metáfora certa é a
 * ligação — pontos que se encontram, acendem uma linha entre si e seguem.
 * Poeira genérica seria bonita e não diria nada.
 *
 * Escrito em canvas 2D e sem biblioteca, de propósito. `three` ou
 * `framer-motion` custariam centenas de KB no primeiro carregamento da página
 * que existe para converter — e nada aqui precisa de 3D.
 *
 * Três decisões que o tornam barato o bastante para rodar atrás de um texto:
 *
 * - **Velocidade por segundo, integrada pelo delta.** Um laço que soma `vx` a
 *   cada quadro corre mais rápido num monitor de 144Hz que num de 60Hz. Com o
 *   delta, o movimento é o mesmo em qualquer tela.
 * - **A busca de vizinhos é O(n²) sobre poucas partículas.** A contagem sai da
 *   largura da tela e satura em 90; a 90 são ~4 mil pares por quadro, que o
 *   navegador faz sem suar. Uma grade espacial resolveria melhor com dez mil,
 *   e dez mil não é o caso.
 * - **Ele para quando não está à vista.** Um `IntersectionObserver` desliga o
 *   `requestAnimationFrame` quando a capa sai da tela: sem isso, a página
 *   inteira rolada continuaria gastando bateria desenhando o que ninguém vê.
 *
 * Respeita `prefers-reduced-motion`: quem pediu para o sistema parar de animar
 * recebe o campo desenhado uma vez, parado, em vez de nada — o fundo continua
 * existindo, só não se mexe.
 */
export function DerivaDeParticulas({ className }: { className?: string }) {
  const refCanvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = refCanvas.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Acima de 2 não há ganho visível e o custo de preenchimento dobra.
    const escala = Math.min(window.devicePixelRatio || 1, 2)

    let largura = 0
    let altura = 0
    let particulas: Particula[] = []

    // O ciano do produto (`--accent`), em componentes para caber no rgba().
    const COR = '86, 208, 245'
    /** Acima desta distância dois pontos não se ligam. */
    const ALCANCE = 132

    function semear() {
      const alvo = Math.min(90, Math.max(34, Math.round((largura * altura) / 19000)))
      particulas = Array.from({ length: alvo }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * 17,
        vy: (Math.random() - 0.5) * 17,
        raio: Math.random() * 1.5 + 0.7,
        brilho: Math.random() * 0.5 + 0.25,
      }))
    }

    function medir() {
      const caixa = canvas!.getBoundingClientRect()
      largura = caixa.width
      altura = caixa.height
      canvas!.width = Math.round(largura * escala)
      canvas!.height = Math.round(altura * escala)
      ctx!.setTransform(escala, 0, 0, escala, 0, 0)
      semear()
    }

    function desenhar() {
      ctx!.clearRect(0, 0, largura, altura)

      // As ligações primeiro: elas ficam atrás dos pontos.
      for (let i = 0; i < particulas.length; i++) {
        const a = particulas[i]!
        for (let j = i + 1; j < particulas.length; j++) {
          const b = particulas[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist2 = dx * dx + dy * dy
          if (dist2 > ALCANCE * ALCANCE) continue

          // A linha nasce forte e some conforme os dois se afastam.
          const forca = 1 - Math.sqrt(dist2) / ALCANCE
          ctx!.strokeStyle = `rgba(${COR},${forca * 0.22})`
          ctx!.lineWidth = forca * 1.05
          ctx!.beginPath()
          ctx!.moveTo(a.x, a.y)
          ctx!.lineTo(b.x, b.y)
          ctx!.stroke()
        }
      }

      for (const p of particulas) {
        ctx!.fillStyle = `rgba(${COR},${p.brilho})`
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.raio, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function mover(delta: number) {
      for (const p of particulas) {
        p.x += p.vx * delta
        p.y += p.vy * delta

        // Atravessa a borda e volta pelo outro lado: o campo não tem fim
        // visível, e ninguém vê partícula "batendo na parede".
        if (p.x < -20) p.x = largura + 20
        else if (p.x > largura + 20) p.x = -20
        if (p.y < -20) p.y = altura + 20
        else if (p.y > altura + 20) p.y = -20
      }
    }

    medir()

    if (parado) {
      desenhar()
      const aoRedimensionar = () => {
        medir()
        desenhar()
      }
      window.addEventListener('resize', aoRedimensionar)
      return () => window.removeEventListener('resize', aoRedimensionar)
    }

    let quadro = 0
    let anterior = performance.now()
    let rodando = false

    function laco(agora: number) {
      // Um delta grande significa que a aba estava em segundo plano; teleportar
      // todo mundo de uma vez fica feio, então ele é limitado a ~3 quadros.
      const delta = Math.min((agora - anterior) / 1000, 0.05)
      anterior = agora
      mover(delta)
      desenhar()
      quadro = requestAnimationFrame(laco)
    }

    function ligar() {
      if (rodando) return
      rodando = true
      anterior = performance.now()
      quadro = requestAnimationFrame(laco)
    }

    function desligar() {
      if (!rodando) return
      rodando = false
      cancelAnimationFrame(quadro)
    }

    const observer = new IntersectionObserver(
      ([entrada]) => (entrada?.isIntersecting ? ligar() : desligar()),
      { threshold: 0 },
    )
    observer.observe(canvas)

    // A aba escondida também para: `requestAnimationFrame` já é estrangulado
    // pelo navegador, mas parar de vez evita o susto do primeiro quadro.
    const aoTrocarDeAba = () => (document.hidden ? desligar() : ligar())
    document.addEventListener('visibilitychange', aoTrocarDeAba)

    let esperaDoResize = 0
    const aoRedimensionar = () => {
      window.clearTimeout(esperaDoResize)
      esperaDoResize = window.setTimeout(medir, 140)
    }
    window.addEventListener('resize', aoRedimensionar)

    return () => {
      desligar()
      observer.disconnect()
      document.removeEventListener('visibilitychange', aoTrocarDeAba)
      window.removeEventListener('resize', aoRedimensionar)
      window.clearTimeout(esperaDoResize)
    }
  }, [])

  return <canvas ref={refCanvas} className={className} aria-hidden />
}
