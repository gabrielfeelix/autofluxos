import type { MensagemAgendada } from '@/server/repos/mensagens-agendadas'
import { horaExata } from '@/lib/quando'

/**
 * O que já está marcado para sair.
 *
 * O agendamento (0057) existia só no Inbox: quem abria a ficha não tinha como
 * saber que havia uma mensagem esperando para ser enviada naquela conversa — e
 * escrevia de novo por cima. É o tipo de informação que só serve se estiver
 * onde a pessoa já está olhando.
 *
 * `falhou` aparece junto, e em vermelho: a mensagem que não saiu é mais urgente
 * que a que vai sair, e esconder a falha aqui faria alguém descobrir dias depois
 * que o cliente nunca recebeu o lembrete.
 */
export function Agendadas({ agendadas }: { agendadas: MensagemAgendada[] }) {
  if (agendadas.length === 0) return null

  return (
    <section className="app-card overflow-hidden">
      <h2 className="border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        Para enviar depois
      </h2>
      <ul>
        {agendadas.map((agendada) => (
          <li key={agendada.id} className="border-b border-line px-[18px] py-3 last:border-0">
            <span className="flex items-center gap-1.5">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  agendada.estado === 'falhou' ? 'bg-rose-400' : 'bg-primary'
                }`}
              />
              <strong
                className={`text-[11.5px] font-bold ${
                  agendada.estado === 'falhou' ? 'text-perigo' : 'text-soft'
                }`}
              >
                {agendada.estado === 'falhou' ? 'não saiu' : horaExata(agendada.quando)}
              </strong>
            </span>
            <span className="mt-1 block line-clamp-3 text-[12px] leading-5 text-muted">
              {agendada.texto}
            </span>
            {agendada.criadaPorNome && (
              <span className="mt-0.5 block text-[10.5px] text-dim">
                marcada por {agendada.criadaPorNome}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
