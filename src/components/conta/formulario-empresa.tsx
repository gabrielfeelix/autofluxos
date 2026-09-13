'use client'

import { useState } from 'react'

/**
 * O formulário do primeiro acesso.
 *
 * Não reusa `FormularioDeConta` porque as duas perguntas não se parecem: lá é
 * credencial (e-mail, senha, `useActionState`), aqui é cadastro de empresa. O
 * que os dois compartilham de verdade é o `Portico` em volta.
 *
 * **Três campos, e só um obrigatório.** A tentação num primeiro acesso é
 * aproveitar que a pessoa está engajada e perguntar tudo — segmento, tamanho de
 * equipe, objetivo. O concorrente direto não pergunta nada disso, e o motivo é
 * bom: dado que ninguém lê depois é atrito cobrado adiantado. O que fica é o que
 * o produto usa — o nome vira a conta, o telefone é como falamos com ela, e o
 * contexto alimenta a IA do chatbot de verdade.
 */
export function FormularioDeEmpresa({
  action,
  telefoneInicial = '',
}: {
  action: (formData: FormData) => Promise<{ ok?: boolean; erro?: string } | void>
  /** Veio da tela de cadastro pela URL — a pessoa já digitou, não pergunte de novo. */
  telefoneInicial?: string
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)

  async function enviar(dados: FormData) {
    setErro(null)
    setPendente(true)
    const r = await action(dados)
    // Sucesso redireciona e nunca chega aqui; só a falha volta com mensagem.
    if (r && r.ok === false) setErro(r.erro ?? 'não deu certo')
    setPendente(false)
  }

  return (
    <form action={enviar} className="flex flex-col gap-3.5">
      <label>
        <Rotulo>Nome da empresa</Rotulo>
        <input
          type="text"
          name="empresa"
          required
          autoFocus
          autoComplete="organization"
          placeholder="ex.: Estúdio MGM Pilates"
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
        <span className="mt-1.5 block text-[11px] text-dim">
          É como ela aparece no painel. Dá para mudar depois.
        </span>
      </label>

      <label>
        <Rotulo>Telefone</Rotulo>
        <input
          type="tel"
          name="telefone"
          autoComplete="tel"
          placeholder="(44) 90000-0000"
          defaultValue={telefoneInicial}
          className="app-field px-[13px] py-[11px] text-[13.5px]"
        />
      </label>

      <label>
        <Rotulo>O que o seu negócio faz</Rotulo>
        <textarea
          name="contexto"
          rows={3}
          placeholder="ex.: estúdio de pilates com aulas em turmas de até 5 alunas, das 6h às 21h"
          className="app-field resize-y px-[13px] py-[11px] text-[13.5px]"
        />
        {/*
          O único campo que pede explicação, porque é o único cujo valor não é
          óbvio: ele não é papelada, é o que faz o bot responder como o negócio
          dela em vez de responder genérico.
        */}
        <span className="mt-1.5 block text-[11px] leading-[1.6] text-dim">
          Opcional, mas ajuda bastante: é com isso que a IA entende o seu negócio na hora de
          responder. Pode escrever solto.
        </span>
      </label>

      {erro && (
        <p
          role="alert"
          className="border-l-2 border-rose-400 py-0.5 pl-3 text-[12.5px] leading-5 text-rose-300"
        >
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="app-primary-button mt-1 px-4 py-3 text-[13.5px]"
      >
        {pendente ? 'Criando…' : 'Criar empresa e continuar'}
      </button>
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
