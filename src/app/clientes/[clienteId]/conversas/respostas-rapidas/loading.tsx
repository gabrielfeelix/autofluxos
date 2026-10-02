import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'

/**
 * As respostas rápidas enquanto vêm: o título e a frase de verdade, e o cartão
 * com o botão de nova no cabeçalho e as linhas de atalho e texto, a forma que
 * o gerenciador desenha quando chega.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <span role="status" className="sr-only">
          Carregando as respostas rápidas…
        </span>
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Respostas rápidas</h1>
        <p className="mt-1.5 mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Frases prontas para quem atende. Elas pertencem a este cliente e aparecem na caixa de
          resposta do Inbox, não vão para o fluxo nem alteram o que o bot diz sozinho.
        </p>
        <section aria-hidden className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <Esqueleto className="h-3.5 w-[96px]" />
              <Esqueleto className="mt-2 h-2.5 w-[230px]" />
            </div>
            <Esqueleto className="h-9 w-[132px] rounded-[10px]" />
          </header>
          {[
            ['w-[72px]', 'w-[86%]', 'w-[54%]'],
            ['w-[96px]', 'w-[64%]', null],
            ['w-[60px]', 'w-[78%]', 'w-[40%]'],
            ['w-[84px]', 'w-[58%]', null],
          ].map(([atalho, linha1, linha2], i) => (
            <div key={i} className="flex items-start gap-4 border-t border-line-soft px-5 py-3.5 first:border-t-0">
              <Esqueleto className={`mt-0.5 h-6 shrink-0 rounded-lg ${atalho}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                <Esqueleto className={`h-2.5 ${linha1}`} />
                {linha2 && <Esqueleto className={`h-2.5 ${linha2}`} />}
              </div>
              <Esqueleto className="size-6 shrink-0 rounded-md" />
            </div>
          ))}
        </section>
      </main>
    </MioloCarregando>
  )
}
