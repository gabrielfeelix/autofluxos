'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
 *
 * ---------------------------------------------------------------------------
 * A lista sai do fluxo, e por quê
 * ---------------------------------------------------------------------------
 *
 * Ela era `position: absolute` dentro do próprio componente, e **todo card do
 * painel tem `overflow-hidden`** — a borda arredondada da lista depende disso.
 * O resultado é a lista sendo cortada na altura do card: no dropdown de papel
 * da tela de Equipe dava para ler metade de uma opção e mais nada.
 *
 * Subir o `z-index` não resolve nada aqui: `overflow: hidden` recorta, não
 * empilha. Tirar o `overflow` dos cards devolveria o canto quadrado em toda
 * lista do sistema.
 *
 * A saída é um portal com `position: fixed`, medido a partir do botão. Isso
 * escapa de qualquer `overflow` e de qualquer contexto de empilhamento acima.
 *
 * **E o destino do portal não é sempre o `body`.** Modal aqui é `<dialog>`
 * nativo, que vive na *top layer* do navegador: qualquer coisa pendurada no
 * `body` é pintada **atrás** dele. Então o portal procura o `<dialog>` mais
 * próximo e, só quando não há nenhum, cai no `body` — senão os dropdowns
 * dentro de modal, que agora são a maioria, sumiriam.
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
  const gatilho = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [caixa, setCaixa] = useState<{ top: number; left: number; width: number } | null>(null)
  /**
   * Onde o portal desenha.
   *
   * Guardado em estado, e não lido do `ref` na hora de renderizar: ler `ref`
   * durante o render é leitura de uma coisa que ainda pode não existir, e o
   * compilador do React recusa — com razão, porque no primeiro render ela não
   * existe mesmo.
   */
  const [destino, setDestino] = useState<Element | null>(null)
  const listaId = useId()
  const valorPedido = valor ?? interno
  const opcaoEscolhida = opcoes.find((opcao) => opcao.valor === valorPedido) ?? opcoes[0]
  // Uma opção pode sumir enquanto o painel está aberto (por exemplo, alguém
  // apagou a credencial em outra aba). O formulário passa então o primeiro
  // valor existente, sem disparar um setState durante renderização.
  const escolhido = opcaoEscolhida?.valor ?? ''

  /**
   * Onde a lista cabe.
   *
   * Abre para baixo; vira para cima quando não há espaço — perto do rodapé da
   * tela, abrir para baixo desenha a lista fora da área visível e o efeito é
   * idêntico ao bug que este portal veio consertar.
   */
  const medir = useCallback(() => {
    const alvo = gatilho.current
    if (!alvo) return

    const r = alvo.getBoundingClientRect()
    const alturaDaLista = Math.min(235, opcoes.length * 44 + 10)
    const cabeAbaixo = window.innerHeight - r.bottom > alturaDaLista + 12

    const proxima = {
      top: cabeAbaixo ? r.bottom + 6 : Math.max(8, r.top - alturaDaLista - 6),
      left: r.left,
      width: r.width,
    }

    // Só troca o estado quando a medida **mudou de verdade**. Um objeto novo a
    // cada medição re-renderiza, e se a re-renderização mexer no que rola (foi
    // o caso do modal que virava contentor de `fixed`), o ciclo se alimenta e a
    // tela treme. A guarda custa três comparações e corta a realimentação.
    setCaixa((atual) =>
      atual && atual.top === proxima.top && atual.left === proxima.left && atual.width === proxima.width
        ? atual
        : proxima,
    )
  }, [opcoes.length])

  // `useLayoutEffect` para a primeira medida acontecer antes de pintar: com
  // `useEffect` a lista aparece um quadro no canto superior esquerdo e pula
  // para o lugar.
  useLayoutEffect(() => {
    if (!aberto) return
    // Ver o comentário do topo: dentro de modal o destino é o próprio
    // `<dialog>`, senão a lista é pintada atrás dele.
    setDestino(raiz.current?.closest('dialog') ?? document.body)
    medir()
  }, [aberto, medir])

  useEffect(() => {
    if (!aberto) return

    // `capture` porque o que rola quase nunca é a janela: é o painel do editor,
    // a coluna do quadro, o `<main>` com rolagem própria. Sem capturar, a lista
    // fica flutuando onde o botão estava.
    const acompanhar = () => medir()
    window.addEventListener('scroll', acompanhar, true)
    window.addEventListener('resize', acompanhar)
    return () => {
      window.removeEventListener('scroll', acompanhar, true)
      window.removeEventListener('resize', acompanhar)
    }
  }, [aberto, medir])

  useEffect(() => {
    const fecharAoClicarFora = (evento: PointerEvent) => {
      const alvo = evento.target as Node
      // A lista não está mais dentro da raiz — ela vive no portal. Conferir só
      // a raiz fecharia o dropdown no clique da própria opção.
      if (raiz.current?.contains(alvo)) return
      if (menu.current?.contains(alvo)) return
      setAberto(false)
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
        ref={gatilho}
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
      {aberto &&
        caixa &&
        destino &&
        createPortal(
          <div
            ref={menu}
            id={listaId}
            role="listbox"
            aria-label={rotuloAcessivel}
            style={{ top: caixa.top, left: caixa.left, width: caixa.width }}
            className="app-dropdown-menu">
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
          </div>,
          destino,
        )}
    </div>
  )
}
