'use client'

import { useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { telefoneLegivel } from '@/core/contatos/telefone'

type Acao = (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>

/**
 * O nome do contato, e a correção dele.
 *
 * O WhatsApp entrega o nome que a pessoa escolheu para si, e numa lista de
 * atendimento isso vira "Rodrigão comedor delas" onde deveria estar "Rodrigo".
 * A correção mora aqui, a um clique, e **não substitui** o nome do perfil: ele
 * continua visível abaixo, porque é o que identifica a conta do WhatsApp e o
 * que quem atende reconhece na notificação do celular.
 */
export function NomeDoContato({
  nome,
  nomeDoPerfil,
  nomeReal,
  waId,
  salvar,
}: {
  nome: string | null
  nomeDoPerfil: string | null
  nomeReal: string
  waId: string
  salvar: Acao
}) {
  const [editando, setEditando] = useState(false)

  if (editando) {
    return (
      <div className="min-w-0 flex-1">
        <FormularioSalvar
          action={async (estado, formData) => {
            const r = await salvar(estado, formData)
            if (r.ok) setEditando(false)
            return r
          }}
          rotulo="Salvar nome"
          dica="Vazio volta a mostrar o nome do perfil do WhatsApp."
        >
          <input
            name="nome"
            autoFocus
            defaultValue={nomeReal}
            maxLength={120}
            placeholder={nomeDoPerfil ?? 'Nome de verdade'}
            className="app-field px-3 py-2 text-[15px] font-semibold"
          />
        </FormularioSalvar>
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="mt-1.5 text-[11.5px] text-muted transition hover:text-accent"
        >
          cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <h1 className="flex flex-wrap items-center gap-2 text-[21px] font-bold tracking-[-0.02em]">
        <span className="min-w-0 break-words">{nome ?? telefoneLegivel(waId)}</span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-lg border border-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
        >
          {nomeReal === '' ? 'corrigir nome' : 'editar'}
        </button>
      </h1>
      <p className="mt-0.5 font-mono text-[11px] text-dim">
        {telefoneLegivel(waId)}
        {/*
          Só aparece quando os dois divergem. Repetir o mesmo nome duas vezes
          seria ruído; mostrar o do perfil quando ele foi corrigido é o que
          explica por que a notificação do celular diz outra coisa.
        */}
        {nomeReal !== '' && nomeDoPerfil && nomeDoPerfil.trim() !== nomeReal && (
          <span className="ml-2 font-sans text-[11px] text-muted">
            no WhatsApp: “{nomeDoPerfil}”
          </span>
        )}
      </p>
    </div>
  )
}

/**
 * A anotação de quem atende.
 *
 * Fechada por padrão pelo mesmo motivo da ficha do cliente: a tela é visitada
 * muitas vezes para olhar e uma vez para escrever. Quando já existe anotação,
 * ela aparece — nota escondida é nota que ninguém lê.
 */
export function NotasDoContato({
  notas,
  limite,
  salvar,
}: {
  notas: string
  limite: number
  salvar: Acao
}) {
  const [editando, setEditando] = useState(false)

  return (
    <section className="app-card p-4">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[12.5px] font-bold">Anotação</h2>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg border border-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-muted transition hover:border-accent/40 hover:text-accent"
          >
            {notas === '' ? 'anotar' : 'editar'}
          </button>
        )}
      </header>

      {editando ? (
        <>
          <FormularioSalvar
            action={async (estado, formData) => {
              const r = await salvar(estado, formData)
              if (r.ok) setEditando(false)
              return r
            }}
            rotulo="Salvar anotação"
            dica="Fica só aqui — não vai para o WhatsApp nem para nenhuma automação."
          >
            <textarea
              name="notas"
              autoFocus
              rows={4}
              maxLength={limite}
              defaultValue={notas}
              placeholder="Prefere aula de manhã. Já perguntou preço duas vezes."
              className="app-field resize-y px-3 py-2.5 text-[12.5px] leading-5"
            />
          </FormularioSalvar>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="mt-1.5 text-[11.5px] text-muted transition hover:text-accent"
          >
            cancelar
          </button>
        </>
      ) : notas === '' ? (
        <p className="text-[12px] text-dim">
          O que não cabe num campo: preferência de horário, o que já foi combinado.
        </p>
      ) : (
        <p className="text-[12.5px] leading-5 whitespace-pre-wrap text-soft">{notas}</p>
      )}
    </section>
  )
}
