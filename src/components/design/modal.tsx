'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * O modal **controlado** — o irmão de `ModalFormulario`.
 *
 * `ModalFormulario` embrulha um `<form>` com Server Action e cuida do botão que
 * o abre; serve para "criar coisa com dois campos". Este aqui recebe `aberto` de
 * fora e não desenha botão nenhum, porque há casos em que quem abre não é um
 * botão de barra: um item dentro de um menu, uma coluna do quadro, uma ação que
 * precisa carregar dados antes de mostrar.
 *
 * Dois eram um só até esta tela: tentar fazer `ModalFormulario` servir aos dois
 * casos deixaria ele com metade das props opcionais e a outra metade
 * incompatível entre si.
 *
 * O `<dialog>` nativo é o ponto: ele traz foco preso, `Esc` para fechar e a
 * camada de topo do navegador de graça. Uma `div` com `position: fixed` teria
 * que reimplementar as três, e a terceira é a que quebra em cima de um quadro
 * com rolagem própria.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = 420,
  children,
}: {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  /** Em pixels. O padrão serve a um formulário curto. */
  largura?: number
  children: ReactNode
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (!elemento) return

    // `showModal()` estoura se já estiver aberto, e `close()` se já estiver
    // fechado — daí as duas guardas em vez de chamar direto.
    if (aberto && !elemento.open) elemento.showModal()
    if (!aberto && elemento.open) elemento.close()
  }, [aberto])

  return (
    <dialog
      ref={dialogo}
      aria-label={titulo}
      // `Esc` dispara `close` sem passar por clique nenhum: sem isto o estado de
      // fora continuaria dizendo "aberto" e o modal não abriria de novo.
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) aoFechar()
      }}
      style={{ width: `min(${largura}px, 92vw)` }}
      className="app-dialog m-auto rounded-[18px] border border-white/10 bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
    >
      <h2 className="text-[17px] font-bold">{titulo}</h2>
      {descricao && <p className="mt-1 text-[12.5px] leading-6 text-muted">{descricao}</p>}
      <div className="mt-5">{children}</div>
    </dialog>
  )
}
