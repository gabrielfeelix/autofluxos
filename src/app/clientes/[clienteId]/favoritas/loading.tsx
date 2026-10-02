import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto } from '@/components/design/esqueleto'

/**
 * As mensagens guardadas enquanto vêm: título e frase de verdade, e o cartão
 * com o botão do Inbox no cabeçalho e as linhas de quem falou e do texto.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full max-w-[1440px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <span role="status" className="sr-only">
          Carregando as mensagens guardadas…
        </span>
        <h1 className="mb-1 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Mensagens guardadas
        </h1>
        <p className="mb-6 text-[13px] leading-6 text-dim">
          O que você marcou com a estrela. Só você vê esta lista.
        </p>
        <section aria-hidden className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <p className="text-[14.5px] font-bold">Guardadas por você</p>
              <Esqueleto className="mt-2 h-2.5 w-[240px]" />
            </div>
            <Esqueleto className="h-9 w-[118px] rounded-[10px]" />
          </header>
          {[
            ['w-[140px]', 'w-[80%]', 'w-[46%]'],
            ['w-[110px]', 'w-[62%]', null],
            ['w-[160px]', 'w-[88%]', 'w-[70%]'],
          ].map(([nome, linha1, linha2], i) => (
            <div key={i} className="border-t border-line px-5 py-3.5 first:border-t-0">
              <span className="flex items-center gap-2">
                <Esqueleto className={`h-3 ${nome}`} />
                <span className="flex-1" />
                <Esqueleto className="h-2.5 w-[90px]" />
              </span>
              <Esqueleto className={`mt-2.5 h-2.5 ${linha1}`} />
              {linha2 && <Esqueleto className={`mt-1.5 h-2.5 ${linha2}`} />}
            </div>
          ))}
        </section>
      </main>
    </MioloCarregando>
  )
}
