'use client'

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'

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
  /**
   * Pode devolver `{ ok: false, erro }` para o modal mostrar a mensagem em vez
   * de fechar. Sem isso, erro de preenchimento vira o digest opaco do Next e a
   * pessoa perde o que digitou.
   */
  action: (formData: FormData) => void | Promise<void | { ok: boolean; erro?: string }>
  children: ReactNode
  /** O texto do botão que confirma. Nem todo modal cria e abre alguma coisa. */
  rotuloEnviar?: string
  /** `secundario` para quando o modal não é a ação principal da tela. */
  variante?: 'primario' | 'secundario'
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(dados: FormData) {
    setErro(null)
    const r = await action(dados)
    if (r && !r.ok) {
      setErro(r.erro ?? 'não deu certo')
      return
    }
    dialogo.current?.close()
  }

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
          if (evento.target === dialogo.current) {
            setErro(null)
            dialogo.current.close()
          }
        }}
        className="app-dialog m-auto w-[420px] rounded-[18px] border border-white/10 bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <h2 className="text-[17px] font-bold">{titulo}</h2>
        <p className="mt-1 mb-5 text-[12.5px] leading-6 text-muted">{descricao}</p>
        <form action={enviar} className="space-y-3.5">
          {children}
          {erro && (
            <p className="rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-rose-200">
              {erro}
            </p>
          )}
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setErro(null)
                dialogo.current?.close()
              }}
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
