import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, TopoCarregando } from '@/components/design/esqueleto'

/**
 * Comércio › Integrações enquanto vem, no formato de `ConectarLoja`: topo,
 * "Disponível agora" em cartões largos, "Em breve" em grade e o painel do que
 * a conexão rende à direita. Era um bloco de seis linhas soltas no azul.
 *
 * Sem `params`: loading não recebe parâmetro nenhum (ver `ajustes/loading.tsx`).
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <TopoCarregando
          titulo="Integrações"
          descricao="Ligue a sua loja on-line e o bot passa a responder com o que está nela: o produto certo, o preço, o estoque e o link para comprar. Ele só lê a loja; quem fecha a compra é o site."
        />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-bold tracking-[0.01em] text-soft">Disponível agora</h2>
              {[0, 1].map((i) => (
                <div key={i} className="app-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <Esqueleto className="size-12 shrink-0 rounded-[12px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <Esqueleto className="h-4 w-32" />
                    <Esqueleto className="h-2.5 w-full max-w-[420px]" />
                  </span>
                  <Esqueleto className="h-9 w-28 rounded-[9px]" />
                </div>
              ))}
            </section>
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-bold tracking-[0.01em] text-soft">Em breve</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="app-card flex h-[200px] flex-col p-5">
                    <Esqueleto className="mb-4 size-10 rounded-[12px]" />
                    <Esqueleto className="h-4 w-28" />
                    <Esqueleto className="mt-2 h-2.5 w-full" />
                    <Esqueleto className="mt-2 h-2.5 w-[70%]" />
                    <span className="flex-1" />
                    <Esqueleto className="h-9 w-24 rounded-[9px]" />
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="app-card p-5">
            <h2 className="text-[14.5px] font-bold">O que a conexão rende</h2>
            <ul className="mt-4 flex flex-col gap-4">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex gap-3">
                  <Esqueleto className="size-8 shrink-0 rounded-[10px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <Esqueleto className="h-3 w-[70%]" />
                    <Esqueleto className="h-2.5 w-full" />
                    <Esqueleto className="h-2.5 w-[80%]" />
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Miolo>
    </MioloCarregando>
  )
}
