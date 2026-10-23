import { GLIFO_INSTAGRAM, GLIFO_META, GLIFO_STRIPE, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from './glifos-oficiais'

/**
 * As logos das marcas com que o produto conversa.
 *
 * ---------------------------------------------------------------------------
 * Por que logo, e não mais um ícone de traço
 * ---------------------------------------------------------------------------
 *
 * Numa tela de integrações, a logo **é** o rótulo: reconhecer o WhatsApp pelo
 * verde é mais rápido do que ler a palavra, e é o que faz a tela parecer um
 * catálogo em vez de uma lista de configurações.
 *
 * ---------------------------------------------------------------------------
 * As logos de verdade, nunca redesenhadas
 * ---------------------------------------------------------------------------
 *
 * Toda marca aqui é a oficial: as que têm desenho no Simple Icons saem de
 * `glifos-oficiais.ts` (copiado do material oficial de cada uma), e as outras
 * de `public/logos/marcas/`, baixadas do site ou do GitHub oficial da
 * empresa. Uma versão desenhada à mão parecida com a marca é a marca errada.
 *
 * Tudo mora no nosso servidor, nada de CDN de terceiro: a tela de
 * configurações não pode quebrar quando o servidor de outra empresa cai, nem
 * contar para fora quem abriu a página. O uso é nominativo: identificar a
 * integração, que é exatamente para o que a marca serve aqui.
 */

/**
 * O quadrado de 40px. Marca de terceiro vai em fundo branco nos dois temas: a
 * logo oficial foi feita para fundo claro, e no escuro ela perde a cor. Os
 * ícones nossos (site, chave, loja) seguem o tema.
 */
function Moldura({
  children,
  classe = '',
  marca = false,
}: {
  children: React.ReactNode
  classe?: string
  marca?: boolean
}) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-line ${marca ? 'bg-white' : 'bg-surface'} ${classe}`}
    >
      {children}
    </span>
  )
}

/** Um desenho oficial de 24x24, na cor oficial da marca. */
function Glifo({ d, cor, tamanho = 24 }: { d: string; cor: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={cor} aria-hidden>
      <path d={d} />
    </svg>
  )
}

/** A logo oficial em arquivo, de `public/logos/marcas/`. */
function Arquivo({ nome, largura = 28, altura = 28 }: { nome: string; largura?: number; altura?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/logos/marcas/${nome}`} alt="" width={largura} height={altura} className="object-contain" draggable={false} />
  )
}

export function LogoWhatsApp() {
  return (
    <Moldura marca>
      <Glifo d={GLIFO_WHATSAPP} cor="#25D366" />
    </Moldura>
  )
}

/** O glifo do Instagram com o degradê oficial (Meta Brand Resources). */
export function LogoInstagram() {
  return (
    <Moldura marca>
      <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <radialGradient id="degrade-instagram" cx="30%" cy="107%" r="150%">
            <stop offset="0" stopColor="#FFD600" />
            <stop offset="0.25" stopColor="#FF7A00" />
            <stop offset="0.5" stopColor="#FF0069" />
            <stop offset="0.75" stopColor="#D300C5" />
            <stop offset="1" stopColor="#7638FA" />
          </radialGradient>
        </defs>
        <path d={GLIFO_INSTAGRAM} fill="url(#degrade-instagram)" />
      </svg>
    </Moldura>
  )
}

/** A Meta, usada para Anúncios (Lead Ads), que é conta de anúncios e páginas. */
export function LogoMeta() {
  return (
    <Moldura marca>
      <Glifo d={GLIFO_META} cor="#0467DF" tamanho={26} />
    </Moldura>
  )
}

export function LogoTelegram() {
  return (
    <Moldura marca>
      <Glifo d={GLIFO_TELEGRAM} cor="#26A5E4" />
    </Moldura>
  )
}

/** O símbolo atual do Mercado Pago, o do cabeçalho de mercadopago.com.br. */
export function LogoMercadoPago() {
  return (
    <Moldura marca>
      <Arquivo nome="mercadopago.svg" />
    </Moldura>
  )
}

/** O ícone oficial do Stripe: o "S" branco no quadrado roxo. */
export function LogoStripe() {
  return (
    <Moldura marca>
      <svg width={28} height={28} viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="5.5" fill="#635BFF" />
        <path d={GLIFO_STRIPE} fill="#fff" transform="translate(4.2 4.2) scale(0.65)" />
      </svg>
    </Moldura>
  )
}

export const LogoAsaas = () => (
  <Moldura marca>
    <Arquivo nome="asaas.png" />
  </Moldura>
)
export const LogoInfinitePay = () => (
  <Moldura marca>
    <Arquivo nome="infinitepay.svg" />
  </Moldura>
)
export const LogoPagBank = () => (
  <Moldura marca>
    <Arquivo nome="pagbank.png" />
  </Moldura>
)
export const LogoWoovi = () => (
  <Moldura marca>
    <Arquivo nome="woovi.png" />
  </Moldura>
)
export const LogoPagHiper = () => (
  <Moldura marca>
    <Arquivo nome="paghiper.png" largura={26} altura={26} />
  </Moldura>
)
/** A Efí não tem símbolo sem a palavra: é o "efí" laranja da marca, sem o "BANK". */
export const LogoEfi = () => (
  <Moldura marca>
    <Arquivo nome="efi.svg" largura={30} altura={19} />
  </Moldura>
)
export const LogoIugu = () => (
  <Moldura marca>
    <Arquivo nome="iugu.svg" largura={24} altura={24} />
  </Moldura>
)
export const LogoPagarme = () => (
  <Moldura marca>
    <Arquivo nome="pagarme.png" largura={26} altura={26} />
  </Moldura>
)

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

/** A agenda: o calendário, no traço dos outros logos genéricos. */
export function LogoAgenda() {
  return (
    <Moldura classe="text-primary">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
    </Moldura>
  )
}
