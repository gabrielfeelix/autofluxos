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
 * ---------------------------------------------------------------------------
 * Por que a lista é `popover`, e o que quebrou antes
 * ---------------------------------------------------------------------------
 *
 * Modal aqui é `<dialog>` nativo, que vive na *top layer*: coisa pendurada no
 * `body` é pintada **atrás** dele. A tentativa anterior foi pendurar o portal
 * dentro do próprio `<dialog>` — e foi ela que produziu o modal travado que
 * três agentes não consertaram.
 *
 * **O que estava errado, medido e não deduzido** (Playwright, Chromium 141, no
 * modal de "Novo fluxo"): `.app-dialog[open]` roda `animation: pop … both`, e
 * `animation-fill-mode: both` deixa o último quadro aplicado para sempre. O
 * último quadro é `transform: none`, mas o **computado** que fica é
 * `matrix(1, 0, 0, 1, 0, 0)` — identidade, e mesmo assim um transform. Com
 * transform, o `<dialog>` vira **bloco contentor de `position: fixed`**.
 *
 * O efeito em números: `style.top` do menu era `400.75px` (coordenada de
 * janela, certa) e o retângulo real saía em `y = 589`, exatamente `400.75` mais
 * o topo do modal. A lista caía fora do modal, o `overflow: auto` do `<dialog>`
 * ganhava barra, a barra disparava o `scroll` que este componente escuta, a
 * remedição movia a lista de novo — e o ciclo se alimentava. O comentário no
 * `globals.css` dizia que `transform: none` matava a causa; não mata.
 *
 * **A saída é a top layer de verdade: a lista é um `popover`.** Elemento na
 * top layer é posicionado a partir da janela — nenhum ancestral com transform o
 * alcança — e não acrescenta área de rolagem a ancestral nenhum, que era o
 * começo do laço.
 *
 * O portal **continua indo para dentro do `<dialog>`**, e isso é obrigatório:
 * modal nativo torna inerte tudo que está fora dele. Pendurado no `body` o
 * `popover` até aparece, mas não recebe clique — o teste mostrou o `<dialog>`
 * interceptando o ponteiro em cima da opção. Quem conserta a posição é o
 * `popover`, não o destino.
 *
 * Onde `showPopover` não existir, sobra o comportamento antigo: a lista aparece
 * deslocada, que é menos ruim do que não aparecer.
 */
/** O navegador sabe top layer sem `<dialog>`? Chrome 114+, Safari 17+, Firefox 125+. */
function temPopover(): boolean {
  return typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function'
}

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
    /*
     * O destino continua sendo o `<dialog>` mais próximo, e agora por um motivo
     * diferente do antigo: **modal nativo torna inerte tudo que está fora
     * dele**. Uma lista pendurada no `body` até é pintada, mas não recebe
     * clique — foi o que o teste mostrou, com o `<dialog>` interceptando o
     * ponteiro em cima da opção.
     *
     * O que conserta a posição não é o destino, é o `popover`: elemento na top
     * layer é posicionado a partir da janela, então o transform do modal deixa
     * de alcançá-lo, e ele não acrescenta área de rolagem ao modal.
     */
    setDestino(raiz.current?.closest('dialog') ?? document.body)
    medir()
  }, [aberto, medir])

  /**
   * Entra na top layer assim que a lista existe no DOM.
   *
   * `manual` de propósito: o fechamento por clique fora já é nosso (e sabe
   * distinguir o clique numa opção), e o `auto` do navegador fecharia o
   * `popover` **e** competiria com o `<dialog>` que está aberto por baixo.
   */
  useLayoutEffect(() => {
    const lista = menu.current
    if (!aberto || !lista || !temPopover()) return
    try {
      lista.showPopover()
    } catch {
      // Já estava na top layer, ou o navegador recusou. A lista continua
      // desenhada; no pior caso, atrás do modal — que é o comportamento antigo.
    }
  }, [aberto, caixa, destino])

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
            // `manual`: quem fecha é o nosso `pointerdown`, que sabe a
            // diferença entre clicar fora e clicar numa opção.
            popover={temPopover() ? 'manual' : undefined}
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
