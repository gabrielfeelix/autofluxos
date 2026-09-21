'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Dica } from './dica'
import { Modal } from './modal'

/**
 * O "?" ao lado do título de um campo — e o único lugar onde a explicação mora.
 *
 * **A explicação sai de baixo do campo e entra aqui.** Antes, quase todo campo
 * do editor trazia um parágrafo cinza embaixo: o painel ficava duas vezes mais
 * alto do que precisava, o campo seguinte era empurrado para fora da vista, e
 * quem já sabia relia tudo a cada visita. O texto estava certo; o lugar é que
 * não estava.
 *
 * São três camadas, e a ordem importa:
 *
 * - **hover** (e foco pelo teclado) mostra `texto`, uma frase curta — o
 *   suficiente para quem só precisa de um empurrão e não quer parar;
 * - **clique** abre o modal com `detalhes`, a explicação inteira, com exemplo;
 * - **no rodapé do modal**, e só lá, o link para `/ajuda#secao`.
 *
 * O `?` **nunca é link**. Antes ele era um `<a target="_blank">` para a página
 * de Ajuda: sair do desenho no meio de montar um bloco é o oposto de ajudar, e
 * quem clicava perdia o lugar onde estava. Ir para a Ajuda continua sendo
 * possível — mas como escolha de quem já abriu o modal e quis mais, nunca como
 * efeito colateral de um clique de curiosidade.
 *
 * Sem `detalhes`, o modal mostra o próprio `texto`: o clique nunca é um gesto
 * morto, e o link do rodapé continua ao alcance.
 */
export function AjudaDoCampo({
  texto,
  detalhes,
  secao,
  titulo,
  alinhar = 'centro',
}: {
  /** A frase curta do balão. Uma linha ou duas; o resto vai em `detalhes`. */
  texto: string
  /** O corpo do modal: a explicação com exemplo. Sem ele, o modal repete `texto`. */
  detalhes?: ReactNode
  /** O id da seção de `/ajuda` que aprofunda o assunto, para o link do rodapé. */
  secao?: string
  /** O título do modal. É o nome do campo, escrito como ele aparece na tela. */
  titulo?: string
  /**
   * `direita` alinha o balão pela borda direita do "?", e é o que serve quando
   * o título está encostado na lateral do painel — centrado, ele vazaria.
   */
  alinhar?: 'centro' | 'direita'
}) {
  const [aberto, setAberto] = useState(false)
  // O modal sai por um portal para o `body`, e não é preciosismo: estes "?"
  // ficam dentro de `<label>`, e um clique em qualquer lugar de um `<dialog>`
  // que fosse filho do `<label>` devolveria o foco para o campo — fechando o
  // dropdown, movendo o cursor, roubando o clique que ia para o link.
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  return (
    <>
      <Dica texto={texto} alinhar={alinhar} largo>
        <button
          type="button"
          aria-label={`Ajuda: ${titulo ?? texto}`}
          onClick={(evento) => {
            // Dentro de um `<label>` o clique continuaria para o campo.
            evento.preventDefault()
            evento.stopPropagation()
            setAberto(true)
          }}
          className="ml-1 inline-flex size-[15px] shrink-0 translate-y-[1px] cursor-pointer items-center justify-center rounded-full border border-line text-[9.5px] leading-none font-bold text-dim normal-case transition hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ?
        </button>
      </Dica>

      {montado &&
        createPortal(
          <Modal
            aberto={aberto}
            aoFechar={() => setAberto(false)}
            titulo={titulo ?? 'Sobre este campo'}
            largura={460}
          >
            <div className="space-y-2.5 text-[12.5px] leading-6 text-muted normal-case [&_code]:font-mono [&_code]:text-primary [&_strong]:text-ink">
              {detalhes ?? texto}
            </div>

            {/*
              O rodapé é o **único** link para fora. Quem chegou até aqui já
              leu a explicação inteira e ainda quis mais; levar para a Ajuda
              antes disso seria decidir pela pessoa.
            */}
            <div className="mt-5 border-t border-line pt-3.5">
              <a
                href={secao ? `/ajuda#${secao}` : '/ajuda'}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-semibold text-primary normal-case underline-offset-2 hover:underline"
              >
                Ficou com dúvidas? Veja a nossa Ajuda
              </a>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  )
}
