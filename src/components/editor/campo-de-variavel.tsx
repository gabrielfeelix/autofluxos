'use client'

import { useCallback, useRef, useState } from 'react'
import { FORMATO_VARIAVEL } from '@/core/flow/schema'
import { Popover } from './popover'

/**
 * O campo que nomeia uma variável — com a lista das que o fluxo já tem.
 *
 * Nasceu de um defeito relatado por quem monta fluxo: "Guardar resposta em" era
 * uma caixa de texto vazia, sem nenhum sinal de que a variável do bloco de cima
 * existia. O resultado previsível é o fluxo com `agendar_aula` e
 * `agendar_aula2` — duas variáveis onde a intenção era **uma**, e nada na tela
 * dizendo que a segunda nasceu por engano. Digitar de novo não é o mesmo gesto
 * que reaproveitar, e só a tela pode saber a diferença.
 *
 * Então o campo faz duas coisas que a caixa livre não fazia:
 *
 * - **oferece as que existem** num seletor igual ao `{x}` das mensagens — mesmo
 *   ícone, mesma busca —, e escolher **substitui o campo inteiro**, porque aqui
 *   o valor é o nome cru (`prazo`), não a citação (`{{prazo}}`);
 * - **diz em uma linha o que vai acontecer**: se aquele nome é novo, se ele
 *   cai em cima do que outro bloco já guarda, ou se está fora do formato que a
 *   publicação aceita.
 *
 * Os dois papéis de um nome de variável são campos diferentes e a legenda
 * separa: `modo="guarda"` escreve nela (a resposta da pergunta, o resultado da
 * IA) e pode inventar um nome novo; `modo="usa"` só lê (a condição, as opções
 * que vêm de uma variável) e um nome que ninguém preenche é um aviso.
 */
export type ModoDeVariavel = 'guarda' | 'usa'

/** O que a legenda diz, separado da tela para poder ser testado sozinho. */
export function classificarNomeDeVariavel({
  valor,
  modo,
  existeEmOutroBloco,
}: {
  valor: string
  modo: ModoDeVariavel
  /** O nome já é guardado por **outro** bloco (o próprio não conta). */
  existeEmOutroBloco: boolean
}): { tom: 'neutro' | 'aviso' | 'reuso'; texto: string } | null {
  const nome = valor.trim()
  if (nome === '') return null

  if (!FORMATO_VARIAVEL.test(nome)) {
    return {
      tom: 'aviso',
      texto:
        'nome fora do formato: comece com letra e use só letra, número e _ (sem espaço nem acento). Assim a publicação recusa.',
    }
  }

  if (modo === 'usa') {
    return existeEmOutroBloco
      ? { tom: 'reuso', texto: 'vem de um bloco que já guarda esse nome.' }
      : {
          tom: 'aviso',
          texto: 'nenhum bloco deste fluxo guarda essa variável — ela vai chegar vazia aqui.',
        }
  }

  return existeEmOutroBloco
    ? {
        tom: 'reuso',
        texto: 'é a mesma variável de outro bloco: os dois escrevem no mesmo lugar, e o último vale.',
      }
    : { tom: 'neutro', texto: 'variável nova neste fluxo.' }
}

export function CampoDeVariavel({
  rotulo,
  valor,
  aoMudar,
  variaveis,
  modo,
  dica,
}: {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  /** As variáveis que **outros** blocos guardam. A do próprio bloco fica fora. */
  variaveis: string[]
  modo: ModoDeVariavel
  dica?: string
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const botao = useRef<HTMLButtonElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const fechar = useCallback(() => setAberto(false), [])

  const filtradas = variaveis.filter((v) => v.toLowerCase().includes(busca.trim().toLowerCase()))
  const legenda = classificarNomeDeVariavel({
    valor,
    modo,
    existeEmOutroBloco: variaveis.includes(valor.trim()),
  })

  function escolher(variavel: string) {
    aoMudar(variavel)
    setAberto(false)
    setBusca('')
    requestAnimationFrame(() => campo.current?.focus())
  }

  return (
    <div className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
        {rotulo}
      </span>

      <span className="relative block">
        <input
          ref={campo}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          className="app-field py-2.5 pr-9 pl-3 text-[13px]"
        />
        <button
          ref={botao}
          type="button"
          aria-label="Escolher uma variável do fluxo"
          aria-expanded={aberto}
          title={
            variaveis.length === 0
              ? 'Nenhuma outra variável ainda: este fluxo não guarda nada fora daqui.'
              : 'Usar uma variável que o fluxo já tem'
          }
          disabled={variaveis.length === 0}
          onMouseDown={(evento) => {
            evento.preventDefault()
            if (variaveis.length === 0) return
            setAberto((estava) => !estava)
          }}
          className={`absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md px-1.5 py-0.5 font-mono text-[12px] transition disabled:opacity-40 ${
            aberto ? 'bg-accent/15 text-accent' : 'text-dim hover:bg-white/[0.06] hover:text-accent'
          }`}
        >
          {'{x}'}
        </button>
      </span>

      <Popover aberto={aberto} gatilho={botao} largura={220} altura={250} aoFechar={fechar}>
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtradas[0]) {
              e.preventDefault()
              escolher(filtradas[0])
            }
          }}
          placeholder="Buscar variável…"
          className="app-field mb-1 px-2 py-1.5 text-[12px]"
        />

        <div className="max-h-[190px] overflow-y-auto">
          {filtradas.length === 0 ? (
            <p className="px-2 py-2 text-[11px] leading-4 text-dim">Nenhuma variável com esse nome.</p>
          ) : (
            filtradas.map((v) => (
              <button
                key={v}
                type="button"
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  escolher(v)
                }}
                className="block w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-[11.5px] text-[#8de2fa] transition hover:bg-accent/[0.12]"
              >
                {v}
              </button>
            ))
          )}
        </div>
      </Popover>

      {legenda ? (
        <span
          className={`mt-1 block text-[10.5px] leading-4 ${
            legenda.tom === 'aviso'
              ? 'text-amber-200'
              : legenda.tom === 'reuso'
                ? 'text-[#8de2fa]'
                : 'text-dim'
          }`}
        >
          {legenda.texto}
        </span>
      ) : (
        dica && <span className="mt-1 block text-[10.5px] leading-4 text-dim">{dica}</span>
      )}
    </div>
  )
}
