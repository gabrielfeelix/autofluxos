'use client'

import { Aviso, Esqueleto } from '@/components/design/esqueleto'
import { useLarguraDosBlocos } from './largura-guardada'

/**
 * O editor de automação enquanto abre: barra do topo, catálogo de blocos à
 * esquerda, o desenho pontilhado no meio e o painel do bloco à direita.
 *
 * Antes valia o esqueleto da **lista** de automações (`fluxos/loading.tsx`),
 * herdado pela rota do editor por falta de um próprio: quem clicava numa
 * automação via título, busca e linhas de tabela, e depois a tela trocava
 * inteira por outra. Esqueleto que não tem a forma da tela que vem é pior que
 * nenhum, porque promete uma coisa e entrega outra.
 *
 * É cliente só para ler a largura do catálogo que a pessoa deixou
 * (`useLarguraDosBlocos`): com ela fixa em 232, a barra pulava para o lugar
 * dela quando o editor chegava.
 */
export function EsqueletoDoEditor() {
  const [larguraDosBlocos] = useLarguraDosBlocos()

  return (
    <div className="app-editor flex h-dvh w-full flex-col overflow-hidden bg-canvas">
      <Aviso>Abrindo a automação…</Aviso>

      <header className="flex h-[54px] shrink-0 items-center gap-3 overflow-hidden border-b border-line bg-panel px-4">
        <Esqueleto className="size-8 shrink-0 rounded-[9px]" />
        <span className="flex shrink-0 flex-col gap-1.5">
          <Esqueleto className="h-3.5 w-36" />
          <Esqueleto className="h-3 w-24" />
        </span>
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line max-md:hidden" />
        <Esqueleto className="h-3 w-12 shrink-0 max-md:hidden" />
        <Esqueleto className="h-3 w-24 shrink-0 max-lg:hidden" />
        <Esqueleto className="h-[30px] w-[290px] shrink-0 rounded-[9px] max-lg:hidden" />
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {['w-24', 'w-24', 'w-8', 'w-20', 'w-28', 'w-20', 'w-16'].map((largura, i) => (
            <Esqueleto key={i} className={`h-[34px] ${largura} rounded-[9px] max-lg:hidden`} />
          ))}
          <Esqueleto className="h-[34px] w-24 rounded-[9px] bg-primary/25" />
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* O catálogo: busca, grupos e um bloco por linha, com ícone e descrição. */}
        <nav
          aria-hidden
          style={{ width: larguraDosBlocos }}
          className="shrink-0 overflow-hidden border-r border-line bg-panel px-3 py-3.5 max-md:hidden"
        >
          <span className="block h-[34px] rounded-[10px] border border-line" />
          {[4, 3, 4].map((quantos, grupo) => (
            <div key={grupo} className="mt-5">
              <Esqueleto className="mb-3 ml-2 h-2.5 w-20" />
              {Array.from({ length: quantos }, (_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                  <Esqueleto className="size-9 shrink-0 rounded-[9px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Esqueleto className={`h-3 ${i % 2 ? 'w-16' : 'w-24'}`} />
                    <Esqueleto className="h-2.5 w-28 max-w-full" />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/*
          O desenho: o pontilhado do canvas e uma árvore de blocos ligados, no
          tamanho em que o editor os mostra ao abrir (cabendo na tela). Uma
          automação de verdade tem dez blocos, não três.
        */}
        <div
          aria-hidden
          className="relative min-w-0 flex-1 overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(var(--line) 1.4px, transparent 1.4px)',
            backgroundSize: '70px 70px',
          }}
        >
          <div className="absolute top-1/2 left-1/2 h-[560px] w-[580px] -translate-x-1/2 -translate-y-1/2 scale-90 max-md:scale-[0.6]">
            <svg className="absolute inset-0 size-full overflow-visible text-strong/30" fill="none" stroke="currentColor" strokeWidth="1.4">
              {LIGACOES.map(([de, para]) => {
                const a = BLOCOS[de]!
                const b = BLOCOS[para]!
                const x1 = a.x + LARGURA_DO_BLOCO / 2
                const y1 = a.y + a.altura
                const x2 = b.x + LARGURA_DO_BLOCO / 2
                const meio = y1 + (b.y - y1) / 2
                return <path key={`${de}-${para}`} d={`M${x1} ${y1} V${meio} H${x2} V${b.y}`} />
              })}
            </svg>
            {BLOCOS.map((bloco, i) => (
              <div
                key={i}
                className="absolute overflow-hidden rounded-[10px] border border-line bg-panel shadow-[0_4px_12px_rgba(19,25,34,0.05)]"
                style={{ left: bloco.x, top: bloco.y, width: LARGURA_DO_BLOCO, height: bloco.altura }}
              >
                <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-2">
                  <Esqueleto className="size-3.5 rounded" />
                  <Esqueleto className="h-2 w-14" />
                </div>
                <div className="space-y-1.5 px-2.5 py-2">
                  <Esqueleto className="h-2 w-[88%]" />
                  {bloco.altura > 60 && <Esqueleto className="h-2 w-[60%]" />}
                  {bloco.altura > 80 && <Esqueleto className="h-4 w-full rounded-md" />}
                </div>
              </div>
            ))}
          </div>
          <Esqueleto className="absolute bottom-3 left-4 h-[94px] w-[146px] rounded-[10px] max-md:hidden" />
          <Esqueleto className="absolute right-3 bottom-3 h-[108px] w-7 rounded-[8px]" />
        </div>

        {/* O painel do bloco: abas e a caixa de "selecione um bloco". */}
        <aside aria-hidden className="w-[420px] shrink-0 border-l border-line bg-panel max-lg:hidden">
          <div className="border-b border-line px-3 py-2.5">
            <Esqueleto className="h-[34px] w-full rounded-[10px]" />
          </div>
          <div className="p-3">
            <span className="flex h-[118px] flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-line">
              <Esqueleto className="h-3 w-56" />
              <Esqueleto className="h-3 w-44" />
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Os blocos do desenho de mentira: posição e altura, numa caixa de 580 por 560. */
const LARGURA_DO_BLOCO = 150
const BLOCOS: readonly { x: number; y: number; altura: number }[] = [
  { x: 220, y: 0, altura: 58 },
  { x: 220, y: 92, altura: 96 },
  { x: 40, y: 230, altura: 56 },
  { x: 40, y: 316, altura: 96 },
  { x: 0, y: 470, altura: 58 },
  { x: 260, y: 300, altura: 62 },
  { x: 260, y: 410, altura: 90 },
  { x: 430, y: 240, altura: 56 },
  { x: 200, y: 540, altura: 56 },
]
/** Quem liga em quem, pelo índice em `BLOCOS`. */
const LIGACOES: readonly [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [5, 6],
  [1, 7],
  [6, 8],
]
