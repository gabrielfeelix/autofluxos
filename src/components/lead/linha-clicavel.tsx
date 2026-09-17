'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * A linha da lista de contatos inteira abre o contato.
 *
 * Antes só o nome era link, e o dono resumiu bem: *"eu tenho que clicar no nome
 * do contato para entrar nele, não faz sentido. Tem que poder clicar na linha"*.
 * O alvo de clique era um texto de 13px no meio de uma linha larga, e a área
 * que parecia clicável (a linha, que acende no `hover`) não era.
 *
 * **O nome continua sendo um `<link>` de verdade**, e isso não é redundância: é
 * o que mantém "abrir em nova aba", o clique do meio e o teclado funcionando.
 * Uma linha que só navega por `onClick` é invisível para quem usa `Tab` e para
 * quem quer duas conversas abertas lado a lado.
 *
 * ---------------------------------------------------------------------------
 * Por que o clique é filtrado, e não capturado
 * ---------------------------------------------------------------------------
 *
 * A linha tem uma caixa de seleção na ponta esquerda e um menu na direita.
 * Navegar quando a pessoa clica num dos dois seria roubar o clique dela: marcar
 * um contato jogaria a pessoa para dentro do contato, que é exatamente o
 * contrário do que ela pediu.
 *
 * Por isso o `onClick` ignora qualquer clique que tenha nascido dentro de algo
 * interativo, e ignora também clique com modificador (ctrl, cmd, shift) e
 * botão do meio, que são os gestos de "abrir noutro lugar" e pertencem ao
 * `<a>`, não a nós.
 *
 * Seleção de texto também não navega: quem arrastou para copiar um telefone não
 * pediu para sair da lista.
 */
export function LinhaClicavel({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  const router = useRouter()

  return (
    <tr
      className={className}
      onClick={(evento) => {
        if (evento.defaultPrevented) return

        // Ctrl/cmd/shift são "abra noutro lugar", e quem responde por isso é o
        // `<a>` do nome, não esta linha.
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return

        const alvo = evento.target as HTMLElement
        if (alvo.closest('a, button, input, label, select, textarea, [role="button"]')) {
          return
        }

        // Arrastou para copiar: não é clique, é seleção.
        if ((window.getSelection()?.toString() ?? '') !== '') return

        router.push(href)
      }}
    >
      {children}
    </tr>
  )
}
