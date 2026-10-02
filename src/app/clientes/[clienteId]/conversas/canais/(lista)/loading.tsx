import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'

/**
 * Os canais enquanto vêm: o mesmo título, a mesma frase e os cartões no mesmo
 * lugar, com logo, selo, nome, descrição e o botão. Mora num grupo de rota
 * para valer só para a lista: as telas de cada canal têm outra forma.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <span role="status" className="sr-only">
          Carregando os canais…
        </span>
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Canais</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Por onde as conversas chegam. Cada cartão diz se o canal está conectado, quando chegou a última mensagem e o
          que fazer se algo parou.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <section key={i} aria-hidden className="app-card flex flex-col p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <Esqueleto className="size-10 rounded-[12px]" />
                <Esqueleto className="h-6 w-[84px] rounded-full" />
              </div>
              <Esqueleto className="h-4 w-[120px]" />
              <Esqueleto className="mt-2.5 h-2.5 w-[92%]" />
              <Esqueleto className="mt-1.5 h-2.5 w-[70%]" />
              <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-line bg-surface px-4 py-3">
                {['w-[60%]', 'w-[48%]', 'w-[66%]'].map((largura, j) => (
                  <Esqueleto key={j} className={`h-2.5 ${largura}`} />
                ))}
              </div>
              <Esqueleto className="mt-5 h-9 w-[150px] rounded-[10px]" />
            </section>
          ))}
        </div>
      </Miolo>
    </MioloCarregando>
  )
}
