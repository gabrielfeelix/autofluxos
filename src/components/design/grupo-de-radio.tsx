'use client'

/**
 * Rádios em cartão, um embaixo do outro (06/nov/2026).
 *
 * Era um alternador de dois botões ("Com palavras", "Qualquer comentário"):
 * cabia, mas obrigava a adivinhar o que cada lado fazia. Cada opção agora diz
 * o que acontece numa linha, como no ManyChat que o Eduardo mostrou.
 */
export function GrupoDeRadio<V extends string>({
  rotulo,
  valor,
  aoEscolher,
  opcoes,
}: {
  rotulo: string
  valor: V
  aoEscolher: (valor: V) => void
  opcoes: { valor: V; titulo: string; descricao: string }[]
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="overflow-hidden rounded-[10px] border border-line">
      {opcoes.map((o, i) => {
        const aceso = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={aceso}
            onClick={() => aoEscolher(o.valor)}
            className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${i > 0 ? 'border-t border-line' : ''} ${
              aceso ? 'bg-primary/[0.06]' : 'hover:bg-surface-strong/60'
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${aceso ? 'border-primary' : 'border-strong'}`}
            >
              {aceso && <span className="size-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink">{o.titulo}</span>
              <span className="block text-[11.5px] leading-4 text-dim">{o.descricao}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
