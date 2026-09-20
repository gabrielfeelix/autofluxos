'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  FORMATO_DO_TIPO,
  NOME_DO_TIPO,
  TIPOS_DE_ATIVIDADE,
  type TipoDeAtividade,
} from '@/core/atividades'
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
 * ---------------------------------------------------------------------------
 * O tipo vem primeiro, e muda o resto
 * ---------------------------------------------------------------------------
 *
 * O tipo era um dropdown no meio do formulário e **não mudava nada**: escolher
 * "reunião" dava o mesmo campo de "tarefa", e o link da chamada acabava no meio
 * do título ou em lugar nenhum. Um seletor que não altera o que vem depois é
 * decoração, e ainda cobra um clique.
 *
 * Agora ele abre o painel, em cinco botões: a escolha aparece inteira sem abrir
 * nada, e é ela que decide os campos de baixo, lidos de `FORMATO_DO_TIPO`.
 * Reunião pede link, visita pede endereço, ligação e reunião pedem hora.
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
  const [tipo, setTipo] = useState<TipoDeAtividade>('tarefa')
  const [titulo, setTitulo] = useState('')
  const [onde, setOnde] = useState('')
  const [prazo, setPrazo] = useState('')
  const [hora, setHora] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  const formato = FORMATO_DO_TIPO[tipo]

  function criar() {
    const limpo = titulo.trim()
    if (limpo === '') return
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarAtividade(clienteId, {
        contatoId,
        tipo,
        titulo: limpo,
        // O `onde` só viaja quando o tipo o usa: trocar de reunião para tarefa
        // depois de colar um link não deve gravar o link numa tarefa.
        onde: formato.onde ? onde : undefined,
        prazo,
        hora: formato.pedeHora ? hora : undefined,
      })
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
      <p className="text-[11px] font-bold text-soft">Marcar atividade</p>

      {/*
        Os cinco tipos à mostra, e não atrás de um dropdown: são poucos, cabem
        numa linha e a escolha é a primeira decisão. Um dropdown esconderia as
        opções e cobraria um clique a mais para ver o que existe.
      */}
      <div role="radiogroup" aria-label="Tipo da atividade" className="flex flex-wrap gap-1">
        {TIPOS_DE_ATIVIDADE.map((chave) => {
          const escolhido = chave === tipo
          return (
            <button
              key={chave}
              type="button"
              role="radio"
              aria-checked={escolhido}
              onClick={() => setTipo(chave)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold capitalize transition ${
                escolhido
                  ? 'border-primary/40 bg-primary-weak text-primary'
                  : 'border-line text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              {NOME_DO_TIPO[chave]}
            </button>
          )
        })}
      </div>

      <input
        value={titulo}
        onChange={(evento) => setTitulo(evento.target.value)}
        placeholder={formato.placeholder}
        aria-label={formato.placeholder}
        className="app-field w-full px-3 py-2.5 text-[12.5px]"
      />

      {formato.onde && (
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-medium text-muted">{formato.onde.rotulo}</span>
          <input
            value={onde}
            onChange={(evento) => setOnde(evento.target.value)}
            placeholder={formato.onde.placeholder}
            maxLength={500}
            className="app-field w-full px-3 py-2 text-[12px]"
          />
        </label>
      )}

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10.5px] font-medium text-muted">Quando</span>
          <input
            type="date"
            value={prazo}
            onChange={(evento) => setPrazo(evento.target.value)}
            className="app-field w-full px-2 py-2 text-[12px]"
          />
        </label>
        {/*
          A hora só aparece onde ela existe de verdade. Uma proposta vence num
          dia; uma reunião acontece numa hora. Pedir hora para tudo faria todo
          mundo deixar 00:00 e a agenda mentir.
        */}
        {formato.pedeHora && (
          <label className="flex w-[104px] flex-col gap-1">
            <span className="text-[10.5px] font-medium text-muted">Hora</span>
            <input
              type="time"
              value={hora}
              onChange={(evento) => setHora(evento.target.value)}
              disabled={prazo === ''}
              className="app-field w-full px-2 py-2 text-[12px] disabled:opacity-50"
            />
          </label>
        )}
      </div>

      {erro && (
        <span role="alert" className="text-[11px] font-semibold text-perigo">
          {erro}
        </span>
      )}

      <button
        type="submit"
        disabled={rodando || titulo.trim() === ''}
        className="app-primary-button w-full px-3 py-2 text-[12px] disabled:opacity-50"
      >
        {rodando ? 'Marcando…' : 'Marcar'}
      </button>

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
