import { Esqueleto, EsqueletoDeAjuste } from '@/components/design/esqueleto'

/** Faturas enquanto vem: o resumo, os três números e as linhas da tabela. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Faturas"
      descricao="O que esta organização pagou e o que está em aberto, com recibo e nota fiscal de cada cobrança."
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <div className="app-card flex h-[150px] flex-col gap-3 p-5">
          <Esqueleto className="h-3 w-24" />
          <Esqueleto className="h-6 w-40" />
          <Esqueleto className="mt-auto h-8 w-48 rounded-[10px]" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="app-card flex h-[150px] flex-col justify-between p-5">
            <Esqueleto className="h-3 w-20" />
            <Esqueleto className="h-6 w-28" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Esqueleto className="h-9 w-[420px] max-w-full rounded-[11px]" />
        <div className="app-card flex flex-col gap-4 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Esqueleto key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </EsqueletoDeAjuste>
  )
}
