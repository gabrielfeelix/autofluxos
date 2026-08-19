'use client'

import { useCallback, useRef, useState, type RefObject } from 'react'
import { inserirNoCursor } from './inserir-variavel'
import { Popover } from './popover'

/**
 * O botão que insere uma variável no campo — com busca.
 *
 * **Substituiu a lista "Variáveis deste fluxo" no rodapé do painel.** Aquela
 * lista era um teclado longe do campo: ficava no fim da coluna, precisava
 * lembrar de deixar o cursor no lugar certo, e crescia sem fim conforme o fluxo
 * coletava mais coisa — num fluxo com quinze variáveis ela sozinha ocupava mais
 * altura que o bloco sendo editado.
 *
 * Aqui o gesto é o que sempre foi em editor de texto: o botão está **no campo
 * em que se escreve**, ao lado do negrito e do emoji, e a busca resolve a lista
 * grande sem ocupar espaço nenhum enquanto está fechada.
 *
 * Um detalhe que parece bug e não é: a seleção do campo **sobrevive** ao foco
 * ir para a caixa de busca. `selectionStart` continua valendo em campo sem
 * foco, e é por isso que a variável cai onde o cursor estava, e não no fim.
 */
export function SeletorDeVariavel({
  campo,
  variaveis,
  aoMudar,
  className = '',
}: {
  /** O campo que recebe a variável. A seleção dele é lida na hora de inserir. */
  campo: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  variaveis: string[]
  aoMudar: (valor: string) => void
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const botao = useRef<HTMLButtonElement>(null)
  const fechar = useCallback(() => setAberto(false), [])

  const filtradas = variaveis.filter((v) =>
    v.toLowerCase().includes(busca.trim().toLowerCase()),
  )

  function inserir(variavel: string) {
    const elemento = campo.current
    if (!elemento) return

    const { proximo, cursor } = inserirNoCursor(
      elemento.value,
      elemento.selectionStart ?? elemento.value.length,
      elemento.selectionEnd ?? elemento.value.length,
      `{{${variavel}}}`,
    )

    aoMudar(proximo)
    setAberto(false)
    setBusca('')

    // O campo é controlado: esperar um quadro devolve foco e cursor depois de o
    // valor novo chegar ao DOM.
    requestAnimationFrame(() => {
      elemento.focus()
      elemento.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <span className={className}>
      <button
        ref={botao}
        type="button"
        aria-label="Inserir variável"
        aria-expanded={aberto}
        title={
          variaveis.length === 0
            ? 'Nenhuma variável ainda: este fluxo não guarda nada antes daqui.'
            : 'Inserir uma variável do fluxo'
        }
        disabled={variaveis.length === 0}
        // `onMouseDown` com `preventDefault`, como na barra de formato: o clique
        // tiraria o foco do campo antes de o botão agir, e com o foco iria a
        // seleção — que é onde a variável precisa cair.
        onMouseDown={(evento) => {
          evento.preventDefault()
          if (variaveis.length === 0) return
          setAberto((estava) => !estava)
        }}
        className={`rounded-md px-1.5 py-0.5 font-mono text-[12px] transition disabled:opacity-40 ${
          aberto ? 'bg-accent/15 text-accent' : 'text-dim hover:bg-white/[0.06] hover:text-accent'
        }`}
      >
        {'{x}'}
      </button>

      <Popover aberto={aberto} gatilho={botao} largura={220} altura={250} aoFechar={fechar}>
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            // `Enter` pega a primeira da lista: com a busca filtrando, a
            // primeira quase sempre é a procurada, e tirar a mão do teclado
            // para clicar é o que torna um seletor cansativo.
            if (e.key === 'Enter' && filtradas[0]) {
              e.preventDefault()
              inserir(filtradas[0])
            }
          }}
          placeholder="Buscar variável…"
          className="app-field mb-1 px-2 py-1.5 text-[12px]"
        />

        <div className="max-h-[190px] overflow-y-auto">
          {filtradas.length === 0 ? (
            <p className="px-2 py-2 text-[11px] leading-4 text-dim">
              Nenhuma variável com esse nome.
            </p>
          ) : (
            filtradas.map((v) => (
              <button
                key={v}
                type="button"
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  inserir(v)
                }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-[11.5px] text-[#8de2fa] transition hover:bg-accent/[0.12]"
              >{`{{${v}}}`}</button>
            ))
          )}
        </div>
      </Popover>
    </span>
  )
}
