'use client'

import type { ReactNode } from 'react'

/**
 * O que existe, mas quase nunca se mexe , recolhido.
 *
 * **O painel do editor abria com tudo aberto ao mesmo tempo.** Um bloco de
 * Pergunta mostrava nove campos de uma vez: o texto, onde guardar a resposta,
 * de onde vêm as opções, o valor de cada opção, o formato exigido, a mensagem
 * de erro, onde guardar o padronizado, se aceita arquivo e o prazo. Quem monta
 * o primeiro fluxo precisa de três deles. Os outros seis não estavam errados,
 * estavam **na frente**, e a soma deles é a tela que o dono do negócio abre e
 * fecha achando que o produto é para outra pessoa.
 *
 * Recolher não é esconder: o resumo diz que há mais ali, e um clique abre.
 *
 * **Abre sozinha quando tem coisa dentro.** É a regra que impede o pior
 * desfecho: alguém que já configurou o formato da resposta abrir o bloco de
 * novo e não achar onde mexeu. Quem nunca usou vê uma linha fechada; quem usou
 * vê tudo como deixou.
 *
 * `<details>` nativo, e não estado em React: ele traz o teclado, o `Enter` que
 * alterna, o anúncio de "recolhido/expandido" no leitor de tela e a busca do
 * navegador que abre a seção ao achar texto dentro. Reimplementar com `useState`
 * custaria os quatro.
 */
export function SecaoAvancada({
  titulo = 'Opções avançadas',
  resumo,
  temConteudo = false,
  children,
}: {
  titulo?: string
  /** Uma frase curta dizendo o que há lá dentro, para não virar caixa-surpresa. */
  resumo?: string
  /** Algum campo de dentro já está preenchido? Então ela nasce aberta. */
  temConteudo?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={temConteudo}
      className="group rounded-[10px] border border-line bg-surface/40 open:bg-transparent"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[11.5px] font-semibold text-muted transition hover:text-ink [&::-webkit-details-marker]:hidden">
        {/* A seta é do produto: o triângulo do navegador muda de forma entre
            sistemas, e num painel com raio de 10px ele é o único canto reto. */}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className="size-3 shrink-0 text-dim transition-transform group-open:rotate-90"
        >
          <path
            d="M4.5 2.5 8 6l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="min-w-0 flex-1">
          {titulo}
          {resumo && (
            <span className="ml-1.5 font-normal text-dim group-open:hidden">{resumo}</span>
          )}
        </span>
      </summary>

      <div className="space-y-4 border-t border-line px-3 py-3.5">{children}</div>
    </details>
  )
}
