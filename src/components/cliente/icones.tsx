/**
 * Os ícones da tela de boas-vindas.
 *
 * Arquivo próprio porque são usados dos dois lados da fronteira: os atalhos são
 * servidor e o "Como funciona" é cliente. Sem `'use client'` de propósito, são
 * desenho puro, sem estado, então servem aos dois sem obrigar o servidor a
 * mandar JavaScript junto.
 *
 * **Traço e `currentColor`, nunca hex**, a mesma regra das ilustrações de
 * estado vazio. Herdar a cor é o que faz o tema escuro funcionar sem uma segunda
 * cópia de cada desenho, e é o que deixa o ícone acender junto com o cartão no
 * hover.
 *
 * Eles repetem o vocabulário da barra lateral de propósito: o atalho para o
 * Inbox tem o mesmo desenho do item "Inbox" do menu. Dois desenhos para a mesma
 * tela obrigariam a aprender duas vezes onde ela fica.
 */

const TRACO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconeCanal({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...TRACO} d="M4.5 18.5 5.6 15A7 7 0 1 1 9 18.4l-4.5 1.1Z" />
    </svg>
  )
}

export function IconeAutomacao({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect {...TRACO} x="3" y="3.5" width="7" height="5" rx="1.6" />
      <rect {...TRACO} x="14" y="9.5" width="7" height="5" rx="1.6" />
      <rect {...TRACO} x="3" y="15.5" width="7" height="5" rx="1.6" />
      <path {...TRACO} d="M10 6h2a2 2 0 0 1 2 2v2m0 4.5v1.5a2 2 0 0 1-2 2h-2" />
    </svg>
  )
}

export function IconeConversa({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        {...TRACO}
        d="M3.5 6.5A2.5 2.5 0 0 1 6 4h8a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 14 13H8l-4.5 3v-9.5Z"
      />
      <path {...TRACO} d="M18 8.5h.5a2 2 0 0 1 2 2V19l-3-2h-4a2 2 0 0 1-1.6-.8" />
    </svg>
  )
}

export function IconeFunil({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect {...TRACO} x="3.5" y="4" width="5" height="16" rx="1.6" />
      <rect {...TRACO} x="10.5" y="4" width="5" height="11" rx="1.6" />
      <rect {...TRACO} x="17.5" y="4" width="3" height="7" rx="1.4" />
    </svg>
  )
}
