import { Esqueleto, EsqueletoDeBusca, TopoCarregando } from '@/components/design/esqueleto'

/** O osso da tela de Sugestões: os quatro números, a barra e os cartões. */
export default function Carregando() {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <TopoCarregando
        titulo="Sugestões"
        descricao="O que os clientes pediram pelo “Sentiu falta de algo?”, com a tela em que estavam. Marque cada uma como planejada, feita ou descartada; quem escreveu nunca vê essa marcação."
        acoes={[]}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="app-card flex flex-col gap-2.5 px-4 py-3.5">
            <Esqueleto className="h-2.5 w-24" />
            <Esqueleto className="h-6 w-16" />
          </div>
        ))}
      </div>
      <EsqueletoDeBusca placeholder="Exemplo: funil, atividade, nome da organização" filtros />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="app-card flex gap-4 px-5 py-4">
            <Esqueleto className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2.5">
              <Esqueleto className="h-3 w-48" />
              <Esqueleto className="h-3 w-[90%]" />
              <Esqueleto className={`h-3 ${i % 2 ? 'w-[55%]' : 'w-[70%]'}`} />
              <div className="mt-1 flex items-center justify-between">
                <Esqueleto className="h-6 w-24 rounded-md" />
                <Esqueleto className="h-8 w-[148px] rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <span role="status" className="sr-only">
        Carregando sugestões…
      </span>
    </main>
  )
}
