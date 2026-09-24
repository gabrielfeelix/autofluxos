'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useId, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import { abaDoCaminho } from '@/components/design/aba-do-caminho'
import { rotuloDaSecao } from '@/components/design/secoes-do-cliente'
import { acaoTrocarDeCompanhia } from '@/server/acoes-conta'

export type ContaDoSeletor = {
  id: string
  nome: string
  logoUrl: string
  papel: string
  esperando: number
}

/**
 * A conta atual no topo da barra, e a troca para as outras sem sair da tela.
 *
 * Era um link para `/contas`: tela inteira, a pessoa escolhia e caía no Painel
 * da outra empresa, longe de onde estava. Quem atende um grupo de empresas faz
 * isso dezenas de vezes por dia, então a troca virou um menu que **mantém a
 * seção**: do Inbox da Empresa 1 para o Inbox da Empresa 2.
 *
 * Cada conta mostra quantas conversas esperam uma pessoa, e o gatilho ganha um
 * ponto quando alguma **outra** conta tem gente esperando: é o que evita entrar
 * em cada empresa só para conferir.
 *
 * A lista é `popover="auto"`, o que dá de graça o fechar com Esc e com clique
 * fora, e a põe na top layer, acima de qualquer `overflow` da barra. Dentro da
 * gaveta do celular (um `<dialog>` modal) ela continua clicável porque o
 * elemento mora dentro do próprio `<dialog>`.
 */
export function SeletorDeConta({ atual, contas }: { atual: ContaDoSeletor; contas: ContaDoSeletor[] }) {
  const id = useId()
  const gatilho = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const [indo, setIndo] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()
  const caminho = usePathname()

  const outras = contas.filter((conta) => conta.id !== atual.id)
  const secao = abaDoCaminho(caminho, `/clientes/${atual.id}`)
  const esperandoNasOutras = outras.reduce((soma, conta) => soma + conta.esperando, 0)

  // Conta única: nada para trocar, e um botão que abre uma lista de um item é
  // atrito puro. Fica só a identificação.
  if (outras.length === 0) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <LogoDoCliente cliente={atual} tamanho={28} />
        <IdentificacaoDaConta conta={atual} />
      </div>
    )
  }

  function posicionar() {
    const botao = gatilho.current?.getBoundingClientRect()
    const caixa = lista.current
    if (!botao || !caixa) return
    const largura = Math.max(botao.width, 296)
    // Encosta na borda esquerda do botão, sem sair da janela no celular.
    const esquerda = Math.min(botao.left, window.innerWidth - largura - 12)
    caixa.style.left = `${Math.max(12, esquerda)}px`
    caixa.style.top = `${botao.bottom + 6}px`
    caixa.style.width = `${largura}px`
  }

  function trocar(conta: ContaDoSeletor) {
    if (conta.id === atual.id) {
      lista.current?.hidePopover()
      return
    }
    setIndo(conta.id)
    iniciar(async () => {
      await acaoTrocarDeCompanhia(conta.id, secao)
    })
  }

  function navegarPeloTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    const opcoes = Array.from(lista.current?.querySelectorAll<HTMLElement>('[data-opcao]') ?? [])
    const agora = opcoes.indexOf(document.activeElement as HTMLElement)
    const passo = evento.key === 'ArrowDown' ? 1 : -1
    opcoes[(agora + passo + opcoes.length) % opcoes.length]?.focus()
  }

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        popoverTarget={id}
        aria-haspopup="menu"
        title="Trocar de conta"
        className="group flex w-full items-center gap-2.5 rounded-[11px] border border-transparent px-2 py-1.5 text-left transition hover:border-line hover:bg-surface aria-expanded:border-line aria-expanded:bg-surface"
      >
        <span className="relative shrink-0">
          <LogoDoCliente cliente={atual} tamanho={28} />
          {esperandoNasOutras > 0 && (
            <span
              aria-hidden
              className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-panel bg-perigo"
            />
          )}
        </span>
        <IdentificacaoDaConta conta={atual} />
        <IconeTrocar />
        {esperandoNasOutras > 0 && (
          <span className="sr-only">
            {esperandoNasOutras === 1
              ? 'Uma conversa esperando em outra conta'
              : `${esperandoNasOutras} conversas esperando em outras contas`}
          </span>
        )}
      </button>

      <div
        ref={lista}
        id={id}
        popover="auto"
        role="menu"
        aria-label="Trocar de conta"
        onKeyDown={navegarPeloTeclado}
        onToggle={(evento) => {
          if (evento.newState === 'open') {
            posicionar()
            lista.current?.querySelector<HTMLElement>('[data-opcao][aria-current="true"]')?.focus()
          }
        }}
        className="app-seletor-de-conta"
      >
        <div className="flex items-baseline justify-between px-2.5 pt-1.5 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-dim">Suas contas</p>
          {secao && secao !== 'inicio' && (
            <p className="text-[11px] text-dim">
              abre em <span className="font-semibold text-muted">{rotuloDaSecao(secao)}</span>
            </p>
          )}
        </div>

        <ul className="flex max-h-[min(360px,60vh)] flex-col gap-0.5 overflow-y-auto">
          {contas.map((conta) => {
            const eAtual = conta.id === atual.id
            const carregando = pendente && indo === conta.id
            return (
              <li key={conta.id}>
                <button
                  type="button"
                  role="menuitem"
                  data-opcao
                  aria-current={eAtual ? 'true' : undefined}
                  disabled={pendente}
                  onClick={() => trocar(conta)}
                  className={`flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left outline-none transition focus-visible:bg-surface disabled:cursor-wait ${
                    eAtual ? 'bg-primary-weak' : 'hover:bg-surface'
                  } ${pendente && !carregando ? 'opacity-50' : ''}`}
                >
                  <LogoDoCliente cliente={conta} tamanho={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{conta.nome}</span>
                    <span className="block truncate text-[11px] text-dim">{conta.papel}</span>
                  </span>
                  {carregando ? (
                    <span
                      aria-label="Abrindo"
                      className="size-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary"
                    />
                  ) : eAtual ? (
                    <IconeAtual />
                  ) : conta.esperando > 0 ? (
                    <span
                      title={conta.esperando === 1 ? '1 conversa esperando' : `${conta.esperando} conversas esperando`}
                      className="shrink-0 rounded-full bg-perigo/12 px-2 py-0.5 text-[11px] font-bold tabular-nums text-perigo"
                    >
                      {conta.esperando > 99 ? '99+' : conta.esperando}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-1.5 border-t border-line pt-1.5">
          <Link
            href="/contas"
            data-opcao
            className="flex items-center gap-2 rounded-[9px] px-2.5 py-2 text-[12px] font-semibold text-muted outline-none transition hover:bg-surface hover:text-ink focus-visible:bg-surface"
          >
            <IconeGrade />
            Ver todas as contas
          </Link>
        </div>
      </div>
    </>
  )
}

function IdentificacaoDaConta({ conta }: { conta: ContaDoSeletor }) {
  return (
    <span className="min-w-0 flex-1 leading-tight">
      <span className="block truncate text-[12.5px] font-semibold text-ink">{conta.nome}</span>
      <span className="block truncate text-[10.5px] text-dim">{conta.papel}</span>
    </span>
  )
}

function IconeTrocar() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-dim transition group-hover:text-muted"
    >
      <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />
    </svg>
  )
}

function IconeAtual() {
  return (
    <svg
      aria-label="Conta atual"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-primary"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconeGrade() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
