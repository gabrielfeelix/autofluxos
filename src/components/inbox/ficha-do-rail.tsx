'use client'

import Link, { useLinkStatus } from 'next/link'

/**
 * Uma ficha do rail de atribuição: `Todos`, `Sem dono`, `Meus`, cada atendente.
 *
 * ---------------------------------------------------------------------------
 * Por que isto é um componente de cliente
 * ---------------------------------------------------------------------------
 *
 * Clicar numa ficha troca o `?de=` da **mesma rota**. Isso tem uma consequência
 * que custou uma tentativa inteira de conserto: `loading.tsx` não aparece.
 * Ele é o fallback de um Suspense que o Next monta ao **entrar** numa rota, e
 * navegar de `?de=todos` para `?de=meus` não entra em rota nenhuma — a página
 * é re-renderizada no servidor e a tela fica parada até a resposta chegar.
 *
 * Eram dois segundos sem nada acontecer: nenhuma ficha acendia, a lista não
 * mudava, e a reação natural é clicar de novo achando que não pegou.
 *
 * `useLinkStatus` é a ferramenta que a doc do Next indica exatamente para este
 * caso — *"Use it for subtle, inline feedback… while navigation completes"* —
 * e ela só existe dentro de um `<Link>`, em componente de cliente.
 *
 * ---------------------------------------------------------------------------
 * O feedback é a ficha inteira, não um spinner ao lado
 * ---------------------------------------------------------------------------
 *
 * Quem clicou quer saber que **aquela** ficha foi escolhida. Então a ficha
 * clicada assume na hora a mesma aparência de "acesa" e o conjunto perde
 * opacidade enquanto a lista não chega: a tela responde no clique, e o que
 * ainda está vindo fica visivelmente em trânsito.
 *
 * Sem `transition` na opacidade de propósito — a mudança tem que ser imediata,
 * que é a única coisa que este componente existe para fazer.
 */
export function FichaDoRail({
  href,
  acesa,
  rotulo,
  contagem,
  alerta = false,
  ausente = false,
  aoEscolher,
}: {
  href: string
  acesa: boolean
  rotulo: string
  contagem: number
  /** "Sem dono" com fila é o que precisa de gente — merece cor. */
  alerta?: boolean
  ausente?: boolean
  /**
   * **Presente = a fila inteira está no navegador**, e trocar de aba é um
   * `filter()` — sem ida ao servidor, sem estado pendente, instantâneo.
   *
   * Ausente = a fila está paginada e quem filtra é o servidor; aí a ficha
   * volta a ser `<Link>`, com `useLinkStatus` avisando que está carregando.
   * Ver `TETO_DA_FILA_LOCAL`.
   */
  aoEscolher?: () => void
}) {
  /*
   * No modo local não há navegação, então não há pendência para mostrar: a
   * lista já mudou antes de o clique terminar. Um `<button>` também é o
   * elemento honesto aqui — `<Link>` que não leva a lugar nenhum mente para
   * quem navega por teclado e para quem abre em nova aba.
   */
  if (aoEscolher) {
    return (
      <button
        type="button"
        onClick={aoEscolher}
        aria-current={acesa ? 'page' : undefined}
        className="shrink-0 rounded-full"
      >
        <Aparencia
          acesa={acesa}
          rotulo={rotulo}
          contagem={contagem}
          alerta={alerta}
          ausente={ausente}
          pendente={false}
        />
      </button>
    )
  }

  return (
    /*
     * `prefetch={false}`: a doc é explícita em que o estado pendente é pulado
     * quando a rota já foi prefetchada, e o que precisamos aqui é justamente
     * ver o pendente. Não custa navegação — o destino é a mesma rota, que já
     * está carregada.
     */
    <Link
      href={href}
      prefetch={false}
      aria-current={acesa ? 'page' : undefined}
      className="shrink-0 rounded-full"
    >
      <AparenciaComLink
        acesa={acesa}
        rotulo={rotulo}
        contagem={contagem}
        alerta={alerta}
        ausente={ausente}
      />
    </Link>
  )
}

/**
 * Separado do `FichaDoRail` porque `useLinkStatus` **só responde dentro de um
 * `<Link>`** — num componente acima dele o hook devolve `pending: false` para
 * sempre, e o clique volta a não ter resposta.
 */
function AparenciaComLink(props: {
  acesa: boolean
  rotulo: string
  contagem: number
  alerta: boolean
  ausente: boolean
}) {
  const { pending } = useLinkStatus()
  return <Aparencia {...props} pendente={pending} />
}

/** O desenho da ficha. `pendente` só existe no modo servidor. */
function Aparencia({
  acesa,
  rotulo,
  contagem,
  alerta,
  ausente,
  pendente,
}: {
  acesa: boolean
  rotulo: string
  contagem: number
  alerta: boolean
  ausente: boolean
  pendente: boolean
}) {
  // Enquanto a navegação corre, esta ficha é a escolhida — é o que o clique
  // acabou de pedir, e mostrar isso antes da confirmação é o ponto.
  const viva = acesa || pendente
  const destaque = alerta && contagem > 0 && !viva

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition ${
        pendente ? 'opacity-60' : ''
      } ${
        viva
          ? 'border-primary/40 bg-primary/[0.14] text-ink'
          : destaque
            ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200 hover:bg-amber-400/[0.14]'
            : 'border-line text-muted hover:border-strong hover:text-ink'
      }`}
    >
      {/* Ausente aparece como ponto apagado: atribuir para quem está de férias é
          o mesmo que não atribuir, e pior — fica um nome ao lado dando a
          impressão de que alguém está cuidando. */}
      {ausente && <span aria-label="ausente" title="ausente" className="size-1.5 rounded-full bg-white/25" />}
      {rotulo}
      <span className="font-mono opacity-70">{contagem}</span>
    </span>
  )
}
