'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '@/components/design/avatar'
import { BotaoDeTema } from '@/components/design/tema'
import { usePerfil } from '@/components/conta/voce'

type Item = {
  chave: string
  rotulo: string
  href: string
  icone: ReactNode
  acesa?: boolean
  contador?: ReactNode
}

/**
 * O celular com cara de aplicativo: saudação e menu no topo, cinco atalhos
 * embaixo, o Inbox no meio.
 *
 * A ordem foi pedida pelo dono: Painel, Contatos, **Inbox** (o botão de
 * destaque, no centro, onde o polegar alcança sem esticar), Atividades e Funil.
 * O resto (Automações, Transmissões, Relatórios, Configurações) mora na gaveta
 * do menu, porque é trabalho de montar, e não de atender o dia inteiro.
 *
 * Quando a pessoa não pode ver um dos cinco, ou o funil está desligado, o lugar
 * vai para o próximo da gaveta. Barra com buraco parece quebrada.
 */
const ORDEM_DE_BAIXO = ['inicio', 'leads', 'inbox', 'atividades', 'quadros']
const RESERVAS = ['fluxos', 'relatorios', 'transmissoes', 'ajustes']
const ROTULO_CURTO: Record<string, string> = {
  inicio: 'Painel',
  quadros: 'Funil',
}

export function itensDeBaixo<T extends { chave: string }>(itens: T[]): T[] {
  const visiveis = new Map(itens.map((item) => [item.chave, item]))
  const escolhidas = ORDEM_DE_BAIXO.filter((chave) => visiveis.has(chave))
  for (const chave of RESERVAS) {
    if (escolhidas.length >= 5) break
    if (visiveis.has(chave)) escolhidas.push(chave)
  }
  return escolhidas.map((chave) => visiveis.get(chave)!)
}

export function BarraDoCelular({
  base,
  itens,
  contaNoTopo,
  voltarHref,
  presenca,
  carregando,
  aoAbrirVoce,
}: {
  base?: string
  itens: Item[]
  contaNoTopo?: ReactNode
  voltarHref?: string
  presenca?: string
  carregando: boolean
  aoAbrirVoce: () => void
}) {
  const gaveta = useRef<HTMLDialogElement>(null)
  const caminho = usePathname()
  const perfil = usePerfil()
  const embaixo = itensDeBaixo(itens)
  const naGaveta = itens.filter((item) => !embaixo.includes(item))
  const esperando = useConversasEsperando(carregando ? undefined : base)
  const primeiroNome = perfil?.nome.trim().split(/\s+/)[0]
  const disponivel = presenca === 'disponivel'

  // A barra mora no layout e não desmonta na navegação: sem isto, a gaveta
  // continuaria aberta por cima da tela que a pessoa acabou de escolher nela.
  useEffect(() => {
    gaveta.current?.close()
    // Fora do Inbox, a próxima entrada nele volta a decidir entre lista e
    // conversa do zero (ver `MolduraDoInbox`).
    if (!base || !caminho.startsWith(`${base}/inbox`)) document.documentElement.removeAttribute('data-inbox-celular')
  }, [caminho, base])

  const link = (item: Item, classe: string, conteudo: ReactNode) => (
    <Link
      key={item.chave}
      href={item.href}
      aria-current={item.acesa ? 'page' : undefined}
      aria-disabled={carregando || undefined}
      tabIndex={carregando ? -1 : undefined}
      onClick={(evento) => {
        if (carregando) evento.preventDefault()
      }}
      className={classe}
    >
      {conteudo}
    </Link>
  )

  return (
    <>
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur md:hidden">
        <button
          type="button"
          disabled={carregando}
          onClick={aoAbrirVoce}
          aria-label={`Você: ${perfil?.nome ?? 'perfil'}${presenca ? ` · ${disponivel ? 'Disponível' : 'Ausente'}` : ''}`}
          className="flex min-w-0 items-center gap-2.5 rounded-xl text-left"
        >
          <span className="relative shrink-0">
            {perfil ? (
              <Avatar nome={perfil.nome} imagem={perfil.imagem} tamanho={38} />
            ) : (
              <span className="app-esqueleto block size-[38px] rounded-full" />
            )}
            {presenca && (
              <span
                className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-panel ${disponivel ? 'bg-emerald-500' : 'bg-dim'}`}
              />
            )}
          </span>
          <span className="min-w-0">
            {primeiroNome ? (
              <span className="block truncate text-[16px] font-bold tracking-[-0.01em]">Olá, {primeiroNome}</span>
            ) : (
              <span className="app-esqueleto block h-4 w-28 rounded" />
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => gaveta.current?.showModal()}
          aria-label="Abrir o menu"
          aria-haspopup="dialog"
          className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-surface"
        >
          <svg
            aria-hidden
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      <dialog
        ref={gaveta}
        aria-label="Menu"
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) gaveta.current?.close()
        }}
        className="app-gaveta fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[calc(100%-56px)] max-w-[380px] bg-panel p-0 text-ink shadow-xl backdrop:bg-black/40 md:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">{contaNoTopo}</div>
            <button
              type="button"
              aria-label="Fechar o menu"
              onClick={() => gaveta.current?.close()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface"
            >
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <nav aria-label="Mais seções" className="flex-1 overflow-y-auto px-3 py-3">
            {voltarHref && (
              <Link
                href={voltarHref}
                className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-dim hover:bg-surface"
              >
                <span aria-hidden>‹</span> Todos os clientes
              </Link>
            )}
            {naGaveta.map((item) =>
              link(
                item,
                `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold [&_svg]:size-[19px] ${item.acesa ? 'bg-primary-weak text-primary' : 'text-ink hover:bg-surface'}`,
                <>
                  <span aria-hidden className={item.acesa ? 'text-primary' : 'text-dim'}>
                    {item.icone}
                  </span>
                  <span className="flex-1">{item.rotulo}</span>
                  {item.contador}
                </>,
              ),
            )}
          </nav>

          <div className="border-t border-line px-3 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={carregando}
              onClick={() => {
                gaveta.current?.close()
                aoAbrirVoce()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface"
            >
              {perfil && <Avatar nome={perfil.nome} imagem={perfil.imagem} tamanho={32} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{perfil?.nome ?? 'Você'}</span>
                <span className="block text-[11.5px] text-dim">
                  {presenca ? (disponivel ? 'Disponível' : 'Ausente') : 'Perfil e preferências'}
                </span>
              </span>
              <span aria-hidden className="text-dim">
                ›
              </span>
            </button>
            <div className="mt-1 px-1.5">
              <BotaoDeTema />
            </div>
          </div>
        </div>
      </dialog>

      {/*
        Com uma conversa aberta no Inbox, a barra de baixo sai: o campo de
        escrever fica no lugar dela, como no WhatsApp. Quem decide é o CSS
        (`.app-barra-de-baixo` em `globals.css`), pelo atributo que a moldura
        do Inbox põe no `<html>`.
      */}
      <nav
        aria-label="Seções do cliente"
        className="app-barra-de-baixo fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-[520px] grid-cols-5 grid-rows-[4rem]">
          {embaixo.map((item, posicao) =>
            posicao === 2 && item.chave === 'inbox'
              ? link(
                  item,
                  'group relative flex h-full flex-col items-center justify-end gap-1 pb-2',
                  <>
                    <span
                      className={`relative flex size-[58px] shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_24px_-6px_var(--primary)] ring-[5px] ring-canvas transition group-active:scale-95 ${item.acesa ? '' : 'opacity-95'}`}
                    >
                      <IconeDeMensagem />
                      {esperando > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-perigo px-1 text-[11px] font-bold text-white ring-2 ring-panel">
                          {esperando > 99 ? '99+' : esperando}
                        </span>
                      )}
                    </span>
                    <span className={`text-[10.5px] font-semibold ${item.acesa ? 'text-primary' : 'text-muted'}`}>
                      {item.rotulo}
                    </span>
                  </>,
                )
              : link(
                  item,
                  `relative flex h-full flex-col items-center justify-end gap-1 pb-2 [&_svg]:size-[21px] ${item.acesa ? 'text-primary' : 'text-muted'}`,
                  <>
                    <span aria-hidden className="relative">
                      {item.icone}
                      {item.contador && <span className="absolute -top-2 left-3 [&>*]:scale-90">{item.contador}</span>}
                    </span>
                    <span className="text-[10.5px] font-semibold">{ROTULO_CURTO[item.chave] ?? item.rotulo}</span>
                  </>,
                ),
          )}
        </div>
      </nav>
    </>
  )
}

/** Balão de conversa com três pontos: o Inbox, sem precisar de rótulo. */
function IconeDeMensagem() {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12.5c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5-3.6 7.5-8 7.5c-1.2 0-2.4-.2-3.4-.7L4.5 20.5l1.1-3.6A7 7 0 0 1 4 12.5Z" />
      <path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01" strokeWidth="2.6" />
    </svg>
  )
}

/**
 * Quantas conversas esperam alguém da equipe, para o número no botão do Inbox.
 *
 * É a mesma consulta do aviso da fila (`NotificacoesDaFila`), no mesmo ritmo
 * de 30 segundos. Falhou, fica o último número: a barra não é lugar de erro.
 */
function useConversasEsperando(base: string | undefined): number {
  const [quantas, setQuantas] = useState(0)
  useEffect(() => {
    if (!base) return
    let ativo = true
    const consultar = async () => {
      try {
        const resposta = await fetch(`/api${base}/inbox/alertas`, {
          cache: 'no-store',
        })
        if (!resposta.ok) return
        const corpo = (await resposta.json()) as { alertas?: unknown[] }
        if (ativo && Array.isArray(corpo.alertas)) setQuantas(corpo.alertas.length)
      } catch {
        // Sem rede, o número antigo continua.
      }
    }
    void consultar()
    const intervalo = setInterval(consultar, 30_000)
    return () => {
      ativo = false
      clearInterval(intervalo)
    }
  }, [base])
  return quantas
}
