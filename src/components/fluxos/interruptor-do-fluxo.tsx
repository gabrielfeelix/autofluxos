'use client'

import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { AVISO_AO_DESLIGAR } from '@/core/entrada'
import { acaoAlternarFluxoAtivo } from '@/server/acoes'

type Recado = { texto: string; erro?: boolean }

/**
 * Liga e desliga uma automação, direto na linha.
 *
 * Mesma forma do interruptor de sequência, de gatilho e de campanha: a mesma
 * coisa se liga do mesmo jeito em toda a tela. Esteve no menu `⋯` por um tempo
 * (3.4) e voltou para a linha a pedido do Gabriel: ligada ou desligada é a
 * informação mais importante da lista, e precisa estar à vista e a um clique.
 *
 * Automação nunca publicada não liga (A05): o servidor recusa de novo no
 * clique, e o `title` diz por quê antes.
 */
export function InterruptorDoFluxo({
  clienteId,
  fluxo,
  emAndamento = 0,
}: {
  clienteId: string
  fluxo: { id: string; nome: string; ativo: boolean; publicada: boolean }
  /** Conversas rodando esta automação agora (RB-44), para o aviso de desligar. */
  emAndamento?: number
}) {
  const [rodando, comecar] = useTransition()
  const [recado, setRecado] = useState<Recado | null>(null)
  const sumir = useCallback(() => setRecado(null), [])

  const bloqueado = !fluxo.ativo && !fluxo.publicada
  const conversas =
    emAndamento === 1 ? '1 conversa em andamento termina' : `${emAndamento} conversas em andamento terminam`

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={fluxo.ativo}
        aria-label={`${fluxo.ativo ? 'Desligar' : 'Ligar'} ${fluxo.nome}`}
        disabled={rodando || bloqueado}
        title={
          bloqueado
            ? 'Publique antes de ligar, senão ninguém recebe resposta.'
            : fluxo.ativo
              ? `Desligar: para de abrir conversa nova. ${emAndamento > 0 ? conversas : 'Quem já está conversando termina'} na versão em que começou.`
              : 'Ligar: volta a abrir conversa na próxima mensagem. Não precisa publicar de novo.'
        }
        onClick={() => {
          setRecado(null)
          comecar(async () => {
            const r = await acaoAlternarFluxoAtivo(clienteId, fluxo.id, !fluxo.ativo)
            if (!r.ok) setRecado({ texto: r.erro ?? 'não deu para ligar ou desligar', erro: true })
            else
              setRecado(
                fluxo.ativo
                  ? { texto: `“${fluxo.nome}” desligada. ${AVISO_AO_DESLIGAR}` }
                  : { texto: `“${fluxo.nome}” ligada: abre conversa nova a partir da próxima mensagem.` },
              )
          })
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          fluxo.ativo ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            fluxo.ativo ? 'left-[15px] bg-emerald-400' : 'left-[2px] bg-dim'
          }`}
        />
      </button>

      {/* Sempre montada: região viva que nasce junto do texto não é lida. */}
      <span role="status" className="sr-only">
        {recado?.texto ?? ''}
      </span>
      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={sumir}>
          {recado.texto}
        </AvisoFlutuante>
      )}
    </>
  )
}
