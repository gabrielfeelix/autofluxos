'use client'

import { useActionState, useState } from 'react'
import { acaoEntrar, type EstadoLogin } from '@/server/auth-actions'

const estadoInicial: EstadoLogin = {}

export function LoginFormulario() {
  const [estado, action, pendente] = useActionState(acaoEntrar, estadoInicial)
  const [mostrarAjuda, setMostrarAjuda] = useState(false)

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
          // O que foi digitado volta depois de um erro. `key` força o React a
          // reconstruir o campo quando o estado muda, senão o valor devolvido
          // pelo servidor não aparece.
          key={estado.email ?? ''}
          defaultValue={estado.email ?? ''}
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>
      {/*
        O rótulo é `htmlFor` em vez de embrulhar o campo: o botão de ajuda mora
        nesta mesma linha, e botão dentro de `<label>` é clique ambíguo — ele
        ativa o rótulo junto, e o nome acessível do campo vira
        "Senha Esqueci a senha".
      */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="senha" className="text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
            Senha
          </label>
          {/*
            Era um `<span>`: parecia link, e não fazia nada. Não existe
            recuperação automática porque não existe conta — é uma senha só,
            guardada pelo time. Dizer isso é a resposta honesta, e a tela não
            conta onde ela mora: esta página é pública.
          */}
          <button
            type="button"
            aria-expanded={mostrarAjuda}
            onClick={() => setMostrarAjuda((v) => !v)}
            className="text-[11px] text-dim underline-offset-2 transition hover:text-accent hover:underline"
          >
            Esqueci a senha
          </button>
        </div>
        <input
          id="senha"
          type="password"
          name="senha"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </div>

      {mostrarAjuda && (
        <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-[1.6] text-muted">
          O painel tem <strong className="text-soft">uma senha só</strong>, do time — não existe
          conta por pessoa, então não há como recuperar por e-mail. Peça a quem administra o painel;
          trocar a senha derruba as sessões abertas.
        </p>
      )}

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
