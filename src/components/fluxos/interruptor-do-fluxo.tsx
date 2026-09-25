'use client'

import { useCallback, useState } from 'react'
import { depoisDaTela } from '@/components/inbox/conversa-local'
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
  /*
   * Otimista desde 25/set: vira no clique, e volta com o motivo se o servidor
   * recusar. Antes esperava a lista de automações voltar do servidor.
   */
  const [ligado, setLigado] = useState(fluxo.ativo)
  const [recado, setRecado] = useState<Recado | null>(null)
  const sumir = useCallback(() => setRecado(null), [])

  const bloqueado = !ligado && !fluxo.publicada
  const conversas =
    emAndamento === 1 ? '1 conversa em andamento termina' : `${emAndamento} conversas em andamento terminam`

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        aria-label={`${ligado ? 'Desligar' : 'Ligar'} ${fluxo.nome}`}
        disabled={bloqueado}
        title={
          bloqueado
            ? 'Publique antes de ligar, senão ninguém recebe resposta.'
            : ligado
              ? `Desligar: para de abrir conversa nova. ${emAndamento > 0 ? conversas : 'Quem já está conversando termina'} na versão em que começou.`
              : 'Ligar: volta a abrir conversa na próxima mensagem. Não precisa publicar de novo.'
        }
        onClick={() => {
          setRecado(null)
          const antes = ligado
          setLigado(!antes)
          setRecado(
            antes
              ? { texto: `“${fluxo.nome}” desligada. ${AVISO_AO_DESLIGAR}` }
              : { texto: `“${fluxo.nome}” ligada: abre conversa nova a partir da próxima mensagem.` },
          )
          const desfazer = (texto: string) => {
            setLigado(antes)
            setRecado({ texto, erro: true })
          }
          depoisDaTela(() => acaoAlternarFluxoAtivo(clienteId, fluxo.id, !antes)).then(
            (r) => {
              if (!r.ok) desfazer(r.erro ?? 'não deu para ligar ou desligar')
            },
            () => desfazer('não deu para ligar ou desligar agora'),
          )
        }}
        className={`relative h-[18px] w-8 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          ligado ? 'border-emerald-400/40 bg-emerald-400/25' : 'border-line bg-surface-strong'
        }`}
      >
        <span
          className={`absolute top-[2px] size-3 rounded-full transition-all ${
            ligado ? 'left-[15px] bg-emerald-400' : 'left-[2px] bg-dim'
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
