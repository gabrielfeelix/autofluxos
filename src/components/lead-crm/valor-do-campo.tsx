import { lerValorDoCampo, type ItemDoCampo } from '@/core/contatos/valor-do-campo'

/**
 * O valor de um campo coletado, desenhado pelo que ele é.
 *
 * Sem `'use client'`: é só marcação, e assim serve a ficha (servidor) e o
 * painel do Inbox (cliente) sem duas versões do mesmo desenho.
 *
 * A regra de leitura está em `lerValorDoCampo`. Aqui mora só a aparência:
 * lista vira fichas separadas, par `hora · pessoa` vira hora em destaque com o
 * nome ao lado, link vira link, sim/não vira selo verde ou cinza, identificador
 * vira código curto com o valor inteiro no `title`.
 */
export function ValorDoCampo({ valor }: { valor: string }) {
  const lido = lerValorDoCampo(valor)

  switch (lido.tipo) {
    case 'vazio':
      return <span className="text-[13px] text-dim">sem resposta</span>

    case 'lista':
      return (
        <ul className="mt-0.5 flex flex-wrap gap-1.5">
          {lido.itens.map((item, indice) => (
            <li key={`${item.principal}-${indice}`}>
              <Ficha item={item} />
            </li>
          ))}
        </ul>
      )

    case 'identificador':
      return (
        <ul className="mt-0.5 flex flex-wrap gap-1.5">
          {lido.itens.map((id) => (
            <li
              key={id}
              title={id}
              className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-dim"
            >
              {id.slice(0, 8)}
            </li>
          ))}
        </ul>
      )

    case 'sim-nao':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
            lido.sim
              ? 'border-emerald-400/25 bg-emerald-400/[0.09] text-ok'
              : 'border-line bg-surface text-muted'
          }`}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${lido.sim ? 'bg-emerald-400' : 'bg-dim'}`} />
          {lido.sim ? 'Sim' : 'Não'}
        </span>
      )

    case 'link':
      return (
        <a
          href={lido.url}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-semibold break-all text-primary hover:underline"
        >
          {lido.url}
        </a>
      )

    default:
      return (
        <p className={`text-[13px] font-semibold break-words ${lido.longo ? 'leading-6' : ''}`}>
          {lido.texto}
        </p>
      )
  }
}

/** Um item da lista: `Pilates solo`, ou `07:00` com `Márcia` ao lado. */
function Ficha({ item }: { item: ItemDoCampo }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-soft">
      <span aria-hidden className="size-1 shrink-0 rounded-full bg-primary/60" />
      {item.principal}
      {item.detalhe && (
        <span className="border-l border-line pl-1.5 text-[11px] font-medium text-dim">
          {item.detalhe}
        </span>
      )}
    </span>
  )
}
