'use client'

import { useRef, useState } from 'react'

/**
 * O diálogo de cancelar, com motivo obrigatório (RB-28).
 *
 * Uma agenda cheia de canceladas sem explicação não responde a pergunta que
 * alguém faz depois, que é sempre "por que isto não foi feito". O servidor
 * recusa sem motivo; aqui o botão só acende com motivo escrito.
 */
export function DialogoDeCancelar({
  titulo,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string
  aoFechar: () => void
  aoConfirmar: (motivo: string) => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const abriu = useRef(false)
  const [motivo, setMotivo] = useState('')

  return (
    <dialog
      ref={(no) => {
        dialogo.current = no
        // Quem chama monta o diálogo só quando quer abri-lo; fechar desmonta.
        // Uma vez só: sem a trava, uma nova renderização entre fechar e
        // desmontar abriria de novo.
        if (no && !abriu.current) {
          abriu.current = true
          no.showModal()
        }
      }}
      aria-labelledby="titulo-cancelar-atividade"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) dialogo.current?.close()
      }}
      className="app-dialog m-auto w-[420px] max-w-[calc(100vw-32px)] rounded-[18px] border border-line bg-panel p-6 text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          if (motivo.trim() === '') return
          aoConfirmar(motivo.trim())
          dialogo.current?.close()
        }}
      >
        <h2 id="titulo-cancelar-atividade" className="text-[16px] font-bold">
          Cancelar atividade?
        </h2>
        <p className="mt-1 text-[12.5px] leading-6 text-muted">
          <strong className="text-ink">{titulo}</strong> sai da agenda e fica guardada como cancelada. Dá para reabrir
          depois.
        </p>
        <label className="mt-4 block text-[12px] font-semibold text-soft" htmlFor="motivo-do-cancelamento">
          Por que não vai ser feita?
        </label>
        <textarea
          id="motivo-do-cancelamento"
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
          rows={3}
          maxLength={300}
          required
          className="app-field mt-1.5 px-3 py-2.5 text-[12.5px]"
          placeholder="Ex.: cliente desistiu da aula experimental"
        />
        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={() => dialogo.current?.close()} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Voltar
          </button>
          <button
            type="submit"
            disabled={motivo.trim() === ''}
            className="flex-[1.3] rounded-[10px] border border-rose-400/40 bg-rose-400/[0.14] px-4 py-2.5 text-[13px] font-bold text-perigo transition hover:bg-rose-400/[0.22] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancelar atividade
          </button>
        </div>
      </form>
    </dialog>
  )
}
