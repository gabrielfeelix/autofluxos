'use client'

import { useState, type ReactNode } from 'react'
import { AgendarMensagem } from '@/components/inbox/agendar'
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
 * As três ações aqui **existem de verdade**, e é por isso que são três:
 * agendar abre o mesmo painel do Inbox, anotar e etiquetar levam ao bloco da
 * coluna e põem o foco nele. Botão que abre um "em breve" é pior que botão
 * nenhum.
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
  const temAgendada = agendadas.some((a) => a.estado === 'agendada' || a.estado === 'enviando')

  return (
    <>
      <span className="flex items-center gap-1">
        <Acao
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
        <Acao
          rotulo="Anotar"
          aoClicar={() => focar('anotacao')}
          icone={
            <>
              <path d="M4.5 19.5h15" />
              <path d="M6 15.2 15.4 5.8a2 2 0 0 1 2.8 2.8L8.8 18 5 19l1-3.8Z" />
            </>
          }
        />
        <Acao
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
    </>
  )
}

/**
 * Rola até o bloco e põe o foco no primeiro campo dele.
 *
 * Só rolar deixa a pessoa olhando para o lugar certo sem poder digitar, o que
 * cobra um clique a mais logo depois do clique que ela acabou de dar.
 *
 * **Pede a aba antes de procurar o bloco.** Anotação e etiquetas agora vivem
 * dentro da visão geral, e um `getElementById` num painel escondido acha o
 * elemento, rola para uma altura que não está à vista e foca um campo que
 * ninguém vê: o clique parecia não fazer nada. O `requestAnimationFrame` espera
 * o React mostrar o painel antes de medir a posição.
 */
function focar(id: string) {
  window.dispatchEvent(new CustomEvent('ficha:aba', { detail: 'visao' }))
  requestAnimationFrame(() => {
    const alvo = document.getElementById(id)
    if (!alvo) return
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const campo = alvo.querySelector<HTMLElement>('textarea, input, button')
    campo?.focus({ preventScroll: true })
  })
}

function Acao({
  rotulo,
  icone,
  aoClicar,
  marcada = false,
}: {
  rotulo: string
  icone: ReactNode
  aoClicar: () => void
  /** O ponto que diz "já tem coisa aqui" — mesma régua da barra do Inbox. */
  marcada?: boolean
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      title={rotulo}
      className="group relative flex w-[62px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10.5px] text-muted transition hover:bg-surface hover:text-primary"
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
