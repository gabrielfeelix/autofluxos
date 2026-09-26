'use client'

import { useState, useTransition } from 'react'
import { NICHOS, PACOTES, type Nicho } from '@/core/nichos'
import { acaoDefinirNicho } from '@/server/acoes-recursos'

/**
 * O tipo de negócio da conta (PLANO-NICHOS 1.4).
 *
 * Trocar muda nomes do menu, os modelos oferecidos e a ficha do assistente.
 * Não apaga nada e não instala nada: por isso a troca pede um segundo clique,
 * dizendo exatamente isso. Quem não pode (só dono e administrador podem) vê a
 * escolha atual sem conseguir mudar.
 */
export function EscolherTipoDeNegocio({
  clienteId,
  atual,
  podeTrocar,
}: {
  clienteId: string
  atual: Nicho | null
  podeTrocar: boolean
}) {
  const [escolhido, setEscolhido] = useState<Nicho | null>(atual)
  const [pendente, setPendente] = useState<Nicho | null | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function confirmar() {
    if (pendente === undefined) return
    const novo = pendente
    setErro(null)
    comecar(async () => {
      const r = await acaoDefinirNicho(clienteId, novo ?? '')
      if (!r.ok) {
        setErro(r.erro ?? 'não deu para salvar')
        return
      }
      setEscolhido(novo)
      setPendente(undefined)
    })
  }

  const opcoes: { valor: Nicho | null; nome: string; exemplos: string }[] = [
    ...NICHOS.map((nicho) => ({ valor: nicho, nome: PACOTES[nicho].nome, exemplos: PACOTES[nicho].exemplos })),
    { valor: null, nome: 'Outro', exemplos: 'o sistema completo, sem adaptar ao ramo' },
  ]

  return (
    <div className="flex flex-col gap-2.5">
      <fieldset className="grid gap-2.5 sm:grid-cols-2" disabled={rodando || !podeTrocar}>
        <legend className="sr-only">Tipo de negócio</legend>
        {opcoes.map((opcao) => {
          const marcado = (pendente === undefined ? escolhido : pendente) === opcao.valor
          return (
            <label
              key={opcao.valor ?? 'outro'}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                marcado ? 'border-accent bg-accent/[0.06]' : 'border-line hover:bg-white/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="nicho"
                checked={marcado}
                onChange={() => setPendente(opcao.valor === escolhido ? undefined : opcao.valor)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13.5px] font-bold tracking-[-0.01em]">{opcao.nome}</span>
                <span className="text-[12px] text-dim">{opcao.exemplos}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {!podeTrocar && <p className="text-[12px] text-dim">Só o dono ou um administrador da organização troca o tipo de negócio.</p>}

      {pendente !== undefined && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3.5 py-3">
          <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-soft">
            Muda os nomes do menu, os modelos oferecidos e a ficha do assistente para toda a equipe.
            Nada é apagado e nada é criado.
          </p>
          <button type="button" onClick={confirmar} disabled={rodando} className="app-primary-button px-4 py-2 text-[12.5px] disabled:opacity-60">
            {rodando ? 'Trocando…' : 'Trocar'}
          </button>
          <button type="button" onClick={() => setPendente(undefined)} disabled={rodando} className="text-[12.5px] font-semibold text-muted hover:text-soft">
            Cancelar
          </button>
        </div>
      )}

      {erro && <p className="text-[12.5px] text-aviso">{erro}</p>}
    </div>
  )
}
