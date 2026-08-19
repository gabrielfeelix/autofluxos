'use client'

import { useState, useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { acaoMoverFluxo } from '@/server/acoes'

/**
 * Trocar um fluxo de gaveta, da própria lista.
 *
 * Um seletor por linha, e não arrastar: arrastar dentro de uma lista que
 * pagina, tem seção por pasta e vive num acordeão é um alvo pequeno num
 * problema resolvido — e no celular não existe.
 */
export function MoverFluxo({
  clienteId,
  fluxoId,
  pastaAtual,
  pastas,
}: {
  clienteId: string
  fluxoId: string
  pastaAtual: string | null
  pastas: { id: string; nome: string }[]
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [pasta, setPasta] = useState(pastaAtual ?? '')
  const [rodando, comecar] = useTransition()

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Dropdown
        rotuloAcessivel="Pasta deste fluxo"
        valor={pasta}
        desabilitado={rodando}
        className="w-[150px]"
        opcoes={[
          { valor: '', rotulo: 'Sem pasta' },
          ...pastas.map((p) => ({ valor: p.id, rotulo: p.nome })),
        ]}
        aoMudar={(novo) => {
          const anterior = pasta
          setErro(null)
          setPasta(novo)
          comecar(async () => {
            const r = await acaoMoverFluxo(clienteId, fluxoId, novo)
            if (!r.ok) {
              setPasta(anterior)
              setErro(r.erro ?? 'não deu para mover')
            }
          })
        }}
      />
      {erro && (
        <span role="alert" className="text-[10.5px] text-rose-300">
          {erro}
        </span>
      )}
    </span>
  )
}
