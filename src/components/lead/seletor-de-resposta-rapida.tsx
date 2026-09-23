'use client'

import { useEffect, useRef, useState } from 'react'
import { Dica } from '@/components/design/dica'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { IconeRespostaRapida } from '@/components/lead/icones-da-barra'

export type RespostaRapidaDaBarra = { atalho: string; texto: string }

/** Tira acento e caixa, para "saudacao" achar "Saudação". */
function normal(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * As respostas rápidas como busca, e não como fileira de chips (tarefa 8.2, X20).
 *
 * Os chips moravam acima do campo e cresciam com a conta: com vinte atalhos,
 * empurravam o compositor para o meio da conversa. Agora é um botão da barra,
 * irmão do de produto e no mesmo padrão: abre para cima, busca enquanto se
 * digita, setas escolhem, Enter insere, Esc fecha e devolve o foco ao campo.
 *
 * `/` no começo do campo vazio abre o mesmo painel: quem já sabe o atalho não
 * precisa tirar a mão do teclado. O pai controla isso por `aberto`.
 */
export function SeletorDeRespostaRapida({
  respostas,
  aberto,
  aoAbrir,
  aoFechar,
  aoEscolher,
  desabilitado = false,
}: {
  respostas: RespostaRapidaDaBarra[]
  aberto: boolean
  aoAbrir: () => void
  /** Fechar sem escolher. O pai devolve o foco ao campo. */
  aoFechar: () => void
  aoEscolher: (resposta: RespostaRapidaDaBarra) => void
  desabilitado?: boolean
}) {
  const [termo, setTermo] = useState('')
  const [marcada, setMarcada] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)

  const achadas = respostas.filter(
    (r) => normal(r.atalho).includes(normal(termo)) || normal(r.texto).includes(normal(termo)),
  )

  useEffect(() => {
    if (!aberto) return
    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) aoFechar()
    }
    document.addEventListener('mousedown', foraDaqui)
    return () => document.removeEventListener('mousedown', foraDaqui)
  }, [aberto, aoFechar])

  function fechar() {
    setTermo('')
    setMarcada(0)
    aoFechar()
  }

  function escolher(resposta: RespostaRapidaDaBarra) {
    setTermo('')
    setMarcada(0)
    aoEscolher(resposta)
  }

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Resposta rápida ( / )" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => (aberto ? fechar() : aoAbrir())}
          aria-label="Inserir resposta rápida"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeRespostaRapida />
        </button>
      </Dica>

      {aberto && (
        <div
          role="dialog"
          aria-label="Respostas rápidas"
          className="absolute bottom-full left-0 z-30 mb-2 w-[340px] max-w-[88vw] rounded-[12px] border border-line bg-panel p-2 shadow-[0_10px_30px_rgba(19,25,34,0.11)]"
        >
          <input
            type="search"
            value={termo}
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="respostas-rapidas-lista"
            aria-activedescendant={achadas[marcada] ? `resposta-rapida-${marcada}` : undefined}
            onChange={(e) => {
              setTermo(e.target.value)
              setMarcada(0)
            }}
            onKeyDown={(evento) => {
              if (evento.key === 'Escape') {
                evento.preventDefault()
                fechar()
              } else if (evento.key === 'ArrowDown') {
                evento.preventDefault()
                setMarcada((m) => Math.min(m + 1, achadas.length - 1))
              } else if (evento.key === 'ArrowUp') {
                evento.preventDefault()
                setMarcada((m) => Math.max(m - 1, 0))
              } else if (evento.key === 'Enter') {
                // Enter aqui insere; não pode enviar a resposta do formulário.
                evento.preventDefault()
                if (achadas[marcada]) escolher(achadas[marcada])
              }
            }}
            placeholder="Buscar pelo atalho ou pelo texto"
            className="mb-2 w-full rounded-[9px] border border-line bg-surface px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-dim focus:border-primary/40"
          />

          {achadas.length === 0 ? (
            <p className="px-1.5 pb-1.5 text-[12px] leading-5 text-dim">
              {respostas.length === 0
                ? 'Nenhuma resposta rápida cadastrada. Crie em Configurações, Respostas rápidas.'
                : 'Nenhuma resposta com esse atalho ou texto.'}
            </p>
          ) : (
            <ul id="respostas-rapidas-lista" role="listbox" className="max-h-[260px] overflow-y-auto">
              {achadas.map((r, i) => (
                <li
                  key={r.atalho}
                  id={`resposta-rapida-${i}`}
                  role="option"
                  aria-selected={i === marcada}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseEnter={() => setMarcada(i)}
                    onClick={() => escolher(r)}
                    className={`block w-full rounded-[9px] px-2 py-1.5 text-left transition ${i === marcada ? 'bg-surface-strong' : ''}`}
                  >
                    <span className="block text-[12px] font-bold text-primary">/{r.atalho}</span>
                    <span className="block truncate text-[12px] text-muted">{r.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
