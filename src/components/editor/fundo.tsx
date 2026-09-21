'use client'

import { Background, useStore } from '@xyflow/react'

/**
 * O fundo do canvas do editor, que responde ao que está acontecendo nele.
 *
 * Eram duas linhas: um `<Background>` de pontinhos e uma cor de véu no CSS. O
 * resultado era correto e mudo. Este fundo faz duas coisas que o anterior não
 * fazia, e nenhuma delas é enfeite:
 *
 * - **A grade mantém o mesmo espaçamento na tela, em qualquer zoom.** O
 *   `<Background>` mede o `gap` em coordenadas do fluxo, então ele encolhe
 *   junto: afastando, os pontos se amontoam até virar textura suja, e o
 *   antídoto de "some quando afasta" deixa o canvas vazio justo quando a
 *   pessoa mais precisa de referência. Aqui o passo é escolhido a cada quadro
 *   para o espaço entre pontos ficar sempre perto de 44px **de tela**, e o
 *   raio do ponto é dividido pelo zoom pelo mesmo motivo. É a lógica de um
 *   mapa que troca de escala: a régua muda, a leitura continua igual.
 * - **Um halo acompanha o que está selecionado.** Num fluxo grande, depois de
 *   dar zoom ou arrastar a tela, achar de novo o bloco selecionado custa uma
 *   varredura visual. A borda azul do cartão resolve isso quando ele está na
 *   tela; o halo resolve antes, porque é a única coisa que muda no fundo.
 *
 * No tema escuro entra ainda a luz de topo com vinheta (`.canvas-luz`, em
 * `globals.css`). Ela não é decoração: sem ela o halo não tem contraste contra
 * o fundo chapado, e os cartões ficam boiando em vez de flutuar. No claro ela
 * não aparece, porque clarear o que já é branco não diz nada.
 *
 * Tudo isto é camada de fundo: `pointer-events: none` e `z-index` abaixo do
 * `.react-flow__pane` (que é 1), então nada aqui rouba clique, arrasto ou
 * laço de seleção.
 */

/**
 * O espaço que se quer ver entre dois pontos, em pixels de tela.
 *
 * 44px é grade de referência, não papel milimetrado: dá para mirar o
 * alinhamento de um bloco sem que o canvas vire textura. Abaixo de uns 30px os
 * pontos deixam de ser pontos e viram cinza.
 */
const ALVO_NA_TELA = 44

/** O raio do ponto na tela, também fixo. */
const RAIO_NA_TELA = 1.4

/**
 * Os passos possíveis, em coordenadas do fluxo, dobrando a cada degrau.
 *
 * Dobrar importa: quando o zoom troca de degrau, a grade nova cai exatamente
 * em cima de uma a cada dois pontos da anterior, e a troca passa despercebida.
 * Com degraus quaisquer (30, 50, 70) todos os pontos mudariam de lugar de uma
 * vez, e o fundo pareceria escorregar.
 */
const DEGRAUS = [10, 20, 40, 80, 160, 320, 640]

/**
 * O transform do canvas, como texto.
 *
 * O seletor do store precisa devolver um valor **comparável por igualdade**:
 * devolver o array `[x, y, zoom]` cria referência nova a cada frame de pan e
 * repinta o fundo inteiro sem nada ter mudado. Texto compara por valor.
 */
function useTransform() {
  const bruto = useStore((s) => `${s.transform[0]}|${s.transform[1]}|${s.transform[2]}`)
  const [x = 0, y = 0, zoom = 1] = bruto.split('|').map(Number)
  return { x, y, zoom }
}

/**
 * A moldura que envolve tudo que está selecionado, em coordenadas do fluxo.
 *
 * Vazio quando não há seleção, e é por isso que o retorno é texto: a mesma
 * regra do transform acima vale aqui, com o agravante de que este seletor roda
 * a cada mudança do store inteiro.
 */
function useCaixaSelecionada() {
  const bruto = useStore((s) => {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity

    for (const no of s.nodeLookup.values()) {
      if (!no.selected) continue
      const { x, y } = no.internals.positionAbsolute
      const largura = no.measured.width ?? 0
      const altura = no.measured.height ?? 0
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x + largura)
      y1 = Math.max(y1, y + altura)
    }

    if (x0 === Infinity) return ''
    return `${x0}|${y0}|${x1}|${y1}`
  })

  if (!bruto) return null
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = bruto.split('|').map(Number)
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0 }
}

export function FundoDoCanvas() {
  const { x, y, zoom } = useTransform()
  const caixa = useCaixaSelecionada()

  // O passo em coordenadas do fluxo que deixa os pontos perto de ALVO px na
  // tela. Os degraus dobram para a troca cair sempre no mesmo lugar da grade
  // anterior: com passos quaisquer, os pontos saltariam de posição no zoom.
  const passo = DEGRAUS.find((degrau) => degrau * zoom >= ALVO_NA_TELA) ?? 640

  // O halo é uma mancha, não um contorno: sobra generosa em volta da caixa,
  // porque o que precisa ser visto de longe é a luz, não o formato dela.
  const sobra = 90
  const halo = caixa && {
    left: caixa.x * zoom + x - sobra,
    top: caixa.y * zoom + y - sobra,
    width: caixa.largura * zoom + sobra * 2,
    height: caixa.altura * zoom + sobra * 2,
  }

  return (
    <>
      {/*
        Uma camada só. O ponto tem raio fixo **na tela**: `size` também é medido
        em coordenadas do fluxo, então sem dividir pelo zoom ele vira grão de
        poeira ao afastar e bolota ao aproximar.
      */}
      <Background gap={passo} size={RAIO_NA_TELA / zoom} color="var(--cor-da-grade)" />

      {/*
        A luz e a vinheta do tema escuro. O elemento existe nos dois temas
        porque tirá-lo e devolvê-lo com o tema piscaria a tela inteira; quem
        decide se ele pinta alguma coisa é o CSS.
      */}
      <div className="canvas-luz" aria-hidden />

      {halo && <div className="canvas-halo" style={halo} aria-hidden />}
    </>
  )
}
