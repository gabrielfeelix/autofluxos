/**
 * Os esqueletos, o desenho cinza que ocupa a tela enquanto o conteúdo vem.
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
import { IconeDoQuadro } from '@/components/quadros/popover-do-quadro'
import { CabecalhoDaTela } from './cabecalho-da-tela'
import { Trilha } from './trilha'
import { Miolo, type LarguraDoMiolo } from './miolo'

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
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  )
}

/** Linhas de texto de larguras diferentes, parágrafo, legenda, campo. */
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
 * Um cartão com cabeçalho e linhas, o formato da maioria das telas daqui
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

/** A grade de cartões, Templates, Configurações, atalhos do Painel. */
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

/**
 * As colunas do funil, cada uma com alguns cartões: coluna em vidro (o
 * `bg-surface` da coluna real) e cartão branco, na mesma largura de 300px.
 */
export function EsqueletoDeQuadro({
  colunas = 5,
  rotulo = 'Carregando o funil…',
}: {
  colunas?: number
  rotulo?: string
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
      {Array.from({ length: colunas }, (_, coluna) => (
        <div
          key={coluna}
          className="flex w-[290px] shrink-0 flex-col gap-2.5 rounded-xl border border-line/60 bg-surface p-2.5 sm:w-[300px]"
        >
          <span className="flex items-center justify-between px-1 py-1.5">
            <Esqueleto className="h-3 w-24" />
            <Esqueleto className="h-4 w-10 rounded-full" />
          </span>
          {Array.from({ length: coluna === 0 ? 1 : 4 - (coluna % 2) }, (_, cartao) => (
            <div key={cartao} className="app-card flex flex-col gap-2.5 p-3">
              <Esqueleto className="h-3 w-[60%]" />
              <Esqueleto className="h-3 w-20" />
              <span className="flex items-center gap-2">
                <Esqueleto className="size-5 rounded-full" />
                <Esqueleto className="h-2.5 w-[55%]" />
              </span>
            </div>
          ))}
        </div>
      ))}
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/**
 * O funil inteiro enquanto vem: topo com o nome do funil, Quadro | Lista e as
 * ações, a barra de busca e as colunas. Usado pelo `loading.tsx` e pela
 * espera da página, para os dois serem a mesma coisa.
 */
export function EsqueletoDoFunil() {
  return (
    <>
    <header className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
      <Esqueleto className="size-9 rounded-[9px]" />
      <span className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-dim uppercase">Negócios</span>
        <Esqueleto className="h-6 w-36 rounded-lg" />
      </span>
      <span className="topo-acoes ml-auto flex flex-wrap items-center gap-2">
        <EsqueletoDeAlternador opcoes={['Quadro', 'Lista']} />
        <EsqueletoDeBotao largura="w-24" />
        <EsqueletoDeBotao largura="w-24" />
        <EsqueletoDeBotao largura="w-9" />
      </span>
    </header>
    <EsqueletoDeBusca placeholder="Buscar negócio ou contato…" filtros className="mb-4">
      <Esqueleto className="h-9 w-[120px] rounded-[10px]" />
    </EsqueletoDeBusca>
    <EsqueletoDeQuadro />
    </>
  )
}

/**
 * O Inbox: um quadro branco só, como a `MolduraDoInbox`, com a barra de
 * cima atravessando, a fila à esquerda, a conversa no meio e a ficha à
 * direita. O título "Caixa de Entrada" vai escrito: não depende de consulta.
 *
 * As bolhas alternam lado porque uma coluna de blocos alinhados à esquerda não
 * se parece com conversa nenhuma, e é o alternado que faz o olho reconhecer a
 * tela antes de ler uma palavra.
 */
export function EsqueletoDeInbox({ rotulo = 'Carregando as conversas…' }: { rotulo?: string }) {
  return (
    <div className="app-inbox flex min-h-[420px] flex-col overflow-hidden bg-panel md:h-full">
      <div className="border-b border-line">
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
          <span className="text-[17px] font-bold tracking-[-0.02em]">Caixa de Entrada</span>
          <Esqueleto className="h-6 w-9 rounded-full" />
        </div>
        <div className="flex gap-2 overflow-hidden px-4 pb-3">
          {['w-36', 'w-40', 'w-24', 'w-44'].map((largura, i) => (
            <Esqueleto key={i} className={`h-8 shrink-0 rounded-full ${largura}`} />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col overflow-hidden border-line md:w-[320px] md:border-r">
          <div className="p-3">
            <Esqueleto className="h-9 w-full rounded-[10px]" />
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3">
              <Esqueleto className="size-11 shrink-0 rounded-full" />
              <span className="flex min-w-0 flex-1 flex-col gap-2.5">
                <Esqueleto className="h-3.5 w-32" />
                <Esqueleto className="h-3 w-full" />
              </span>
            </div>
          ))}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Esqueleto className="size-10 rounded-full" />
            <Esqueleto className="h-3.5 w-40" />
            <Esqueleto className="ml-auto h-9 w-40 rounded-[10px]" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Esqueleto
                key={i}
                className={`h-12 max-w-[62%] rounded-[14px] ${i % 2 === 0 ? 'w-[48%]' : 'w-[56%] self-end'}`}
              />
            ))}
          </div>
          <div className="p-4 pt-0">
            <Esqueleto className="h-[92px] w-full rounded-[14px]" />
          </div>
        </div>
        <div className="hidden w-[296px] shrink-0 flex-col gap-4 border-l border-line p-4 xl:flex">
          <span className="flex items-center gap-3">
            <Esqueleto className="size-10 rounded-full" />
            <span className="flex flex-1 flex-col gap-2">
              <Esqueleto className="h-3.5 w-28" />
              <Esqueleto className="h-3 w-24" />
            </span>
          </span>
          <Esqueleto className="h-24 w-full rounded-xl" />
          <Esqueleto className="h-28 w-full rounded-xl" />
        </div>
      </div>
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/**
 * O topo da tela enquanto ela vem: o `CabecalhoDaTela` de verdade.
 *
 * **Título e descrição vão escritos, não em cinza.** Eles não dependem de
 * consulta, e trocá-los por osso fazia o topo piscar a cada clique e a tela
 * "pular" quando chegava (02/out/2026). Só o que vem do banco vira osso: a
 * contagem ao lado do título e os botões, que dependem de permissão.
 *
 * `acoes` são as larguras dos botões da direita, na ordem da tela pronta.
 */
export function TopoCarregando({
  titulo,
  descricao,
  contagem = false,
  acoes = [],
  trilha,
}: {
  titulo: ReactNode
  descricao?: ReactNode
  contagem?: boolean
  acoes?: string[]
  /** O caminho de volta ("Configurações", "Funções"): escrito, sem link, porque o loading não sabe a conta. */
  trilha?: string[]
}) {
  return (
    <>
    {trilha && <Trilha caminho={trilha.map((rotulo) => ({ rotulo }))} />}
    <CabecalhoDaTela
      titulo={titulo}
      descricao={descricao}
      contagem={contagem ? <Esqueleto className="h-6 w-20 rounded-full" /> : undefined}
      acoes={
        acoes.length > 0 ? (
          <>
            {acoes.map((largura, i) => (
              <EsqueletoDeBotao key={i} largura={largura} />
            ))}
          </>
        ) : undefined
      }
    />
    </>
  )
}

/** Um botão `md` (36px) enquanto vem. */
export function EsqueletoDeBotao({ largura = 'w-28' }: { largura?: string }) {
  return <Esqueleto className={`h-9 rounded-[9px] ${largura}`} />
}

/**
 * A barra de busca da `BarraDeLista`, **fora do cartão**, com o texto de
 * exemplo escrito: é a mesma caixa branca que vai chegar, só sem resposta.
 */
export function EsqueletoDeBusca({
  placeholder,
  filtros = false,
  acoes = [],
  className = 'mb-3',
  children,
}: {
  placeholder: string
  filtros?: boolean
  /** Larguras dos botões à direita da barra. */
  acoes?: string[]
  className?: string
  /** O que mora na mesma linha, depois de Filtros (um alternador). */
  children?: ReactNode
}) {
  return (
    <div aria-hidden className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="campo-de-busca relative block w-full sm:max-w-[380px] sm:flex-1">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
          <IconeDoQuadro tipo="busca" />
        </span>
        <span className="app-field flex h-9 items-center py-2 pr-3 pl-9 text-[13px] text-dim">{placeholder}</span>
      </span>
      {filtros && (
        <span className="quadro-tool">
          <IconeDoQuadro tipo="filtro" />
          <span>Filtros</span>
        </span>
      )}
      {children}
      {acoes.length > 0 && (
        <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {acoes.map((largura, i) => (
            <EsqueletoDeBotao key={i} largura={largura} />
          ))}
        </span>
      )}
    </div>
  )
}

/**
 * O `Alternador` enquanto o conteúdo vem, com os rótulos de verdade e a opção
 * certa acesa: é a parte da tela que a pessoa acabou de clicar, e ela não pode
 * piscar. Substitui as abas sublinhadas, que nenhuma tela usa mais.
 */
export function EsqueletoDeAlternador({
  opcoes,
  ativa = 0,
  className = '',
}: {
  opcoes: readonly string[]
  /** O índice da opção acesa. */
  ativa?: number
  className?: string
}) {
  return (
    <div aria-hidden className={`alternador ${className}`}>
      {opcoes.map((rotulo, i) => (
        <span key={rotulo} className="alternador-opcao" aria-current={i === ativa ? 'page' : undefined}>
          {rotulo}
        </span>
      ))}
    </div>
  )
}

/**
 * Linhas de lista dentro de cartão branco, sem cabeçalho: o cabeçalho mora
 * fora do cartão (`TopoCarregando`). `colunas` desenha uma faixa de títulos de
 * tabela em cima, para quando a tela pronta é tabela.
 */
export function EsqueletoDeLinhas({
  linhas = 5,
  comRosto = false,
  colunas = 0,
  altura = 'h-14',
  rotulo = 'Carregando…',
  className = '',
}: {
  linhas?: number
  comRosto?: boolean
  colunas?: number
  altura?: string
  rotulo?: string
  className?: string
}) {
  return (
    <div className={`app-card overflow-hidden ${className}`}>
      {colunas > 0 && (
        <div className="flex h-10 items-center gap-6 border-b border-line px-5">
          {Array.from({ length: colunas }, (_, i) => (
            <Esqueleto key={i} className={`h-2.5 ${i === 0 ? 'w-24' : 'w-16'} ${i > 1 ? 'hidden md:block' : ''}`} />
          ))}
        </div>
      )}
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={`flex ${altura} items-center gap-3 border-b border-line px-5 last:border-b-0`}>
          {comRosto && <Esqueleto className="size-8 shrink-0 rounded-full" />}
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Esqueleto className={`h-3 ${['w-44', 'w-56', 'w-36', 'w-48'][i % 4]} max-w-[60%]`} />
            <Esqueleto className="h-2.5 w-24 max-w-[40%]" />
          </span>
          <Esqueleto className="hidden h-3 w-20 md:block" />
          <Esqueleto className="h-7 w-16 rounded-lg" />
        </div>
      ))}
      <Aviso>{rotulo}</Aviso>
    </div>
  )
}

/**
 * Uma tela de Configurações enquanto ela vem: caminho, título e frase de
 * verdade (`TopoCarregando`), e o corpo. Sem `children`, o corpo são dois
 * cartões de formulário, que é o formato da maioria delas.
 *
 * Era um bloco de seis linhas de texto solto, que não parecia com nenhuma das
 * telas daqui; depois virou caminho e título em osso, que piscavam ao chegar
 * (02/out/2026). Cada subtela tem o seu `loading.tsx` com o próprio título.
 */
export function EsqueletoDeAjuste({
  titulo,
  descricao,
  trilha = ['Configurações'],
  acoes,
  contagem,
  largura = 'leitura',
  rotulo = 'Carregando a configuração…',
  children,
}: {
  titulo?: ReactNode
  descricao?: ReactNode
  trilha?: string[]
  acoes?: string[]
  contagem?: boolean
  largura?: LarguraDoMiolo
  rotulo?: string
  children?: ReactNode
}) {
  return (
    <Miolo largura={largura}>
      <Aviso>{rotulo}</Aviso>
      <TopoCarregando
        trilha={titulo && trilha.length > 0 ? [...trilha, String(titulo)] : undefined}
        titulo={titulo ?? <Esqueleto className="my-1 h-[26px] w-56 rounded-lg" />}
        descricao={descricao ?? <Esqueleto className="mt-1.5 h-3 w-full max-w-[520px]" />}
        acoes={acoes}
        contagem={contagem}
      />
      {children ?? <EsqueletoDeFormulario />}
    </Miolo>
  )
}

/**
 * A ficha de cadastro da organização (`FichaDoCliente`) em leitura: cabeçalho
 * com "Editar", o logo e os campos em duas colunas. Não é formulário: quem
 * abre a tela vê texto, e o campo só aparece depois do "Editar".
 */
export function EsqueletoDaFicha({ observacoes = false }: { observacoes?: boolean }) {
  return (
    <div className="app-card mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <span className="flex flex-col gap-1.5">
          <Esqueleto className="h-3.5 w-20" />
          <Esqueleto className="h-2.5 w-64 max-w-full" />
        </span>
        <Esqueleto className="h-8 w-16 shrink-0 rounded-lg" />
      </div>
      <div className="flex flex-col items-start gap-6 p-4 sm:flex-row sm:p-6">
        <Esqueleto className="size-[72px] shrink-0 rounded-[14px]" />
        <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {Array.from({ length: observacoes ? 5 : 4 }, (_, i) => (
            <span key={i} className="flex flex-col gap-2">
              <Esqueleto className="h-2.5 w-24" />
              <Esqueleto className="h-3 w-32" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Dois cartões de formulário: título, frase e campos em duas colunas. */
export function EsqueletoDeFormulario({ cartoes = [3, 2] }: { cartoes?: number[] }) {
  return (
    <>
      {cartoes.map((campos, cartao) => (
        <div key={cartao} className="app-card mb-5 p-5">
          <Esqueleto className="h-4 w-44 rounded" />
          <Esqueleto className="mt-2 mb-5 h-3 w-72 max-w-full rounded" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: campos * 2 }, (_, i) => (
              <div key={i}>
                <Esqueleto className="mb-2 h-3 w-24 rounded" />
                <Esqueleto className="h-10 w-full rounded-[10px]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
