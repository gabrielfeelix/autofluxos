import Link from 'next/link'
import type { PassoDaTrilha } from '@/core/trilha-de-configuracao'

/**
 * A trilha no topo de Configurações, enquanto houver passo por fazer.
 *
 * Cinco colunas no computador, lista no celular. O próximo passo (o primeiro
 * pendente) é o único com botão cheio: com cinco links do mesmo peso a trilha
 * vira outro índice, e o índice é justamente o que já existe embaixo dela.
 * Passo bloqueado não é link: ele diz de qual depende, e o link certo é o
 * daquele.
 */
export function TrilhaDeConfiguracao({ clienteId, passos }: { clienteId: string; passos: PassoDaTrilha[] }) {
  const feitos = passos.filter((p) => p.estado === 'feito').length
  const proximo = passos.find((p) => p.estado === 'pendente')

  return (
    <section aria-labelledby="titulo-trilha" className="app-card mb-8 overflow-hidden">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-4 pb-3">
        <h2 id="titulo-trilha" className="text-[15px] font-bold tracking-[-0.01em]">
          Primeira configuração
        </h2>
        <p className="text-[12.5px] text-muted">
          {feitos} de {passos.length} feitos. Nesta ordem, a primeira conversa já chega atendida.
        </p>
      </header>

      <ol className="grid border-t border-line-soft md:grid-cols-5">
        {passos.map((passo, indice) => {
          const ehProximo = passo === proximo
          return (
            <li
              key={passo.chave}
              className={`flex gap-3 border-line-soft px-5 py-3.5 max-md:border-t max-md:first:border-t-0 md:flex-col md:gap-2 md:border-l md:first:border-l-0 ${
                ehProximo ? 'bg-primary-weak' : ''
              }`}
            >
              <span
                aria-hidden
                className={`grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  passo.estado === 'feito'
                    ? 'bg-primary text-white'
                    : ehProximo
                      ? 'border-2 border-primary text-primary'
                      : 'border border-strong text-dim'
                }`}
              >
                {passo.estado === 'feito' ? '✓' : indice + 1}
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`text-[13.5px] font-semibold ${passo.estado === 'feito' ? 'text-muted' : ''}`}>
                  {passo.titulo}
                </span>
                <span className="text-[12px] leading-[1.45] text-dim">
                  <span className="sr-only">
                    {passo.estado === 'feito' ? 'Feito.' : passo.estado === 'bloqueado' ? 'Bloqueado:' : 'Pendente:'}{' '}
                  </span>
                  {passo.estado === 'feito' ? 'Feito' : passo.motivo}
                </span>
                {passo.estado === 'pendente' && (
                  <Link
                    href={`/clientes/${clienteId}${passo.href}`}
                    className={`mt-1 self-start text-[12px] ${
                      ehProximo ? 'app-primary-button px-3 py-1.5' : 'font-semibold text-primary hover:opacity-80'
                    }`}
                  >
                    {ehProximo ? 'Fazer agora' : 'Abrir'}
                  </Link>
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
