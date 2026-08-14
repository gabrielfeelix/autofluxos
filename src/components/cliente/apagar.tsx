'use client'

import { useRef, useState, useTransition } from 'react'

export type EstragoDaExclusao = {
  leads: number
  fluxos: number
  conexoes: number
  numeros: number
}

/**
 * Apagar o cliente.
 *
 * **Por que digitar o nome e não um `confirm()`.** Este é o único botão do
 * painel que apaga leads, conversas e credenciais de uma vez. Um `confirm()` é
 * um obstáculo de meio segundo — quem clicou sem querer clica em "OK" sem
 * querer também. Digitar o nome obriga a ler qual cliente está prestes a sumir,
 * que é justamente o erro que a confirmação existe para pegar: apagar o cliente
 * certo pelo motivo errado é raro; apagar o cliente errado é o caso comum.
 *
 * Os números aparecem porque "apaga os leads" é abstrato e "apaga 428 leads"
 * faz alguém parar e reler.
 */
export function ApagarCliente({
  nome,
  estrago,
  acao,
}: {
  nome: string
  estrago: EstragoDaExclusao
  acao: () => Promise<{ ok: boolean; erro?: string }>
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, comecar] = useTransition()

  const confere = digitado.trim() === nome.trim()

  function fechar() {
    setDigitado('')
    setErro(null)
    dialogo.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="rounded-lg border border-rose-400/25 px-3.5 py-2 text-[12px] font-semibold text-rose-300 transition hover:bg-rose-400/[0.1]"
      >
        Apagar este cliente
      </button>

      <dialog
        ref={dialogo}
        aria-label={`Apagar o cliente ${nome}`}
        onClick={(evento) => {
          if (evento.target === dialogo.current) fechar()
        }}
        onClose={() => {
          setDigitado('')
          setErro(null)
        }}
        className="app-dialog m-auto w-[440px] rounded-[18px] border border-white/10 bg-panel p-[26px] text-ink shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
      >
        <h2 className="text-[17px] font-bold">Apagar {nome}?</h2>
        <p className="mt-1 text-[12.5px] leading-6 text-muted">
          Isto apaga o cliente e tudo que é dele, de uma vez e sem desfazer:
        </p>

        <ul className="mt-3 space-y-1.5 rounded-[12px] border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3 text-[12.5px] text-rose-100">
          <Item quantidade={estrago.leads} singular="lead" plural="leads" complemento="com as conversas inteiras" />
          <Item quantidade={estrago.fluxos} singular="automação" plural="automações" complemento="e o histórico de versões" />
          <Item quantidade={estrago.conexoes} singular="credencial" plural="credenciais" complemento="guardadas no cofre" />
          <Item quantidade={estrago.numeros} singular="número" plural="números" complemento="desconectados do WhatsApp" />
        </ul>

        <p className="mt-4 text-[12.5px] leading-6 text-muted">
          Para confirmar, digite <strong className="text-ink">{nome}</strong> abaixo.
        </p>

        <input
          type="text"
          value={digitado}
          onChange={(evento) => setDigitado(evento.target.value)}
          aria-label={`Digite ${nome} para confirmar`}
          autoComplete="off"
          className="app-field mt-2 px-3 py-2.5 text-[13px]"
        />

        {erro && (
          <p role="alert" className="mt-3 rounded-[10px] border border-rose-400/25 bg-rose-400/[0.08] px-3 py-2.5 text-[12px] leading-5 text-rose-200">
            {erro}
          </p>
        )}

        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={fechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!confere || apagando}
            onClick={() => {
              setErro(null)
              comecar(async () => {
                const r = await acao()
                if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
              })
            }}
            className="flex-[1.35] rounded-[10px] border border-rose-400/40 bg-rose-400/[0.16] px-4 py-2.5 text-[13px] font-bold text-rose-100 transition hover:bg-rose-400/[0.24] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {apagando ? 'apagando…' : 'Apagar para sempre'}
          </button>
        </div>
      </dialog>
    </>
  )
}

function Item({
  quantidade,
  singular,
  plural,
  complemento,
}: {
  quantidade: number
  singular: string
  plural: string
  complemento: string
}) {
  return (
    <li>
      <strong>{quantidade}</strong> {quantidade === 1 ? singular : plural} {complemento}
    </li>
  )
}
