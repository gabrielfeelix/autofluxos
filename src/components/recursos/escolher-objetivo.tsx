'use client'

import { useState, useTransition } from 'react'
import {
  EXPLICA_O_OBJETIVO,
  OBJETIVOS,
  ROTULO_DO_OBJETIVO,
  cobra,
  type Objetivo,
} from '@/core/objetivo-da-conta'
import { acaoDefinirObjetivo } from '@/server/acoes-recursos'

/**
 * O objetivo da conta, e o que ele muda.
 *
 * Cada opção diz **o que passa a ser cobrado**, e não só o que ela é. Sem essa
 * linha, trocar de objetivo é uma escolha às cegas: a pessoa marca "vender",
 * dois passos novos aparecem na tela inicial e ela não liga uma coisa à outra.
 *
 * `core/objetivo-da-conta.ts` é a única fonte de qual objetivo cobra o quê, e
 * este componente lê `cobra()` em vez de repetir a regra em texto: repetida, ela
 * divergiria no primeiro ajuste.
 */
export function EscolherObjetivo({
  clienteId,
  atual,
}: {
  clienteId: string
  atual: Objetivo
}) {
  const [escolhido, setEscolhido] = useState<Objetivo>(atual)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [rodando, comecar] = useTransition()

  function trocar(objetivo: Objetivo) {
    if (objetivo === escolhido) return
    const anterior = escolhido
    // Otimista: a marca anda na hora e volta se o servidor recusar. Radio que
    // só se move depois da rede parece quebrado no clique.
    setEscolhido(objetivo)
    setErro(null)
    setSalvo(false)

    comecar(async () => {
      const r = await acaoDefinirObjetivo(clienteId, objetivo)
      if (!r.ok) {
        setEscolhido(anterior)
        setErro(r.erro ?? 'não deu para salvar')
        return
      }
      setSalvo(true)
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <fieldset className="flex flex-col gap-2.5" disabled={rodando}>
        <legend className="sr-only">Objetivo da conta</legend>
        {OBJETIVOS.map((objetivo) => {
          const marcado = objetivo === escolhido
          const pede = (['automacao', 'funil'] as const).filter((passo) => cobra(objetivo, passo))

          return (
            <label
              key={objetivo}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition ${
                marcado ? 'border-accent bg-accent/[0.06]' : 'border-line hover:bg-white/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="objetivo"
                value={objetivo}
                checked={marcado}
                onChange={() => trocar(objetivo)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[13.5px] font-bold tracking-[-0.01em]">
                  {ROTULO_DO_OBJETIVO[objetivo]}
                </span>
                <span className="text-[12.5px] leading-5 text-dim">
                  {EXPLICA_O_OBJETIVO[objetivo]}
                </span>
                <span className="mt-0.5 text-[11.5px] leading-4 text-muted">
                  {pede.length === 0
                    ? 'Os primeiros passos pedem só o canal.'
                    : `Os primeiros passos passam a pedir: ${pede
                        .map((passo) => (passo === 'automacao' ? 'uma automação publicada' : 'um funil'))
                        .join(' e ')}.`}
                </span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {erro && (
        <p role="alert" className="text-[11.5px] leading-4 text-perigo">
          {erro}
        </p>
      )}
      {salvo && !erro && (
        <p role="status" className="text-[11.5px] leading-4 text-muted">
          Salvo.
        </p>
      )}
    </div>
  )
}
