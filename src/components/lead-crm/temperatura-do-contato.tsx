'use client'

import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { TEMPERATURAS, type Temperatura } from '@/core/crm'
import { acaoDefinirTemperatura } from '@/server/acoes-crm'

/**
 * O quanto quem atendeu acredita nesta venda (0068).
 *
 * **Três botões e não um menu**, ao contrário do estágio ao lado. A diferença
 * não é estética: o estágio tem seis valores e muda sozinho, abri-lo é um gesto
 * raro, de correção. Temperatura tem três valores, nunca muda sozinha, e é
 * justamente o que se marca de passagem ao fechar uma conversa. Um menu custaria
 * dois cliques e uma leitura para o gesto mais frequente do painel.
 *
 * As cores são as do termo, e param aí: azul de frio, âmbar de morno, vermelho
 * de quente. Quem está daltônico continua lendo a palavra, que está escrita em
 * cada botão, a cor acompanha o texto, não o substitui.
 *
 * Otimista pelas três razões de sempre: é interno, é reversível num clique e não
 * é lote.
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

export function TemperaturaDoContato({
  clienteId,
  contatoId,
  temperatura,
}: {
  clienteId: string
  contatoId: string
  temperatura: Temperatura
}) {
  const otimista = useAcaoOtimista<Temperatura>(temperatura)

  return (
    <span className="flex flex-col">
      <span
        role="radiogroup"
        aria-label="Quanto esta venda está quente"
        className="flex gap-1.5"
      >
        {TEMPERATURAS.map((valor) => {
          const aceso = otimista.valor === valor
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={aceso}
              onClick={() =>
                otimista.agir(valor, () => acaoDefinirTemperatura(clienteId, contatoId, valor))
              }
              className={`flex-1 rounded-[9px] border px-2 py-1.5 text-[11.5px] font-bold capitalize transition ${aceso ? TOM[valor].aceso : TOM[valor].apagado}`}
            >
              {valor}
            </button>
          )
        })}
      </span>
      {otimista.erro && (
        <span role="alert" className="mt-1 text-[10.5px] text-perigo">
          {otimista.erro}
        </span>
      )}
    </span>
  )
}
