import { MioloCarregando } from '@/components/design/esqueleto-do-cliente'
import { Esqueleto, EsqueletoDeAlternador, EsqueletoDeBotao } from '@/components/design/esqueleto'
import { Trilha } from '@/components/design/trilha'

/** Um cartão branco da página do negócio: título pequeno e linhas. */
function Bloco({ altura, linhas = 3 }: { altura: string; linhas?: number }) {
  return (
    <div className={`app-card flex flex-col gap-3 px-5 py-4 ${altura}`}>
      <Esqueleto className="h-2.5 w-24" />
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} className={`h-3 ${['w-[70%]', 'w-full', 'w-[50%]', 'w-[80%]'][i % 4]}`} />
      ))}
    </div>
  )
}

/**
 * A página do negócio enquanto vem: a trilha, o topo em cartão com valor e
 * ações, Visão geral | Histórico e as três colunas de cartões.
 */
export default function Carregando() {
  return (
    <MioloCarregando>
      <main className="w-full px-4 pt-[22px] pb-12 md:px-7">
        <div className="md:hidden">
          <Trilha caminho={[{ rotulo: 'Negócios' }, { rotulo: '…' }]} />
        </div>
        <div className="app-card mb-4 flex flex-col gap-4 px-5 py-5 md:px-6 lg:flex-row lg:items-start">
          <span className="flex min-w-0 flex-1 flex-col gap-3">
            <Esqueleto className="h-7 w-64 max-w-full rounded-lg" />
            <span className="flex items-center gap-3">
              <Esqueleto className="h-6 w-20 rounded-full" />
              <Esqueleto className="h-5 w-24" />
              <Esqueleto className="h-4 w-32" />
            </span>
          </span>
          <span className="flex gap-2">
            <EsqueletoDeBotao largura="w-28" />
            <EsqueletoDeBotao largura="w-28" />
            <EsqueletoDeBotao largura="w-28" />
            <EsqueletoDeBotao largura="w-9" />
          </span>
        </div>
        <EsqueletoDeAlternador opcoes={['Visão geral', 'Histórico']} className="mb-4" />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          <Bloco altura="h-[420px]" linhas={8} />
          <div className="flex flex-col gap-4">
            <Bloco altura="h-[180px]" linhas={4} />
            <Bloco altura="h-[150px]" />
            <Bloco altura="h-[110px]" linhas={2} />
          </div>
          <div className="hidden flex-col gap-4 xl:flex">
            <Bloco altura="h-[170px]" linhas={4} />
            <Bloco altura="h-[100px]" linhas={2} />
          </div>
        </div>
      </main>
    </MioloCarregando>
  )
}
