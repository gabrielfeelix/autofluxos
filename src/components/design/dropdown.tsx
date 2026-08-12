'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type OpcaoDropdown = {
  valor: string
  rotulo: string
  detalhe?: string
  desabilitada?: boolean
}

/**
 * Lista de escolha do painel.
 *
 * O `<select>` nativo entrega o desenho do sistema operacional quando abre —
 * inclusive fundo branco em cima de um modal escuro. Esta versão mantém a
 * mesma semântica no formulário (via input oculto), mas a lista é nossa e
 * funciona por mouse, toque e teclado.
 */
export function Dropdown({
  opcoes,
  nome,
  valor,
  valorInicial,
  aoMudar,
  rotuloAcessivel,
  desabilitado = false,
  className = '',
}: {
  opcoes: readonly OpcaoDropdown[]
  /** Nome que o Server Action recebe ao enviar o formulário. */
  nome?: string
  /** Use junto com `aoMudar` em telas que já controlam o estado. */
  valor?: string
  /** Valor inicial para formulários renderizados no servidor. */
  valorInicial?: string
  aoMudar?: (valor: string) => void
  rotuloAcessivel: string
  desabilitado?: boolean
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [interno, setInterno] = useState(valorInicial ?? opcoes[0]?.valor ?? '')
  const raiz = useRef<HTMLDivElement>(null)
  const listaId = useId()
  const valorPedido = valor ?? interno
  const opcaoEscolhida = opcoes.find((opcao) => opcao.valor === valorPedido) ?? opcoes[0]
  // Uma opção pode sumir enquanto o painel está aberto (por exemplo, alguém
  // apagou a credencial em outra aba). O formulário passa então o primeiro
  // valor existente, sem disparar um setState durante renderização.
  const escolhido = opcaoEscolhida?.valor ?? ''

  useEffect(() => {
    const fecharAoClicarFora = (evento: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('pointerdown', fecharAoClicarFora)
    return () => document.removeEventListener('pointerdown', fecharAoClicarFora)
  }, [])

  function escolher(novoValor: string) {
    if (valor === undefined) setInterno(novoValor)
    aoMudar?.(novoValor)
    setAberto(false)
  }

  function mover(fator: 1 | -1) {
    const selecionaveis = opcoes.filter((opcao) => !opcao.desabilitada)
    if (selecionaveis.length === 0) return
    const atual = selecionaveis.findIndex((opcao) => opcao.valor === escolhido)
    const proximo = selecionaveis[(atual + fator + selecionaveis.length) % selecionaveis.length]
    if (proximo) escolher(proximo.valor)
  }

  return (
    <div ref={raiz} className={`app-dropdown ${className}`}>
      {nome && <input type="hidden" name={nome} value={escolhido} />}
      <button
        type="button"
        aria-label={rotuloAcessivel}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listaId}
        disabled={desabilitado || opcoes.length === 0}
        onClick={() => setAberto((estado) => !estado)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            setAberto(false)
            return
          }
          if (evento.key === 'ArrowDown') {
            evento.preventDefault()
            if (!aberto) setAberto(true)
            else mover(1)
          }
          if (evento.key === 'ArrowUp') {
            evento.preventDefault()
            if (!aberto) setAberto(true)
            else mover(-1)
          }
          if (evento.key === 'Home') {
            evento.preventDefault()
            const primeira = opcoes.find((opcao) => !opcao.desabilitada)
            if (primeira) escolher(primeira.valor)
          }
          if (evento.key === 'End') {
            evento.preventDefault()
            const ultima = [...opcoes].reverse().find((opcao) => !opcao.desabilitada)
            if (ultima) escolher(ultima.valor)
          }
        }}
        className="app-dropdown-trigger"
      >
        <span className="min-w-0 flex-1 truncate text-left">{opcaoEscolhida?.rotulo ?? 'Selecione uma opção'}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 shrink-0 transition-transform duration-150 ${aberto ? 'rotate-180' : ''}`}>
          <path d="m3.5 6 4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {aberto && (
        <div id={listaId} role="listbox" aria-label={rotuloAcessivel} className="app-dropdown-menu">
          {opcoes.map((opcao) => {
            const selecionada = opcao.valor === escolhido
            return (
              <button
                key={opcao.valor}
                type="button"
                role="option"
                aria-selected={selecionada}
                disabled={opcao.desabilitada}
                onClick={() => escolher(opcao.valor)}
                className={`app-dropdown-option ${selecionada ? 'app-dropdown-option-active' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{opcao.rotulo}</span>
                  {opcao.detalhe && <span className="mt-0.5 block truncate text-[10.5px] text-dim">{opcao.detalhe}</span>}
                </span>
                {selecionada && (
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-accent">
                    <path d="m3.2 8.2 2.8 2.8 6.8-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
