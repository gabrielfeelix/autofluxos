import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'

/** A página do negócio enquanto vem: o topo e as três colunas, no lugar certo. */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full px-4 pt-[22px] pb-12 md:px-7">
        <Esqueleto className="mb-3 h-4 w-40 rounded" />
        <div className="app-card mb-4 px-5 py-5 md:px-6">
          <Esqueleto className="h-7 w-72 max-w-full rounded-lg" />
          <Esqueleto className="mt-3 h-5 w-56 rounded-lg" />
        </div>
        <Esqueleto className="mb-4 h-9 w-56 rounded-lg" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <Esqueleto className="h-80 rounded-xl" />
          <Esqueleto className="h-80 rounded-xl" />
          <Esqueleto className="hidden h-80 rounded-xl xl:block" />
        </div>
      </main>
    </MioloCarregando>
  )
}
