/**
 * As ilustrações dos estados vazios.
 *
 * **São nossas, desenhadas aqui, e isso foi escolha e não falta de opção.**
 * O levantamento das bibliotecas públicas (unDraw, Storyset, Humaaans, Open
 * Peeps, ManyPixels e outras dez) terminou em três constatações: nenhuma tem
 * API, todas são download manual , as bonitas de graça exigem link de
 * atribuição visível (Storyset, Icons8, Streamline), e as que não exigem têm o
 * estilo que todo SaaS usa, então o cliente já viu aquele mesmo desenho em três
 * ferramentas.
 *
 * Desenhar aqui custa este arquivo e devolve três coisas: zero dependência
 * externa (nada some quando um serviço cair), zero licença de terceiro, e o
 * traço na medida do produto.
 *
 * **A regra de cor é `currentColor`, nunca hex.** Cada peça herda a cor de quem
 * a envolve, então a ilustração acompanha o tema sozinha, e um fundo branco
 * embutido, que é o defeito clássico de ilustração pronta em tema escuro,
 * simplesmente não existe aqui porque não há fundo nenhum.
 *
 * Cada uma mostra **a tela cheia**, em fantasma: o quadro com suas colunas, a
 * conversa com seus balões. Quem nunca viu a tela funcionando entende o que ela
 * vira olhando, que é o que um parágrafo de texto não faz.
 */

/** Traço fino comum a todas, o desenho é linha, não mancha. */
const TRACO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * A moldura comum.
 *
 * `opacity` baixa e a cor vindo de fora fazem a ilustração ser **fundo**, não
 * conteúdo: ela ocupa o vazio sem competir com o texto que explica o que fazer,
 * nem com o botão que é a ação da tela.
 */
function Tela({ children, titulo }: { children: React.ReactNode; titulo: string }) {
  return (
    <svg
      viewBox="0 0 200 120"
      role="img"
      aria-label={titulo}
      className="mx-auto h-[116px] w-auto text-primary/75"
    >
      {children}
    </svg>
  )
}

/** Quadros: três colunas com cartões, o funil desenhado. */
export function IlustracaoQuadros() {
  return (
    <Tela titulo="Um quadro com três etapas e cartões em cada uma">
      {[6, 70, 134].map((x, coluna) => (
        <g key={x}>
          <rect x={x} y={20} width={60} height={82} rx={7} {...TRACO} opacity={0.45} />
          {/* O título da etapa, como uma barra curta. */}
          <rect x={x + 10} y={30} width={24} height={4.5} rx={2.2} fill="currentColor" opacity={0.75} />
          {/* Menos cartões a cada coluna: é um funil, e ele afunila. */}
          {Array.from({ length: 3 - coluna }).map((_, i) => (
            <rect
              key={i}
              x={x + 10}
              y={43 + i * 17}
              width={40}
              height={12}
              rx={3}
              fill="currentColor"
              opacity={0.2}
            />
          ))}
        </g>
      ))}
    </Tela>
  )
}

/** Contatos: pessoas numa lista. */
export function IlustracaoContatos() {
  return (
    <Tela titulo="Uma lista de contatos com nome e telefone">
      {[0, 1, 2].map((linha) => {
        const y = 14 + linha * 32
        return (
          <g key={linha} opacity={1 - linha * 0.22}>
            {/* Cabeça e ombros, a pessoa, reduzida ao essencial. */}
            <circle cx={32} cy={y + 11} r={7.5} {...TRACO} />
            <path d={`M20 ${y + 26}a12 12 0 0 1 24 0`} {...TRACO} />
            <rect x={56} y={y + 5} width={62} height={5} rx={2.5} fill="currentColor" opacity={0.55} />
            <rect x={56} y={y + 16} width={40} height={4} rx={2} fill="currentColor" opacity={0.25} />
          </g>
        )
      })}
    </Tela>
  )
}

/** Automações: o fluxo, com nós ligados e uma bifurcação. */
export function IlustracaoAutomacoes() {
  return (
    <Tela titulo="Um fluxo com blocos ligados e uma bifurcação">
      {/* Entrada */}
      <rect x={12} y={48} width={40} height={24} rx={5} {...TRACO} />
      <rect x={20} y={57} width={24} height={4} rx={2} fill="currentColor" opacity={0.5} />

      {/* Decisão, o losango que bifurca */}
      <path d="M88 60 106 44 124 60 106 76Z" {...TRACO} />

      {/* Duas saídas, é o "se isso, senão aquilo" */}
      <rect x={152} y={20} width={36} height={22} rx={5} {...TRACO} opacity={0.75} />
      <rect x={152} y={78} width={36} height={22} rx={5} {...TRACO} opacity={0.75} />

      {/* As ligações */}
      <path d="M52 60h36" {...TRACO} opacity={0.6} />
      <path d="M124 60h14v-29h14" {...TRACO} opacity={0.6} />
      <path d="M124 60h14v29h14" {...TRACO} opacity={0.6} />

      {/* Os pontos de conexão, que dizem que aquilo se liga */}
      {[[52, 60], [88, 60], [124, 60], [152, 31], [152, 89]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.6} fill="currentColor" opacity={0.7} />
      ))}
    </Tela>
  )
}

/**
 * O balão de quem responde, com a ponta virada para baixo-direita, o canto de
 * onde a fala sai. Escrito uma vez porque é desenhado duas: o preenchimento e o
 * contorno por cima, e dois caminhos iguais que divergem viram uma borda fora
 * do lugar.
 */
const BALAO_DIREITA =
  'M110 64h68a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-56l-11 8V70a6 6 0 0 1 6-6Z'

/** Inbox: a conversa, balões dos dois lados. */
export function IlustracaoInbox() {
  return (
    <Tela titulo="Uma conversa com mensagens dos dois lados">
      {/* Quem chega, à esquerda, com a ponta virada para fora */}
      <path d="M16 16h74a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H32l-11 8V22a6 6 0 0 1 6-6Z" {...TRACO} />
      <rect x={28} y={26} width={48} height={4.5} rx={2.2} fill="currentColor" opacity={0.5} />
      <rect x={28} y={36} width={32} height={4.5} rx={2.2} fill="currentColor" opacity={0.3} />

      {/* A resposta, à direita e cheia: é o nosso lado falando */}
      <path d={BALAO_DIREITA} fill="currentColor" opacity={0.2} />
      <path d={BALAO_DIREITA} {...TRACO} opacity={0.85} />
      <rect x={122} y={74} width={44} height={4.5} rx={2.2} fill="currentColor" opacity={0.5} />
      <rect x={122} y={84} width={30} height={4.5} rx={2.2} fill="currentColor" opacity={0.3} />
    </Tela>
  )
}

/**
 * Mensagens guardadas: duas mensagens, e a estrela acesa na de cima.
 *
 * A estrela é o assunto do desenho porque é o gesto que a tela ensina. Quem
 * chega em "Mensagens guardadas" sem nada guardado quase sempre não sabe onde
 * fica a estrela, e o texto ao lado diz "embaixo de cada mensagem": a
 * ilustração mostra exatamente isso, encostada na bolha.
 */
export function IlustracaoGuardadas() {
  return (
    <Tela titulo="Mensagens com uma delas marcada com estrela">
      {/* A mensagem guardada, com a estrela embaixo */}
      <path d="M16 14h74a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H32l-11 8V20a6 6 0 0 1 6-6Z" {...TRACO} />
      <rect x={28} y={24} width={48} height={4.5} rx={2.2} fill="currentColor" opacity={0.5} />
      <rect x={28} y={34} width={32} height={4.5} rx={2.2} fill="currentColor" opacity={0.3} />

      {/*
        A estrela cheia, e a única peça com opacidade alta: é o que a pessoa
        precisa procurar depois, no Inbox.
      */}
      <path
        d="M31 56l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7Z"
        fill="currentColor"
        opacity={0.9}
      />

      {/* Outra mensagem, sem estrela, para a de cima ter com o que contrastar */}
      <path d="M110 76h74a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-58l-11 8V82a6 6 0 0 1 6-6Z" {...TRACO} opacity={0.45} />
      <rect x={122} y={86} width={44} height={4.5} rx={2.2} fill="currentColor" opacity={0.25} />
      <rect x={122} y={96} width={30} height={4.5} rx={2.2} fill="currentColor" opacity={0.18} />
    </Tela>
  )
}
