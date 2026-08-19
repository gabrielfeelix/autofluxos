'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { acaoEntrar, type EstadoLogin } from '@/server/auth-actions'
import { CampoDeSenha } from './campo-de-senha'

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
      <CampoDeSenha
        id="senha"
        placeholder="••••••••"
        aoLado={
          /*
            Era um `<span>`: parecia link, e não fazia nada. Não existe
            recuperação automática porque não existe conta — é uma senha só,
            guardada pelo time. Dizer isso é a resposta honesta, e a tela não
            conta onde ela mora: esta página é pública.
          */
          <button
            type="button"
            aria-expanded={mostrarAjuda}
            onClick={() => setMostrarAjuda((v) => !v)}
            className="text-[11px] text-dim underline-offset-2 transition hover:text-accent hover:underline"
          >
            Esqueci a senha
          </button>
        }
      />

      {mostrarAjuda && (
        <p className="rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-[1.6] text-muted">
          O painel tem <strong className="text-soft">uma senha só</strong>, do time — não existe
          conta por pessoa, então não há como recuperar por e-mail. Peça a quem administra o painel;
          trocar a senha derruba as sessões abertas.
        </p>
      )}

      {estado.erro && (
        <div role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3">
          <p className="text-[12.5px] leading-5 text-rose-300">{estado.erro}</p>
          {/*
            A saída fica **onde o erro está**, e não só no rodapé.
            Esta porta é a senha única do time; quem tem conta própria digita a
            senha dela aqui e recebe exatamente esta mensagem, que é verdadeira
            e inútil — a senha está certa, a porta é que é outra. Repetir o
            caminho aqui não conta nada que o rodapé já não conte.
          */}
          <p className="mt-1.5 text-[11.5px] leading-5 text-muted">
            Tem conta própria no AutoFluxos? A senha dela não abre esta porta —{' '}
            <Link href="/entrar" className="underline underline-offset-2 transition hover:text-accent">
              entre com e-mail e senha
            </Link>
            .
          </p>
        </div>
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
