'use client'

import { useState, useTransition } from 'react'
import { acaoDefinirPapelNaConta, acaoRemoverDaConta } from '@/server/acoes'
import type { OpcaoDropdown } from '@/components/design/dropdown'
import { Dropdown } from '@/components/design/dropdown'

type Membro = { id: string; nome: string; email: string; papel: string; presenca: string }

/**
 * Uma pessoa da equipe, com o papel dela.
 *
 * Componente de cliente porque as duas ações **recusam com motivo** — "só quem
 * administra a conta mexe na equipe", "esta é a única pessoa dona da conta" — e
 * um `<form>` cru jogaria o motivo fora: o clique pareceria não ter funcionado
 * justamente na recusa que precisa ser lida.
 */
export function LinhaDaEquipe({
  clienteId,
  membro,
  papeis,
  podeMexer,
}: {
  clienteId: string
  membro: Membro
  papeis: OpcaoDropdown[]
  podeMexer: boolean
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [papel, setPapel] = useState(membro.papel)
  const [rodando, comecar] = useTransition()

  const trocarPapel = (novo: string) => {
    const anterior = papel
    setErro(null)
    setPapel(novo)
    comecar(async () => {
      const r = await acaoDefinirPapelNaConta(clienteId, membro.id, novo)
      if (!r.ok) {
        setPapel(anterior)
        setErro(r.erro ?? 'não deu para trocar o papel')
      }
    })
  }

  const remover = () => {
    setErro(null)
    if (!confirm(`Tirar ${membro.nome} desta conta? A pessoa continua existindo no sistema.`)) return
    comecar(async () => {
      const r = await acaoRemoverDaConta(clienteId, membro.id)
      if (!r.ok) setErro(r.erro ?? 'não deu para remover')
    })
  }

  return (
    <li className="border-b border-white/[0.045] px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-0 flex-1">
          <strong className="flex items-center gap-2 text-[13.5px] font-semibold">
            <span
              title={membro.presenca === 'disponivel' ? 'disponível' : 'ausente'}
              className={`size-2 shrink-0 rounded-full ${membro.presenca === 'disponivel' ? 'bg-emerald-400' : 'bg-dim'}`}
            />
            <span className="truncate">{membro.nome}</span>
          </strong>
          <span className="mt-0.5 block truncate text-[11.5px] text-dim">{membro.email}</span>
        </span>

        {podeMexer ? (
          <>
            <Dropdown
              rotuloAcessivel={`Papel de ${membro.nome}`}
              opcoes={papeis}
              valor={papel}
              aoMudar={trocarPapel}
              desabilitado={rodando}
              className="w-[190px]"
            />
            <button
              type="button"
              disabled={rodando}
              onClick={remover}
              className="rounded-lg border border-white/[0.09] px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-rose-400/40 hover:bg-rose-400/[0.09] hover:text-rose-300 disabled:opacity-50"
            >
              {rodando ? '…' : 'Remover'}
            </button>
          </>
        ) : (
          <span className="text-[11.5px] text-muted">
            {papeis.find((opcao) => opcao.valor === papel)?.rotulo ?? papel}
          </span>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-1.5 text-[11px] leading-4 text-rose-300">
          {erro}
        </p>
      )}
    </li>
  )
}
