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
function Tela({
  children,
  titulo,
  altura = 'h-[116px]',
}: {
  children: React.ReactNode
  titulo: string
  altura?: string
}) {
  return (
    <svg
      viewBox="0 0 200 120"
      role="img"
      aria-label={titulo}
      className={`ilu mx-auto w-auto text-primary/75 ${altura}`}
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
      <path d="M52 60h36" {...TRACO} opacity={0.6} className="ilu-corre" />
      <path d="M124 60h14v-29h14" {...TRACO} opacity={0.6} className="ilu-corre" />
      <path d="M124 60h14v29h14" {...TRACO} opacity={0.6} className="ilu-corre" />

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
      <g className="ilu-flutua">
        <path d={BALAO_DIREITA} fill="currentColor" opacity={0.2} />
        <path d={BALAO_DIREITA} {...TRACO} opacity={0.85} />
        <rect x={122} y={74} width={44} height={4.5} rx={2.2} fill="currentColor" opacity={0.5} />
        <rect x={122} y={84} width={30} height={4.5} rx={2.2} fill="currentColor" opacity={0.3} />
      </g>
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
        className="ilu-pulsa"
      />

      {/* Outra mensagem, sem estrela, para a de cima ter com o que contrastar */}
      <path d="M110 76h74a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-58l-11 8V82a6 6 0 0 1 6-6Z" {...TRACO} opacity={0.45} />
      <rect x={122} y={86} width={44} height={4.5} rx={2.2} fill="currentColor" opacity={0.25} />
      <rect x={122} y={96} width={30} height={4.5} rx={2.2} fill="currentColor" opacity={0.18} />
    </Tela>
  )
}

/*
 * ---------------------------------------------------------------------------
 * O movimento.
 *
 * Cada ilustração tem **uma** peça que se mexe, e ela é o assunto do desenho:
 * a etiqueta de preço que balança, a linha que corre até o destinatário, o
 * sino que toca. Uma só porque duas disputam o olho, e o olho precisa sobrar
 * para o texto e o botão. As classes `ilu-*` moram em `globals.css`, e todas
 * param com `prefers-reduced-motion`.
 * ---------------------------------------------------------------------------
 */

/** Um brilho de quatro pontas, o "novo" que ainda não tem nada dentro. */
function Brilho({ x, y, r = 4, atraso = 0 }: { x: number; y: number; r?: number; atraso?: number }) {
  return (
    <path
      d={`M${x} ${y - r}v${r * 2}M${x - r} ${y}h${r * 2}`}
      {...TRACO}
      opacity={0.55}
      className="ilu-pulsa"
      style={{ animationDelay: `${atraso}ms` }}
    />
  )
}

/** Produtos: a caixa aberta na prateleira, a sacola, e a etiqueta de preço. */
export function IlustracaoProdutos() {
  return (
    <Tela titulo="Uma caixa, uma sacola e uma etiqueta de preço">
      <path d="M18 104h164" {...TRACO} opacity={0.35} />

      {/* A caixa, aberta: o catálogo ainda está sendo montado */}
      <rect x={30} y={56} width={56} height={48} rx={4} fill="currentColor" opacity={0.12} />
      <rect x={30} y={56} width={56} height={48} rx={4} {...TRACO} />
      <path d="M30 56l-8-12h28l8 12M86 56l8-12H66l-8 12" {...TRACO} opacity={0.75} />
      <rect x={40} y={80} width={22} height={4.5} rx={2.2} fill="currentColor" opacity={0.45} />
      <rect x={40} y={90} width={14} height={4} rx={2} fill="currentColor" opacity={0.25} />

      {/* A sacola, que é a venda */}
      <rect x={110} y={62} width={48} height={42} rx={5} fill="currentColor" opacity={0.2} />
      <rect x={110} y={62} width={48} height={42} rx={5} {...TRACO} />
      <path d="M122 62v-5a12 12 0 0 1 24 0v5" {...TRACO} />

      {/* A etiqueta, pendurada na alça: é o preço, e é ela que balança */}
      <g className="ilu-balanca" style={{ transformOrigin: '134px 45px' }}>
        <path d="M134 45c4 3 9 5 14 5" {...TRACO} opacity={0.6} />
        <path d="M148 50l10-10h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-22Z" fill="currentColor" opacity={0.25} />
        <path d="M148 50l10-10h22a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-22Z" {...TRACO} />
        <circle cx={157} cy={50} r={2.2} {...TRACO} />
        <rect x={164} y={47.5} width={14} height={4.5} rx={2.2} fill="currentColor" opacity={0.7} />
      </g>

      <Brilho x={100} y={30} />
      <Brilho x={18} y={34} r={3} atraso={900} />
    </Tela>
  )
}

/** Chaves de API: o cadeado e a chave que abre. */
export function IlustracaoChaves() {
  return (
    <Tela titulo="Um cadeado e uma chave">
      {/* O cadeado */}
      <path d="M58 54V40a18 18 0 0 1 36 0v14" {...TRACO} />
      <rect x={46} y={54} width={60} height={48} rx={9} fill="currentColor" opacity={0.15} />
      <rect x={46} y={54} width={60} height={48} rx={9} {...TRACO} />
      <circle cx={76} cy={74} r={5} fill="currentColor" opacity={0.7} />
      <path d="M76 78v10" {...TRACO} strokeWidth={2.5} opacity={0.7} />

      {/* A chave, flutuando a caminho */}
      <g className="ilu-flutua">
        <circle cx={140} cy={36} r={12} fill="currentColor" opacity={0.2} />
        <circle cx={140} cy={36} r={12} {...TRACO} />
        <circle cx={140} cy={36} r={4} {...TRACO} opacity={0.7} />
        <path d="M152 36h32M174 36v8M182 36v6" {...TRACO} />
      </g>

      {/* O que a chave guarda: um endereço, em código */}
      <rect x={124} y={70} width={60} height={30} rx={6} {...TRACO} opacity={0.45} />
      <path d="M134 80l-4 5 4 5M174 80l4 5-4 5" {...TRACO} opacity={0.6} />
      <rect x={140} y={83} width={28} height={4} rx={2} fill="currentColor" opacity={0.35} />
      <path d="M126 50c-8 6-14 10-18 18" {...TRACO} opacity={0.5} className="ilu-corre" />
    </Tela>
  )
}

/** Anúncios e campanhas: o megafone falando com um formulário. */
export function IlustracaoAnuncios() {
  return (
    <Tela titulo="Um megafone e um formulário de contato">
      {/* O megafone */}
      <path d="M28 52h10l32-18v52L38 68H28a4 4 0 0 1-4-4V56a4 4 0 0 1 4-4Z" fill="currentColor" opacity={0.18} />
      <path d="M28 52h10l32-18v52L38 68H28a4 4 0 0 1-4-4V56a4 4 0 0 1 4-4Z" {...TRACO} />
      <path d="M36 68l5 18h8l-3-18" {...TRACO} opacity={0.7} />

      {/* O som, em ondas que saem uma depois da outra */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${80 + i * 8} ${50 - i * 6}a${14 + i * 8} ${14 + i * 8} 0 0 1 0 ${20 + i * 12}`}
          {...TRACO}
          opacity={0.7 - i * 0.18}
          className="ilu-onda"
          style={{ animationDelay: `${i * 260}ms` }}
        />
      ))}

      {/* O formulário, onde o lead cai */}
      <rect x={120} y={18} width={64} height={84} rx={8} {...TRACO} />
      <rect x={130} y={28} width={30} height={4.5} rx={2.2} fill="currentColor" opacity={0.7} />
      <rect x={130} y={40} width={44} height={11} rx={3} {...TRACO} opacity={0.5} />
      <rect x={130} y={57} width={44} height={11} rx={3} {...TRACO} opacity={0.5} />
      <rect x={130} y={78} width={26} height={12} rx={4} fill="currentColor" opacity={0.4} />
    </Tela>
  )
}

/** Respostas coletadas: a ficha na prancheta, preenchida pela conversa. */
export function IlustracaoRespostas() {
  return (
    <Tela titulo="Uma prancheta com respostas marcadas">
      {/* Quem respondeu, à esquerda */}
      <g className="ilu-flutua">
        <path d="M14 30h40a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H28l-9 7V35a5 5 0 0 1 5-5Z" {...TRACO} opacity={0.75} />
        <rect x={25} y={38} width={26} height={4} rx={2} fill="currentColor" opacity={0.45} />
      </g>
      <path d="M60 48h14" {...TRACO} opacity={0.55} className="ilu-corre" />

      {/* A prancheta */}
      <rect x={78} y={16} width={80} height={94} rx={8} fill="currentColor" opacity={0.08} />
      <rect x={78} y={16} width={80} height={94} rx={8} {...TRACO} />
      <rect x={100} y={10} width={36} height={13} rx={4} fill="currentColor" opacity={0.3} />
      <rect x={100} y={10} width={36} height={13} rx={4} {...TRACO} />

      {[0, 1, 2].map((i) => {
        const y = 40 + i * 22
        const feita = i < 2
        return (
          <g key={i} opacity={feita ? 1 : 0.45}>
            <circle cx={94} cy={y + 2} r={6} {...TRACO} />
            {feita && <path d={`M91 ${y + 2}l2.2 2.4 4-4.6`} {...TRACO} />}
            <rect x={106} y={y - 2} width={38} height={4.5} rx={2.2} fill="currentColor" opacity={0.55} />
            <rect x={106} y={y + 6} width={24} height={3.5} rx={1.8} fill="currentColor" opacity={0.28} />
          </g>
        )
      })}

      <Brilho x={176} y={30} />
    </Tela>
  )
}

/** Atividades: a lista da equipe e o relógio do prazo. */
export function IlustracaoAtividades() {
  return (
    <Tela titulo="Uma lista de tarefas com um relógio">
      <rect x={36} y={18} width={96} height={90} rx={8} {...TRACO} />
      <path d="M36 36h96" {...TRACO} opacity={0.5} />
      <path d="M60 11v14M108 11v14" {...TRACO} />

      {[0, 1, 2].map((i) => {
        const y = 46 + i * 19
        const feita = i === 0
        return (
          <g key={i} opacity={feita ? 1 : 0.8 - i * 0.15}>
            <rect x={48} y={y} width={10} height={10} rx={3} fill="currentColor" opacity={feita ? 0.3 : 0} />
            <rect x={48} y={y} width={10} height={10} rx={3} {...TRACO} />
            {feita && <path d={`M50.5 ${y + 5}l2 2.2 3.6-4.4`} {...TRACO} />}
            <rect x={66} y={y + 3} width={feita ? 40 : 50 - i * 8} height={4.5} rx={2.2} fill="currentColor" opacity={feita ? 0.3 : 0.5} />
          </g>
        )
      })}

      {/* O relógio, por cima: atividade tem hora */}
      <circle cx={148} cy={80} r={22} fill="currentColor" opacity={0.14} />
      <circle cx={148} cy={80} r={22} {...TRACO} />
      <path d="M148 80v-12" {...TRACO} strokeWidth={2} />
      <path d="M148 80h10" {...TRACO} strokeWidth={2} className="ilu-gira" style={{ transformOrigin: '148px 80px' }} />
      <circle cx={148} cy={80} r={2} fill="currentColor" />
    </Tela>
  )
}

/** Uma etiqueta, apontando para a esquerda, com o furo do barbante. */
function Etiqueta({ x, y, cheia }: { x: number; y: number; cheia?: boolean }) {
  const d = `M${x} ${y + 13}l13-13h57a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5h-57Z`
  return (
    <>
      {cheia && <path d={d} fill="currentColor" opacity={0.2} />}
      <path d={d} {...TRACO} />
      <circle cx={x + 13} cy={y + 13} r={2.6} {...TRACO} />
      <rect x={x + 24} y={y + 10.5} width={cheia ? 34 : 26} height={5} rx={2.5} fill="currentColor" opacity={cheia ? 0.7 : 0.4} />
    </>
  )
}

/** Etiquetas: três, em leque, a de cima em destaque. */
export function IlustracaoEtiquetas() {
  return (
    <Tela titulo="Três etiquetas em leque">
      <g transform="rotate(12 100 60)" opacity={0.45}>
        <Etiqueta x={70} y={70} />
      </g>
      <g transform="rotate(-4 100 60)" opacity={0.7}>
        <Etiqueta x={56} y={48} />
      </g>
      <g className="ilu-balanca" style={{ transformOrigin: '42px 36px' }}>
        <g transform="rotate(-14 100 60)">
          <Etiqueta x={42} y={22} cheia />
        </g>
      </g>
      <Brilho x={162} y={28} />
      <Brilho x={34} y={92} r={3} atraso={1100} />
    </Tela>
  )
}

/** Respostas rápidas: a barra "/" e a lista de atalhos que abre em cima. */
export function IlustracaoRespostasRapidas() {
  return (
    <Tela titulo="Um campo de mensagem com a lista de atalhos aberta">
      {/* A lista que o "/" abre */}
      <rect x={22} y={10} width={112} height={66} rx={8} {...TRACO} />
      <rect x={28} y={16} width={100} height={17} rx={5} fill="currentColor" opacity={0.18} />
      {[0, 1, 2].map((i) => (
        <g key={i} opacity={1 - i * 0.25}>
          <rect x={34} y={22 + i * 19} width={14} height={5} rx={2.5} fill="currentColor" opacity={0.7} />
          <rect x={54} y={22 + i * 19} width={56 - i * 10} height={5} rx={2.5} fill="currentColor" opacity={0.35} />
        </g>
      ))}

      {/* O campo, com a barra digitada e o cursor piscando */}
      <rect x={22} y={86} width={156} height={24} rx={12} {...TRACO} />
      <path d="M36 104l5-12" {...TRACO} strokeWidth={2} />
      <path d="M47 92v12" {...TRACO} className="ilu-pisca" />
      <circle cx={164} cy={98} r={7} fill="currentColor" opacity={0.3} />

      {/* O raio: é a resposta que sai em um toque */}
      <path
        d="M162 18l-12 22h10l-6 20 17-27h-10l6-15Z"
        fill="currentColor"
        opacity={0.25}
        className="ilu-pulsa"
      />
      <path d="M162 18l-12 22h10l-6 20 17-27h-10l6-15Z" {...TRACO} />
    </Tela>
  )
}

/** Transmissões: uma mensagem saindo para muita gente de uma vez. */
export function IlustracaoTransmissoes() {
  const destinos = [22, 60, 98]
  return (
    <Tela titulo="Uma mensagem enviada a vários contatos">
      {/* A origem, o aviãozinho de papel */}
      <circle cx={40} cy={60} r={22} fill="currentColor" opacity={0.15} />
      <circle cx={40} cy={60} r={22} {...TRACO} />
      <path d="M29 60l22-10-7 21-4-8Z" {...TRACO} />
      <path d="M40 63l11-13" {...TRACO} opacity={0.7} />

      {destinos.map((y, i) => (
        <g key={y}>
          <path
            d={`M64 60C92 60 98 ${y} 124 ${y}`}
            {...TRACO}
            opacity={0.55}
            className="ilu-corre"
            style={{ animationDelay: `${i * 200}ms` }}
          />
          <path d={`M130 ${y - 10}h48a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5h-48a5 5 0 0 1-5-5v-10a5 5 0 0 1 5-5Z`} {...TRACO} opacity={0.85 - i * 0.15} />
          <circle cx={139} cy={y} r={4} fill="currentColor" opacity={0.45} />
          <rect x={148} y={y - 2.2} width={26 - i * 4} height={4.5} rx={2.2} fill="currentColor" opacity={0.4} />
        </g>
      ))}
    </Tela>
  )
}

/** Modelos: a mensagem com lacunas, e o selo de aprovada. */
export function IlustracaoModelos() {
  return (
    <Tela titulo="Um modelo de mensagem com campos variáveis e selo de aprovado">
      <rect x={46} y={14} width={104} height={94} rx={9} {...TRACO} />
      <rect x={58} y={28} width={62} height={5} rx={2.5} fill="currentColor" opacity={0.6} />

      {/* O texto, com as lacunas tracejadas: é onde o nome de cada pessoa entra */}
      <rect x={58} y={42} width={26} height={5} rx={2.5} fill="currentColor" opacity={0.35} />
      <rect x={88} y={39} width={24} height={11} rx={3.5} fill="currentColor" opacity={0.18} />
      <rect x={88} y={39} width={24} height={11} rx={3.5} {...TRACO} strokeDasharray="2.5 2.5" opacity={0.8} />
      <rect x={58} y={56} width={48} height={5} rx={2.5} fill="currentColor" opacity={0.35} />
      <rect x={110} y={53} width={26} height={11} rx={3.5} fill="currentColor" opacity={0.18} />
      <rect x={110} y={53} width={26} height={11} rx={3.5} {...TRACO} strokeDasharray="2.5 2.5" opacity={0.8} />
      <rect x={58} y={70} width={36} height={5} rx={2.5} fill="currentColor" opacity={0.25} />

      <rect x={58} y={86} width={80} height={13} rx={4} {...TRACO} opacity={0.5} />
      <rect x={84} y={90.5} width={28} height={4} rx={2} fill="currentColor" opacity={0.4} />

      {/* O selo: aprovado pela Meta, pronto para enviar */}
      <g className="ilu-pulsa">
        <circle cx={152} cy={20} r={13} fill="currentColor" opacity={0.3} />
        <circle cx={152} cy={20} r={13} {...TRACO} />
        <path d="M146 20l4 4 8-8" {...TRACO} strokeWidth={2} />
      </g>
    </Tela>
  )
}

/** Segmentos: o funil que escolhe gente sozinho, e a volta que refaz todo dia. */
export function IlustracaoSegmentos() {
  const chegando = [
    [62, 10, 1],
    [78, 6, 0.6],
    [96, 11, 0.85],
    [114, 5, 0.5],
    [130, 10, 0.75],
  ] as const
  return (
    <Tela titulo="Contatos passando por um filtro">
      {chegando.map(([cx, cy, o], i) => (
        <circle
          key={cx}
          cx={cx}
          cy={cy}
          r={4}
          fill="currentColor"
          opacity={o * 0.6}
          className="ilu-flutua"
          style={{ animationDelay: `${i * 380}ms` }}
        />
      ))}

      <path d="M54 22h92l-32 34v26l-28 12V56Z" fill="currentColor" opacity={0.12} />
      <path d="M54 22h92l-32 34v26l-28 12V56Z" {...TRACO} />
      <path d="M66 34h68" {...TRACO} opacity={0.35} />

      {/* Quem passou: poucos, e escolhidos */}
      <circle cx={100} cy={108} r={5} fill="currentColor" opacity={0.8} />

      {/* A volta: a lista se refaz sozinha */}
      <g className="ilu-gira-devagar" style={{ transformOrigin: '168px 66px' }}>
        <path d="M156 66a12 12 0 1 1 3.5 8.5" {...TRACO} opacity={0.7} />
        <path d="M154 60l2 6 6-2" {...TRACO} opacity={0.7} />
      </g>
    </Tela>
  )
}

/** Canal: o celular, e o plugue que liga ele aqui. */
export function IlustracaoCanal() {
  return (
    <Tela titulo="Um celular sendo conectado">
      {/* O plugue, que se aproxima */}
      <path d="M8 60h30" {...TRACO} opacity={0.6} />
      <g className="ilu-encaixa">
        <rect x={38} y={50} width={18} height={20} rx={4} fill="currentColor" opacity={0.25} />
        <rect x={38} y={50} width={18} height={20} rx={4} {...TRACO} />
        <path d="M56 55h8M56 65h8" {...TRACO} strokeWidth={2} />
      </g>

      {/* O celular, com a conversa dentro */}
      <rect x={76} y={8} width={54} height={104} rx={11} {...TRACO} />
      <rect x={95} y={14} width={16} height={3.5} rx={1.75} fill="currentColor" opacity={0.4} />
      <path d="M84 30h28a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H90l-6 4V34a4 4 0 0 1 4-4Z" {...TRACO} opacity={0.6} />
      <path d="M94 56h26a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-20l-6 4V60a4 4 0 0 1 4-4Z" fill="currentColor" opacity={0.25} />
      <path d="M84 82h24a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H90l-6 4V86a4 4 0 0 1 4-4Z" {...TRACO} opacity={0.35} />

      {/* O sinal: ligado, a mensagem chega */}
      {[0, 1].map((i) => (
        <path
          key={i}
          d={`M${142 + i * 9} ${48 - i * 6}a${14 + i * 9} ${14 + i * 9} 0 0 1 0 ${24 + i * 12}`}
          {...TRACO}
          opacity={0.65 - i * 0.2}
          className="ilu-onda"
          style={{ animationDelay: `${i * 300}ms` }}
        />
      ))}
    </Tela>
  )
}

/** Equipe: três pessoas juntas. */
export function IlustracaoEquipe() {
  return (
    <Tela titulo="Três pessoas lado a lado">
      <g opacity={0.6}>
        <circle cx={58} cy={52} r={10} {...TRACO} />
        <path d="M40 94a18 18 0 0 1 36 0" {...TRACO} />
      </g>
      <g opacity={0.6}>
        <circle cx={142} cy={52} r={10} {...TRACO} />
        <path d="M124 94a18 18 0 0 1 36 0" {...TRACO} />
      </g>

      {/* Quem está no meio, em destaque */}
      <g className="ilu-flutua">
        <circle cx={100} cy={40} r={14} fill="currentColor" opacity={0.2} />
        <circle cx={100} cy={40} r={14} {...TRACO} />
        <path d="M74 94a26 26 0 0 1 52 0Z" fill="currentColor" opacity={0.15} />
        <path d="M74 94a26 26 0 0 1 52 0" {...TRACO} />
      </g>

      <path d="M30 100h140" {...TRACO} opacity={0.35} />
      <Brilho x={100} y={10} r={3.5} />
      <Brilho x={172} y={30} r={3} atraso={800} />
    </Tela>
  )
}

/** Acervo: a foto, o vídeo e o PDF que o bot manda. */
export function IlustracaoAcervo() {
  return (
    <Tela titulo="Uma foto, um vídeo e um documento">
      {/* A foto */}
      <g transform="rotate(-10 52 66)" opacity={0.7}>
        <rect x={24} y={42} width={58} height={48} rx={6} {...TRACO} />
        <circle cx={40} cy={56} r={4.5} fill="currentColor" opacity={0.5} />
        <path d="M28 84l16-16 10 10 8-6 16 12" {...TRACO} />
      </g>

      {/* O vídeo */}
      <g transform="rotate(10 148 66)" opacity={0.7}>
        <rect x={118} y={42} width={58} height={48} rx={6} {...TRACO} />
        <path d="M142 56v20l16-10Z" fill="currentColor" opacity={0.5} />
      </g>

      {/* O PDF, na frente */}
      <g className="ilu-flutua">
        <path d="M78 26h32l16 16v58a5 5 0 0 1-5 5H78a5 5 0 0 1-5-5V31a5 5 0 0 1 5-5Z" fill="currentColor" opacity={0.12} />
        <path d="M78 26h32l16 16v58a5 5 0 0 1-5 5H78a5 5 0 0 1-5-5V31a5 5 0 0 1 5-5Z" {...TRACO} />
        <path d="M110 26v16h16" {...TRACO} opacity={0.7} />
        <rect x={82} y={52} width={26} height={9} rx={3} fill="currentColor" opacity={0.55} />
        <rect x={82} y={68} width={34} height={4} rx={2} fill="currentColor" opacity={0.3} />
        <rect x={82} y={78} width={26} height={4} rx={2} fill="currentColor" opacity={0.3} />
        <rect x={82} y={88} width={30} height={4} rx={2} fill="currentColor" opacity={0.3} />
      </g>
    </Tela>
  )
}

/** Palavras-chave: a palavra da mensagem que dispara a automação. */
export function IlustracaoPalavrasChave() {
  return (
    <Tela titulo="Uma mensagem com uma palavra destacada ligada a um bloco">
      <path d="M14 18h92a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H32l-11 8V24a6 6 0 0 1 6-6Z" {...TRACO} />
      <rect x={28} y={28} width={30} height={5} rx={2.5} fill="currentColor" opacity={0.4} />

      {/* A palavra, destacada: é ela que a automação escuta */}
      <g className="ilu-pulsa">
        <rect x={62} y={24} width={38} height={13} rx={4} fill="currentColor" opacity={0.3} />
        <rect x={62} y={24} width={38} height={13} rx={4} {...TRACO} />
      </g>
      <rect x={28} y={42} width={48} height={5} rx={2.5} fill="currentColor" opacity={0.25} />

      <path d="M81 38c0 30 20 42 55 42" {...TRACO} opacity={0.55} className="ilu-corre" />

      {/* O bloco que ela aciona */}
      <rect x={138} y={66} width={48} height={28} rx={6} fill="currentColor" opacity={0.15} />
      <rect x={138} y={66} width={48} height={28} rx={6} {...TRACO} />
      <path d="M150 74v12l9-6Z" fill="currentColor" opacity={0.7} />
      <rect x={164} y={78} width={14} height={4} rx={2} fill="currentColor" opacity={0.45} />
    </Tela>
  )
}

/** Eventos: a agenda que avisa, e o sino que toca. */
export function IlustracaoEventos() {
  return (
    <Tela titulo="Um calendário e um sino de aviso">
      <rect x={24} y={30} width={66} height={66} rx={8} {...TRACO} opacity={0.6} />
      <path d="M24 46h66M42 24v12M72 24v12" {...TRACO} opacity={0.6} />
      {[0, 1, 2].flatMap((l) =>
        [0, 1, 2, 3].map((c) => (
          <circle
            key={`${l}-${c}`}
            cx={36 + c * 14}
            cy={58 + l * 12}
            r={2.4}
            fill="currentColor"
            opacity={l === 1 && c === 2 ? 0.9 : 0.25}
          />
        )),
      )}

      <path d="M94 66c8 0 14-2 20-6" {...TRACO} opacity={0.5} className="ilu-corre" />

      {/* O sino */}
      <g className="ilu-balanca" style={{ transformOrigin: '140px 37px' }}>
        <circle cx={140} cy={37} r={3} fill="currentColor" opacity={0.7} />
        <path d="M120 80h40l-6-8V54a14 14 0 0 0-28 0v18Z" fill="currentColor" opacity={0.2} />
        <path d="M120 80h40l-6-8V54a14 14 0 0 0-28 0v18Z" {...TRACO} />
        <path d="M134 86a6 6 0 0 0 12 0" {...TRACO} />
      </g>
      <circle cx={156} cy={42} r={5.5} fill="currentColor" opacity={0.9} className="ilu-pulsa" />
    </Tela>
  )
}

/** Sequências: mensagens espaçadas no tempo, uma depois da outra. */
export function IlustracaoSequencias() {
  const passos = [40, 100, 160]
  return (
    <Tela titulo="Uma linha do tempo com mensagens em dias diferentes">
      <path d="M22 76h156" {...TRACO} opacity={0.35} strokeDasharray="3 5" />

      {passos.map((x, i) => (
        <g key={x} opacity={1 - i * 0.25}>
          <path
            d={`M${x - 20} 24h40a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5h-14l-6 7-6-7h-14a5 5 0 0 1-5-5V29a5 5 0 0 1 5-5Z`}
            {...TRACO}
            fill={i === 0 ? 'currentColor' : 'none'}
            fillOpacity={0.15}
          />
          <rect x={x - 16} y={31} width={30} height={4} rx={2} fill="currentColor" opacity={0.5} />
          <rect x={x - 16} y={39} width={20} height={3.5} rx={1.75} fill="currentColor" opacity={0.3} />
          <circle cx={x} cy={76} r={6} fill="currentColor" opacity={i === 0 ? 0.8 : 0.12} />
          <circle cx={x} cy={76} r={6} {...TRACO} />
          <rect x={x - 9} y={92} width={18} height={4.5} rx={2.2} fill="currentColor" opacity={0.35} />
        </g>
      ))}

      {/* O andamento: alguém percorrendo a sequência */}
      <circle cx={40} cy={76} r={3} fill="currentColor" className="ilu-percorre" />
    </Tela>
  )
}

/** Organizações: prédios lado a lado, e o sinal de que cabe mais um. */
export function IlustracaoOrganizacoes() {
  const janelas = (x: number, y: number, colunas: number, linhas: number) =>
    Array.from({ length: colunas * linhas }).map((_, i) => (
      <rect
        key={i}
        x={x + (i % colunas) * 10}
        y={y + Math.floor(i / colunas) * 11}
        width={5}
        height={6}
        rx={1.2}
        fill="currentColor"
        opacity={0.3}
      />
    ))
  return (
    <Tela titulo="Três prédios lado a lado">
      <g opacity={0.6}>
        <rect x={36} y={52} width={36} height={52} rx={4} {...TRACO} />
        {janelas(44, 60, 3, 3)}
      </g>
      <rect x={78} y={22} width={46} height={82} rx={4} fill="currentColor" opacity={0.1} />
      <rect x={78} y={22} width={46} height={82} rx={4} {...TRACO} />
      {janelas(87, 32, 3, 5)}
      <rect x={95} y={90} width={12} height={14} rx={2} {...TRACO} />
      <g opacity={0.6}>
        <rect x={130} y={42} width={36} height={62} rx={4} {...TRACO} />
        {janelas(138, 50, 3, 4)}
      </g>
      <path d="M22 104h156" {...TRACO} opacity={0.35} />

      <g className="ilu-pulsa">
        <circle cx={172} cy={26} r={10} fill="currentColor" opacity={0.25} />
        <path d="M172 21v10M167 26h10" {...TRACO} strokeWidth={2} />
      </g>
      <path d="M28 30h20a6 6 0 0 0 0-12 9 9 0 0 0-17 2 5 5 0 0 0-3 10Z" {...TRACO} opacity={0.4} className="ilu-flutua" />
    </Tela>
  )
}

/** Tudo certo: o escudo com o visto, que é a notícia boa. */
export function IlustracaoTudoCerto() {
  return (
    <Tela titulo="Um escudo com um sinal de certo">
      <g className="ilu-flutua">
        <path d="M100 12l36 13v27c0 26-16 44-36 54-20-10-36-28-36-54V25Z" fill="currentColor" opacity={0.15} />
        <path d="M100 12l36 13v27c0 26-16 44-36 54-20-10-36-28-36-54V25Z" {...TRACO} />
        <path d="M84 58l11 11 22-24" {...TRACO} strokeWidth={3} />
      </g>
      <Brilho x={44} y={34} />
      <Brilho x={158} y={40} atraso={500} />
      <Brilho x={152} y={94} r={3} atraso={1000} />
      <Brilho x={50} y={88} r={3} atraso={1500} />
    </Tela>
  )
}

/*
 * ---------------------------------------------------------------------------
 * Os cartões de relatório sem dado.
 *
 * Menores que as de tela (o cartão divide a linha com outro) e uma por forma de
 * gráfico, não por assunto: quem vê a rosca vazia entende que ali vai aparecer
 * uma rosca, e isso diz mais sobre o cartão do que um desenho de "conversa".
 * ---------------------------------------------------------------------------
 */

export type DesenhoDeRelatorio =
  | 'desfecho'
  | 'horarios'
  | 'canais'
  | 'atendentes'
  | 'origens'
  | 'nps'
  | 'espera'
  | 'fechamentos'
  | 'funil'
  | 'podio'
  | 'motivos'
  | 'etapas'
  | 'maisVendidos'
  | 'origemDasVendas'

const ALTURA_DO_CARTAO = 'h-[84px]'

export function IlustracaoDeRelatorio({ desenho }: { desenho: DesenhoDeRelatorio }) {
  const Desenho = {
    desfecho: RelatorioDesfecho,
    horarios: RelatorioHorarios,
    canais: RelatorioCanais,
    atendentes: RelatorioAtendentes,
    origens: RelatorioOrigens,
    nps: RelatorioNps,
    espera: RelatorioEspera,
    fechamentos: RelatorioFechamentos,
    funil: RelatorioFunil,
    podio: RelatorioPodio,
    motivos: RelatorioMotivos,
    etapas: RelatorioEtapas,
    maisVendidos: RelatorioMaisVendidos,
    origemDasVendas: RelatorioOrigemDasVendas,
  }[desenho]
  return <Desenho />
}

/** Como terminaram: a conversa que se divide em automação, equipe e sem resposta. */
function RelatorioDesfecho() {
  const destinos = [22, 60, 98]
  return (
    <Tela titulo="Uma conversa que termina de três jeitos" altura={ALTURA_DO_CARTAO}>
      <path d="M14 42h56a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H30l-10 8V48a6 6 0 0 1 6-6Z" {...TRACO} />
      <rect x={26} y={51} width={36} height={4.5} rx={2.2} fill="currentColor" opacity={0.5} />
      <rect x={26} y={60} width={22} height={4} rx={2} fill="currentColor" opacity={0.28} />
      {destinos.map((y, i) => (
        <path
          key={y}
          d={`M82 57C112 57 110 ${y} 136 ${y}`}
          {...TRACO}
          opacity={0.5}
          className="ilu-corre"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
      {destinos.map((y, i) => (
        <circle key={y} cx={152} cy={y} r={14} fill="currentColor" opacity={0.12 + (2 - i) * 0.06} />
      ))}
      {destinos.map((y) => (
        <circle key={y} cx={152} cy={y} r={14} {...TRACO} />
      ))}
      {/* O robô: resolvida pela automação */}
      <rect x={145} y={17} width={14} height={11} rx={3} {...TRACO} />
      <path d="M152 17v-3" {...TRACO} />
      <circle cx={149.5} cy={22.5} r={1.2} fill="currentColor" />
      <circle cx={154.5} cy={22.5} r={1.2} fill="currentColor" />
      {/* A pessoa: foi para a equipe */}
      <circle cx={152} cy={56} r={3.5} {...TRACO} />
      <path d="M145 67a7 7 0 0 1 14 0" {...TRACO} />
      {/* O relógio: ficou sem resposta */}
      <circle cx={152} cy={98} r={6.5} {...TRACO} />
      <path d="M152 94.5V98h3" {...TRACO} />
    </Tela>
  )
}

/** Por onde chegam: WhatsApp e Instagram caindo na mesma caixa de entrada. */
function RelatorioCanais() {
  return (
    <Tela titulo="Dois canais chegando numa caixa de entrada" altura={ALTURA_DO_CARTAO}>
      {/* O balão redondo, do WhatsApp */}
      <path d="M40 18a16 16 0 1 1-8.5 29.6L22 50l2.6-8.8A16 16 0 0 1 40 18Z" {...TRACO} />
      <rect x={32} y={32} width={16} height={4} rx={2} fill="currentColor" opacity={0.5} />
      {/* A câmera quadrada, do Instagram */}
      <rect x={24} y={68} width={32} height={32} rx={10} {...TRACO} />
      <circle cx={40} cy={84} r={7.5} {...TRACO} />
      <circle cx={49} cy={75} r={1.6} fill="currentColor" />

      <path d="M62 34C92 34 96 58 118 64" {...TRACO} opacity={0.5} className="ilu-corre" />
      <path d="M62 84C92 84 96 72 118 70" {...TRACO} opacity={0.5} className="ilu-corre" style={{ animationDelay: '300ms' }} />

      {/* A mensagem entrando */}
      <g className="ilu-flutua">
        <rect x={138} y={26} width={30} height={20} rx={4} fill="currentColor" opacity={0.2} />
        <rect x={138} y={26} width={30} height={20} rx={4} {...TRACO} />
        <path d="M138 30l15 9 15-9" {...TRACO} opacity={0.7} />
      </g>
      {/* A caixa de entrada */}
      <path d="M126 58h52l10 22v20a6 6 0 0 1-6 6h-60a6 6 0 0 1-6-6V80Z" fill="currentColor" opacity={0.1} />
      <path d="M126 58h52l10 22v20a6 6 0 0 1-6 6h-60a6 6 0 0 1-6-6V80Z" {...TRACO} />
      <path d="M116 80h20l5 8h22l5-8h20" {...TRACO} opacity={0.7} />
    </Tela>
  )
}

/** Quem atendeu: a pessoa de fone, respondendo. */
function RelatorioAtendentes() {
  return (
    <Tela titulo="Uma pessoa de fone atendendo uma conversa" altura={ALTURA_DO_CARTAO}>
      <circle cx={84} cy={48} r={16} fill="currentColor" opacity={0.15} />
      <circle cx={84} cy={48} r={16} {...TRACO} />
      <path d="M62 50a22 22 0 0 1 44 0" {...TRACO} />
      <rect x={58} y={45} width={7} height={14} rx={3.5} fill="currentColor" opacity={0.5} />
      <rect x={103} y={45} width={7} height={14} rx={3.5} fill="currentColor" opacity={0.5} />
      <path d="M62 58c1 10 8 14 16 14" {...TRACO} />
      <circle cx={80} cy={72} r={2.2} fill="currentColor" />
      <path d="M50 110a34 34 0 0 1 68 0" {...TRACO} />

      {/* A resposta sendo digitada */}
      <g className="ilu-flutua">
        <path d="M130 22h46a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6h-32l-10 8V28a6 6 0 0 1 6-6Z" fill="currentColor" opacity={0.15} />
        <path d="M130 22h46a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6h-32l-10 8V28a6 6 0 0 1 6-6Z" {...TRACO} />
        {[144, 154, 164].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={36}
            r={2.6}
            fill="currentColor"
            opacity={0.7}
            className="ilu-pulsa"
            style={{ animationDelay: `${i * 250}ms` }}
          />
        ))}
      </g>
    </Tela>
  )
}

/** De onde vêm os contatos: anúncio, mapa e busca chegando numa ficha. */
function RelatorioOrigens() {
  return (
    <Tela titulo="Anúncio, mapa e busca trazendo um contato novo" altura={ALTURA_DO_CARTAO}>
      {/* O anúncio */}
      <rect x={18} y={12} width={32} height={24} rx={5} {...TRACO} />
      <path d="M30 19v10l8-5Z" fill="currentColor" opacity={0.6} />
      {/* O mapa */}
      <path d="M24 54a10 10 0 0 1 20 0c0 8-10 17-10 17s-10-9-10-17Z" {...TRACO} />
      <circle cx={34} cy={54} r={3} fill="currentColor" opacity={0.6} />
      {/* A busca */}
      <circle cx={32} cy={96} r={8} {...TRACO} />
      <path d="M38 102l7 7" {...TRACO} strokeWidth={2} />

      {[
        'M54 24C90 24 96 60 124 60',
        'M50 58C80 58 96 60 124 60',
        'M48 96C90 96 96 60 124 60',
      ].map((d, i) => (
        <path key={d} d={d} {...TRACO} opacity={0.45} className="ilu-corre" style={{ animationDelay: `${i * 220}ms` }} />
      ))}

      {/* A ficha do contato novo */}
      <g className="ilu-pulsa">
        <rect x={126} y={36} width={60} height={48} rx={8} fill="currentColor" opacity={0.14} />
        <rect x={126} y={36} width={60} height={48} rx={8} {...TRACO} />
        <circle cx={144} cy={54} r={6.5} {...TRACO} />
        <path d="M133 74a11 11 0 0 1 22 0" {...TRACO} />
        <rect x={160} y={50} width={18} height={4} rx={2} fill="currentColor" opacity={0.5} />
        <rect x={160} y={59} width={12} height={3.5} rx={1.75} fill="currentColor" opacity={0.3} />
      </g>
    </Tela>
  )
}

/** Quanto esperaram: a ampulheta, e a conversa parada do lado. */
function RelatorioEspera() {
  return (
    <Tela titulo="Uma ampulheta ao lado de uma conversa esperando" altura={ALTURA_DO_CARTAO}>
      <path d="M62 14h44M62 106h44" {...TRACO} strokeWidth={2.5} />
      <path d="M68 14c0 26 32 28 32 46s-32 20-32 46M100 14c0 26-32 28-32 46s32 20 32 46" {...TRACO} />
      <path d="M74 26h20l-10 16Z" fill="currentColor" opacity={0.35} />
      <path d="M84 62v34" {...TRACO} opacity={0.6} className="ilu-corre" />
      <path d="M72 102q12-16 24 0Z" fill="currentColor" opacity={0.45} />

      <g className="ilu-flutua">
        <path d="M126 36h50a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6h-36l-10 8V42a6 6 0 0 1 6-6Z" {...TRACO} opacity={0.8} />
        {[142, 152, 162].map((x, i) => (
          <circle key={x} cx={x} cy={51} r={2.6} fill="currentColor" opacity={0.3 + i * 0.2} />
        ))}
      </g>
    </Tela>
  )
}

/** Ranking de vendas: o pódio, com a estrela em cima do primeiro. */
function RelatorioPodio() {
  return (
    <Tela titulo="Um pódio com três lugares" altura={ALTURA_DO_CARTAO}>
      <rect x={46} y={64} width={36} height={40} rx={4} {...TRACO} opacity={0.7} />
      <rect x={82} y={46} width={36} height={58} rx={4} fill="currentColor" opacity={0.18} />
      <rect x={82} y={46} width={36} height={58} rx={4} {...TRACO} />
      <rect x={118} y={76} width={36} height={28} rx={4} {...TRACO} opacity={0.55} />
      <path d="M36 104h128" {...TRACO} opacity={0.35} />

      <circle cx={64} cy={54} r={6} {...TRACO} opacity={0.7} />
      <circle cx={136} cy={66} r={6} {...TRACO} opacity={0.55} />
      <path
        d="M100 14l4.4 8.9 9.8 1.4-7.1 6.9 1.7 9.8-8.8-4.6-8.8 4.6 1.7-9.8-7.1-6.9 9.8-1.4Z"
        fill="currentColor"
        opacity={0.6}
        className="ilu-flutua"
      />
      <path d="M97 62l4-3v18" {...TRACO} strokeWidth={2} />
      <Brilho x={72} y={24} r={3} />
      <Brilho x={130} y={30} r={3} atraso={700} />
    </Tela>
  )
}

/** Por que perdemos: o negócio riscado, e a pergunta que ficou. */
function RelatorioMotivos() {
  return (
    <Tela titulo="Um negócio marcado como perdido e um ponto de interrogação" altura={ALTURA_DO_CARTAO}>
      <rect x={34} y={22} width={78} height={80} rx={8} {...TRACO} />
      <rect x={46} y={36} width={40} height={5} rx={2.5} fill="currentColor" opacity={0.55} />
      <rect x={46} y={50} width={52} height={4} rx={2} fill="currentColor" opacity={0.25} />
      <rect x={46} y={60} width={34} height={4} rx={2} fill="currentColor" opacity={0.25} />
      <rect x={46} y={78} width={30} height={12} rx={4} fill="currentColor" opacity={0.2} />

      <circle cx={110} cy={26} r={12} fill="currentColor" opacity={0.3} />
      <circle cx={110} cy={26} r={12} {...TRACO} />
      <path d="M105 21l10 10M115 21l-10 10" {...TRACO} strokeWidth={2} />

      <g className="ilu-flutua">
        <path d="M134 50h44a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6h-30l-10 8V56a6 6 0 0 1 6-6Z" fill="currentColor" opacity={0.12} />
        <path d="M134 50h44a6 6 0 0 1 6 6v22a6 6 0 0 1-6 6h-30l-10 8V56a6 6 0 0 1 6-6Z" {...TRACO} />
        <path d="M151 61a5.5 5.5 0 1 1 7 5.3c-1.2.4-2 1.3-2 2.6V71" {...TRACO} strokeWidth={2} />
        <circle cx={156} cy={76} r={1.5} fill="currentColor" />
      </g>
    </Tela>
  )
}

/** Em aberto por etapa: as colunas do funil, com negócios parados em cada uma. */
function RelatorioEtapas() {
  const colunas = [
    [22, 3],
    [78, 2],
    [134, 1],
  ] as const
  return (
    <Tela titulo="Colunas de etapas com negócios em aberto" altura={ALTURA_DO_CARTAO}>
      {colunas.map(([x, n], c) => (
        <g key={x}>
          <rect x={x} y={14} width={48} height={92} rx={7} {...TRACO} opacity={0.4} />
          <rect x={x + 8} y={23} width={20} height={4.5} rx={2.2} fill="currentColor" opacity={0.7} />
          {Array.from({ length: n }).map((_, i) => (
            <rect
              key={i}
              x={x + 7}
              y={36 + i * 20}
              width={34}
              height={15}
              rx={3.5}
              fill="currentColor"
              opacity={0.22}
              className={c === 1 && i === 0 ? 'ilu-encaixa' : undefined}
            />
          ))}
        </g>
      ))}
    </Tela>
  )
}

/** O que mais vende: o produto, e as vendas dele subindo. */
function RelatorioMaisVendidos() {
  return (
    <Tela titulo="Um produto com um gráfico de vendas subindo" altura={ALTURA_DO_CARTAO}>
      <rect x={22} y={56} width={52} height={46} rx={4} fill="currentColor" opacity={0.12} />
      <rect x={22} y={56} width={52} height={46} rx={4} {...TRACO} />
      <path d="M22 56l-6-10h26l6 10M74 56l6-10H54l-6 10" {...TRACO} opacity={0.75} />
      <path d="M58 30l8-8h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H66Z" {...TRACO} />
      <circle cx={65} cy={30} r={1.8} {...TRACO} />
      <path d="M58 30c-6 2-10 12-12 26" {...TRACO} opacity={0.5} />

      {[
        [112, 30],
        [136, 48],
        [160, 68],
      ].map(([x = 0, h = 0], i) => (
        <rect
          key={x}
          x={x}
          y={102 - h}
          width={16}
          height={h}
          rx={3}
          fill="currentColor"
          opacity={0.2 + i * 0.15}
          className="ilu-sobe"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
      <path d="M106 64l24-18 22 8 26-26" {...TRACO} />
      <path d="M168 28h10v10" {...TRACO} />
      <path d="M100 102h86" {...TRACO} opacity={0.35} />
    </Tela>
  )
}

/** De onde vêm as vendas: o anúncio virando dinheiro. */
function RelatorioOrigemDasVendas() {
  return (
    <Tela titulo="Um anúncio levando a um saco de dinheiro" altura={ALTURA_DO_CARTAO}>
      <rect x={16} y={34} width={58} height={46} rx={7} {...TRACO} />
      <path d="M36 46v14l12-7Z" fill="currentColor" opacity={0.6} />
      <rect x={26} y={68} width={38} height={4.5} rx={2.2} fill="currentColor" opacity={0.35} />

      <path d="M80 57C100 57 108 70 124 70" {...TRACO} opacity={0.5} className="ilu-corre" />

      <g className="ilu-flutua">
        <path d="M144 46c-18 10-22 52 8 52h4c30 0 26-42 8-52Z" fill="currentColor" opacity={0.2} />
        <path d="M144 46c-18 10-22 52 8 52h4c30 0 26-42 8-52Z" {...TRACO} />
        <path d="M144 46h20M146 36l8 8 8-8" {...TRACO} />
        <path d="M160 66c-2-3-12-3-12 2s12 3 12 8-10 5-12 2M154 60v26" {...TRACO} />
      </g>
      <ellipse cx={186} cy={98} rx={8} ry={3.5} {...TRACO} opacity={0.6} />
      <ellipse cx={186} cy={92} rx={8} ry={3.5} {...TRACO} opacity={0.6} />
      <Brilho x={128} y={28} r={3} />
    </Tela>
  )
}

/** O funil de etapas, cada uma mais estreita que a de cima. */
function RelatorioFunil() {
  const degraus = [128, 96, 64, 36]
  return (
    <Tela titulo="Um funil de etapas, ainda sem dados" altura={ALTURA_DO_CARTAO}>
      {degraus.map((w, i) => (
        <rect
          key={w}
          x={100 - w / 2}
          y={14 + i * 24}
          width={w}
          height={18}
          rx={5}
          fill="currentColor"
          opacity={0.4 - i * 0.08}
        />
      ))}
      {[70, 100, 130].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={6}
          r={3}
          fill="currentColor"
          opacity={0.5}
          className="ilu-flutua"
          style={{ animationDelay: `${i * 400}ms` }}
        />
      ))}
    </Tela>
  )
}

/** O NPS: o velocímetro de detratores a promotores, com o ponteiro indeciso. */
function RelatorioNps() {
  // Três arcos de 60 graus cada, centro em (100, 96), raio 60.
  const ponto = (graus: number) => {
    const rad = (graus * Math.PI) / 180
    return `${(100 + 60 * Math.cos(rad)).toFixed(2)} ${(96 - 60 * Math.sin(rad)).toFixed(2)}`
  }
  const arcos: [number, number, number][] = [
    [178, 122, 0.2],
    [118, 62, 0.4],
    [58, 2, 0.75],
  ]
  return (
    <Tela titulo="Um medidor de satisfação, ainda sem respostas" altura={ALTURA_DO_CARTAO}>
      {arcos.map(([de, ate, o]) => (
        <path
          key={de}
          d={`M${ponto(de)}A60 60 0 0 1 ${ponto(ate)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={12}
          strokeLinecap="round"
          opacity={o}
        />
      ))}
      <g className="ilu-balanca" style={{ transformOrigin: '100px 96px' }}>
        <path d="M100 96V52" {...TRACO} strokeWidth={3} />
      </g>
      <circle cx={100} cy={96} r={6} fill="currentColor" />
    </Tela>
  )
}

/** O mapa de horários: a grade de dias e horas, com um pico aceso. */
function RelatorioHorarios() {
  const colunas = 8
  const linhas = 5
  // Tons fixos, e não aleatórios, para o servidor e o navegador desenharem igual.
  const tom = (l: number, c: number) => ((l * 7 + c * 5 + l * c) % 5) / 5
  return (
    <Tela titulo="Uma grade de dias e horários, ainda sem dados" altura={ALTURA_DO_CARTAO}>
      {Array.from({ length: linhas }).flatMap((_, l) =>
        Array.from({ length: colunas }).map((_, c) => {
          const pico = l === 2 && c === 7
          return (
            <rect
              key={`${l}-${c}`}
              x={18 + c * 13.5}
              y={20 + l * 17}
              width={10.5}
              height={13}
              rx={2.5}
              fill="currentColor"
              opacity={pico ? 0.85 : 0.08 + tom(l, c) * 0.25}
              className={pico ? 'ilu-pulsa' : undefined}
            />
          )
        }),
      )}
      {/* O relógio: é a hora que a grade mede */}
      <circle cx={162} cy={60} r={22} fill="currentColor" opacity={0.12} />
      <circle cx={162} cy={60} r={22} {...TRACO} />
      <path d="M162 60V46" {...TRACO} strokeWidth={2} />
      <path d="M162 60h11" {...TRACO} strokeWidth={2} className="ilu-gira" style={{ transformOrigin: '162px 60px' }} />
      <circle cx={162} cy={60} r={2} fill="currentColor" />
    </Tela>
  )
}

/** Fechamentos: o troféu do negócio ganho. */
function RelatorioFechamentos() {
  return (
    <Tela titulo="Um troféu, ainda sem negócios fechados" altura={ALTURA_DO_CARTAO}>
      <g className="ilu-flutua">
        <path d="M80 22h40v22a20 20 0 0 1-40 0Z" fill="currentColor" opacity={0.2} />
        <path d="M80 22h40v22a20 20 0 0 1-40 0Z" {...TRACO} />
        <path d="M80 30h-9a10 10 0 0 0 11 16M120 30h9a10 10 0 0 1-11 16" {...TRACO} />
        <path d="M100 64v12" {...TRACO} />
        <rect x={84} y={76} width={32} height={10} rx={3} fill="currentColor" opacity={0.3} />
        <rect x={84} y={76} width={32} height={10} rx={3} {...TRACO} />
      </g>
      <path d="M60 100h80" {...TRACO} opacity={0.3} />
      <Brilho x={56} y={30} />
      <Brilho x={146} y={40} atraso={700} />
      <Brilho x={142} y={80} r={3} atraso={1300} />
    </Tela>
  )
}
