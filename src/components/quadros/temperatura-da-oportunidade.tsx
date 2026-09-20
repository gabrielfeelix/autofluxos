'use client'

import { useAcaoOtimista } from '@/components/design/acao-otimista'
import type { Temperatura } from '@/core/quadros'
import { acaoAvaliarOportunidade } from '@/server/acoes-produtos'

/**
 * O quanto quem atende acredita **nesta negociação** (0079).
 *
 * Irmão de `lead-crm/temperatura-do-contato.tsx`, com uma diferença que é o
 * ponto inteiro da T5.1: **aqui existe "não avaliada"**, e ela é o estado
 * inicial de todo cartão.
 *
 * A do contato (0068) tem `not null default 'morno'`, então ela nunca consegue
 * dizer "ninguém opinou": um cartão recém-criado já aparece morno, e morno
 * parece avaliação. Como a própria 0068 registrou, derivar temperatura seria
 * "inventar um número e apresentá-lo como opinião de alguém".
 *
 * Por isso clicar no botão aceso **desmarca**. Sem isso, a primeira avaliação
 * errada seria permanente: não haveria como voltar para "ainda não sei", só
 * como escolher outra opinião falsa.
 *
 * Otimista pelas três razões de sempre: é interno, é reversível num clique e
 * não é lote.
 */
const TOM: Record<Temperatura, { aceso: string; apagado: string }> = {
  frio: {
    aceso: 'border-sky-400/50 bg-sky-50 text-sky-700',
    apagado: 'border-line bg-panel text-dim hover:bg-sky-50/60 hover:text-sky-700',
  },
  morno: {
    aceso: 'border-amber-400/50 bg-amber-50 text-amber-700',
    apagado: 'border-line bg-panel text-dim hover:bg-amber-50/60 hover:text-amber-700',
  },
  quente: {
    aceso: 'border-rose-400/50 bg-rose-50 text-rose-700',
    apagado: 'border-line bg-panel text-dim hover:bg-rose-50/60 hover:text-rose-700',
  },
}

const VALORES: readonly Temperatura[] = ['frio', 'morno', 'quente']

export function TemperaturaDaOportunidade({
  clienteId,
  cartaoId,
  temperatura,
}: {
  clienteId: string
  cartaoId: string
  /** `null` é "não avaliada", e é diferente de morno. */
  temperatura: Temperatura | null
}) {
  const otimista = useAcaoOtimista<Temperatura | null>(temperatura)

  return (
    <span className="flex flex-col">
      <span role="radiogroup" aria-label="Quanto esta negociação está quente" className="flex gap-1.5">
        {VALORES.map((valor) => {
          const aceso = otimista.valor === valor
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={aceso}
              title={aceso ? 'Clique de novo para voltar a não avaliada' : undefined}
              onClick={() => {
                // Clicar no aceso desmarca: é o caminho de volta para "ainda
                // não sei", que sem isto não existiria.
                const proximo = aceso ? null : valor
                otimista.agir(proximo, () =>
                  acaoAvaliarOportunidade(clienteId, cartaoId, proximo ?? ''),
                )
              }}
              className={`flex-1 rounded-[9px] border px-2 py-1.5 text-[11.5px] font-bold capitalize transition ${aceso ? TOM[valor].aceso : TOM[valor].apagado}`}
            >
              {valor}
            </button>
          )
        })}
      </span>

      {otimista.valor === null && (
        <span className="mt-1 text-[10.5px] leading-4 text-dim">
          Ainda não avaliada. Não é o mesmo que morno.
        </span>
      )}

      {otimista.erro && (
        <span role="alert" className="mt-1 text-[10.5px] text-perigo">
          {otimista.erro}
        </span>
      )}
    </span>
  )
}
