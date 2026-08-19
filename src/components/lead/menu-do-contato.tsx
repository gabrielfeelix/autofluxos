'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { acaoAlternarAutomacaoDoLead, acaoApagarContatos } from '@/server/acoes'

/**
 * O menu por linha da lista de contatos (o `⋮` do print 8).
 *
 * Existe porque as três coisas que se faz com um contato na lista — abrir,
 * pausar o bot, apagar — não cabem como três botões em cada linha sem a tabela
 * virar uma parede de controles. O menu esconde o que é raro sem escondê-lo
 * atrás de outra tela.
 *
 * Fecha com clique fora e com `Escape`: menu que só fecha clicando no mesmo
 * ponto é o que fica aberto por cima da linha seguinte enquanto a pessoa tenta
 * ler a tabela.
 */
export function MenuDoContato({
  clienteId,
  contatoId,
  nome,
  automacaoAtiva,
  aguardandoPessoa,
}: {
  clienteId: string
  contatoId: string
  nome: string
  automacaoAtiva: boolean
  aguardandoPessoa: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    const foraDaqui = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    const escapou = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', escapou)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', escapou)
    }
  }, [aberto])

  const alternarBot = () => {
    setErro(null)
    comecar(async () => {
      const r = await acaoAlternarAutomacaoDoLead(clienteId, contatoId, !automacaoAtiva)
      if (!r.ok) setErro(r.erro ?? 'não deu para mudar a automação')
      else setAberto(false)
    })
  }

  const apagar = () => {
    setErro(null)
    if (!confirm(`Apagar ${nome}? Some a conversa inteira, e não dá para desfazer.`)) return
    comecar(async () => {
      const r = await acaoApagarContatos(clienteId, [contatoId])
      if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
      else setAberto(false)
    })
  }

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${nome}`}
        onClick={() => setAberto((estava) => !estava)}
        className="rounded-lg px-2 py-1 text-[13px] leading-none text-dim transition hover:bg-white/[0.06] hover:text-soft"
      >
        ⋮
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-[196px] overflow-hidden rounded-[10px] border border-white/[0.1] bg-[#141a23] py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(contatoId)}`}
            className="block px-3 py-2 text-[12px] text-soft transition hover:bg-white/[0.06]"
          >
            Abrir no Inbox
          </Link>
          <Link
            role="menuitem"
            href={`/clientes/${clienteId}/leads/${contatoId}`}
            className="block px-3 py-2 text-[12px] text-soft transition hover:bg-white/[0.06]"
          >
            Ver a ficha
          </Link>

          {/*
            Religar o bot com alguém esperando atendimento é recusado no
            servidor (`alterarAutomacaoDoContato`). Desabilitar aqui evita
            oferecer o que vai ser negado — e o `title` diz por quê, em vez de
            deixar um item cinza sem explicação.
          */}
          <button
            role="menuitem"
            type="button"
            disabled={rodando || (aguardandoPessoa && !automacaoAtiva)}
            title={
              aguardandoPessoa && !automacaoAtiva
                ? 'Conclua o atendimento antes de religar o bot'
                : undefined
            }
            onClick={alternarBot}
            className="block w-full px-3 py-2 text-left text-[12px] text-soft transition hover:bg-white/[0.06] disabled:opacity-40"
          >
            {automacaoAtiva ? 'Pausar o bot' : 'Religar o bot'}
          </button>

          <button
            role="menuitem"
            type="button"
            disabled={rodando}
            onClick={apagar}
            className="block w-full border-t border-white/[0.06] px-3 py-2 text-left text-[12px] text-rose-300 transition hover:bg-rose-400/[0.09] disabled:opacity-40"
          >
            Apagar contato
          </button>

          {erro && (
            <p role="alert" className="px-3 py-2 text-[10.5px] leading-4 text-rose-300">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
