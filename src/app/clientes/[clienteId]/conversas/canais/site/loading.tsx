import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'
import { Trilha } from '@/components/design/trilha'
import { DEFINICAO_DO_CANAL } from '@/core/canais'

/**
 * O chat do site enquanto vem: trilha, título e frase reais; à esquerda o
 * cartão de ligar e os cartões de ajuste, à direita a prévia do balão.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[46px] md:px-[42px]">
        <span role="status" className="sr-only">
          Carregando o chat do site…
        </span>
        <Trilha caminho={[{ rotulo: 'Canais' }, { rotulo: 'Site' }]} />
        <header className="mb-6">
          <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Chat no site</h1>
          <p className="mt-1.5 max-w-[680px] text-[13px] leading-6 text-dim">
            {DEFINICAO_DO_CANAL.site.resumo} O visitante conversa com os mesmos fluxos e a mesma IA do WhatsApp, e a
            equipe responde pelo Inbox.
          </p>
        </header>

        <div
          aria-hidden
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]"
        >
          <div className="flex min-w-0 flex-col gap-5">
            <section className="app-card flex flex-wrap items-center gap-4 px-5 py-4">
              <Esqueleto className="size-2.5 rounded-full" />
              <div className="min-w-0 flex-1">
                <Esqueleto className="h-3.5 w-[220px] max-w-full" />
                <Esqueleto className="mt-2 h-2.5 w-[300px] max-w-full" />
              </div>
              <Esqueleto className="h-9 w-[150px] rounded-[10px]" />
            </section>
            {[0, 1].map((i) => (
              <section key={i} className="app-card px-5 py-5">
                <Esqueleto className="h-3.5 w-[150px]" />
                <Esqueleto className="mt-3 h-2.5 w-[85%]" />
                <Esqueleto className="mt-2 h-2.5 w-[50%]" />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[0, 1].map((j) => (
                    <div key={j}>
                      <Esqueleto className="h-2.5 w-[110px]" />
                      <Esqueleto className="mt-2 h-10 w-full rounded-[10px]" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <section className="rounded-[14px] border border-line bg-surface px-5 py-5">
              <div className="mx-auto flex w-fit gap-2 rounded-[10px] border border-line p-1">
                {['w-[52px]', 'w-[76px]', 'w-[68px]'].map((largura, j) => (
                  <Esqueleto key={j} className={`h-7 ${largura} rounded-[8px]`} />
                ))}
              </div>
              <div className="mx-auto mt-5 max-w-[230px] overflow-hidden rounded-[16px] border border-line">
                <Esqueleto className="h-[96px] w-full rounded-none" />
                <div className="flex flex-col gap-3 p-3">
                  <Esqueleto className="h-14 w-full rounded-[12px]" />
                  <Esqueleto className="h-14 w-full rounded-[12px]" />
                  <Esqueleto className="mt-10 h-8 w-full rounded-[10px]" />
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </MioloCarregando>
  )
}
