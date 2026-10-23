import { GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import type { ReactNode } from 'react'

/**
 * Os ícones dos títulos da ficha.
 *
 * **Um ícone por seção, na cor do que a seção diz.** A ficha era uma pilha de
 * retângulos brancos com um título em negrito cada, todos iguais: para achar
 * "Etiquetas" era preciso ler os seis títulos em ordem. O ícone dá a cada bloco
 * uma forma reconhecível antes da leitura, que é como se acha alguma coisa numa
 * tela já conhecida.
 *
 * Traço, e não preenchimento: é o mesmo desenho dos ícones da barra de ações
 * (`acoes-da-ficha.tsx`) e dos da navegação, e misturar as duas famílias faria
 * a ficha parecer montada com peças de dois produtos.
 *
 * A cor entra só onde ela **significa**: dinheiro em verde, prazo em azul,
 * etiqueta na cor da etiqueta. Um ícone colorido por decoração vira ruído, e
 * seis ícones coloridos viram um arco-íris que esconde o que era urgente.
 */
export function IconeDaSecao({
  children,
  tom = 'neutro',
}: {
  children: ReactNode
  tom?: 'neutro' | 'ok' | 'primary' | 'aviso'
}) {
  const cor =
    tom === 'ok'
      ? 'text-ok'
      : tom === 'primary'
        ? 'text-primary'
        : tom === 'aviso'
          ? 'text-aviso'
          : 'text-dim'

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`size-[15px] shrink-0 ${cor}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** Negociações: o funil. */
export const iconeFunil = (
  <>
    <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />
  </>
)

/** Informações: o cartão de identificação. */
export const iconeFicha = (
  <>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <path d="M7.5 9.5h4M7.5 13h9M7.5 16h6" />
  </>
)

/** Próximos passos: o relógio. */
export const iconeRelogio = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </>
)

/** Já rendeu: a moeda. */
export const iconeDinheiro = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v8.4M14.3 10c0-1-1-1.6-2.3-1.6s-2.3.6-2.3 1.5c0 2.2 4.6 1.2 4.6 3.4 0 1-1 1.6-2.3 1.6s-2.3-.6-2.3-1.6" />
  </>
)

/** Anotação: o lápis. */
export const iconeLapis = (
  <>
    <path d="M4.5 19.5h15" />
    <path d="M6 15.2 15.4 5.8a2 2 0 0 1 2.8 2.8L8.8 18 5 19l1-3.8Z" />
  </>
)

/** Etiquetas: a etiqueta. */
export const iconeEtiqueta = (
  <>
    <path d="M4.5 10.2V5.2a.7.7 0 0 1 .7-.7h5l9 9a1.6 1.6 0 0 1 0 2.3l-4.2 4.2a1.6 1.6 0 0 1-2.3 0l-8-8Z" />
    <circle cx="8.6" cy="8.6" r="1.1" />
  </>
)

/** Histórico: a linha do tempo. */
export const iconeLinhaDoTempo = (
  <>
    <path d="M6 4.5v15" />
    <circle cx="6" cy="8.5" r="1.8" />
    <circle cx="6" cy="15.5" r="1.8" />
    <path d="M10.5 8.5h8M10.5 15.5h5.5" />
  </>
)

/** Dados e origem: o formulário. */
export const iconeFormulario = (
  <>
    <path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
    <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" />
  </>
)

/** Jornada de anúncios: o alvo. */
export const iconeAlvo = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </>
)

/**
 * O WhatsApp.
 *
 * Preenchido, e não em traço, porque este é o **logotipo de um produto que
 * existe** e não um ícone da nossa família: desenhá-lo em traço fino faria dele
 * um símbolo quase irreconhecível. Mesma razão pela qual a bolha da conversa
 * não muda de tema.
 */
export function IconeWhatsApp({ className = 'size-[13px]' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="currentColor">
      <path d={GLIFO_WHATSAPP} />
    </svg>
  )
}

/** Promoções: o megafone, o que a transmissão manda. */
export const iconeMegafone = (
  <>
    <path d="M4.5 10v4a1 1 0 0 0 1 1h2l6.5 4V5L7.5 9h-2a1 1 0 0 0-1 1Z" />
    <path d="M17.5 9.2a4 4 0 0 1 0 5.6" />
    <path d="M9 15.2 10 19.5" />
  </>
)
