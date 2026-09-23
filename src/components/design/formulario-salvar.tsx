'use client'

import { useActionState, useState, type ReactNode } from 'react'

export type EstadoSalvar = { ok?: boolean; erro?: string }

const INICIAL: EstadoSalvar = {}

/**
 * Um formulário que **confirma que salvou**.
 *
 * Existe porque a tela do contexto do negócio salvava em silêncio: o botão
 * piscava, a página recarregava igual, e não havia como saber se gravou. Num
 * campo que é a única fonte de verdade da IA, "será que foi?" é o pior estado
 * possível, a pessoa reescreve, ou pior, acha que escreveu e não escreveu.
 *
 * Confirmar é o mínimo; a confirmação some sozinha na próxima edição, porque
 * aviso que fica pendurado para de ser lido.
 */
export function FormularioSalvar({
  action,
  children,
  rotulo = 'Salvar',
  dica,
}: {
  action: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  children: ReactNode
  rotulo?: string
  dica?: ReactNode
}) {
  const [estado, enviar, pendente] = useActionState(action, INICIAL)
  // "Salvo" fica à vista até a pessoa mexer de novo (S02): sumir sozinho
  // deixava quem olhou para o lado sem saber se gravou, e ficar depois de uma
  // edição nova diria que o que está na tela já foi gravado, e não foi.
  const [mexeuDepois, setMexeuDepois] = useState(false)

  return (
    <form action={enviar} onInput={() => setMexeuDepois(true)} onSubmit={() => setMexeuDepois(false)}>
      {children}
      <div className="mt-3.5 flex items-center gap-3">
        <button disabled={pendente} className="app-primary-button px-[18px] py-2.5 text-[13px] disabled:opacity-60">
          {pendente ? 'Salvando…' : rotulo}
        </button>

        {estado.erro ? (
          <span role="alert" className="text-[12px] font-semibold text-perigo">
            {estado.erro}
          </span>
        ) : estado.ok && !mexeuDepois ? (
          <span role="status" className="flex items-center gap-1.5 text-[12px] font-semibold text-ok">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Salvo
          </span>
        ) : null}

        {dica && <span className="text-[11.5px] text-dim">{dica}</span>}
      </div>
    </form>
  )
}
