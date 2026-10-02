import { Esqueleto, EsqueletoDeAjuste, EsqueletoDeCartoes } from '@/components/design/esqueleto'

/** Plano e consumo enquanto vem: o caminho, o título e a frase de verdade, e os cartões dos planos. */
export default function Carregando() {
  return (
    <EsqueletoDeAjuste
      titulo="Plano e consumo"
      descricao="Em que plano esta organização está, quanto já foi usado neste mês, e o que muda se você trocar."
    >
      <div className="app-card mb-6 flex h-[290px] flex-col gap-3 p-5">
        <Esqueleto className="h-3.5 w-32" />
        <Esqueleto className="h-6 w-40" />
        <Esqueleto className="mt-2 h-10 w-full rounded-[10px]" />
        <Esqueleto className="h-2 w-full rounded-full" />
        <Esqueleto className="h-3 w-[70%]" />
        <Esqueleto className="h-3 w-[55%]" />
      </div>
      <EsqueletoDeCartoes quantidade={3} altura="h-[220px]" colunas="md:grid-cols-3" />
    </EsqueletoDeAjuste>
  )
}
