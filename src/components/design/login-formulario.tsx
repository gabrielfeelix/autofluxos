'use client'

import { useActionState } from 'react'
import { acaoEntrar, type EstadoLogin } from '@/server/auth-actions'

const estadoInicial: EstadoLogin = {}

export function LoginFormulario() {
  const [estado, action, pendente] = useActionState(acaoEntrar, estadoInicial)

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <label>
        <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="voce@4yu.studio"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>
      <label>
        <span className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">Senha</span>
          <span className="text-[11px] text-dim">Esqueci a senha</span>
        </span>
        <input
          type="password"
          name="senha"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>

      {estado.erro && (
        <p role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-rose-300">
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="app-primary-button mt-1 px-4 py-3 text-[13.5px]"
      >
        {pendente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
