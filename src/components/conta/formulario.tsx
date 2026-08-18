'use client'

import { useActionState } from 'react'
import type { EstadoDeConta } from '@/server/acoes-conta'

const INICIAL: EstadoDeConta = {}

/**
 * O formulário de entrar e o de cadastrar são o mesmo.
 *
 * A diferença entre eles é um campo de nome e o rótulo do botão. Escrever dois
 * componentes por causa disso significa corrigir a devolução do valor digitado,
 * o `aria-live` do erro e o estado pendente duas vezes — e é assim que um dos
 * dois fica para trás.
 */
export function FormularioDeConta({
  action,
  botao,
  pedirNome = false,
  ajuda,
}: {
  action: (estado: EstadoDeConta, formData: FormData) => Promise<EstadoDeConta>
  botao: string
  pedirNome?: boolean
  ajuda?: string
}) {
  const [estado, enviar, pendente] = useActionState(action, INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-3.5">
      {pedirNome && (
        <label>
          <Rotulo>Nome</Rotulo>
          <input
            type="text"
            name="nome"
            required
            autoFocus
            autoComplete="name"
            placeholder="ex.: Eduardo Mutti"
            // O que foi digitado volta depois de um erro. `key` força o React a
            // reconstruir o campo quando o estado muda, senão o valor devolvido
            // pelo servidor não aparece.
            key={estado.nome ?? ''}
            defaultValue={estado.nome ?? ''}
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
      )}

      <label>
        <Rotulo>E-mail</Rotulo>
        <input
          type="email"
          name="email"
          required
          autoFocus={!pedirNome}
          autoComplete="email"
          placeholder="voce@empresa.com.br"
          key={estado.email ?? ''}
          defaultValue={estado.email ?? ''}
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>

      <label>
        <Rotulo>Senha</Rotulo>
        <input
          type="password"
          name="senha"
          required
          minLength={10}
          autoComplete={pedirNome ? 'new-password' : 'current-password'}
          placeholder="••••••••••"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
        {pedirNome && (
          // O mínimo é 10 (`auth.ts`). Dizer isso antes vale mais que recusar
          // depois: o servidor devolve a mensagem da biblioteca, em inglês.
          <span className="mt-1.5 block text-[11px] text-dim">Pelo menos 10 caracteres.</span>
        )}
      </label>

      {estado.erro && (
        <p
          role="alert"
          className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-rose-300"
        >
          {estado.erro}
        </p>
      )}

      <button type="submit" disabled={pendente} className="app-primary-button mt-1 px-4 py-3 text-[13.5px]">
        {pendente ? 'Um instante…' : botao}
      </button>

      {ajuda && <p className="text-[11.5px] leading-[1.6] text-dim">{ajuda}</p>}
    </form>
  )
}

function Rotulo({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">
      {children}
    </span>
  )
}
