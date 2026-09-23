'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CamposDaAtividade,
  pedidoDosCampos,
  VALORES_VAZIOS,
  type ValoresDaAtividade,
} from '@/components/atividades/campos-da-atividade'
import { acaoCriarAtividade } from '@/server/acoes-atividades'

/**
 * Marcar uma atividade sem sair da conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que no Inbox
 * ---------------------------------------------------------------------------
 *
 * A atividade só nascia na ficha do contato, e o caminho até lá é sair do
 * Inbox, abrir a ficha, achar a aba. Só que a tarefa nasce **durante** a
 * conversa: o cliente diz "me liga terça" enquanto se está respondendo a ele.
 * Uma tarefa que custa três telas para registrar é uma tarefa que não é
 * registrada, e o combinado fica só na cabeça de quem atendeu.
 *
 * Os campos (tipo, título, onde, dia, hora) são `CamposDaAtividade`, os
 * mesmos de "Nova atividade" na agenda: uma regra de criação só.
 *
 * ---------------------------------------------------------------------------
 * Isto **não** manda mensagem, e a tela precisa dizer isso
 * ---------------------------------------------------------------------------
 *
 * É a RB-33, e ela vale mais em `core/atividades.ts`, onde não existe nenhuma
 * função que produza mensagem. Mas este painel fica ao lado de "Agendar
 * mensagem", que manda texto ao cliente na hora marcada, e dois ícones vizinhos
 * com resultados opostos é como alguém marca um querendo o outro.
 *
 * O responsável é quem está marcando: `acaoCriarAtividade` cai na sessão atual
 * quando nenhum é passado. Numa equipe, tarefa sem dono é tarefa que ninguém
 * faz, e quem marca durante a conversa quase sempre é quem vai fazer.
 */
export function MarcarAtividade({
  clienteId,
  contatoId,
  aoFechar,
}: {
  clienteId: string
  contatoId: string
  aoFechar: () => void
}) {
  const router = useRouter()
  const [valores, setValores] = useState<ValoresDaAtividade>(VALORES_VAZIOS)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function criar() {
    if (valores.titulo.trim() === '') return
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarAtividade(clienteId, { contatoId, ...pedidoDosCampos(valores) })
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para marcar')
        return
      }
      router.refresh()
      aoFechar()
    })
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault()
        criar()
      }}
      className="flex flex-col gap-2.5"
    >
      <p className="text-[12px] font-bold text-soft">Marcar atividade</p>

      <CamposDaAtividade valores={valores} aoMudar={setValores} />

      {erro && (
        <span role="alert" className="text-[12px] font-semibold text-perigo">
          {erro}
        </span>
      )}

      <button
        type="submit"
        disabled={rodando || valores.titulo.trim() === ''}
        className="app-primary-button w-full px-3 py-2 text-[12.5px] disabled:opacity-50"
      >
        {rodando ? 'Marcando…' : 'Marcar'}
      </button>

      {/*
        O aviso fica aqui, e não só no nome do botão: o vizinho desta ação na
        barra é "Agendar mensagem", que manda texto ao cliente.
      */}
      <p className="border-t border-line pt-2 text-[11.5px] leading-4 text-dim">
        É um lembrete para a equipe. <strong>Nada é enviado ao cliente.</strong>
      </p>
    </form>
  )
}

/** O tique dentro de um círculo: uma coisa a fazer, não uma mensagem a sair. */
export function IconeAtividade() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
    </svg>
  )
}
