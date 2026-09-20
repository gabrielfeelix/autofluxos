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
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.41a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.16 1.73 2.64 4.19 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  )
}
