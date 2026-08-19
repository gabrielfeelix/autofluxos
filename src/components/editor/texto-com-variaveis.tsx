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
 * critério do `validar()`: é o erro de digitação aparecendo antes de virar
 * mensagem torta.
 *
 * ---------------------------------------------------------------------------
 * Como funciona, porque a técnica não é óbvia
 * ---------------------------------------------------------------------------
 *
 * Não dá para estilizar pedaço de conteúdo dentro de um `<textarea>`. A saída é
 * um **fundo espelhado**: uma `<div>` atrás, com a mesma tipografia e as mesmas
 * medidas de caixa, desenhando o texto já fatiado; e o `<textarea>` por cima,
 * com o texto transparente e só o cursor visível.
 *
 * O `<textarea>` continua sendo um `<textarea>` de verdade, e isso é o ponto:
 * `contenteditable` daria o mesmo efeito visual e quebraria colar, desfazer,
 * seleção nativa e o `registrarCampo` que insere variável na posição do cursor.
 *
 * O que a técnica exige, e cada item já quebrou em alguma implementação por aí:
 *
 * - **as duas camadas precisam medir igual** — fonte, tamanho, entrelinha,
 *   espaçamento, padding e largura de borda. Por isso as classes do campo saem
 *   de uma constante única, e não são repetidas nas duas;
 * - **rolagem sincronizada**: o fundo não tem barra e é empurrado pelo `scroll`
 *   do campo de cima, senão o realce descola do texto na quinta linha;
 * - **a última quebra de linha precisa de um caractere depois** — sem ele o
 *   fundo não reserva a linha vazia final e o texto sobe um degrau enquanto a
 *   pessoa digita `Enter`;
 * - **`white-space: pre-wrap` e `break-words`** nos dois, ou a quebra de linha
 *   cai em coluna diferente em cada camada.
 */

/** As medidas que as duas camadas precisam compartilhar. Uma fonte só. */
const CAIXA = 'px-3 py-2.5 text-[13px] leading-6'

/**
 * O espelho copia as **medidas** do `.app-field`, e nenhuma cor.
 *
 * Herdar a classe inteira pintaria fundo e borda duas vezes, e a borda de foco
 * apareceria dobrada. O que ele precisa é começar o texto exatamente na mesma
 * coluna do campo de cima — e isso é a borda de 1px reservando espaço, mais o
 * mesmo `padding`, que vem de `CAIXA`.
 */
const ESPELHO: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderRadius: 10,
  color: 'var(--ink)',
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
            className={`rounded-[4px] px-[3px] py-[1px] font-semibold ${
              conhecidas && !conhecidas.includes(pedaco.nome)
                ? 'bg-amber-300/[0.18] text-amber-200 ring-1 ring-amber-300/30'
                : 'bg-accent/[0.16] text-accent'
            }`}
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
      <div
        ref={fundo}
        aria-hidden
        style={ESPELHO}
        className={`pointer-events-none absolute inset-0 overflow-hidden ${CAIXA}`}
      >
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
        // `resize-y` fica: o fundo é `inset-0` e acompanha a altura sozinho.
        className={`app-field relative resize-y bg-transparent text-transparent caret-[var(--ink)] ${CAIXA} ${
          erro ? 'border-rose-400/60' : ''
        }`}
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
      <div
        ref={fundo}
        aria-hidden
        style={{ ...ESPELHO, whiteSpace: 'pre' }}
        className={`pointer-events-none absolute inset-0 overflow-hidden ${CAIXA}`}
      >
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
        className={`app-field relative bg-transparent text-transparent caret-[var(--ink)] ${CAIXA}`}
      />
    </div>
  )
}

/**
 * A legenda que explica a cor.
 *
 * Fica junto do campo porque cor sem legenda é decoração: quem vê âmbar pela
 * primeira vez precisa saber que é aviso, e não estilo.
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
    ? [...new Set(citadas.filter((p) => !conhecidas.includes(p.nome)).map((p) => p.nome))]
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

  return <span className="mt-1 block text-[10.5px] text-dim">{children ?? 'aceita {{variavel}}'}</span>
}
