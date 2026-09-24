import { Esqueleto } from '@/components/design/esqueleto'
import { ABAS_DA_ORGANIZACAO } from './abas'

/**
 * Os esqueletos do detalhe da organização e das abas, cada um no formato da
 * tela pronta. As abas são escritas de verdade (não dependem de consulta),
 * pelo mesmo motivo de a barra lateral ser escrita: trocar de aba não pode
 * apagar justamente a parte da tela que a pessoa acabou de clicar.
 */

function Aviso({ children }: { children: string }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  )
}

export function EsqueletoDoDetalhe() {
  return (
    <main className="flex min-h-full w-full flex-col px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <Esqueleto className="mb-3 h-3 w-40" />
      <header className="mb-4 flex items-center gap-4">
        <Esqueleto className="size-12 shrink-0 rounded-full" />
        <span className="flex flex-1 flex-col gap-2">
          <Esqueleto className="h-6 w-56 max-w-full" />
          <Esqueleto className="h-3 w-72 max-w-full" />
        </span>
        <Esqueleto className="hidden h-10 w-40 rounded-[10px] sm:block" />
      </header>
      <div aria-hidden className="mb-5 flex gap-1 overflow-hidden border-b border-line whitespace-nowrap">
        {ABAS_DA_ORGANIZACAO.map((aba, i) => (
          <span key={aba.chave} className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold sm:px-3.5 ${i === 0 ? 'border-primary text-primary' : 'border-transparent text-dim'}`}>
            {aba.rotulo}
          </span>
        ))}
      </div>
      <EsqueletoDoResumo />
      <Aviso>Carregando a organização…</Aviso>
    </main>
  )
}

export function EsqueletoDoResumo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="app-card flex flex-col gap-2.5 px-4 py-3.5">
            <Esqueleto className="h-2.5 w-24" />
            <Esqueleto className="h-6 w-14" />
            <Esqueleto className="h-2.5 w-32 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="app-card overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <Esqueleto className="h-3.5 w-36" />
            </div>
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
                <Esqueleto className="size-8 shrink-0 rounded-full" />
                <Esqueleto className="h-3 w-[55%]" />
                <Esqueleto className="ml-auto h-3 w-12" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EsqueletoDeFormulario() {
  return (
    <div className="flex max-w-[1100px] flex-col gap-4">
      <div className="app-card flex flex-col gap-4 p-5">
        <Esqueleto className="h-4 w-40" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="flex flex-col gap-2">
              <Esqueleto className="h-2.5 w-24" />
              <Esqueleto className="h-10 w-full rounded-[10px]" />
            </span>
          ))}
        </div>
        <Esqueleto className="h-10 w-36 rounded-[10px]" />
      </div>
      <div className="app-card flex items-center gap-4 p-5">
        <Esqueleto className="size-14 shrink-0 rounded-full" />
        <Esqueleto className="h-10 w-40 rounded-[10px]" />
      </div>
      <Aviso>Carregando os dados…</Aviso>
    </div>
  )
}

export function EsqueletoDaTabelaSolta({
  colunas,
  rotulo,
  comBotao = false,
  comBarra = false,
}: {
  colunas: number
  rotulo: string
  comBotao?: boolean
  comBarra?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(comBotao || comBarra) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {comBarra ? <Esqueleto className="h-9 w-full rounded-[10px] sm:w-[320px]" /> : <Esqueleto className="h-3 w-20" />}
          {comBotao && <Esqueleto className="h-9 w-32 shrink-0 rounded-[10px]" />}
        </div>
      )}
      <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 items-center gap-6 border-b border-line px-4">
          {Array.from({ length: colunas }, (_, i) => (
            <Esqueleto key={i} className={`h-2.5 ${i === 0 ? 'w-28' : 'w-16'}`} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex h-[58px] items-center gap-6 border-b border-line px-4 last:border-0">
            <span className="flex w-[200px] shrink-0 items-center gap-3">
              <Esqueleto className="size-8 shrink-0 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Esqueleto className="h-3 w-[80%]" />
                <Esqueleto className="h-2 w-[55%]" />
              </span>
            </span>
            {Array.from({ length: colunas - 1 }, (_, c) => (
              <Esqueleto key={c} className={`hidden h-3 md:block ${c % 2 ? 'w-14' : 'w-20'}`} />
            ))}
          </div>
        ))}
      </div>
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

export function EsqueletoDePerigo() {
  return (
    <div className="flex max-w-[1100px] flex-col gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="app-card flex items-center gap-4 px-5 py-4">
          <span className="flex flex-1 flex-col gap-2">
            <Esqueleto className="h-3.5 w-48" />
            <Esqueleto className="h-2.5 w-full max-w-[520px]" />
          </span>
          <Esqueleto className="h-9 w-24 rounded-[10px]" />
        </div>
      ))}
      <Aviso>Carregando…</Aviso>
    </div>
  )
}
