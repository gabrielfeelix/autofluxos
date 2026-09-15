'use client'

import { useState, type ReactNode } from 'react'

/**
 * Conversa e Histórico, no mesmo cartão.
 *
 * **A conversa continua sendo a primeira**: quem abre a ficha quase sempre vai
 * responder, e uma aba a mais entre a pessoa e a caixa de texto seria um clique
 * cobrado de todo mundo para o benefício de quem veio auditar.
 *
 * A aba escondida é escondida por CSS, e não desmontada. Desmontar a conversa
 * perderia o que já foi digitado na caixa de resposta e a rolagem do histórico
 * — ir ver quando a pessoa mudou de etapa custaria o rascunho da mensagem.
 */
export function Abas({
  conversa,
  historico,
  extra,
}: {
  conversa: ReactNode
  historico: ReactNode
  /** O que fica à direita das abas: a contagem da janela e o número. */
  extra?: ReactNode
}) {
  const [aba, setAba] = useState<'conversa' | 'historico'>('conversa')

  return (
    <section className="app-card flex max-h-[620px] min-h-[360px] flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-[18px] py-2.5">
        <div role="tablist" aria-label="Conversa e histórico" className="flex flex-1 gap-1.5">
          <Aba atual={aba} valor="conversa" aoEscolher={setAba}>
            Conversa
          </Aba>
          <Aba atual={aba} valor="historico" aoEscolher={setAba}>
            Histórico
          </Aba>
        </div>
        {extra}
      </header>

      <div
        role="tabpanel"
        aria-label="Conversa"
        hidden={aba !== 'conversa'}
        className={`min-h-0 flex-1 flex-col ${aba === 'conversa' ? 'flex' : 'hidden'}`}
      >
        {conversa}
      </div>

      <div
        role="tabpanel"
        aria-label="Histórico"
        hidden={aba !== 'historico'}
        className={`min-h-0 flex-1 overflow-auto p-[18px] ${aba === 'historico' ? 'block' : 'hidden'}`}
      >
        {historico}
      </div>
    </section>
  )
}

function Aba({
  atual,
  valor,
  aoEscolher,
  children,
}: {
  atual: string
  valor: 'conversa' | 'historico'
  aoEscolher: (valor: 'conversa' | 'historico') => void
  children: ReactNode
}) {
  const escolhida = atual === valor
  return (
    <button
      type="button"
      role="tab"
      aria-selected={escolhida}
      onClick={() => aoEscolher(valor)}
      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
        escolhida
          ? 'border-primary/40 bg-primary/[0.1] text-primary'
          : 'border-transparent text-muted hover:border-line hover:bg-surface'
      }`}
    >
      {children}
    </button>
  )
}
