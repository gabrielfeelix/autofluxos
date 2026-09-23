'use client'

import Link from 'next/link'
import type { ItemAntesDePublicar, OrigemDoFluxo } from '@/core/flow/antes-de-publicar'

const MARCA = {
  pendente: { sinal: '!', classe: 'border-rose-400/40 bg-rose-400/10 text-perigo' },
  conferir: { sinal: '?', classe: 'border-amber-300/40 bg-amber-300/10 text-aviso' },
  ok: { sinal: '✓', classe: 'border-emerald-400/40 bg-emerald-400/10 text-ok' },
} as const

/**
 * A aba "Antes de publicar" do painel do editor (A13).
 *
 * Só aparece quando a automação acabou de chegar por importação ou cópia
 * (`?origem=`). Os itens vêm prontos de `antesDePublicar`, recalculados a cada
 * mudança do desenho: escolher a etiqueta no bloco já marca o item aqui.
 */
export function AntesDePublicar({
  origem,
  itens,
  clienteId,
  rotuloDoNo,
  aoFocar,
}: {
  origem: OrigemDoFluxo
  itens: ItemAntesDePublicar[]
  clienteId: string
  rotuloDoNo: (noId: string) => string
  aoFocar: (noId: string) => void
}) {
  const faltam = itens.filter((item) => item.estado === 'pendente').length

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <p className="text-[12px] leading-[1.6] text-dim">
        {origem === 'importado'
          ? 'Esta automação veio de outra conta ou de um arquivo. Ela nasce rascunho, sem IA e sem chaves.'
          : 'Esta é uma cópia. Ela nasce desligada e sem os gatilhos da original.'}{' '}
        {faltam === 0
          ? 'Nada impede publicar; confira os itens com "?".'
          : faltam === 1
            ? 'Falta resolver 1 item.'
            : `Faltam resolver ${faltam} itens.`}
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {itens.map((item) => {
          const marca = MARCA[item.estado]
          return (
            <li key={item.chave} className="flex gap-2.5 rounded-xl border border-line bg-panel p-3">
              <span
                aria-hidden
                className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-bold ${marca.classe}`}
              >
                {marca.sinal}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] leading-5 font-semibold ${item.estado === 'ok' ? 'text-muted' : 'text-ink'}`}>
                  <span className="sr-only">
                    {item.estado === 'pendente' ? 'Falta: ' : item.estado === 'conferir' ? 'Conferir: ' : 'Feito: '}
                  </span>
                  {item.titulo}
                </p>
                {item.detalhe && (
                  <p className="mt-0.5 text-[11.5px] leading-[1.55] text-dim">{item.detalhe}</p>
                )}
                {(item.noIds.length > 0 || item.link) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.noIds.map((noId) => (
                      <button
                        key={noId}
                        type="button"
                        onClick={() => aoFocar(noId)}
                        title="Mostrar este bloco no desenho"
                        className="max-w-full truncate rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition hover:border-primary/50 hover:text-primary"
                      >
                        {rotuloDoNo(noId)}
                      </button>
                    ))}
                    {item.link && (
                      <Link
                        href={`/clientes/${clienteId}${item.link.caminho}`}
                        className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-primary transition hover:border-primary/50"
                      >
                        {item.link.rotulo}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
