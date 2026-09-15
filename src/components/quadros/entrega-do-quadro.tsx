'use client'

import { useState, useTransition } from 'react'
import { acaoEncadearQuadro } from '@/server/acoes-crm'

/**
 * A quem este funil entrega.
 *
 * É a peça que deixa cada empresa partir o processo onde quiser: o SDR
 * qualifica no quadro dele e entrega ao vendedor, o vendedor fecha e entrega ao
 * pós-venda. Ganhar aqui abre o cartão lá — **a passagem é o gesto que já
 * existe**, e não um botão novo.
 *
 * Fica ao lado do seletor de quadros, e não numa tela de ajustes, porque é aqui
 * que a pessoa está quando percebe que precisa dele: olhando o funil cheio e
 * pensando "e depois que eu ganho?".
 */
export function EntregaDoQuadro({
  clienteId,
  quadroId,
  seguinteId,
  outros,
}: {
  clienteId: string
  quadroId: string
  seguinteId: string | null
  outros: { id: string; nome: string }[]
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  // Sem outro quadro, não há cadeia possível — e um seletor de nenhum item é um
  // controle que só ensina o que a conta ainda não pode fazer.
  if (outros.length === 0) return null

  return (
    <label className="flex items-center gap-1.5 text-[11.5px] text-dim">
      <span className="whitespace-nowrap">Ao ganhar, mandar para</span>
      <select
        value={seguinteId ?? ''}
        disabled={rodando}
        onChange={(e) => {
          const destino = e.target.value === '' ? null : e.target.value
          setErro(null)
          comecar(async () => {
            try {
              const r = await acaoEncadearQuadro(clienteId, quadroId, destino)
              if (!r.ok) setErro(r.erro ?? 'não deu para ligar os quadros')
            } catch {
              setErro('não deu para ligar os quadros agora')
            }
          })
        }}
        className="app-field max-w-[170px] px-2 py-1 text-[11.5px]"
      >
        <option value="">ninguém (fim da cadeia)</option>
        {outros.map((quadro) => (
          <option key={quadro.id} value={quadro.id}>
            {quadro.nome}
          </option>
        ))}
      </select>
      {erro && (
        <span role="alert" className="text-perigo">
          {erro}
        </span>
      )}
    </label>
  )
}
