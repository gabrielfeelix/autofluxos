'use client'

import { useEffect, useRef } from 'react'

type Particula = {
  x: number
  y: number
  /** Velocidade em píxeis por segundo, não por quadro. Ver o laço. */
  vx: number
  vy: number
  raio: number
  brilho: number
  /**
   * Quanto esta partícula obedece ao cursor, de 0.15 a 1.
   *
   * **A força é diferente em cada uma, e é isso que cria profundidade.** Com
   * um valor só, o campo inteiro se move como uma chapa e o efeito vira gelatina.
   * Variando, algumas correm atrás do mouse e outras mal se incomodam, e o olho
   * lê as duas velocidades como dois planos.
   */
  magnetismo: number
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
 * **O cursor puxa a rede.** Cada partícula obedece com força própria, entre 15%
 * e 100%, o que faz o campo se abrir em dois planos em vez de se mover como uma
 * chapa. Perto do ponteiro os pontos incham e as linhas acendem.
 *
 * Três decisões que o tornam barato o bastante para rodar atrás de um texto:
 *
 * - **Velocidade por segundo, integrada pelo delta.** Um laço que soma `vx` a
 *   cada quadro corre mais rápido num monitor de 144Hz que num de 60Hz. Com o
 *   delta, o movimento é o mesmo em qualquer tela.
 * - **A busca de vizinhos é O(n²) sobre poucas partículas.** A contagem sai da
 *   largura da tela e satura em 130; a 130 são ~8 mil pares por quadro, que o
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
    const ALCANCE = 158
    /** Até onde o cursor puxa. */
    const RAIO_MOUSE = 250

    /**
     * Onde o cursor está, em coordenadas do canvas.
     *
     * Guardado num objeto mutável em vez de estado do React: o mouse dispara
     * dezenas de eventos por segundo, e um `setState` a cada um redesenharia a
     * árvore inteira para mover pontinhos que o canvas já sabe desenhar.
     */
    const cursor = { x: 0, y: 0, dentro: false }

    function semear() {
      const alvo = Math.min(130, Math.max(48, Math.round((largura * altura) / 13000)))
      particulas = Array.from({ length: alvo }, () => ({
        x: Math.random() * largura,
        y: Math.random() * altura,
        vx: (Math.random() - 0.5) * 17,
        vy: (Math.random() - 0.5) * 17,
        raio: Math.random() * 1.8 + 0.9,
        brilho: Math.random() * 0.5 + 0.42,
        magnetismo: Math.random() * 0.85 + 0.15,
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

      /*
       * O foco que acompanha o ponteiro.
       *
       * Ele fica atrás de tudo e é largo o bastante para o olho ler como luz
       * ambiente, não como um círculo. É o que dá a sensação de que o mouse
       * *ilumina* a rede em vez de só empurrá-la.
       */
      if (cursor.dentro) {
        const foco = ctx!.createRadialGradient(
          cursor.x, cursor.y, 0,
          cursor.x, cursor.y, RAIO_MOUSE * 1.1,
        )
        foco.addColorStop(0, `rgba(${COR},0.1)`)
        foco.addColorStop(1, `rgba(${COR},0)`)
        ctx!.fillStyle = foco
        ctx!.fillRect(
          cursor.x - RAIO_MOUSE * 1.1, cursor.y - RAIO_MOUSE * 1.1,
          RAIO_MOUSE * 2.2, RAIO_MOUSE * 2.2,
        )
      }

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

          // Perto do cursor a rede acende: é o que faz o campo responder ao
          // mouse em vez de só se deformar.
          let realce = 0
          if (cursor.dentro) {
            const mx = (a.x + b.x) / 2 - cursor.x
            const my = (a.y + b.y) / 2 - cursor.y
            const d = Math.sqrt(mx * mx + my * my)
            if (d < RAIO_MOUSE) realce = (1 - d / RAIO_MOUSE) * 0.85
          }

          ctx!.strokeStyle = `rgba(${COR},${forca * (0.34 + realce)})`
          ctx!.lineWidth = forca * (1.25 + realce * 1.8)
          ctx!.beginPath()
          ctx!.moveTo(a.x, a.y)
          ctx!.lineTo(b.x, b.y)
          ctx!.stroke()
        }
      }

      for (const p of particulas) {
        let brilho = p.brilho
        let raio = p.raio

        if (cursor.dentro) {
          const dx = p.x - cursor.x
          const dy = p.y - cursor.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < RAIO_MOUSE) {
            const perto = 1 - d / RAIO_MOUSE
            brilho = Math.min(1, brilho + perto * 0.75)
            raio += perto * 2.1
          }
        }

        /*
         * O halo é o que faz o ponto **brilhar** em vez de só existir.
         *
         * Um degradê radial de três vezes o raio, quase transparente na borda.
         * Só nos pontos que já estão claros: pintar halo em todos custaria um
         * gradiente por partícula por quadro e o ganho visual seria zero, já
         * que os fracos somem no fundo de qualquer jeito.
         */
        if (brilho > 0.45) {
          const halo = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, raio * 3.4)
          halo.addColorStop(0, `rgba(${COR},${brilho * 0.42})`)
          halo.addColorStop(1, `rgba(${COR},0)`)
          ctx!.fillStyle = halo
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, raio * 3.4, 0, Math.PI * 2)
          ctx!.fill()
        }

        ctx!.fillStyle = `rgba(${COR},${brilho})`
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, raio, 0, Math.PI * 2)
        ctx!.fill()
      }
    }

    function mover(delta: number) {
      const temCursor = cursor.dentro

      for (const p of particulas) {
        p.x += p.vx * delta
        p.y += p.vy * delta

        if (temCursor) {
          const dx = cursor.x - p.x
          const dy = cursor.y - p.y
          const dist2 = dx * dx + dy * dy

          if (dist2 < RAIO_MOUSE * RAIO_MOUSE && dist2 > 1) {
            const dist = Math.sqrt(dist2)
            // Cai com a distância: perto, puxa forte; na borda do raio, nada.
            const forca = (1 - dist / RAIO_MOUSE) * p.magnetismo
            p.x += (dx / dist) * forca * 96 * delta
            p.y += (dy / dist) * forca * 96 * delta
          }
        }

        // Atravessa a borda e volta pelo outro lado. O campo não tem fim
        // visível, e ninguém vê partícula batendo na parede.
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

    /*
     * O ponteiro é ouvido na **seção inteira**, não no canvas.
     *
     * O canvas está atrás do texto e dos botões, e um `mousemove` nele pararia
     * de disparar assim que o cursor passasse por cima do título — que é
     * justamente o meio da tela, onde o efeito mais importa. Ouvindo no pai, o
     * campo responde em qualquer ponto da capa.
     */
    const palco = canvas.parentElement ?? canvas

    const aoMover = (e: PointerEvent) => {
      const caixa = canvas.getBoundingClientRect()
      cursor.x = e.clientX - caixa.left
      cursor.y = e.clientY - caixa.top
      cursor.dentro = true
    }
    const aoSair = () => {
      cursor.dentro = false
    }

    palco.addEventListener('pointermove', aoMover as EventListener)
    palco.addEventListener('pointerleave', aoSair)

    let esperaDoResize = 0
    const aoRedimensionar = () => {
      window.clearTimeout(esperaDoResize)
      esperaDoResize = window.setTimeout(medir, 140)
    }
    window.addEventListener('resize', aoRedimensionar)

    return () => {
      desligar()
      palco.removeEventListener('pointermove', aoMover as EventListener)
      palco.removeEventListener('pointerleave', aoSair)
      observer.disconnect()
      document.removeEventListener('visibilitychange', aoTrocarDeAba)
      window.removeEventListener('resize', aoRedimensionar)
      window.clearTimeout(esperaDoResize)
    }
  }, [])

  return <canvas ref={refCanvas} className={className} aria-hidden />
}
