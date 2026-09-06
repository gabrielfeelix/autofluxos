'use client'

import { useState } from 'react'
import { rotuloDoCampo } from '@/core/contatos/rotulo-do-campo'

/**
 * O que o fluxo coletou, no painel direito do Inbox.
 *
 * **A queixa que gerou este componente:** *"muita informação técnica na
 * direita, código, número esquisito, e eu nunca vou usar aquilo"*. Eram duas
 * causas na mesma tela: a chave da variável renderizada crua em `font-mono` —
 * `objetivo_aluno`, que é identificador de desenho de fluxo — e a lista sem
 * teto, que num fluxo de 20 perguntas empurra a anotação da equipe para 20
 * blocos abaixo da dobra.
 *
 * O rótulo sai de {@link rotuloDoCampo}. O teto está aqui.
 *
 * **Esconder não apaga**, e é por isso que esta mudança pôde entrar com o
 * revisor da Meta podendo abrir o produto: o dado continua inteiro no
 * componente, a um clique, e continua inteiro na Ficha, que já tem link ao
 * lado do título.
 */

/**
 * Quatro.
 *
 * É quanto cabe acima da dobra do painel sem empurrar a anotação da equipe —
 * que é o campo mais usado da coluna — para fora da tela num monitor de
 * notebook. Número maior devolve o problema; menor faz o botão aparecer em
 * conversa que não tinha excesso nenhum.
 */
export const TETO_DE_CAMPOS_VISIVEIS = 4

/**
 * O que a lista mostra e o que o botão diz, sem React no meio.
 *
 * Está separado do componente porque é a parte que erra em silêncio — cortar
 * um campo a mais, dizer "1 campos", ou oferecer o botão numa conversa que
 * cabia inteira. Não há testing-library neste repositório; função pura é o que
 * torna essas três coisas prováveis por `npm test`.
 */
export function recorteDosCampos(campos: [string, string][], aberto: boolean) {
  const escondidos = Math.max(0, campos.length - TETO_DE_CAMPOS_VISIVEIS)
  return {
    visiveis: aberto ? campos : campos.slice(0, TETO_DE_CAMPOS_VISIVEIS),
    escondidos,
    rotuloDoBotao: aberto
      ? 'Ver menos'
      : `Ver mais ${escondidos} ${escondidos === 1 ? 'campo' : 'campos'}`,
  }
}

export function CamposColetados({ campos }: { campos: [string, string][] }) {
  const [aberto, setAberto] = useState(false)

  if (campos.length === 0) {
    return (
      <p className="mt-2 text-[11px] leading-5 text-dim">
        Ainda não houve campo preenchido nesta conversa.
      </p>
    )
  }

  const { visiveis, escondidos, rotuloDoBotao } = recorteDosCampos(campos, aberto)

  return (
    <>
      <dl className="mt-2.5 divide-y divide-white/[0.045] border-y border-white/[0.045]">
        {visiveis.map(([chave, valor]) => (
          <div key={chave} className="py-2.5">
            {/*
              O rótulo, não a chave, e sem `font-mono`: a fonte de código é
              metade do que fazia a coluna parecer painel de sistema.
            */}
            <dt className="text-[10px] font-semibold tracking-[0.01em] text-dim">
              {rotuloDoCampo(chave) || chave}
            </dt>
            <dd className="mt-0.5 break-words text-[11.5px] font-semibold text-soft">{valor}</dd>
          </div>
        ))}
      </dl>
      {escondidos > 0 && (
        <button
          type="button"
          onClick={() => setAberto((estava) => !estava)}
          className="mt-2 text-[10.5px] font-semibold text-accent transition hover:underline"
        >
          {rotuloDoBotao}
        </button>
      )}
    </>
  )
}
