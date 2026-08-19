'use client'

import { useState, type ReactNode, type RefObject } from 'react'
import { alternarMarca, type Marca } from './formatar'

/**
 * A barra de negrito, itálico, riscado, monoespaçado e emoji.
 *
 * **Ela nasceu dentro do bloco de Mensagem e ficou presa lá.** Enquanto só
 * aquele bloco mandava texto isso passou despercebido; hoje a Pergunta, o
 * Handoff e a legenda da Mídia também mandam, e quem escreve a saudação com
 * negrito e a pergunta seguinte sem entende — corretamente — que a segunda tela
 * está quebrada. Um componente só é o que impede as duas de divergirem de novo.
 *
 * O que ela **não** faz continua valendo: não muda o formato do que é gravado.
 * O WhatsApp não recebe HTML, ele recebe `*negrito*` e renderiza sozinho, então
 * o que fica no banco é exatamente o que sai. A barra existe para ninguém
 * precisar decorar que itálico é sublinhado dos dois lados.
 *
 * Onde ela **não** entra, e de propósito: campo que não vira mensagem. O valor
 * do bloco Guardar, o motivo interno do Handoff, a instrução da IA e a URL do
 * arquivo não passam por render nenhum — asterisco ali é asterisco literal, e
 * oferecer o botão seria ensinar a estragar o dado.
 */

/**
 * Emojis à mão, sem biblioteca.
 *
 * Um seletor completo são milhares de caracteres, busca, categorias e tom de
 * pele — peso de sobra para o que acontece aqui, que é pôr um 👋 na saudação. A
 * lista é a dos que aparecem em mensagem de atendimento; quem quiser outro cola
 * do teclado do sistema, que continua funcionando.
 */
const EMOJIS = [
  '👋', '😀', '😊', '🙂', '😉', '🤝', '🙏', '👍', '👏', '💪',
  '✅', '❌', '⚠️', '❤️', '🎉', '✨', '🔥', '⭐', '📅', '⏰',
  '📍', '📞', '💬', '📷', '📄', '💰', '🛒', '🚀', '💡', '🔗',
]

export function BarraDeFormato({
  area,
  aoMudar,
  children,
}: {
  /** O campo em que a barra age. Ela lê a seleção dele, não um estado próprio. */
  area: RefObject<HTMLTextAreaElement | null>
  aoMudar: (valor: string) => void
  /** O que vai à direita — hoje, o contador de caracteres. */
  children?: ReactNode
}) {
  const [emojisAbertos, setEmojisAbertos] = useState(false)

  function aplicar(marca: Marca) {
    const elemento = area.current
    if (!elemento) return

    const { proximo, selecaoInicio, selecaoFim } = alternarMarca(
      elemento.value,
      elemento.selectionStart,
      elemento.selectionEnd,
      marca,
    )
    aoMudar(proximo)

    // O campo é controlado: esperar um frame devolve foco e seleção depois de
    // o valor novo chegar ao DOM.
    requestAnimationFrame(() => {
      elemento.focus()
      elemento.setSelectionRange(selecaoInicio, selecaoFim)
    })
  }

  function inserirEmoji(emoji: string) {
    const elemento = area.current
    if (!elemento) return

    const de = elemento.selectionStart
    const ate = elemento.selectionEnd
    const proximo = elemento.value.slice(0, de) + emoji + elemento.value.slice(ate)
    aoMudar(proximo)
    setEmojisAbertos(false)

    requestAnimationFrame(() => {
      elemento.focus()
      const cursor = de + emoji.length
      elemento.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="mb-1.5 flex items-center gap-1">
      <BotaoDeMarca rotulo="Negrito" marca="negrito" aoClicar={aplicar}>
        <strong>B</strong>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Itálico" marca="italico" aoClicar={aplicar}>
        <em>I</em>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Riscado" marca="riscado" aoClicar={aplicar}>
        <s>S</s>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Monoespaçado" marca="mono" aoClicar={aplicar}>
        <span className="font-mono">{'{}'}</span>
      </BotaoDeMarca>

      <div className="relative">
        <button
          type="button"
          aria-label="Inserir emoji"
          aria-expanded={emojisAbertos}
          // Mesmo motivo de `BotaoDeMarca`: o clique não pode roubar o foco do
          // campo antes de a gente saber onde o cursor estava.
          onMouseDown={(evento) => {
            evento.preventDefault()
            setEmojisAbertos((aberto) => !aberto)
          }}
          className="rounded-md px-1.5 py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white"
        >
          ☺
        </button>
        {emojisAbertos && (
          <div className="app-dropdown-menu right-auto left-0 grid w-[232px] grid-cols-10 gap-0.5 p-1.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  inserirEmoji(emoji)
                }}
                className="rounded p-0.5 text-[15px] leading-none transition hover:bg-white/[0.08]"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {children && <span className="ml-auto">{children}</span>}
    </div>
  )
}

function BotaoDeMarca({
  rotulo,
  marca,
  aoClicar,
  children,
}: {
  rotulo: string
  marca: Marca
  aoClicar: (marca: Marca) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      // `onMouseDown` com `preventDefault` em vez de `onClick`: clicar num
      // botão tira o foco do textarea antes do clique acontecer, e com o foco
      // vai a seleção — que é justamente o que a barra precisa saber.
      onMouseDown={(evento) => {
        evento.preventDefault()
        aoClicar(marca)
      }}
      className="w-6 rounded-md py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  )
}
