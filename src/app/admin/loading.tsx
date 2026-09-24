import { Esqueleto } from '@/components/design/esqueleto'

/** A Visão geral enquanto vem: título real, os quatro números e os cartões. */
export default function Carregando() {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <header className="mb-5">
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Visão geral</h1>
        <Esqueleto className="mt-2.5 h-3 w-80 max-w-full" />
      </header>
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="app-card flex flex-col gap-2.5 px-4 py-3.5">
            <Esqueleto className="h-2.5 w-24" />
            <Esqueleto className="h-6 w-14" />
            <Esqueleto className="h-2.5 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <Esqueleto className="mb-3 h-4 w-48" />
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="app-card flex h-[118px] flex-col gap-3 p-4">
                <span className="flex items-center gap-3">
                  <Esqueleto className="size-[38px] shrink-0 rounded-full" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <Esqueleto className="h-3 w-[60%]" />
                    <Esqueleto className="h-2.5 w-[40%]" />
                  </span>
                </span>
                <span className="mt-auto flex items-end justify-between">
                  <Esqueleto className="h-6 w-20" />
                  <Esqueleto className="h-8 w-24 rounded-[10px]" />
                </span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <Esqueleto className="mb-3 h-4 w-44" />
          <div className="app-card flex flex-col gap-4 p-4">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-col gap-2">
                <Esqueleto className="h-3 w-[70%]" />
                <Esqueleto className="h-1.5 w-full rounded-full" />
              </span>
            ))}
          </div>
        </section>
      </div>
      <span role="status" className="sr-only">
        Carregando a visão geral…
      </span>
    </main>
  )
}
