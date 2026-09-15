'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

/**
 * As pílulas de filtro do topo da fila.
 *
 * ---------------------------------------------------------------------------
 * Por que trocaram as fichas por isto
 * ---------------------------------------------------------------------------
 *
 * O filtro do Inbox eram três linhas de fichas empilhadas — estado, dono,
 * origem — sempre abertas, ocupando cerca de 120px do topo da coluna numa tela
 * onde o que importa é ver conversa. Três eixos abertos ao mesmo tempo também
 * fazem a pergunta errada: quem abre a fila quer saber o que está aberto, não
 * escolher entre onze abas.
 *
 * Uma pílula por eixo, com o valor escolhido escrito nela, responde as duas
 * coisas: diz em que recorte a pessoa está sem que ela precise procurar a ficha
 * acesa, e devolve o espaço para a lista.
 *
 * ---------------------------------------------------------------------------
 * Por que cada opção tem descrição
 * ---------------------------------------------------------------------------
 *
 * "Adiadas" e "Resolvidas" são palavras do produto, não do português: ninguém
 * chega sabendo que adiar tem prazo e que resolver é o fim do atendimento. A
 * linha embaixo do rótulo é onde isso cabe — e ela só existe no menu aberto,
 * então não custa espaço na tela parada.
 */

export type OpcaoDaPilula = {
  chave: string
  rotulo: string
  /** A linha de baixo, no menu aberto. Diz o que a opção significa. */
  descricao?: string
  contagem?: number
  /** No modo paginado cada opção é um endereço; no local, um callback. */
  href?: string
  /** Uma bolinha cinza ao lado do rótulo. Hoje: atendente ausente. */
  ausente?: boolean
}

/**
 * Os três estados, com o texto que explica cada um.
 *
 * Mora aqui porque as duas metades da fila precisam da mesma lista: a paginada,
 * onde cada opção é um endereço, e a local, onde é um `filter()`. Duas cópias
 * viram dois vocabulários — e "encerrada" numa tela com "resolvida" na outra é
 * a pessoa achando que são coisas diferentes.
 */
export const ESTADOS_DA_FILA = [
  {
    chave: 'aberta',
    rotulo: 'Conversas abertas',
    descricao: 'Esperando alguém responder',
  },
  {
    chave: 'adiada',
    rotulo: 'Conversas adiadas',
    descricao: 'Voltam sozinhas para a fila no prazo marcado',
  },
  {
    chave: 'resolvida',
    rotulo: 'Conversas encerradas',
    descricao: 'Atendimento terminado por gente ou por automação',
  },
] as const

/** O visual comum a toda pílula — a escolhida e as outras. */
const PILULA =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition'

const PILULA_PARADA = 'border-line bg-panel text-soft hover:border-strong hover:bg-surface'
const PILULA_ACESA = 'border-primary/40 bg-primary-weak text-primary'

/**
 * Uma pílula que abre menu.
 *
 * O rótulo mostra **o valor escolhido**, não o nome do eixo: "Conversas
 * abertas", e não "Estado". O nome do eixo só ajudaria quem ainda não escolheu
 * nada, e sempre há algo escolhido.
 */
export function PilulaMenu({
  rotulo,
  opcoes,
  escolhida,
  aoEscolher,
  aria,
}: {
  /** O que a pílula mostra fechada. Normalmente o rótulo da opção escolhida. */
  rotulo: string
  opcoes: OpcaoDaPilula[]
  escolhida: string
  /** Ausente quando as opções são `href` — aí quem navega é o `<Link>`. */
  aoEscolher?: (chave: string) => void
  aria: string
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  /*
   * Fechar com Esc e ao clicar fora. O clique fora é ouvido no documento, e não
   * resolvido com um `<button>` cobrindo a tela: a cobertura engole o primeiro
   * clique, e quem quer ir direto de uma pílula para a outra precisa clicar
   * duas vezes.
   */
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoClicar = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicar)
    }
  }, [aberto])

  const naoEhOPadrao = escolhida !== opcoes[0]?.chave

  return (
    <div ref={caixa} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={aria}
        onClick={() => setAberto((x) => !x)}
        className={`${PILULA} ${naoEhOPadrao || aberto ? PILULA_ACESA : PILULA_PARADA}`}
      >
        {rotulo}
        <Seta aberta={aberto} />
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-1.5 w-[248px] overflow-hidden rounded-[12px] border border-line bg-panel py-1 shadow-menu"
        >
          {opcoes.map((opcao) => {
            const acesa = opcao.chave === escolhida
            const miolo = (
              <>
                <span className="flex items-center gap-1.5">
                  {opcao.ausente && (
                    <span
                      aria-label="ausente"
                      title="ausente"
                      className="size-1.5 shrink-0 rounded-full bg-dim"
                    />
                  )}
                  <span className={`flex-1 truncate ${acesa ? 'text-primary' : 'text-ink'}`}>
                    {opcao.rotulo}
                  </span>
                  {opcao.contagem !== undefined && (
                    <span className="shrink-0 font-mono text-[10.5px] text-dim">
                      {opcao.contagem}
                    </span>
                  )}
                </span>
                {opcao.descricao && (
                  <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">
                    {opcao.descricao}
                  </span>
                )}
              </>
            )
            const classe = `block w-full px-3 py-2 text-left text-[12px] font-semibold transition ${
              acesa ? 'bg-primary-weak' : 'hover:bg-surface'
            }`

            return opcao.href ? (
              <Link
                key={opcao.chave}
                href={opcao.href}
                scroll={false}
                role="menuitem"
                onClick={() => setAberto(false)}
                className={classe}
              >
                {miolo}
              </Link>
            ) : (
              <button
                key={opcao.chave}
                type="button"
                role="menuitem"
                onClick={() => {
                  aoEscolher?.(opcao.chave)
                  setAberto(false)
                }}
                className={classe}
              >
                {miolo}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Uma pílula que só liga e desliga. */
export function PilulaInterruptor({
  rotulo,
  ligada,
  aoAlternar,
  contagem,
  titulo,
  desabilitada = false,
}: {
  rotulo: string
  ligada: boolean
  aoAlternar: () => void
  contagem?: number
  /** A explicação no `title`, para os interruptores cujo efeito não é imediato. */
  titulo?: string
  desabilitada?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={ligada}
      onClick={aoAlternar}
      title={titulo}
      disabled={desabilitada}
      className={`${PILULA} ${ligada ? PILULA_ACESA : PILULA_PARADA} disabled:opacity-60`}
    >
      {rotulo}
      {contagem !== undefined && contagem > 0 && (
        <span className="font-mono text-[10.5px] opacity-70">{contagem}</span>
      )}
    </button>
  )
}

function Seta({ aberta }: { aberta: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition ${aberta ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
