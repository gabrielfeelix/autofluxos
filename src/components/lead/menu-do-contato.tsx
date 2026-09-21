'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { acaoAlternarAutomacaoDoLead, acaoApagarContatos } from '@/server/acoes'
import { useConfirmar } from '@/components/design/confirmar'

/**
 * O menu por linha da lista de contatos (o `⋮` do print 8).
 *
 * Existe porque as três coisas que se faz com um contato na lista, abrir,
 * pausar o bot, apagar, não cabem como três botões em cada linha sem a tabela
 * virar uma parede de controles. O menu esconde o que é raro sem escondê-lo
 * atrás de outra tela.
 *
 * Fecha com clique fora e com `Escape`: menu que só fecha clicando no mesmo
 * ponto é o que fica aberto por cima da linha seguinte enquanto a pessoa tenta
 * ler a tabela.
 *
 * **Abre num portal, e não dentro da célula.** Era `absolute` dentro da tabela,
 * e a tabela vive num cartão com `overflow` para rolar de lado: o menu das
 * últimas linhas nascia cortado pela borda do cartão, com metade dos itens
 * fora e uma barra de rolagem aparecendo por causa dele. `position: fixed` num
 * portal no `<body>` tira o menu do contexto de recorte; a posição é medida do
 * botão e vira para cima quando não cabe embaixo.
 */

/** A altura aproximada do menu aberto, para decidir se ele cabe embaixo. */
const ALTURA_DO_MENU = 186

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
  const { confirmar, dialogo } = useConfirmar()
  const [rodando, comecar] = useTransition()
  const raiz = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [caixa, setCaixa] = useState<{ top: number; left: number } | null>(null)

  /*
    A largura do menu é fixa (196px) e ele encosta à direita do botão, que é
    onde ele já ficava. `Math.max(8, …)` impede que ele saia pela esquerda numa
    janela estreita.
  */
  const medir = useCallback(() => {
    const alvo = raiz.current
    if (!alvo) return
    const r = alvo.getBoundingClientRect()
    const cabeAbaixo = window.innerHeight - r.bottom > ALTURA_DO_MENU + 12
    setCaixa({
      top: cabeAbaixo ? r.bottom + 4 : Math.max(8, r.top - ALTURA_DO_MENU - 4),
      left: Math.max(8, r.right - 196),
    })
  }, [])

  useLayoutEffect(() => {
    if (aberto) medir()
  }, [aberto, medir])

  useEffect(() => {
    if (!aberto) return

    const foraDaqui = (evento: MouseEvent) => {
      const alvo = evento.target as Node
      if (!raiz.current?.contains(alvo) && !menu.current?.contains(alvo)) setAberto(false)
    }
    const escapou = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    /*
      Rolou a página ou a tabela, o menu fecha.

      Menu fixo que fica parado enquanto o conteúdo rola é pior que menu
      cortado: ele passa a apontar para a linha errada. `capture` porque quem
      rola aqui costuma ser o cartão da tabela, não a janela.
    */
    const rolou = () => setAberto(false)

    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', escapou)
    window.addEventListener('scroll', rolou, true)
    window.addEventListener('resize', rolou)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', escapou)
      window.removeEventListener('scroll', rolou, true)
      window.removeEventListener('resize', rolou)
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

  const apagar = () =>
    confirmar({
      titulo: `Apagar ${nome}?`,
      descricao: 'Some a conversa inteira, e não dá para desfazer.',
      rotulo: 'Apagar contato',
      aoConfirmar: async () => {
        const r = await acaoApagarContatos(clienteId, [contatoId])
        if (r.ok) setAberto(false)
        return r
      },
    })

  return (
    <div ref={raiz} className="relative">
      {dialogo}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${nome}`}
        onClick={() => setAberto((estava) => !estava)}
        className="rounded-lg px-2 py-1 text-[13px] leading-none text-dim transition hover:bg-surface-strong hover:text-soft"
      >
        ⋮
      </button>

      {aberto && caixa && typeof document !== 'undefined' && createPortal(
        <div
          ref={menu}
          role="menu"
          style={{ top: caixa.top, left: caixa.left }}
          className="fixed z-50 w-[196px] overflow-hidden rounded-[10px] border border-line bg-panel py-1 shadow-xl"
        >
          <Link
            role="menuitem"
            href={`/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(contatoId)}`}
            className="block px-3 py-2 text-[12px] text-soft transition hover:bg-surface-strong"
          >
            Abrir no Inbox
          </Link>
          <Link
            role="menuitem"
            href={`/clientes/${clienteId}/leads/${contatoId}`}
            className="block px-3 py-2 text-[12px] text-soft transition hover:bg-surface-strong"
          >
            Ver a ficha
          </Link>

          {/*
            Religar o bot com alguém esperando atendimento é recusado no
            servidor (`alterarAutomacaoDoContato`). Desabilitar aqui evita
            oferecer o que vai ser negado, e o `title` diz por quê, em vez de
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
            className="block w-full px-3 py-2 text-left text-[12px] text-soft transition hover:bg-surface-strong disabled:opacity-40"
          >
            {automacaoAtiva ? 'Pausar o bot' : 'Religar o bot'}
          </button>

          <button
            role="menuitem"
            type="button"
            disabled={rodando}
            onClick={apagar}
            className="block w-full border-t border-line px-3 py-2 text-left text-[12px] text-perigo transition hover:bg-rose-400/[0.09] disabled:opacity-40"
          >
            Apagar contato
          </button>

          {erro && (
            <p role="alert" className="px-3 py-2 text-[10.5px] leading-4 text-perigo">
              {erro}
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
