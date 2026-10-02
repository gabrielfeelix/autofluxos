import type { ReactNode } from 'react'
import { CORES, ICONES, NOMES } from '@/core/flow/blocos'
import type { TipoNo } from '@/core/flow/schema'

/**
 * As peças da Ajuda, e a ideia que segura a página inteira.
 *
 * **Toda explicação daqui mostra os dois lados: a conversa e o desenho.** O
 * `Espelho` é isso literalmente, à esquerda o que a pessoa lê no WhatsApp, à
 * direita o bloco que produziu aquilo. É a única forma de responder as duas
 * perguntas que quem opera faz junto: *"como isso fica?"* e *"onde eu clico?"*.
 *
 * Os blocos desenhados aqui usam o nome, o ícone e a cor de `core/flow/blocos.ts`, os mesmos do editor. Não é economia: é o que impede a Ajuda de descrever um
 * produto que mudou de nome. Quando `http` deixou de se chamar "API", a página
 * acompanhou sem ninguém lembrar dela.
 *
 * Tudo é servidor e sem JavaScript. A sanfona de dúvidas é `<details>`, o índice
 * são âncoras, uma página de socorro não pode depender de um bundle carregar.
 */

/* ─────────────────────────── estrutura ─────────────────────────── */

/**
 * O corpo de um artigo. Título, categoria e trilha vêm do catálogo
 * (`artigos.ts`) e quem desenha é a página do artigo; aqui fica a chamada,
 * em corpo maior, e o texto.
 *
 * `etiqueta` e `titulo` continuam aceitos para os corpos se lerem sozinhos no
 * código, mas não aparecem: a página usa o título do catálogo.
 */
export function Secao({
  chamada,
  children,
}: {
  id: string
  etiqueta: string
  titulo: string
  chamada?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="artigo-de-ajuda">
      {chamada && <p className="text-[17px] leading-[1.65] text-soft">{chamada}</p>}
      <div className="mt-7 space-y-5 text-[15px] leading-[1.75] text-muted">{children}</div>
    </div>
  )
}

/** O endereço de um subtítulo: "E o 31 de fevereiro?" vira `e-o-31-de-fevereiro`. */
export function ancoraDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Um subtítulo do artigo. Ganha âncora para o sumário ao lado apontar. */
export function Sub({ children }: { children: ReactNode }) {
  const id = typeof children === 'string' ? ancoraDe(children) : undefined
  return (
    <h2
      id={id}
      className="scroll-mt-[96px] pt-6 text-[21px] leading-[1.25] font-bold tracking-[-0.02em] text-ink"
    >
      {children}
    </h2>
  )
}

/* ───────────────────────── texto e marcas ───────────────────────── */

/** Uma variável do fluxo, escrita como se escreve no campo. */
export function Var({ children }: { children: string }) {
  return (
    <code className="rounded-[5px] border border-emerald-400/20 bg-emerald-400/[0.09] px-[5px] py-[1px] font-mono text-[12px] whitespace-nowrap text-ok">
      {'{{'}
      {children}
      {'}}'}
    </code>
  )
}

/** Um valor literal: um caminho de JSON, um endereço, uma resposta. */
export function Cod({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[5px] border border-line bg-surface px-[5px] py-[1px] font-mono text-[12px] text-soft">
      {children}
    </code>
  )
}

/** Um bloco de código de verdade, JSON de resposta, corpo de requisição. */
export function Codigo({ titulo, children }: { titulo?: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {titulo && (
        <p className="border-b border-line px-3.5 py-2 text-[12.5px] font-semibold text-muted">
          {titulo}
        </p>
      )}
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11.5px] leading-[1.65] text-soft">
        {children}
      </pre>
    </div>
  )
}

const TOM_DA_NOTA = {
  atencao: {
    borda: 'border-amber-300/25 bg-amber-300/[0.05]',
    marca: 'text-aviso',
    simbolo: '!',
  },
  erro: {
    borda: 'border-rose-400/25 bg-rose-400/[0.05]',
    marca: 'text-perigo',
    simbolo: '×',
  },
  dica: {
    borda: 'border-primary/25 bg-primary/[0.05]',
    marca: 'text-primary',
    simbolo: '→',
  },
} as const

/**
 * O aviso ao lado do texto.
 *
 * Três tons, e cada um responde uma pergunta diferente: `atencao` é "isto tem
 * uma pegadinha", `erro` é "isto vai quebrar e você não vai ver", `dica` é "há
 * um caminho mais curto". Um tom só transformaria os três em decoração.
 */
export function Nota({
  tom = 'dica',
  titulo,
  children,
}: {
  tom?: keyof typeof TOM_DA_NOTA
  titulo: string
  children: ReactNode
}) {
  const estilo = TOM_DA_NOTA[tom]
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3.5 ${estilo.borda}`}>
      <span
        aria-hidden
        className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold ${estilo.marca}`}
      >
        {estilo.simbolo}
      </span>
      <div className="min-w-0 text-[13px] leading-[1.65]">
        <strong className={`block font-bold ${estilo.marca}`}>{titulo}</strong>
        <div className="mt-1 space-y-2 text-muted">{children}</div>
      </div>
    </div>
  )
}

/* ─────────────────────── o bloco, como no editor ─────────────────────── */

/**
 * Um bloco desenhado igual ao do editor, inclusive as alças.
 *
 * As alças pretas nas laterais não são enfeite: elas são a única coisa que
 * explica ramificação neste produto. *A setinha que você arrasta já é o
 * caminho.* Um bloco desenhado sem elas seria um cartão bonito que não ensina
 * nada sobre como as coisas se ligam.
 */
export function Bloco({
  tipo,
  titulo,
  children,
  saidas,
}: {
  tipo: TipoNo
  /** Sobrescreve o nome do tipo quando o exemplo pede ("Pergunta · a data"). */
  titulo?: string
  children?: ReactNode
  /** Os nomes das saídas, quando o bloco tem mais de uma. */
  saidas?: string[]
}) {
  return (
    <div
      className={`relative w-full max-w-[262px] overflow-hidden rounded-xl border bg-panel shadow-[0_14px_34px_rgba(19,25,34,0.077)] ${CORES[tipo]}`}
    >
      <p className="flex h-[38px] items-center gap-2 border-b border-line px-3 text-[10px] font-bold tracking-[0.06em] text-muted uppercase">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-[7px] bg-surface text-[13px] text-soft"
        >
          {ICONES[tipo]}
        </span>
        {titulo ?? NOMES[tipo]}
      </p>
      {children && (
        <div className="space-y-1.5 px-3 py-2.5 text-[11.5px] leading-[1.5] text-soft">
          {children}
        </div>
      )}
      {saidas && (
        <ul className="border-t border-line">
          {saidas.map((saida) => (
            <li
              key={saida}
              className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-1.5 text-[11px] text-muted last:border-0"
            >
              {saida}
              <span aria-hidden className="size-[7px] rounded-full bg-primary/70" />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Um campo do painel de propriedades, como ele aparece preenchido. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="font-mono text-[9.5px] tracking-[0.07em] text-dim uppercase">{rotulo}</span>
      <span className="min-w-0 break-words text-soft">{children}</span>
    </p>
  )
}

/* ─────────────────────────── a conversa ─────────────────────────── */

/** Uma mensagem no WhatsApp. `de="bot"` sai à esquerda; a pessoa, à direita. */
export function Zap({
  de = 'bot',
  botoes,
  children,
}: {
  de?: 'bot' | 'pessoa'
  /** Os botões da mensagem interativa, quando há. */
  botoes?: string[]
  children: ReactNode
}) {
  const daPessoa = de === 'pessoa'
  return (
    <div className={`flex ${daPessoa ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-[13px] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-line ${
          daPessoa
            ? 'rounded-br-[4px] bg-[#d9fdd3] text-[#111b21]'
            : 'rounded-bl-[4px] border border-line bg-white text-[#111b21]'
        }`}
      >
        {children}
        {botoes && (
          <span className="mt-2 block space-y-1 border-t border-line pt-2">
            {botoes.map((botao) => (
              <span
                key={botao}
                className="block rounded-[7px] border border-line py-1 text-center text-[11.5px] font-semibold text-primary"
              >
                {botao}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

/** O celular em volta da conversa. Dá contexto sem virar mockup de loja. */
export function Conversa({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <div className="w-full max-w-[300px] overflow-hidden rounded-2xl border border-line bg-[#efeae2]">
      <p className="flex items-center gap-2 border-b border-line bg-panel px-3.5 py-2.5">
        <span
          aria-hidden
          className="flex size-[22px] items-center justify-center rounded-full bg-[#25d366] text-[10px] font-bold text-white"
        >
          W
        </span>
        <span className="text-[11.5px] font-semibold text-soft">{titulo ?? 'WhatsApp'}</span>
      </p>
      <div className="space-y-1.5 px-3 py-3.5">{children}</div>
    </div>
  )
}

/**
 * **A peça assinatura da página: a conversa e o desenho, lado a lado.**
 *
 * Quem opera não tem dificuldade em imaginar a conversa nem em enxergar o
 * desenho, a dificuldade é ligar um no outro. Explicar só com prosa deixa essa
 * ligação por conta do leitor, e é exatamente aí que se erra: escrever
 * `{{horario}}` no corpo do POST quando a API queria o id parece certo em texto
 * e é errado na tela.
 *
 * No celular as duas colunas viram uma, com a conversa em cima, é a metade que
 * dá sentido à outra.
 */
export function Espelho({
  conversa,
  desenho,
  nota,
}: {
  conversa: ReactNode
  desenho: ReactNode
  nota?: ReactNode
}) {
  return (
    <div className="app-card overflow-hidden">
      <div className="grid gap-6 p-5 md:grid-cols-[300px_1fr] md:items-start md:gap-7">
        <div>
          <p className="mb-2.5 text-[12.5px] font-semibold text-muted">
            O que a pessoa vê
          </p>
          {conversa}
        </div>
        <div className="min-w-0 md:border-l md:border-line md:pl-7">
          <p className="mb-2.5 text-[12.5px] font-semibold text-muted">
            O que você desenha
          </p>
          <div className="space-y-3">{desenho}</div>
        </div>
      </div>
      {nota && (
        <p className="border-t border-line bg-panel px-5 py-3 text-[12.5px] leading-[1.6] text-muted">
          {nota}
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── sequência e listas ───────────────────────── */

/**
 * Passos numerados, **só onde a ordem é informação**.
 *
 * Ligar a Verandi tem ordem de verdade: sem a credencial cadastrada, o bloco não
 * chama nada. Já a lista de blocos não tem ordem nenhuma, e numerá-la seria
 * inventar uma sequência que o produto não tem.
 */
export function Passos({ children }: { children: ReactNode }) {
  return <ol className="space-y-3.5">{children}</ol>
}

export function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="app-card flex gap-3.5 p-4">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.12] font-mono text-[12px] font-bold text-primary"
      >
        {n}
      </span>
      <div className="min-w-0 space-y-2">
        <strong className="block text-[14px] font-bold text-ink">{titulo}</strong>
        <div className="space-y-2 text-[13px] leading-[1.65]">{children}</div>
      </div>
    </li>
  )
}

/** Uma pergunta da sanfona. Fechada por padrão: a página é para varrer. */
export function Duvida({ p, children }: { p: string; children: ReactNode }) {
  return (
    <details className="group app-card app-card-interactive overflow-hidden">
      <summary className="flex list-none items-start gap-3 px-4 py-3.5 text-[13.5px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="mt-[3px] shrink-0 font-mono text-[11px] text-primary transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        {p}
      </summary>
      <div className="space-y-2.5 border-t border-line px-4 py-3.5 pl-[34px] text-[13px] leading-[1.7] text-muted">
        {children}
      </div>
    </details>
  )
}

/** Uma tabela que rola sozinha no celular em vez de empurrar a página. */
export function Tabela({ cabecalho, children }: { cabecalho: string[]; children: ReactNode }) {
  return (
    <div className="app-card overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-line">
            {cabecalho.map((coluna) => (
              <th
                key={coluna}
                scope="col"
                className="px-3.5 py-2.5 text-[12.5px] font-semibold text-ink"
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export function Linha({ children }: { children: ReactNode }) {
  return <tr className="align-top">{children}</tr>
}

export function Cel({ children, forte }: { children: ReactNode; forte?: boolean }) {
  return (
    <td className={`px-3.5 py-2.5 leading-[1.6] ${forte ? 'text-soft' : 'text-muted'}`}>
      {children}
    </td>
  )
}
