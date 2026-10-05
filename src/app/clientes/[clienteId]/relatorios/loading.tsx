import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeAlternador, EsqueletoDeBotao, TopoCarregando } from '@/components/design/esqueleto'

/**
 * Relatórios enquanto vêm: topo, a barra do período, os quatro números e os
 * dois gráficos, nos mesmos lugares do `PainelDeBlocos`.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="toda">
        <TopoCarregando titulo="Relatórios" descricao={<Esqueleto className="mt-1.5 h-3 w-64" />} />
        <div aria-hidden className="mt-4 mb-4 flex flex-wrap items-center gap-2">
          <EsqueletoDeAlternador opcoes={['7 dias', '30 dias', '90 dias']} ativa={1} />
          <EsqueletoDeBotao largura="w-32" />
          <span className="flex-1" />
          <EsqueletoDeBotao largura="w-32" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="app-card flex h-[118px] flex-col gap-3 p-4">
              <Esqueleto className="h-3 w-24" />
              <Esqueleto className="h-6 w-14" />
              <Esqueleto className="mt-auto h-6 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="app-card flex h-[300px] flex-col gap-3 p-5">
            <Esqueleto className="h-3.5 w-40" />
            <Esqueleto className="h-2.5 w-56" />
            <Esqueleto className="mt-2 w-full flex-1 rounded-lg" />
          </div>
          <div className="app-card flex h-[300px] flex-col items-center gap-4 p-5">
            <Esqueleto className="h-3.5 w-48 self-start" />
            <Esqueleto className="size-32 rounded-full" />
            <Esqueleto className="h-2.5 w-full" />
            <Esqueleto className="h-2.5 w-full" />
          </div>
        </div>
      </Miolo>
    </MioloCarregando>
  )
}
