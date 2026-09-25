/**
 * As logos das marcas com que o produto conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que logo, e não mais um ícone de traço
 * ---------------------------------------------------------------------------
 *
 * Numa tela de integrações, a logo **é** o rótulo: reconhecer o WhatsApp pelo
 * verde é mais rápido do que ler a palavra, e é o que faz a tela parecer um
 * catálogo em vez de uma lista de configurações. É a coisa mais valiosa da
 * referência que o dono trouxe, e a mais barata de acertar.
 *
 * ---------------------------------------------------------------------------
 * Desenhadas aqui, e de propósito
 * ---------------------------------------------------------------------------
 *
 * Nada é baixado de CDN de terceiro: uma tela de configurações que depende do
 * servidor de outra empresa para desenhar quatro ícones é uma tela que quebra
 * quando aquele servidor cai, e que conta para fora quem abriu a página. São
 * formas simplificadas, reconhecíveis pela silhueta, e o uso é nominativo ,
 * identificar a integração, que é exatamente para o que a marca serve aqui.
 *
 * A cor vem de `globals.css` (`--marca-*`), nunca escrita neste arquivo.
 */

function Moldura({
  children,
  classe,
}: {
  children: React.ReactNode
  classe: string
}) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line bg-surface ${classe}`}
    >
      {children}
    </span>
  )
}

export function LogoWhatsApp() {
  return (
    <Moldura classe="text-marca-whatsapp">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.2-4.3-3.9-4.4-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.8-2.1c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.4l.8 2c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.2.6 1 1.3 1.7.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" />
      </svg>
    </Moldura>
  )
}

export function LogoInstagram() {
  return (
    <Moldura classe="text-marca-instagram">
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    </Moldura>
  )
}

/** A Meta, usada para Anúncios (Lead Ads), que é conta de anúncios e páginas. */
export function LogoMeta() {
  return (
    <Moldura classe="text-marca-meta">
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M2.8 14.8c0-3.9 2-7.6 4.3-7.6 1.3 0 2.3 1 3.6 2.9l1.3 2" />
        <path d="M21.2 14.8c0-3.9-2-7.6-4.3-7.6-1.3 0-2.3 1-3.6 2.9l-1.3 2" />
        <path d="M2.8 14.8c0 1.5.8 2.4 2 2.4 1.6 0 2.8-1.2 5-4.8" />
        <path d="M21.2 14.8c0 1.5-.8 2.4-2 2.4-1.6 0-2.8-1.2-5-4.8" />
      </svg>
    </Moldura>
  )
}

export function LogoTelegram() {
  return (
    <Moldura classe="text-marca-telegram">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21.7 4.3 2.9 11.5c-.9.3-.9 1.5.1 1.7l4.7 1.2 1.8 5.3c.2.6 1 .8 1.4.3l2.4-2.5 4.7 3.4c.6.4 1.4.1 1.5-.6l2.8-14.9c.2-.8-.6-1.4-1.6-1.1ZM9.4 14.2l9.1-6.4-7.8 7.5-.3 3.1-1-4.2Z" />
      </svg>
    </Moldura>
  )
}

/**
 * O chat do site. Não é marca de ninguém: uma janela de navegador com o balão
 * de conversa, que é exatamente o que o visitante vê. A cor é a do canal em
 * `core/canais.ts`, escrita aqui porque não há `--marca-site` (o site é do
 * lojista, não de uma rede).
 */
export function LogoSite() {
  return (
    <Moldura classe="text-[#6366F1]">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
        <path d="M2.5 7.5h19" />
        <path d="M9 11.2h6.5a1.3 1.3 0 0 1 1.3 1.3v1.9a1.3 1.3 0 0 1-1.3 1.3H12l-2.3 1.8v-1.8H9a1.3 1.3 0 0 1-1.3-1.3v-1.9A1.3 1.3 0 0 1 9 11.2Z" fill="currentColor" stroke="none" />
        <path d="M8 21h8" />
      </svg>
    </Moldura>
  )
}

/** A chave, não é marca de ninguém: é o que o cliente traz do sistema dele. */
export function LogoChave() {
  return (
    <Moldura classe="text-soft">
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9" />
        <path d="M17.5 12v3" />
        <path d="M20.5 12v2" />
      </svg>
    </Moldura>
  )
}

/** Loja on-line, sem marca: o ícone é da ideia de loja, não de plataforma. */
export function LogoLoja() {
  return (
    <Moldura classe="text-soft">
      <svg
        width="21"
        height="21"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 8h14l-1 12H6L5 8Z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    </Moldura>
  )
}
