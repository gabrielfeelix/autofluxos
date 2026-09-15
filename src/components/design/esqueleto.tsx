/**
 * Os esqueletos — o desenho cinza que ocupa a tela enquanto o conteúdo vem.
 *
 * **Por que um arquivo só.** Cada tela tinha (ou não tinha) o seu, escrito na
 * mão dentro do `page.tsx`, e o resultado era esqueleto em duas telas e tela
 * congelada nas outras seis. Aqui eles ficam com o mesmo cinza, o mesmo raio e
 * o mesmo brilho, e uma tela nova ganha o dela escrevendo uma linha.
 *
 * **A regra de desenho: o esqueleto imita o que vem, não é um spinner.** Um
 * cartão vira um retângulo da altura do cartão, uma lista vira as linhas da
 * lista, um funil vira as colunas do funil. É isso que faz o olho já saber para
 * onde vai olhar quando o conteúdo chega, em vez de reaprender a tela.
 *
 * **Nunca invente número de itens.** Os esqueletos mostram uma quantidade fixa e
 * discreta (três, quatro), porque prometer dez linhas e entregar uma é pior que
 * não prometer nada.
 *
 * O `role="status"` com texto invisível existe porque um bloco cinza não é lido
 * por leitor de tela: sem ele, quem navega por áudio não recebe aviso nenhum
 * entre o clique e o conteúdo.
 */
import type { ReactNode } from 'react'

/** Um bloco cinza. A base de todo o resto. */
export function Esqueleto({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`app-esqueleto block ${className}`} />
}

/**
 * O anúncio para quem não vê o cinza.
 *
 * Um por esqueleto, e não um por bloco: `role="status"` repetido vira uma
 * enxurrada de avisos sobre a mesma espera.
 */
function Aviso({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  )
}

/** Linhas de texto de larguras diferentes — parágrafo, legenda, campo. */
export function EsqueletoDeTexto({
  linhas = 3,
  className = '',
}: {
  linhas?: number
  className?: string
}) {
  // As larguras variam de propósito: três barras do mesmo tamanho parecem
  // tabela, não texto.
  const larguras = ['w-full', 'w-[88%]', 'w-[64%]', 'w-[76%]']

  return (
    <span className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} className={`h-3 ${larguras[i % larguras.length]}`} />
      ))}
    </span>
  )
}

/**
 * Um cartão com cabeçalho e linhas — o formato da maioria das telas daqui
 * (Fluxos, Palavras-chave, Campanhas, Sequências, Contatos).
 *
 * `comRosto` liga o círculo da esquerda, que só existe onde a linha é gente.
 */
export function EsqueletoDeLista({
  linhas = 4,
  comRosto = false,
  comCabecalho = true,
  rotulo = 'Carregando…',
}: {
  linhas?: number
  comRosto?: boolean
  comCabecalho?: boolean
  rotulo?: string
}) {
  return (
    <div className="app-card overflow-hidden">
      {comCabecalho && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4">
          <span className="flex flex-col gap-2">
            <Esqueleto className="h-3.5 w-28" />
            <Esqueleto className="h-2.5 w-56 max-w-full" />
          </span>
          <Esqueleto className="h-8 w-32 rounded-lg" />
        </div>
      )}
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex h-14 items-center gap-3 border-b border-line px-5 last:border-b-0">
          {comRosto && <Esqueleto className="size-8 shrink-0 rounded-full" />}
          <Esqueleto className="h-3 w-40 max-w-[45%]" />
          <Esqueleto className="ml-auto h-3 w-16" />
        </div>
      ))}
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/** A grade de cartões — Templates, Configurações, atalhos do Painel. */
export function EsqueletoDeCartoes({
  quantidade = 6,
  altura = 'h-[132px]',
  colunas = 'sm:grid-cols-2 lg:grid-cols-3',
  rotulo = 'Carregando…',
}: {
  quantidade?: number
  altura?: string
  colunas?: string
  rotulo?: string
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${colunas}`}>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className={`app-card ${altura} flex flex-col gap-3 p-4`}>
          <Esqueleto className="size-8 rounded-lg" />
          <Esqueleto className="h-3.5 w-32 max-w-[70%]" />
          <Esqueleto className="h-2.5 w-full" />
          <Esqueleto className="h-2.5 w-[70%]" />
        </div>
      ))}
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/** As colunas do funil, cada uma com alguns cartões. */
export function EsqueletoDeQuadro({
  colunas = 4,
  rotulo = 'Carregando o funil…',
}: {
  colunas?: number
  rotulo?: string
}) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: colunas }, (_, coluna) => (
        <div key={coluna} className="app-card flex w-[264px] shrink-0 flex-col gap-3 p-3">
          <span className="flex items-center justify-between">
            <Esqueleto className="h-3 w-24" />
            <Esqueleto className="h-3 w-6 rounded-full" />
          </span>
          {Array.from({ length: 3 - (coluna % 2) }, (_, cartao) => (
            <div key={cartao} className="flex flex-col gap-2 rounded-[10px] border border-line p-3">
              <Esqueleto className="h-3 w-[70%]" />
              <Esqueleto className="h-2.5 w-[45%]" />
            </div>
          ))}
        </div>
      ))}
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/**
 * O Inbox: a fila à esquerda e a conversa à direita.
 *
 * As bolhas alternam lado porque uma coluna de blocos alinhados à esquerda não
 * se parece com conversa nenhuma — e é o alternado que faz o olho reconhecer a
 * tela antes de ler uma palavra.
 */
export function EsqueletoDeInbox({ rotulo = 'Carregando as conversas…' }: { rotulo?: string }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      <div className="app-card hidden w-[320px] shrink-0 flex-col overflow-hidden md:flex">
        <div className="border-b border-line p-3">
          <Esqueleto className="h-8 w-full rounded-lg" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line px-3.5 py-3">
            <Esqueleto className="size-9 shrink-0 rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Esqueleto className="h-3 w-28" />
              <Esqueleto className="h-2.5 w-full" />
            </span>
          </div>
        ))}
      </div>

      <div className="app-card flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Esqueleto className="size-9 rounded-full" />
          <Esqueleto className="h-3 w-40" />
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto
              key={i}
              className={`h-12 max-w-[62%] rounded-[14px] ${i % 2 === 0 ? 'w-[48%]' : 'w-[56%] self-end'}`}
            />
          ))}
        </div>
      </div>
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/**
 * A barra de abas enquanto o conteúdo vem.
 *
 * **Os rótulos são os de verdade, não blocos cinzas.** Eles não dependem de
 * consulta nenhuma, e trocá-los por cinza faria a barra piscar a cada clique —
 * apagando justamente a única parte da tela que a pessoa acabou de usar. Só a
 * contagem, que vem do banco, vira um pastilha cinza.
 */
export function EsqueletoDeAbas({
  abas,
  ativa,
}: {
  abas: readonly { chave: string; rotulo: string }[]
  ativa: string
}) {
  return (
    <div aria-hidden className="mb-5 flex flex-wrap gap-1 border-b border-line">
      {abas.map((item) => (
        <span
          key={item.chave}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold ${
            item.chave === ativa ? 'border-primary text-primary' : 'border-transparent text-dim'
          }`}
        >
          {item.rotulo}
          <Esqueleto className="h-3.5 w-5 rounded-full" />
        </span>
      ))}
    </div>
  )
}
