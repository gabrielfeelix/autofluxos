'use client'

import { useActionState } from 'react'
import { acaoConferirCodigo } from '@/server/acoes-conta'

export function FormularioDeCodigo() {
  const [estado, enviar, pendente] = useActionState(acaoConferirCodigo, {})

  return (
    <form action={enviar} className="flex flex-col gap-3.5">
      <label>
        <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">Código</span>
        <input
          name="codigo"
          required
          autoFocus
          autoComplete="one-time-code"
          maxLength={20}
          placeholder="Exemplo: 123456"
          className="app-field px-[13px] py-[11px] text-center font-mono text-[18px] tracking-[0.3em] placeholder:font-sans placeholder:text-[13.5px] placeholder:tracking-normal"
        />
      </label>

      {estado.erro && (
        <p role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-perigo">
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={pendente} className="app-primary-button mt-1 px-4 py-3 text-[13.5px]">
        {pendente ? 'Conferindo…' : 'Entrar'}
      </button>
    </form>
  )
}
