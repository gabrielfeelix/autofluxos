'use client'

import { useState, type ReactNode } from 'react'

export type AbaDaFicha = {
  chave: string
  rotulo: string
  /** Aparece ao lado do rótulo. Zero não é mostrado — contador de nada é ruído. */
  contagem?: number
  conteudo: ReactNode
  /** A conversa é a única que gerencia a própria rolagem e o próprio rodapé. */
  solta?: boolean
}

/**
 * As abas da ficha.
 *
 * **A conversa é sempre a primeira**: quem abre a ficha quase sempre vai
 * responder, e uma aba a mais entre a pessoa e a caixa de texto seria um clique
 * cobrado de todo mundo para o benefício de quem veio auditar.
 *
 * **Nenhuma aba é desmontada ao trocar**, só escondida. Desmontar a conversa
 * perderia o que já foi digitado na caixa de resposta e a rolagem do histórico
 * — ir ver de que anúncio a pessoa veio custaria o rascunho da mensagem.
 */
export function Abas({ abas, extra }: { abas: AbaDaFicha[]; extra?: ReactNode }) {
  const [atual, setAtual] = useState(abas[0]?.chave ?? '')

  return (
    <section className="app-card flex max-h-[620px] min-h-[360px] flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-[18px] py-2.5">
        <div role="tablist" aria-label="Seções da ficha" className="flex flex-1 flex-wrap gap-1.5">
          {abas.map((aba) => {
            const escolhida = aba.chave === atual
            return (
              <button
                key={aba.chave}
                type="button"
                role="tab"
                aria-selected={escolhida}
                onClick={() => setAtual(aba.chave)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  escolhida
                    ? 'border-primary/40 bg-primary-weak text-primary'
                    : 'border-transparent text-muted hover:border-line hover:bg-surface'
                }`}
              >
                {aba.rotulo}
                {aba.contagem !== undefined && aba.contagem > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                      escolhida ? 'bg-primary/15' : 'bg-surface-strong text-dim'
                    }`}
                  >
                    {aba.contagem}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {extra}
      </header>

      {abas.map((aba) => {
        const escolhida = aba.chave === atual
        return (
          <div
            key={aba.chave}
            role="tabpanel"
            aria-label={aba.rotulo}
            hidden={!escolhida}
            className={
              aba.solta
                ? `min-h-0 flex-1 flex-col ${escolhida ? 'flex' : 'hidden'}`
                : `min-h-0 flex-1 overflow-auto p-[18px] ${escolhida ? 'block' : 'hidden'}`
            }
          >
            {aba.conteudo}
          </div>
        )
      })}
    </section>
  )
}
