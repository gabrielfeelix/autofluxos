'use client'

import { useState } from 'react'
import { Conversa } from '@/components/conversa'
import type { Fluxo } from '@/core/flow/schema'

/**
 * A vitrine de um fluxo compartilhado: conversar com ele, ou ler o roteiro.
 *
 * A página pública nasceu só com o roteiro, e a premissa era que quem abre o
 * link está decidindo se importa. Ela estava errada pela metade: antes de
 * decidir, a pessoa quer **sentir** o atendimento, e ler quinze blocos em ordem
 * não responde "isso é bom?". Conversar responde em trinta segundos.
 *
 * O roteiro não sai, vira a segunda aba. Ele continua sendo a única forma de
 * ver de uma vez um caminho por onde a conversa não passou.
 *
 * Quem conversa é o mesmo componente da aba Testar do editor, e isso é o ponto:
 * o motor é o mesmo do WhatsApp, então um fluxo com erro de desenho erra aqui
 * também. Uma imitação mostraria sempre o fluxo funcionando, que é exatamente o
 * que ninguém precisa ver.
 */
export function Vitrine({
  token,
  fluxo,
  nomeDoFluxo,
  roteiro,
}: {
  token: string
  fluxo: Fluxo
  nomeDoFluxo: string
  /** O roteiro já montado no servidor, para não carregar nada à toa aqui. */
  roteiro: React.ReactNode
}) {
  const [aba, setAba] = useState<'conversa' | 'roteiro'>('conversa')

  return (
    <section className="mt-[18px]">
      <div
        className="flex w-fit rounded-xl border border-line bg-surface p-0.5"
        role="tablist"
        aria-label="Como ver este fluxo"
      >
        {(['conversa', 'roteiro'] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            role="tab"
            aria-selected={aba === opcao}
            onClick={() => setAba(opcao)}
            className={`rounded-[10px] px-3.5 py-2 text-[12px] font-bold transition ${
              aba === opcao ? 'bg-surface-strong text-ink shadow-sm' : 'text-dim hover:text-soft'
            }`}
          >
            {opcao === 'conversa' ? 'Conversar' : 'Passo a passo'}
          </button>
        ))}
      </div>

      {aba === 'conversa' ? (
        <div className="mt-3">
          <div className="app-card flex h-[600px] flex-col overflow-hidden">
            <Conversa
              fluxo={fluxo}
              nomeContato={NOME_FICTICIO}
              token={token}
              legendaDoContato="pessoa de exemplo"
            />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-[1.7] text-dim">
            Você conversa como <strong className="font-semibold text-muted">{NOME_FICTICIO}</strong>
            , uma pessoa inventada: nome, telefone e o que ela responder existem só nesta aba. O
            desenho é o de <strong className="font-semibold text-muted">{nomeDoFluxo}</strong>, sem
            corte nenhum, e é por isso que o que der errado aqui dá errado no WhatsApp também.
          </p>
        </div>
      ) : (
        <div className="mt-3">{roteiro}</div>
      )}
    </section>
  )
}

/**
 * Com quem o visitante conversa.
 *
 * Um nome só, comum e obviamente de exemplo. Ele entra em `{{nome}}` e aparece
 * nas mensagens do fluxo, que é o que faz a demonstração parecer um
 * atendimento em vez de um formulário.
 */
const NOME_FICTICIO = 'João'
