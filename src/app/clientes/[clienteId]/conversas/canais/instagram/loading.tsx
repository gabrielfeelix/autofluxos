import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'
import { Trilha } from '@/components/design/trilha'
import { DEFINICAO_DO_CANAL } from '@/core/canais'

/**
 * O Instagram enquanto vem: trilha, título e frase reais, a caixa da conexão,
 * o cartão da conta ligada e o cartão de explicação embaixo.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full max-w-[820px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
        <span role="status" className="sr-only">
          Carregando o Instagram…
        </span>
        <Trilha caminho={[{ rotulo: 'Canais' }, { rotulo: 'Instagram' }]} />
        <header className="mb-7">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Instagram</h1>
          <p className="mt-1 text-[13px] text-muted">{DEFINICAO_DO_CANAL.instagram.resumo}</p>
        </header>

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

        <section aria-hidden className="app-card mb-5 px-5 py-5">
          <div className="flex items-center gap-3">
            <Esqueleto className="size-2.5 rounded-full" />
            <div className="min-w-0 flex-1">
              <Esqueleto className="h-3.5 w-[130px]" />
              <Esqueleto className="mt-2 h-2.5 w-[170px]" />
            </div>
            <Esqueleto className="h-9 w-[76px] rounded-[10px]" />
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <Esqueleto className="h-2.5 w-[70%]" />
          </div>
        </section>

        <section aria-hidden className="app-card px-5 py-5">
          <Esqueleto className="h-3 w-[170px]" />
          <Esqueleto className="mt-3.5 h-2.5 w-[96%]" />
          <Esqueleto className="mt-2 h-2.5 w-[88%]" />
          <Esqueleto className="mt-2 h-2.5 w-[60%]" />
        </section>
      </main>
    </MioloCarregando>
  )
}
