import type { ReactNode } from 'react'
import { CORES, ICONES, NOMES } from '@/core/flow/blocos'
import type { TipoNo } from '@/core/flow/schema'

/**
 * As peças da Ajuda — e a ideia que segura a página inteira.
 *
 * **Toda explicação daqui mostra os dois lados: a conversa e o desenho.** O
 * `Espelho` é isso literalmente — à esquerda o que a pessoa lê no WhatsApp, à
 * direita o bloco que produziu aquilo. É a única forma de responder as duas
 * perguntas que quem opera faz junto: *"como isso fica?"* e *"onde eu clico?"*.
 *
 * Os blocos desenhados aqui usam o nome, o ícone e a cor de `core/flow/blocos.ts`
 * — os mesmos do editor. Não é economia: é o que impede a Ajuda de descrever um
 * produto que mudou de nome. Quando `http` deixou de se chamar "API", a página
 * acompanhou sem ninguém lembrar dela.
 *
 * Tudo é servidor e sem JavaScript. A sanfona de dúvidas é `<details>`, o índice
 * são âncoras — uma página de socorro não pode depender de um bundle carregar.
 */

/* ─────────────────────────── estrutura ─────────────────────────── */

export function Secao({
  id,
  etiqueta,
  titulo,
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
    <section id={id} className="scroll-mt-[86px] border-t border-white/[0.06] pt-11 first:border-0">
      <p className="font-mono text-[10.5px] font-bold tracking-[0.16em] text-accent uppercase">
        {etiqueta}
      </p>
      <h2 className="mt-2 text-[24px] leading-[1.15] font-bold tracking-[-0.025em] text-balance md:text-[29px]">
        {titulo}
      </h2>
      {chamada && (
        <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.65] text-soft">{chamada}</p>
      )}
      <div className="mt-6 space-y-5 text-[13.5px] leading-[1.7] text-muted">{children}</div>
    </section>
  )
}

/** Um subtítulo dentro de uma seção. */
export function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 text-[16px] font-bold tracking-[-0.015em] text-ink">{children}</h3>
  )
}

/* ───────────────────────── texto e marcas ───────────────────────── */

/** Uma variável do fluxo, escrita como se escreve no campo. */
export function Var({ children }: { children: string }) {
  return (
    <code className="rounded-[5px] border border-emerald-400/20 bg-emerald-400/[0.09] px-[5px] py-[1px] font-mono text-[12px] whitespace-nowrap text-emerald-200">
      {'{{'}
      {children}
      {'}}'}
    </code>
  )
}

/** Um valor literal: um caminho de JSON, um endereço, uma resposta. */
export function Cod({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[5px] border border-white/[0.09] bg-white/[0.045] px-[5px] py-[1px] font-mono text-[12px] text-soft">
      {children}
    </code>
  )
}

/** Um bloco de código de verdade — JSON de resposta, corpo de requisição. */
export function Codigo({ titulo, children }: { titulo?: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#070a0e]">
      {titulo && (
        <p className="border-b border-white/[0.06] px-3.5 py-2 font-mono text-[10.5px] tracking-[0.08em] text-dim uppercase">
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
    marca: 'text-amber-200',
    simbolo: '!',
  },
  erro: {
    borda: 'border-rose-400/25 bg-rose-400/[0.05]',
    marca: 'text-rose-200',
    simbolo: '×',
  },
  dica: {
    borda: 'border-accent/25 bg-accent/[0.05]',
    marca: 'text-accent',
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
 * Um bloco desenhado igual ao do editor — inclusive as alças.
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
      className={`relative w-full max-w-[262px] overflow-hidden rounded-xl border bg-[#0b1018] shadow-[0_14px_34px_rgba(0,0,0,0.35)] ${CORES[tipo]}`}
    >
      <p className="flex h-[38px] items-center gap-2 border-b border-white/[0.06] px-3 text-[10px] font-bold tracking-[0.06em] text-[#97a2b4] uppercase">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-[7px] bg-white/[0.05] text-[13px] text-soft"
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
        <ul className="border-t border-white/[0.06]">
          {saidas.map((saida) => (
            <li
              key={saida}
              className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-3 py-1.5 text-[11px] text-muted last:border-0"
            >
              {saida}
              <span aria-hidden className="size-[7px] rounded-full bg-accent/70" />
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
            ? 'rounded-br-[4px] bg-[#1d4b46] text-[#e6f4f1]'
            : 'rounded-bl-[4px] bg-[#141a24] text-soft'
        }`}
      >
        {children}
        {botoes && (
          <span className="mt-2 block space-y-1 border-t border-white/[0.09] pt-2">
            {botoes.map((botao) => (
              <span
                key={botao}
                className="block rounded-[7px] border border-white/[0.09] py-1 text-center text-[11.5px] font-semibold text-accent"
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
    <div className="w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e15]">
      <p className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
        <span
          aria-hidden
          className="flex size-[22px] items-center justify-center rounded-full bg-[#1d4b46] text-[10px] font-bold text-[#7ee3c8]"
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
 * desenho — a dificuldade é ligar um no outro. Explicar só com prosa deixa essa
 * ligação por conta do leitor, e é exatamente aí que se erra: escrever
 * `{{horario}}` no corpo do POST quando a API queria o id parece certo em texto
 * e é errado na tela.
 *
 * No celular as duas colunas viram uma, com a conversa em cima — é a metade que
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
          <p className="mb-2.5 font-mono text-[10px] tracking-[0.12em] text-dim uppercase">
            O que a pessoa vê
          </p>
          {conversa}
        </div>
        <div className="min-w-0 md:border-l md:border-white/[0.06] md:pl-7">
          <p className="mb-2.5 font-mono text-[10px] tracking-[0.12em] text-dim uppercase">
            O que você desenha
          </p>
          <div className="space-y-3">{desenho}</div>
        </div>
      </div>
      {nota && (
        <p className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3 text-[12.5px] leading-[1.6] text-muted">
          {nota}
        </p>
      )}
    </div>
  )
}

/* ───────────────────────── sequência e listas ───────────────────────── */

/**
 * Passos numerados — **só onde a ordem é informação**.
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
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/[0.12] font-mono text-[12px] font-bold text-accent"
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
          className="mt-[3px] shrink-0 font-mono text-[11px] text-accent transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        {p}
      </summary>
      <div className="space-y-2.5 border-t border-white/[0.06] px-4 py-3.5 pl-[34px] text-[13px] leading-[1.7] text-muted">
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
          <tr className="border-b border-white/[0.07]">
            {cabecalho.map((coluna) => (
              <th
                key={coluna}
                scope="col"
                className="px-3.5 py-2.5 font-mono text-[10px] font-bold tracking-[0.09em] text-dim uppercase"
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.045]">{children}</tbody>
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
