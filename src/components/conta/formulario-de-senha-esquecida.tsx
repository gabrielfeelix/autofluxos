'use client'

import { useActionState } from 'react'
import { CampoDeSenha } from '@/components/design/campo-de-senha'
import { acaoPedirRedefinicao, acaoRedefinirSenha, type EstadoDeRedefinicao } from '@/server/acoes-conta'

const INICIAL: EstadoDeRedefinicao = {}

function Erro({ texto }: { texto?: string }) {
  if (!texto) return null
  return (
    <p role="alert" className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-perigo">
      {texto}
    </p>
  )
}

/**
 * Pede o link. Depois de enviar, o formulário vira a confirmação, e a frase é a
 * mesma exista a conta ou não: a tela não pode contar quem tem conta aqui.
 */
export function FormularioDePedido() {
  const [estado, enviar, pendente] = useActionState(acaoPedirRedefinicao, INICIAL)

  if (estado.enviado) {
    return (
      <div role="status" className="flex flex-col gap-2 text-[13.5px] leading-6 text-ink">
        <p>
          Se existir uma conta com <strong>{estado.email}</strong>, o link para criar uma senha nova chega em
          alguns minutos.
        </p>
        <p className="text-[12.5px] text-muted">O link vale por 1 hora. Não chegou? Confira o spam.</p>
      </div>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-3.5">
      <label>
        <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.05em] text-muted uppercase">E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="Exemplo: voce@empresa.com.br"
          key={estado.email ?? ''}
          defaultValue={estado.email ?? ''}
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>
      <Erro texto={estado.erro} />
      <button type="submit" disabled={pendente} className="app-primary-button mt-1 px-4 py-3 text-[13.5px]">
        {pendente ? 'Enviando…' : 'Mandar o link'}
      </button>
    </form>
  )
}

/** A senha nova, duas vezes. O token vem do link e vai escondido no formulário. */
export function FormularioDeRedefinicao({ token }: { token: string }) {
  const [estado, enviar, pendente] = useActionState(acaoRedefinirSenha, INICIAL)

  return (
    <form action={enviar} className="flex flex-col gap-3.5">
      <input type="hidden" name="token" value={token} />
      <CampoDeSenha
        rotulo="Senha nova"
        minimo={10}
        autoFocus
        autoComplete="new-password"
        ajuda={<span className="mt-1.5 block text-[11px] text-dim">Pelo menos 10 caracteres.</span>}
      />
      <CampoDeSenha rotulo="Repita a senha nova" nome="confirmacao" minimo={10} autoComplete="new-password" />
      <Erro texto={estado.erro} />
      <button type="submit" disabled={pendente} className="app-primary-button mt-1 px-4 py-3 text-[13.5px]">
        {pendente ? 'Salvando…' : 'Salvar a senha nova'}
      </button>
    </form>
  )
}
