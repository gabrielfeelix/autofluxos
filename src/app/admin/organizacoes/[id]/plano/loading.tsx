import { Esqueleto } from '@/components/design/esqueleto'

/** O Plano enquanto vem: a barra de uso e os três cartões de plano. */
export default function Carregando() {
  return (
    <div className="flex flex-col gap-6">
      <div className="app-card flex flex-col gap-3 px-5 py-4">
        <Esqueleto className="h-3.5 w-48" />
        <Esqueleto className="h-2 w-full rounded-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="app-card flex h-[210px] flex-col gap-3 p-4">
            <Esqueleto className="h-4 w-24" />
            <Esqueleto className="h-6 w-32" />
            <Esqueleto className="h-3 w-40" />
            <Esqueleto className="mt-auto h-9 w-full rounded-[10px]" />
          </div>
        ))}
      </div>
      <span role="status" className="sr-only">Carregando o plano…</span>
    </div>
  )
}
