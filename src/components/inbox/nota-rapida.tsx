'use client'

import { useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'

/**
 * A anotação de quem atende, **sem sair da conversa**.
 *
 * Ela já existia na ficha do contato, a um clique e uma volta daqui — e um
 * clique e uma volta é o suficiente para ninguém anotar nada. O que se perde
 * quando ninguém anota é justamente o que a próxima pessoa precisaria saber:
 * "já ligou duas vezes", "prefere de manhã".
 *
 * Não vai para o WhatsApp e não alimenta automação. É recado entre gente.
 */
export function NotaRapida({
  inicial,
  salvar,
}: {
  inicial: string
  salvar: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
}) {
  const [aberta, setAberta] = useState(inicial.trim() !== '')

  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="mt-2 w-full rounded-[8px] border border-dashed border-white/[0.12] px-2.5 py-2 text-[11px] text-dim transition hover:border-accent/40 hover:text-accent"
      >
        + Anotar
      </button>
    )
  }

  return (
    <div className="mt-2">
      <FormularioSalvar action={salvar} rotulo="Salvar nota">
        <textarea
          name="notas"
          defaultValue={inicial}
          rows={3}
          placeholder="Já ligou duas vezes. Prefere de manhã."
          className="app-field resize-y px-2.5 py-2 text-[11.5px] leading-5"
        />
      </FormularioSalvar>
    </div>
  )
}
