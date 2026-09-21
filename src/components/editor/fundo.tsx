'use client'

import { Background, BackgroundVariant, useStore } from '@xyflow/react'

/**
 * O fundo do canvas do editor, que responde ao que está acontecendo nele.
 *
 * Eram duas linhas: um `<Background>` de pontinhos e uma cor de véu no CSS. O
 * resultado era correto e mudo. Este fundo faz duas coisas que o anterior não
 * fazia, e nenhuma delas é enfeite:
 *
 * - **A grade troca de densidade conforme o zoom.** Afastado, pontinho de 24px
 *   vira textura suja e some; quem está longe precisa é da linha mestra, que
 *   dá noção de distância entre os blocos. Colado, a grade de 24px fica larga
 *   demais para servir de referência ao alinhar, e a de 8px aparece. É a mesma
 *   ideia de um mapa que troca de escala, e o motivo é o mesmo: a régua útil
 *   depende de quão perto se está.
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

/** Sobe de 0 a 1 entre `de` e `ate`, e trava nas pontas. */
function rampa(valor: number, de: number, ate: number) {
  if (valor <= de) return 0
  if (valor >= ate) return 1
  return (valor - de) / (ate - de)
}

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

  // Longe: a grade de 24px vira sujeira e sai; a linha mestra assume.
  const opacidadeDaGrade = rampa(zoom, 0.35, 0.65)
  // Perto: entra a grade fina, que é a régua de quem está alinhando bloco.
  const opacidadeDoDetalhe = rampa(zoom, 1.3, 2) * 0.6
  // A mestra existe sempre, e pesa mais quanto mais longe se está.
  const opacidadeDaMestra = 0.45 + 0.55 * (1 - rampa(zoom, 0.7, 1.5))

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
      <Background
        id="mestra"
        variant={BackgroundVariant.Lines}
        gap={192}
        lineWidth={1}
        color="var(--cor-da-grade-mestra)"
        style={{ opacity: opacidadeDaMestra }}
      />
      <Background id="grade" gap={24} size={1} color="var(--cor-da-grade)" style={{ opacity: opacidadeDaGrade }} />
      <Background
        id="detalhe"
        gap={8}
        size={1}
        color="var(--cor-da-grade)"
        style={{ opacity: opacidadeDoDetalhe }}
      />

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
