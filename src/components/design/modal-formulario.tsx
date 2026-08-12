'use client'

import type { ReactNode } from 'react'
import { useRef } from 'react'

export function ModalFormulario({
  botao,
  titulo,
  descricao,
  action,
  children,
  rotuloEnviar = 'Criar e abrir',
  variante = 'primario',
}: {
  botao: ReactNode
  titulo: string
  descricao: string
  action: (formData: FormData) => void | Promise<void>
  children: ReactNode
  /** O texto do botão que confirma. Nem todo modal cria e abre alguma coisa. */
  rotuloEnviar?: string
  /** `secundario` para quando o modal não é a ação principal da tela. */
  variante?: 'primario' | 'secundario'
}) {
  const dialogo = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className={
          variante === 'primario'
            ? 'app-primary-button px-[18px] py-2.5 text-[13px]'
            : 'app-secondary-button px-3 py-1.5 text-[11.5px]'
        }
      >
        {botao}
      </button>
      <dialog
        ref={dialogo}
        onClick={(evento) => {
          if (evento.target === dialogo.current) dialogo.current.close()
        }}
        className="app-dialog m-auto w-[420px] rounded-[18px] border border-white/10 bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <h2 className="text-[17px] font-bold">{titulo}</h2>
        <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">{descricao}</p>
        <form action={action} className="space-y-3.5">
          {children}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
            >
              Cancelar
            </button>
            <button type="submit" className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]">
              {rotuloEnviar}
            </button>
          </div>
        </form>
      </dialog>
    </>
  )
}

export function RotuloCampo({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
      {children}
    </span>
  )
}
