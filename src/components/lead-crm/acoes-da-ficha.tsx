'use client'

import { useState, type ReactNode } from 'react'
import { AgendarMensagem } from '@/components/inbox/agendar'
import { MarcarAtividade } from '@/components/inbox/marcar-atividade'
import { Modal } from '@/components/design/modal'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'

/**
 * As ações sobre o contato, no alto e à direita.
 *
 * **Ícone com rótulo embaixo, e não menu.** É o desenho que o Brevo e o RD usam
 * na ficha pela mesma razão: são poucas ações, e elas precisam ser reconhecidas
 * de relance por quem abre trinta fichas por dia. Menu esconde o que existe, e
 * o que se esconde não é usado.
 *
 * As ações aqui **existem de verdade**: agendar e marcar atividade abrem os
 * mesmos painéis do Inbox, anotar e etiquetar levam ao bloco da coluna e põem o
 * foco nele. Botão que abre um "em breve" é pior que botão nenhum.
 *
 * **"Atividade" mora aqui, e não só dentro da aba.** Marcar um retorno é uma
 * ação sobre a pessoa, da mesma família de agendar e anotar, e quem está lendo
 * a visão geral precisava trocar de aba só para registrar o combinado. A aba
 * continua sendo onde as atividades **moram**: o que nasce aqui aparece lá, é a
 * mesma `acaoCriarAtividade`, e o painel é o mesmo do Inbox para as duas telas
 * não virarem dois produtos.
 */
export function AcoesDaFicha({
  clienteId,
  contatoId,
  nome,
  fimDaJanela,
  agendadas,
}: {
  clienteId: string
  contatoId: string
  nome: string
  /** Quando a janela de 24h fecha, em ISO. `null` = já fechou. */
  fimDaJanela: string | null
  agendadas: MensagemAgendada[]
}) {
  const [agendando, setAgendando] = useState(false)
  const [marcando, setMarcando] = useState(false)
  const temAgendada = agendadas.some((a) => a.estado === 'agendada' || a.estado === 'enviando')

  return (
    <>
      <span className="flex items-center gap-1">
        <AcaoDaFicha
          rotulo="Agendar"
          marcada={temAgendada}
          aoClicar={() => setAgendando(true)}
          icone={
            <>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 1.8" />
            </>
          }
        />
        {/*
          O ícone é o mesmo de "Marcar atividade" no Inbox, de propósito: é o
          mesmo painel e o mesmo resultado, e ícone diferente para a mesma coisa
          ensina que são duas coisas.
        */}
        <AcaoDaFicha
          rotulo="Atividade"
          aoClicar={() => setMarcando(true)}
          icone={
            <>
              <circle cx="12" cy="12" r="8.5" />
              <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
            </>
          }
        />
        <AcaoDaFicha
          rotulo="Anotar"
          aoClicar={() => focar('anotacao')}
          icone={
            <>
              <path d="M4.5 19.5h15" />
              <path d="M6 15.2 15.4 5.8a2 2 0 0 1 2.8 2.8L8.8 18 5 19l1-3.8Z" />
            </>
          }
        />
        <AcaoDaFicha
          rotulo="Etiquetar"
          aoClicar={() => focar('etiquetas')}
          icone={
            <>
              <path d="M4.5 10.2V5.2a.7.7 0 0 1 .7-.7h5l9 9a1.6 1.6 0 0 1 0 2.3l-4.2 4.2a1.6 1.6 0 0 1-2.3 0l-8-8Z" />
              <circle cx="8.6" cy="8.6" r="1.1" />
            </>
          }
        />
      </span>

      <Modal
        aberto={agendando}
        aoFechar={() => setAgendando(false)}
        titulo={`Agendar mensagem para ${nome}`}
        descricao="A mensagem sai sozinha na hora marcada. Enquanto não sai, dá para cancelar aqui mesmo."
      >
        <AgendarMensagem
          clienteId={clienteId}
          contatoId={contatoId}
          nome={nome}
          fimDaJanela={fimDaJanela}
          agendadas={agendadas}
          aoFechar={() => setAgendando(false)}
        />
      </Modal>

      {/*
        `MarcarAtividade` dá `router.refresh()` ao criar, então a aba Atividades
        já vem com a nova na próxima pintura: não existe uma segunda lista aqui
        para manter em dia.
      */}
      <Modal
        aberto={marcando}
        aoFechar={() => setMarcando(false)}
        titulo={`Marcar atividade para ${nome}`}
        descricao="É um lembrete para a equipe, e aparece na aba Atividades desta pessoa. Nada é enviado ao cliente."
      >
        <MarcarAtividade
          clienteId={clienteId}
          contatoId={contatoId}
          aoFechar={() => setMarcando(false)}
        />
      </Modal>
    </>
  )
}

/**
 * Pede a aba que contém o bloco, e o foco nele.
 *
 * **Quem troca a aba é quem foca**, em `abas.tsx`: aqui só sai o pedido. A
 * versão anterior disparava o evento e procurava o bloco no quadro seguinte,
 * que ainda é cedo demais — o painel continuava `hidden`, e "Anotar" não fazia
 * nada em produção.
 */
function focar(id: string) {
  window.dispatchEvent(new CustomEvent('ficha:aba', { detail: { aba: 'visao', focar: id } }))
}

export function AcaoDaFicha({
  rotulo,
  icone,
  aoClicar,
  marcada = false,
  tom = 'normal',
  titulo,
}: {
  rotulo: string
  icone: ReactNode
  aoClicar: () => void
  /** O ponto que diz "já tem coisa aqui" — mesma régua da barra do Inbox. */
  marcada?: boolean
  /** `perigo` pinta o hover de vermelho: usado por "Apagar contato". */
  tom?: 'normal' | 'perigo'
  /** O `title` do botão, quando o rótulo curto não basta para explicar. */
  titulo?: string
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={titulo ?? rotulo}
      className={`group relative flex w-[62px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10.5px] text-muted transition ${
        tom === 'perigo'
          ? 'hover:bg-rose-400/[0.09] hover:text-perigo'
          : 'hover:bg-surface hover:text-primary'
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[19px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icone}
      </svg>
      {rotulo}
      {marcada && (
        <span className="absolute top-1 right-3 size-1.5 rounded-full bg-primary" />
      )}
    </button>
  )
}
