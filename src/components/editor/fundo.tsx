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
 *   para o espaço entre pontos ficar sempre perto de 40px **de tela**, e o
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
 * 40px é grade de referência, não papel milimetrado: dá para mirar o
 * alinhamento de um bloco sem que o canvas vire textura. Abaixo de uns 30px os
 * pontos deixam de ser pontos e viram cinza.
 */
const ALVO_NA_TELA = 40

/**
 * O diâmetro do ponto na tela, também fixo.
 *
 * **É diâmetro, e não raio**: o React Flow desenha o círculo com
 * `radius = size * zoom / 2`. Com 1.4 aqui o ponto saía com 0,7px de raio, que
 * é literalmente invisível contra o canvas claro. 2.6 dá 1,3px de raio, que é
 * o tamanho em que um ponto ainda é ponto.
 */
const DIAMETRO_NA_TELA = 2.6

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
    const ids: string[] = []
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity

    for (const no of s.nodeLookup.values()) {
      if (!no.selected) continue
      ids.push(no.id)
      const { x, y } = no.internals.positionAbsolute
      const largura = no.measured.width ?? 0
      const altura = no.measured.height ?? 0
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x + largura)
      y1 = Math.max(y1, y + altura)
    }

    if (x0 === Infinity) return ''
    // Os ids vêm junto porque o halo precisa saber **quando a seleção trocou**,
    // e não só onde ela está: a caixa muda de valor a todo quadro de arrasto, e
    // usá-la como identidade remontaria o elemento sessenta vezes por segundo.
    return `${x0}|${y0}|${x1}|${y1}|${ids.sort().join(',')}`
  })

  if (!bruto) return null
  const [bx0, by0, bx1, by1, ids = ''] = bruto.split('|')
  const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = [bx0, by0, bx1, by1].map(Number)
  return { x: x0, y: y0, largura: x1 - x0, altura: y1 - y0, ids }
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
        poeira ao afastar e bolota ao aproximar. A cor sai do CSS
        (`.react-flow__background pattern circle`), que vence esta prop.
      */}
      <Background gap={passo} size={DIAMETRO_NA_TELA / zoom} color="var(--cor-da-grade)" />

      {/*
        A luz e a vinheta do tema escuro. O elemento existe nos dois temas
        porque tirá-lo e devolvê-lo com o tema piscaria a tela inteira; quem
        decide se ele pinta alguma coisa é o CSS.
      */}
      <div className="canvas-luz" aria-hidden />

      {/*
        A `key` é a seleção, não a posição.

        Trocar de bloco **remonta** o halo, e é isso que o faz nascer já no
        lugar certo em vez de viajar até lá. Arrastar e dar pan mudam só o
        `style`, então o elemento continua o mesmo e acompanha o bloco sem
        atraso nenhum.
      */}
      {halo && caixa && <div key={caixa.ids} className="canvas-halo" style={halo} aria-hidden />}
    </>
  )
}
