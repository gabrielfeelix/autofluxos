'use client'

import type { Atividade } from '@/core/atividades'
import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'
import { horaExata, quando } from '@/lib/quando'

/**
 * O prazo em palavras.
 *
 * `quando()` só sabe falar do passado: para um prazo que ainda não venceu ele
 * responde "agora", e "Mandar o contrato" com prazo para depois de amanhã
 * aparecia como se fosse para este minuto. Atrasado continua com `quando()`,
 * que é a frase certa para o que já passou.
 */
function prazoEmPalavras(prazo: string | null, agora: number): { texto: string; atrasada: boolean } {
  if (prazo === null) return { texto: 'sem prazo', atrasada: false }

  const falta = new Date(prazo).getTime() - agora
  if (falta < 0) return { texto: `venceu ${quando(prazo, agora)}`, atrasada: true }

  const horas = Math.floor(falta / 3_600_000)
  if (horas < 1) return { texto: 'na próxima hora', atrasada: false }
  if (horas < 24) return { texto: `em ${horas} h`, atrasada: false }

  const dias = Math.floor(horas / 24)
  return { texto: dias === 1 ? 'amanhã' : `em ${dias} dias`, atrasada: false }
}

/**
 * O que está marcado para acontecer, na visão geral.
 *
 * As tarefas viviam só dentro da aba "Atividades" e as mensagens agendadas num
 * cartão perdido no fim da coluna. As duas respondem a mesma pergunta — o que
 * já está combinado com esta pessoa — e nenhuma delas aparecia sem alguém ir
 * procurar. Aqui é um resumo com link para o lugar completo, não uma segunda
 * cópia da lista: só o que vence antes.
 */
export function ProximosPassos({
  atividades,
  agendadas,
  agora,
}: {
  atividades: Atividade[]
  agendadas: MensagemAgendada[]
  agora: number
}) {
  /*
   * Prazo `null` é "algum dia" e é resposta legítima, então ele vai para o fim
   * da fila em vez de ser descartado: a tarefa sem data continua sendo uma
   * tarefa aberta, só não disputa a primeira linha com a que vence hoje.
   */
  const abertas = atividades
    .filter((atividade) => atividade.situacao === 'aberta')
    .sort((a, b) => (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))

  const aSair = agendadas.filter((agendada) => agendada.estado !== 'falhou')
  const falhou = agendadas.filter((agendada) => agendada.estado === 'falhou')

  const vazio = abertas.length === 0 && agendadas.length === 0

  return (
    <section className="app-card overflow-hidden">
      <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        Próximos passos
      </h2>

      {vazio ? (
        <p className="px-[18px] py-[22px] text-xs leading-5 text-dim">
          Nada marcado com esta pessoa. Crie uma tarefa em Atividades ou agende uma mensagem.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {/*
            A falha vem primeiro, e em vermelho: a mensagem que não saiu é mais
            urgente que a que vai sair, e enterrá-la no fim faria alguém
            descobrir dias depois que o cliente nunca recebeu o lembrete.
          */}
          {falhou.map((agendada) => (
            <p key={agendada.id} className="px-[18px] py-3">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-rose-400" />
                <strong className="text-[11.5px] font-bold text-perigo">não saiu</strong>
              </span>
              <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-muted">
                {agendada.texto}
              </span>
            </p>
          ))}

          {abertas.slice(0, 3).map((atividade) => {
            const { texto, atrasada } = prazoEmPalavras(atividade.prazo, agora)
            return (
              <p key={atividade.id} className="px-[18px] py-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${atrasada ? 'bg-rose-400' : 'bg-primary'}`}
                  />
                  <strong
                    className={`text-[11.5px] font-bold ${atrasada ? 'text-perigo' : 'text-soft'}`}
                  >
                    {texto}
                  </strong>
                </span>
                <span className="mt-1 block text-[12px] leading-5 text-muted">
                  {atividade.titulo}
                </span>
              </p>
            )
          })}

          {aSair.slice(0, 2).map((agendada) => (
            <p key={agendada.id} className="px-[18px] py-3">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-surface-strong" />
                <strong className="text-[11.5px] font-bold text-soft">
                  {horaExata(agendada.quando)}
                </strong>
              </span>
              <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-muted">
                {agendada.texto}
              </span>
            </p>
          ))}
        </div>
      )}

      {abertas.length > 3 && (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('ficha:aba', { detail: 'atividades' }))}
          className="w-full border-t border-line px-[18px] py-2.5 text-left text-[11.5px] font-semibold text-primary transition hover:bg-surface"
        >
          Ver as {abertas.length} atividades abertas
        </button>
      )}
    </section>
  )
}
