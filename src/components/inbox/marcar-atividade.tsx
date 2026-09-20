'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from '@/components/design/dropdown'
import { NOME_DO_TIPO, TIPOS_DE_ATIVIDADE, type TipoDeAtividade } from '@/core/atividades'
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
 * Aqui o contato já é sabido, que é justamente o que a tela de Atividades não
 * tem: lá seria preciso procurar a pessoa antes de escrever o que fazer.
 *
 * ---------------------------------------------------------------------------
 * Isto **não** manda mensagem, e a tela precisa dizer isso
 * ---------------------------------------------------------------------------
 *
 * É a RB-33, e ela vale mais em `core/atividades.ts`, onde não existe nenhuma
 * função que produza mensagem. Mas este painel fica ao lado de "Agendar
 * mensagem", que manda texto ao cliente na hora marcada, e dois ícones vizinhos
 * com resultados opostos é como alguém marca um querendo o outro. Daí o aviso
 * escrito no rodapé do painel, e não só no nome.
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
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoDeAtividade>('tarefa')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function criar() {
    const limpo = titulo.trim()
    if (limpo === '') return
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarAtividade(clienteId, {
        contatoId,
        tipo,
        titulo: limpo,
        prazo,
      })
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para marcar')
        return
      }
      setTitulo('')
      setPrazo('')
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
      className="flex flex-col gap-2"
    >
      <p className="text-[11px] font-bold text-soft">Marcar atividade</p>

      <input
        autoFocus
        value={titulo}
        onChange={(evento) => setTitulo(evento.target.value)}
        placeholder="o que precisa ser feito"
        aria-label="O que precisa ser feito"
        className="app-field w-full px-3 py-2.5 text-[12.5px]"
      />

      <div className="flex gap-2">
        <span className="flex-1">
          <Dropdown
            valor={tipo}
            aoMudar={(novo) => setTipo(novo as TipoDeAtividade)}
            rotuloAcessivel="Tipo da atividade"
            className="w-full text-[12px]"
            opcoes={TIPOS_DE_ATIVIDADE.map((t) => ({ valor: t, rotulo: NOME_DO_TIPO[t] }))}
          />
        </span>
        <input
          type="date"
          value={prazo}
          onChange={(evento) => setPrazo(evento.target.value)}
          aria-label="Prazo"
          className="app-field flex-1 px-2 py-2 text-[12px]"
        />
      </div>

      {erro && (
        <span role="alert" className="text-[11px] font-semibold text-perigo">
          {erro}
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] leading-4 text-dim">
          Sem data é <strong>algum dia</strong>.
        </span>
        <button
          type="submit"
          disabled={rodando || titulo.trim() === ''}
          className="app-primary-button px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          {rodando ? 'Marcando…' : 'Marcar'}
        </button>
      </div>

      {/*
        O aviso fica aqui, e não só no nome do botão: o vizinho desta ação na
        barra é "Agendar mensagem", que manda texto ao cliente.
      */}
      <p className="border-t border-line pt-2 text-[10.5px] leading-4 text-dim">
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
