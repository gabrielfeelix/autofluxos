import { comoFrase, type Evento } from '@/core/crm'

/**
 * A linha do tempo do contato, na aba ao lado da conversa.
 *
 * É a mesma lista do painel lateral do quadro, e de propósito: quem aprende a
 * ler o histórico num lugar não pode ter que reaprender no outro. A diferença é
 * só o espaço — aqui cabe a data por extenso.
 *
 * A conversa **não entra aqui**. Ela já é a outra aba, e repetir cada mensagem
 * como evento transformaria o histórico numa segunda cópia do WhatsApp, onde o
 * que importa (mudou de etapa, alguém assumiu, ganhou, perdeu) ficaria enterrado.
 */
export function Historico({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12px] leading-5 text-dim">
        Nada registrado ainda. A partir de agora, mudança de etapa, quem assumiu e o que foi ganho
        ou perdido aparecem aqui.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-0">
      {eventos.map((evento) => (
        <li key={evento.id} className="flex gap-2.5 border-l border-line pb-4 pl-4 last:pb-0">
          <span className="mt-[6px] -ml-[21px] size-[7px] shrink-0 rounded-full bg-surface-strong ring-2 ring-panel" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-5">{comoFrase(evento)}</span>
            <span className="text-[11px] text-dim">
              {new Date(evento.criadoEm).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {evento.autor ? ` · ${evento.autor}` : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
