'use client'

import { useState, type ReactNode } from 'react'
import { Modal } from './modal'

export type PassoDaAjuda = { titulo: string; texto: ReactNode }

/**
 * O `?` ao lado do título de uma tela, que abre a explicação inteira dela.
 *
 * Existe para a descrição embaixo do título poder ser curta: duas linhas dizem
 * para que serve a tela, e o detalhe (o passo a passo, as regras, o porquê)
 * mora aqui, a um clique, em vez de empurrar o conteúdo da tela para baixo.
 *
 * Mesmo círculo do `BotaoDeAjuda` do topo, para ser reconhecido como a mesma
 * coisa: ajuda. A diferença é o alcance, este explica só esta tela.
 */
export function AjudaDaTela({
  titulo,
  resumo,
  passos,
  children,
}: {
  titulo: string
  resumo: string
  passos: PassoDaAjuda[]
  /** O que vem depois dos passos: regras, dúvidas comuns. */
  children?: ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title={`Como funciona: ${titulo}`}
        aria-label={`Como funciona: ${titulo}`}
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-strong text-[12px] font-bold text-dim transition hover:border-primary/50 hover:bg-primary/[0.1] hover:text-primary"
      >
        <span aria-hidden>?</span>
      </button>
      <Modal aberto={aberto} aoFechar={() => setAberto(false)} titulo={titulo} descricao={resumo} largura={600}>
        <ol className="space-y-4">
          {passos.map((passo, i) => (
            <li key={passo.titulo} className="flex gap-3.5">
              <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-primary/[0.12] text-[12px] font-bold text-primary tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold">{passo.titulo}</p>
                <div className="mt-0.5 text-[12.5px] leading-6 text-muted">{passo.texto}</div>
              </div>
            </li>
          ))}
        </ol>
        {children && <div className="mt-5 space-y-3 border-t border-line pt-4 text-[12.5px] leading-6 text-muted">{children}</div>}
        <div className="pt-5">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="app-secondary-button w-full py-2.5 text-[13px]"
          >
            Entendi
          </button>
        </div>
      </Modal>
    </>
  )
}
