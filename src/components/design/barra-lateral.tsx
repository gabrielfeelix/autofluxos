'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { BotaoDeTema, definirPreferencia, usePreferencia } from '@/components/design/tema'

/**
 * A barra lateral do painel, e a seta que a recolhe.
 *
 * ---------------------------------------------------------------------------
 * O que ela é, e o que continua sendo do servidor
 * ---------------------------------------------------------------------------
 *
 * Recolher é estado, e estado é cliente. Mas o que a barra mostra — a conta
 * aberta, quem está logado, a presença, a lista de clientes — continua vindo
 * pronto do servidor, por `props`. Este arquivo decide **largura e o que some**,
 * e nada mais.
 *
 * ---------------------------------------------------------------------------
 * Por que a escolha é gravada
 * ---------------------------------------------------------------------------
 *
 * Diferente da ficha do contato no Inbox, que é um gesto por conversa, a
 * largura da barra é uma preferência de trabalho: quem recolheu quer a barra
 * recolhida amanhã também. Ela vai para o `<html>` antes da primeira pintura
 * (ver `SCRIPT_DAS_PREFERENCIAS`) — se fosse lida depois, a barra nasceria
 * larga e encolheria na frente da pessoa, empurrando a tela inteira.
 *
 * ---------------------------------------------------------------------------
 * No celular ela não recolhe
 * ---------------------------------------------------------------------------
 *
 * Abaixo de `md` a barra já não é barra: é uma faixa no topo com a navegação
 * rolando na horizontal. Não há largura para devolver, então a seta some — e o
 * atributo continua valendo, para quando a mesma pessoa abrir no computador.
 */
export function BarraLateral({
  marca,
  identidadeNoCelular,
  voltar,
  itens,
  rodape,
}: {
  marca: ReactNode
  /** No celular a barra vira faixa e o rodapé some: sem isto, nada diz de quem é a conta. */
  identidadeNoCelular: ReactNode
  /** O link "‹ Todos os clientes", quando a pessoa tem acesso a mais de um. */
  voltar: ReactNode | null
  itens: { chave: string; rotulo: string; href: string; icone: ReactNode; acesa: boolean }[]
  rodape: ReactNode
}) {
  const recolhida = usePreferencia('barra')

  return (
    <aside
      className={`flex shrink-0 flex-col border-line bg-panel transition-[width] md:border-r md:pt-5 md:pb-4 ${
        recolhida ? 'md:w-[68px] md:px-2.5' : 'md:w-[226px] md:px-3.5'
      }`}
    >
      <div
        className={`flex items-center gap-3 border-b border-line px-4 py-3 md:mb-5 md:border-0 md:py-0 ${
          recolhida ? 'md:justify-center md:px-0' : 'md:px-2'
        }`}
      >
        {/* Recolhida, sobra o símbolo da marca — o nome escrito não cabe em
            68px sem cortar no meio, que é pior do que não estar lá. */}
        <span className={recolhida ? 'md:[&_span:last-child]:hidden' : ''}>{marca}</span>
        <span className="ml-auto flex items-center gap-2 md:hidden">{identidadeNoCelular}</span>
      </div>

      {voltar && !recolhida && voltar}

      {/* Rola na horizontal no celular: nenhum item some, e a página não passa
          a rolar de lado por causa da navegação. */}
      <nav
        aria-label="Seções do cliente"
        className={`flex gap-1 overflow-x-auto border-b border-line px-3 py-2 md:flex-col md:gap-0.5 md:overflow-visible md:border-0 md:p-0 ${
          recolhida ? 'md:items-center' : ''
        }`}
      >
        {itens.map((item) => (
          <Link
            key={item.chave}
            href={item.href}
            aria-current={item.acesa ? 'page' : undefined}
            /*
              Recolhida, o `title` é a única coisa que diz o nome da seção. Ele
              fica sempre, e não só nesse estado: no celular o rótulo é curto e
              o `title` não atrapalha nada.
            */
            title={item.rotulo}
            className={`flex shrink-0 items-center gap-2.5 rounded-[10px] text-[13px] font-semibold transition ${
              recolhida ? 'md:size-10 md:justify-center md:px-0 px-2.5 py-2.5' : 'px-2.5 py-2.5'
            } ${
              item.acesa
                ? 'bg-primary-weak text-primary'
                : 'text-muted hover:bg-surface hover:text-ink'
            }`}
          >
            <span className={item.acesa ? 'text-primary' : 'text-dim'}>{item.icone}</span>
            <span className={recolhida ? 'md:hidden' : ''}>{item.rotulo}</span>
          </Link>
        ))}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div
        className={`hidden border-t border-line pt-3 md:block ${recolhida ? 'md:px-0' : ''}`}
      >
        {/*
          Tema e seta ficam **no rodapé, junto de presença e conta**: são as
          preferências de quem está usando o painel, e não do cliente aberto.
          O topo é da marca e da identidade da conta, e estava virando prateleira
          de ícone avulso.
        */}
        <div className={recolhida ? 'flex flex-col items-center gap-1' : ''}>
          <BotaoDeTema recolhida={recolhida} />
          <BotaoDeRecolher recolhida={recolhida} />
        </div>

        {!recolhida && rodape}
      </div>
    </aside>
  )
}

function BotaoDeRecolher({ recolhida }: { recolhida: boolean }) {
  const rotulo = recolhida ? 'Expandir a barra lateral' : 'Recolher a barra lateral'

  return (
    <button
      type="button"
      onClick={() => definirPreferencia('barra', !recolhida)}
      title={rotulo}
      aria-label={rotulo}
      aria-expanded={!recolhida}
      className={`flex items-center rounded-[10px] text-muted transition hover:bg-surface hover:text-ink ${
        recolhida ? 'size-9 justify-center' : 'w-full gap-2 px-1.5 py-1.5'
      }`}
    >
      <Seta apontandoParaDireita={recolhida} />
      {!recolhida && <span className="flex-1 text-left text-[11.5px]">Recolher</span>}
    </button>
  )
}

function Seta({ apontandoParaDireita }: { apontandoParaDireita: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={apontandoParaDireita ? 'rotate-180' : ''}
    >
      <path d="M14.5 6 8.5 12l6 6" />
      <path d="M19 5v14" />
    </svg>
  )
}
