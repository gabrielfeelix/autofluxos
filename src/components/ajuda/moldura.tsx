import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Categoria } from './artigos'

/**
 * A moldura da central de ajuda: o cabeçalho em vidro sobre a casca, os ícones
 * das categorias e a faixa de contato do fim.
 *
 * O padrão é o de dentro da conta: fundo azul com os fios, ilhas de vidro
 * claro (branco a 14%, borda a 25%, cantos 16px) para o que fica solto no azul
 * e cartões brancos para o que pede leitura.
 */

export const WHATSAPP_DA_4YU = 'https://wa.me/5544998775978'
export const EMAIL_DA_4YU = 'contato@4yu.com.br'

export function CabecalhoDaAjuda() {
  return (
    <header className="mx-auto w-full max-w-[1200px] px-3 pt-3 md:px-6">
      <div className="flex h-[60px] items-center gap-3 rounded-2xl border border-white/25 bg-white/[0.14] pr-2 pl-4 text-white backdrop-blur-md">
        <Link href="/ajuda" className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white">
            <Image src="/logos/logo-autofluxos-marca.png" alt="" width={22} height={22} />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.01em]">AutoFluxos</span>
          <span aria-hidden className="hidden h-5 w-px bg-white/30 sm:block" />
          <span className="hidden text-[14px] font-medium text-white/85 sm:inline">Central de ajuda</span>
        </Link>
        <Link
          href="/painel"
          className="ml-auto inline-flex h-10 items-center rounded-xl whitespace-nowrap bg-white px-4 text-[13px] font-semibold text-[#1d4ed8] transition hover:bg-white/90"
        >
          Voltar ao painel
        </Link>
      </div>
    </header>
  )
}

/** O fim de toda página: quem não achou fala com a equipe. */
export function FaleComAGente() {
  return (
    <section className="mt-14 flex flex-wrap items-center gap-5 rounded-[22px] bg-primary-weak px-6 py-7 md:px-8">
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-panel text-primary shadow-[0_6px_16px_-10px_rgb(16_32_84/0.5)]"
      >
        <IconeBalao />
      </span>
      <div className="min-w-[240px] flex-1 basis-[300px]">
        <h2 className="text-[18px] font-bold tracking-[-0.015em] text-ink">Não encontrou o que procurava?</h2>
        <p className="mt-1 text-[14px] leading-[1.6] text-muted">
          A equipe da 4YU atende pelo WhatsApp em horário comercial. Para pedidos com print ou
          planilha, escreva para {EMAIL_DA_4YU}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={WHATSAPP_DA_4YU}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-semibold text-primary-ink transition hover:bg-primary-strong"
        >
          <IconeWhatsapp />
          Falar no WhatsApp
        </a>
        <a
          href={`mailto:${EMAIL_DA_4YU}`}
          className="inline-flex h-11 items-center rounded-xl border border-line bg-panel px-5 text-[14px] font-semibold text-primary transition hover:border-primary/45"
        >
          Enviar e-mail
        </a>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ ícones */

function Traco({ children, tamanho = 22 }: { children: ReactNode; tamanho?: number }) {
  return (
    <svg aria-hidden width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const ICONES: Record<Categoria['icone'], () => ReactNode> = {
  fluxo: () => (
    <Traco>
      <rect x="3" y="4" width="7" height="5" rx="1.5" />
      <rect x="14" y="15" width="7" height="5" rx="1.5" />
      <path d="M10 6.5h2.5a2 2 0 0 1 2 2V15" />
    </Traco>
  ),
  conversa: () => (
    <Traco>
      <path d="M4 5h16v11H9l-5 4V5Z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </Traco>
  ),
  agenda: () => (
    <Traco>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </Traco>
  ),
  atendimento: () => (
    <Traco>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
    </Traco>
  ),
}

export function IconeDaCategoria({ icone }: { icone: Categoria['icone'] }) {
  const Icone = ICONES[icone]
  return <Icone />
}

export function IconeArtigo() {
  return (
    <Traco tamanho={18}>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </Traco>
  )
}

export function IconeSeta() {
  return (
    <Traco tamanho={16}>
      <path d="m9 6 6 6-6 6" />
    </Traco>
  )
}

function IconeBalao() {
  return (
    <Traco>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
    </Traco>
  )
}

function IconeWhatsapp() {
  return (
    <Traco tamanho={18}>
      <path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1Z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-.9.8a4 4 0 0 1-2.2-2.2l.8-.9-1-2Z" />
    </Traco>
  )
}
