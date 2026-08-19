'use client'

import { useId, useState } from 'react'

/**
 * O campo de senha com "mostrar".
 *
 * Existe porque senha digitada às cegas é onde a tela de entrar mais mente: o
 * erro que volta é "credenciais não conferem", que é a mesma frase para senha
 * errada e para dedo errado — e quem tem uma senha com ponto no fim, acento ou
 * maiúscula no meio não tem como saber em qual dos dois caiu. Ver o que se
 * digitou não é conveniência, é o único jeito de distinguir os dois casos sem
 * tentativa e erro.
 *
 * **Está aqui, e não copiado nas duas telas**, porque são duas: a senha única
 * do time (`/login`) e a conta da pessoa (`/entrar`, `/criar-conta`). Duas
 * cópias divergem, e a que fica para trás é sempre a que menos se usa — que é
 * justamente a que a pessoa acessa sem prática nenhuma.
 *
 * O botão fica **fora** do `<label>` e o rótulo aponta por `htmlFor`. Botão
 * dentro de rótulo é clique ambíguo: ativa o rótulo junto e o nome acessível do
 * campo vira "Senha Mostrar". É a mesma razão que já valia para o "Esqueci a
 * senha" do `/login`.
 */
export function CampoDeSenha({
  id,
  rotulo = 'Senha',
  nome = 'senha',
  autoComplete = 'current-password',
  placeholder = '••••••••••',
  minimo,
  autoFocus,
  aoLado,
  ajuda,
}: {
  id?: string
  rotulo?: string
  nome?: string
  autoComplete?: 'current-password' | 'new-password'
  placeholder?: string
  minimo?: number
  autoFocus?: boolean
  /** O que mais mora na linha do rótulo — hoje, o "Esqueci a senha". */
  aoLado?: React.ReactNode
  /** Linha abaixo do campo, como o aviso do mínimo de caracteres. */
  ajuda?: React.ReactNode
}) {
  const gerado = useId()
  const campoId = id ?? `senha-${gerado}`
  const [visivel, setVisivel] = useState(false)

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label
          htmlFor={campoId}
          className="text-[11px] font-semibold tracking-[0.05em] text-muted uppercase"
        >
          {rotulo}
        </label>
        {aoLado}
      </div>

      <div className="relative">
        <input
          id={campoId}
          // Trocar só o `type` mantém o mesmo nó no DOM, e com ele o que já foi
          // digitado. Renderizar dois campos alternados esvaziaria o valor a
          // cada clique — o oposto do que o botão promete.
          type={visivel ? 'text' : 'password'}
          name={nome}
          required
          minLength={minimo}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          // Espaço para o botão. Sem isto, senha longa passa por baixo dele e
          // fica ilegível justamente quando alguém pediu para ver.
          className="app-field py-[11px] pr-[78px] pl-[13px] text-[13.5px]"
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          // `aria-pressed` e não só o texto: quem usa leitor de tela precisa
          // saber o estado atual, não só o que o clique vai fazer.
          aria-pressed={visivel}
          aria-controls={campoId}
          // O rótulo diz da senha, e não "mostrar" solto — numa tela com dois
          // campos de senha (a de cadastro, um dia) "Mostrar" sozinho não
          // distingue qual.
          aria-label={visivel ? 'Ocultar a senha' : 'Mostrar a senha'}
          // `tabIndex={-1}` de propósito: o caminho de teclado esperado é senha
          // → Entrar. Quem quer ver a senha usa o mouse ou chega pelo leitor de
          // tela, que alcança o botão sem depender do Tab.
          tabIndex={-1}
          className="absolute top-1/2 right-[10px] -translate-y-1/2 rounded-[6px] px-1.5 py-1 text-[10.5px] font-semibold tracking-[0.05em] text-dim uppercase transition hover:text-accent focus-visible:text-accent"
        >
          {visivel ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      {ajuda}
    </div>
  )
}
