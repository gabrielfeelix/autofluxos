'use client'

import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { fatiarVariaveis } from '@/core/engine/interpolar'

/**
 * Campo de texto que **mostra** onde há variável.
 *
 * `{{nome}}` digitado no meio de uma frase é indistinguível de texto comum, e a
 * consequência aparece tarde: a pessoa escreve `{{nomee}}`, publica, e descobre
 * na conversa de um cliente que ali sai vazio. O realce é o aviso no lugar certo
 * — na hora de escrever.
 *
 * **E ele distingue conhecida de desconhecida**, que é o que transforma enfeite
 * em informação. Variável que nenhum bloco preenche fica âmbar, com o mesmo
 * critério do `validar()`.
 *
 * ---------------------------------------------------------------------------
 * Fundo espelhado: como funciona, e o que já quebrou
 * ---------------------------------------------------------------------------
 *
 * Não dá para estilizar pedaço de conteúdo dentro de um `<textarea>`. A saída é
 * uma `<div>` atrás desenhando o texto fatiado, e o campo por cima com o texto
 * transparente e só o cursor visível. O `<textarea>` continua sendo um
 * `<textarea>` de verdade — `contenteditable` daria o mesmo efeito e quebraria
 * colar, desfazer, seleção nativa e a inserção de variável na posição do cursor.
 *
 * **As medidas vêm de `style` inline, e não de classe.** A primeira versão usava
 * classes utilitárias nas duas camadas e o texto apareceu dobrado, deslocado
 * alguns pixels: `.app-field` define `color: var(--ink)` e ganhava do
 * `text-transparent` do Tailwind por ordem de origem, então as duas camadas
 * pintavam texto. Estilo inline é a única forma de garantir que **a mesma
 * medida** vale para as duas — e aqui divergir um pixel significa o cursor numa
 * coluna e a cor em outra.
 *
 * O resto que a técnica exige, e cada item já quebrou em alguma implementação:
 *
 * - rolagem sincronizada, senão o realce descola do texto na quinta linha;
 * - um caractere depois da última quebra de linha, senão o fundo não reserva a
 *   linha vazia final e o texto sobe um degrau ao apertar `Enter`;
 * - `white-space: pre-wrap` e quebra por palavra idênticas nas duas.
 */

/**
 * Tudo que as duas camadas precisam ter igual, ao pixel.
 *
 * `font: inherit` não basta: o `<textarea>` tem fonte própria do agente de
 * usuário e não herda sozinho.
 */
const MEDIDAS: CSSProperties = {
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: '24px',
  letterSpacing: 'normal',
  padding: '10px 12px',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: 10,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'normal',
  margin: 0,
  /**
   * O vão da barra de rolagem, reservado sempre e nas duas camadas.
   *
   * Sem isto, o texto que passa da altura faz o `<textarea>` mostrar barra e
   * perder ~15px de largura útil — o espelho, que não tem barra, continua com a
   * largura cheia e quebra as linhas em pontos diferentes. É o mesmo defeito de
   * desalinhamento, só que aparecendo de repente na quarta linha.
   */
  scrollbarGutter: 'stable',
}

const FUNDO: CSSProperties = {
  ...MEDIDAS,
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  borderColor: 'transparent',
  background: 'transparent',
  color: 'var(--ink)',
}

const CAMPO: CSSProperties = {
  ...MEDIDAS,
  position: 'relative',
  width: '100%',
  display: 'block',
  outline: 'none',
  background: 'rgba(255,255,255,0.045)',
  borderColor: 'rgba(255,255,255,0.1)',
  // As duas linhas que fazem o espelho aparecer: o texto some, o cursor fica.
  color: 'transparent',
  caretColor: 'var(--ink)',
}

/**
 * O realce de uma variável — **sem mexer em uma medida sequer**.
 *
 * Era aqui o defeito que fazia o campo parecer duplicado: o realce tinha
 * `padding: 1px 3px` e `font-weight: 600`. Os dois mudam a largura do texto no
 * espelho, e o `<textarea>` por cima não sabe disso — ele desenha `{{nome}}`
 * com a largura normal. A partir da primeira variável as duas camadas passavam
 * a discordar de alguns pixels por variável, e o efeito na tela é exatamente o
 * que se vê: texto fantasma deslocado, e o cursor caindo numa coluna diferente
 * da letra que está sendo digitada.
 *
 * A regra desta técnica, que não abre exceção: **o espelho só pode mudar cor.**
 * Nada de padding, borda, negrito, `letter-spacing`, fonte ou transformação —
 * qualquer coisa que mova um glifo um pixel quebra a ilusão.
 *
 * O ar em volta do realce continua existindo, feito por `box-shadow`: sombra
 * não ocupa espaço no fluxo, então ela pinta a folga sem empurrar o que vem
 * depois.
 */
const REALCE_CONHECIDA: CSSProperties = {
  borderRadius: 4,
  background: 'color-mix(in oklab, var(--accent) 20%, transparent)',
  color: 'var(--accent)',
  boxShadow: '0 0 0 2px color-mix(in oklab, var(--accent) 20%, transparent)',
}

const REALCE_DESCONHECIDA: CSSProperties = {
  borderRadius: 4,
  background: 'rgba(252, 211, 77, 0.20)',
  color: '#fde68a',
  boxShadow: '0 0 0 2px rgba(252, 211, 77, 0.20)',
}

function Pedacos({ valor, conhecidas }: { valor: string; conhecidas?: string[] }) {
  return (
    <>
      {fatiarVariaveis(valor).map((pedaco, i) =>
        pedaco.tipo === 'texto' ? (
          <span key={i}>{pedaco.texto}</span>
        ) : (
          <span
            key={i}
            style={
              conhecidas && !conhecidas.includes(pedaco.nome)
                ? REALCE_DESCONHECIDA
                : REALCE_CONHECIDA
            }
          >
            {pedaco.texto}
          </span>
        ),
      )}
      {/* Ver o comentário do topo: sem isto a última linha vazia some. */}
      {'​'}
    </>
  )
}

export function TextoComVariaveis({
  valor,
  aoMudar,
  area,
  rows = 4,
  erro = false,
  conhecidas,
  id,
  aoFocar,
}: {
  valor: string
  aoMudar: (valor: string) => void
  /** O mesmo `ref` que a barra de formatação usa para saber onde está o cursor. */
  area?: RefObject<HTMLTextAreaElement | null>
  rows?: number
  /** Pinta a borda de recusa — texto acima do limite da Meta, por exemplo. */
  erro?: boolean
  /** Quando vem, variável fora da lista é marcada como desconhecida. */
  conhecidas?: string[]
  id?: string
  aoFocar?: (elemento: HTMLTextAreaElement, aoMudar: (valor: string) => void) => void
}) {
  const proprio = useRef<HTMLTextAreaElement>(null)
  const campo = area ?? proprio
  const fundo = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      <div ref={fundo} aria-hidden style={FUNDO}>
        <Pedacos valor={valor} conhecidas={conhecidas} />
      </div>

      <textarea
        id={id}
        ref={campo}
        value={valor}
        rows={rows}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        onSelect={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        onScroll={(e) => {
          if (fundo.current) fundo.current.scrollTop = e.currentTarget.scrollTop
        }}
        style={{
          ...CAMPO,
          resize: 'vertical',
          ...(erro ? { borderColor: 'rgba(251,113,133,0.6)' } : {}),
        }}
      />
    </div>
  )
}

/** A mesma coisa numa linha só — para os campos curtos que interpolam. */
export function LinhaComVariaveis({
  valor,
  aoMudar,
  conhecidas,
  aoFocar,
}: {
  valor: string
  aoMudar: (valor: string) => void
  conhecidas?: string[]
  aoFocar?: (elemento: HTMLInputElement, aoMudar: (valor: string) => void) => void
}) {
  const fundo = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      <div ref={fundo} aria-hidden style={{ ...FUNDO, whiteSpace: 'pre' }}>
        <Pedacos valor={valor} conhecidas={conhecidas} />
      </div>

      <input
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onFocus={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        onSelect={(e) => aoFocar?.(e.currentTarget, aoMudar)}
        onScroll={(e) => {
          if (fundo.current) fundo.current.scrollLeft = e.currentTarget.scrollLeft
        }}
        style={{ ...CAMPO, whiteSpace: 'pre' }}
      />
    </div>
  )
}

/**
 * A legenda que explica a cor.
 *
 * Cor sem legenda é decoração: quem vê âmbar pela primeira vez precisa saber
 * que é aviso, e não estilo.
 */
export function LegendaDeVariaveis({
  valor,
  conhecidas,
  children,
}: {
  valor: string
  conhecidas?: string[]
  children?: ReactNode
}) {
  const citadas = fatiarVariaveis(valor).filter((p) => p.tipo === 'variavel')
  const desconhecidas = conhecidas
    ? [...new Set(citadas.map((p) => (p.tipo === 'variavel' ? p.nome : '')))].filter(
        (nome) => nome !== '' && !conhecidas.includes(nome),
      )
    : []

  if (desconhecidas.length > 0) {
    return (
      <span className="mt-1 block text-[10.5px] leading-4 text-amber-200">
        {desconhecidas.map((nome) => `{{${nome}}}`).join(', ')}{' '}
        {desconhecidas.length === 1 ? 'não é preenchida' : 'não são preenchidas'} por nenhum bloco
        antes daqui — vai sair vazio na conversa.
      </span>
    )
  }

  return (
    <span className="mt-1 block text-[10.5px] text-dim">{children ?? 'aceita {{variavel}}'}</span>
  )
}
