import { Miolo } from '@/components/design/miolo'
import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'
import { Trilha } from '@/components/design/trilha'

/**
 * O WhatsApp enquanto vem: a trilha e o título reais, a caixa da conexão e o
 * cartão dos números com o cabeçalho de verdade e duas linhas de número.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <Miolo largura="cheia">
        <span role="status" className="sr-only">
          Carregando o WhatsApp…
        </span>
        <Trilha caminho={[{ rotulo: 'Canais' }, { rotulo: 'WhatsApp' }]} />
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">WhatsApp</h1>

        <div aria-hidden className="mb-5 rounded-[12px] border border-line bg-surface px-4 py-3">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 sm:gap-x-6">
            {[
              ['w-[64px]', 'w-[40px]'],
              ['w-[80px]', 'w-[48px]'],
              ['w-[150px]', 'w-[64px]'],
            ].map(([rotulo, valor], i) => (
              <span key={i} className="contents">
                <Esqueleto className={`h-2.5 ${rotulo}`} />
                <Esqueleto className={`h-2.5 ${valor}`} />
              </span>
            ))}
          </div>
        </div>

        <section className="app-card mb-[18px] overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 max-w-[70ch]">
              <h2 className="text-[14.5px] font-bold">Números do WhatsApp</h2>
              <p className="mt-0.5 text-[12px] leading-5 text-dim">
                Cada número mostra a conexão, o que o bot responde e o endereço da Meta.
              </p>
            </div>
            <Esqueleto className="h-8 w-[132px] shrink-0 rounded-[8px]" />
          </header>
          <ul aria-hidden>
            {[0, 1].map((i) => (
              <li key={i} className="border-b border-line px-5 py-5 last:border-b-0">
                <div className="flex items-center gap-3">
                  <Esqueleto className="size-2.5 rounded-full" />
                  <Esqueleto className="h-4 w-[160px]" />
                  <Esqueleto className="ml-auto h-8 w-[96px] rounded-[10px]" />
                </div>
                <Esqueleto className="mt-3 h-2.5 w-[220px]" />
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="rounded-[12px] border border-line bg-surface px-4 py-3">
                      <Esqueleto className="h-2.5 w-[45%]" />
                      <Esqueleto className="mt-2.5 h-8 w-full rounded-[10px]" />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Miolo>
    </MioloCarregando>
  )
}
