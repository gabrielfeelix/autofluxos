'use client'

import type { ReactNode } from 'react'

/**
 * Os desenhos dos templates — feitos com o material do próprio produto.
 *
 * ---------------------------------------------------------------------------
 * A regra que mantém isto um sistema, e não doze ícones soltos
 * ---------------------------------------------------------------------------
 *
 * Todo desenho é **um pedaço do canvas do editor**: a mesma malha de pontos, o
 * mesmo cartão de bloco com faixa colorida no topo, o mesmo fio curvo de
 * ligação. O que muda de um para o outro é (1) a **forma do fluxo** — leque,
 * funil, laço, duas pistas — e (2) **um objeto do assunto** desenhado com a
 * mesma geometria chapada: um calendário, um relógio, um código de barras.
 *
 * Isso é o oposto de sortear um ícone por tema. A forma do fluxo é informação:
 * quem olha o cartão do menu vê um bloco abrindo em três, e já sabe o que vai
 * receber antes de ler o resumo.
 *
 * **Sem emoji, sem biblioteca de ícones.** Emoji é do teclado, e biblioteca de
 * ícone é de qualquer produto; o cartão de bloco é deste. As cores saem da
 * mesma paleta dos blocos do editor.
 */

const AZUL = '#56d0f5'
const ROXO = '#a78bfa'
const VERDE = '#34d399'
const AMBAR = '#fcd34d'

const TRACO = 'rgba(255,255,255,0.26)'
const CHEIO = 'rgba(255,255,255,0.07)'

/** A folha: fundo do canvas e a malha de pontos, com a altura que se pedir. */
export function Canvas({
  id,
  altura = 72,
  children,
}: {
  /** Precisa ser único na página: é o id do `<pattern>` da malha. */
  id: string
  altura?: number
  children: ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 248 ${altura}`}
      aria-hidden
      className="block w-full rounded-[10px] border border-white/[0.05]"
    >
      <defs>
        <pattern id={`malha-${id}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1" fill="rgba(255,255,255,0.085)" />
        </pattern>
      </defs>
      <rect width="248" height={altura} fill="#070b11" />
      <rect width="248" height={altura} fill={`url(#malha-${id})`} />
      {children}
    </svg>
  )
}

/** Um cartão de bloco como o do desenho: faixa de cabeçalho e duas linhas. */
export function Bloco({
  x,
  y,
  cor,
  largura = 62,
  altura = 34,
  linhas = 2,
}: {
  x: number
  y: number
  /** A faixa de cima, como no editor: cada tipo de bloco tem a sua cor. */
  cor: string
  largura?: number
  altura?: number
  linhas?: 0 | 1 | 2
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={largura} height={altura} rx="6" fill="#0b1018" stroke="rgba(255,255,255,0.11)" />
      <rect width={largura} height="9" rx="6" fill={cor} opacity="0.85" />
      <rect y="6" width={largura} height="3" fill={cor} opacity="0.85" />
      {linhas > 0 && (
        <rect
          x="7"
          y={altura > 26 ? 16 : 14}
          width={largura - 22}
          height="3"
          rx="1.5"
          fill="rgba(255,255,255,0.22)"
        />
      )}
      {linhas > 1 && (
        <rect x="7" y="23" width={largura - 36} height="3" rx="1.5" fill="rgba(255,255,255,0.13)" />
      )}
    </g>
  )
}

/** O fio de ligação, na cor e na curvatura das arestas do editor. */
export function Fio({ d, tracejado = false }: { d: string; tracejado?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--accent)"
      strokeWidth="1.4"
      opacity={tracejado ? 0.5 : 0.75}
      strokeDasharray={tracejado ? '4 3' : undefined}
      strokeLinecap="round"
    />
  )
}

/* ------------------------------------------- as duas escolhas da abertura */

export function MiniaturaEmBranco() {
  return (
    <Canvas id="branco" altura={116}>
      <rect
        x="93"
        y="41"
        width="62"
        height="34"
        rx="6"
        fill="rgba(255,255,255,0.02)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.2"
        strokeDasharray="5 4"
      />
      <path
        d="M124 52v12M118 58h12"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Canvas>
  )
}

export function MiniaturaDeTemplate() {
  return (
    <Canvas id="template" altura={116}>
      {/* Os fios primeiro, para os cartões cobrirem as pontas — é o que o
          editor faz, e é o que faz a ligação parecer entrar no bloco. */}
      <Fio d="M72 34C86 34 84 58 98 58" />
      <Fio d="M160 58C174 58 170 82 184 82" />
      <Bloco x={10} y={17} cor={AZUL} />
      <Bloco x={98} y={41} cor={ROXO} />
      <Bloco x={176} y={65} cor={VERDE} />
    </Canvas>
  )
}

/* ------------------------------------------------ um desenho por template */

/** Um calendário chapado: cabeçalho e a grade de dias. */
function Calendario({
  x,
  y,
  marcado,
  segundoMarcado,
}: {
  x: number
  y: number
  /** O dia aceso, contado a partir de 0 na grade 5×3. */
  marcado: number
  segundoMarcado?: number
}) {
  const dias = Array.from({ length: 15 }, (_, i) => i)

  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="66" height="52" rx="7" fill="#0b1018" stroke="rgba(255,255,255,0.13)" />
      <rect width="66" height="10" rx="7" fill={AZUL} opacity="0.8" />
      <rect y="7" width="66" height="3" fill={AZUL} opacity="0.8" />
      {dias.map((dia) => {
        const cx = 11 + (dia % 5) * 11
        const cy = 22 + Math.floor(dia / 5) * 11
        const aceso = dia === marcado
        const antigo = dia === segundoMarcado
        return (
          <circle
            key={dia}
            cx={cx}
            cy={cy}
            r={aceso || antigo ? 3.4 : 2}
            fill={aceso ? VERDE : antigo ? 'transparent' : CHEIO}
            stroke={antigo ? TRACO : 'none'}
            strokeWidth={antigo ? 1.2 : 0}
            strokeDasharray={antigo ? '2 2' : undefined}
          />
        )
      })}
    </g>
  )
}

/** Menu: um bloco que abre em três. A forma já é a explicação. */
function DesenhoMenu() {
  return (
    <Canvas id="t-menu">
      <Fio d="M70 36C104 36 108 14 142 14" />
      <Fio d="M70 36h72" />
      <Fio d="M70 36C104 36 108 58 142 58" />
      <Bloco x={12} y={22} cor={AZUL} largura={58} altura={28} linhas={1} />
      <Bloco x={142} y={4} cor={ROXO} largura={54} altura={20} linhas={1} />
      <Bloco x={142} y={26} cor={ROXO} largura={54} altura={20} linhas={1} />
      <Bloco x={142} y={48} cor={VERDE} largura={54} altura={20} linhas={1} />
    </Canvas>
  )
}

/** Funil: três faixas que estreitam até sobrar quem vale a conversa. */
function DesenhoFunil() {
  return (
    <Canvas id="t-sdr">
      <rect x="18" y="12" width="96" height="10" rx="5" fill="rgba(255,255,255,0.13)" />
      <rect x="30" y="30" width="72" height="10" rx="5" fill="rgba(86,208,245,0.28)" />
      <rect x="44" y="48" width="44" height="10" rx="5" fill={VERDE} opacity="0.75" />
      <Fio d="M88 53C112 53 116 36 136 36" />
      <Bloco x={136} y={22} cor={VERDE} largura={62} altura={28} linhas={1} />
    </Canvas>
  )
}

/** Carrinho parado e o laço que traz a pessoa de volta. */
function DesenhoCarrinho() {
  return (
    <Canvas id="t-carrinho">
      <path
        d="M18 18h10l7 24h30l7-17"
        fill="none"
        stroke={TRACO}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="34" y="20" width="38" height="14" rx="3" fill={CHEIO} />
      <circle cx="40" cy="49" r="3.4" fill={TRACO} />
      <circle cx="60" cy="49" r="3.4" fill={TRACO} />
      {/* O laço: a conversa volta ao carrinho, e por isso o fio é tracejado —
          é a parte que depende de a pessoa responder. */}
      <Fio d="M92 30C110 30 112 12 134 12" />
      <Fio d="M134 56C108 56 96 52 84 44" tracejado />
      <Bloco x={134} y={-2} cor={ROXO} largura={58} altura={26} linhas={1} />
      <Bloco x={134} y={42} cor={AZUL} largura={58} altura={26} linhas={1} />
    </Canvas>
  )
}

/** Encomenda e o caminho dela até a resposta. */
function DesenhoPedido() {
  return (
    <Canvas id="t-pedido">
      <g transform="translate(16 16)">
        <rect width="42" height="38" rx="5" fill="#0b1018" stroke="rgba(255,255,255,0.16)" />
        <path d="M0 13h42" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
        <rect x="16" y="0" width="10" height="13" fill={AMBAR} opacity="0.55" />
      </g>
      <circle cx="76" cy="35" r="2.6" fill={VERDE} />
      <circle cx="90" cy="35" r="2.6" fill={VERDE} opacity="0.65" />
      <circle cx="104" cy="35" r="2.6" fill="rgba(255,255,255,0.16)" />
      <Fio d="M112 35h22" />
      <Bloco x={134} y={18} cor={AZUL} largura={62} altura={34} />
    </Canvas>
  )
}

/** A régua de 0 a 10, e as duas saídas que ela produz. */
function DesenhoNps() {
  const barras = Array.from({ length: 11 }, (_, i) => i)

  return (
    <Canvas id="t-nps">
      {barras.map((nota) => {
        const alto = 8 + nota * 3.2
        return (
          <rect
            key={nota}
            x={16 + nota * 9}
            y={54 - alto}
            width="5"
            height={alto}
            rx="2.5"
            fill={nota >= 9 ? VERDE : nota <= 6 ? 'rgba(251,113,133,0.55)' : 'rgba(255,255,255,0.16)'}
          />
        )
      })}
      <Fio d="M118 30C138 30 140 16 158 16" />
      <Fio d="M118 44C138 44 140 56 158 56" />
      <Bloco x={158} y={4} cor={VERDE} largura={54} altura={22} linhas={1} />
      <Bloco x={158} y={44} cor={ROXO} largura={54} altura={22} linhas={1} />
    </Canvas>
  )
}

/** Boleto: o código de barras que todo mundo reconhece de longe. */
function DesenhoCobranca() {
  const larguras = [2, 4, 1.6, 3, 1.6, 5, 2, 2.6, 4, 1.6, 3]

  return (
    <Canvas id="t-cobranca">
      <g transform="translate(16 14)">
        <rect width="78" height="44" rx="6" fill="#0b1018" stroke="rgba(255,255,255,0.14)" />
        {larguras.reduce<{ nodes: ReactNode[]; x: number }>(
          (acumulado, largura, i) => {
            acumulado.nodes.push(
              <rect
                key={i}
                x={acumulado.x}
                y="10"
                width={largura}
                height="24"
                fill="rgba(255,255,255,0.34)"
              />,
            )
            acumulado.x += largura + 3
            return acumulado
          },
          { nodes: [], x: 9 },
        ).nodes}
      </g>
      <Fio d="M100 36h34" />
      <Bloco x={134} y={19} cor={AMBAR} largura={62} altura={34} />
    </Canvas>
  )
}

/** Agenda: o dia escolhido vira conversa. */
function DesenhoAgenda() {
  return (
    <Canvas id="t-agenda">
      <Calendario x={16} y={10} marcado={7} />
      <Fio d="M88 36h44" />
      <Bloco x={132} y={19} cor={VERDE} largura={62} altura={34} />
    </Canvas>
  )
}

/** Reagendar: o dia velho fica tracejado, o novo acende. */
function DesenhoReagenda() {
  return (
    <Canvas id="t-reagenda">
      <Calendario x={16} y={10} marcado={13} segundoMarcado={6} />
      {/* A seta é o assunto: o dia velho fica tracejado, e a marcação desce
          para o novo. Sem ela, os dois pontos são só dois pontos. */}
      <path
        d="M49 36C56 40 58 46 55 52"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        opacity="0.8"
      />
      <path
        d="M52 49l3 4 4-2"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      <Fio d="M88 36h44" />
      <Bloco x={132} y={19} cor={ROXO} largura={62} altura={34} />
    </Canvas>
  )
}

/** Lembrete: o relógio adianta a conversa. */
function DesenhoLembrete() {
  return (
    <Canvas id="t-lembrete">
      <circle cx="46" cy="36" r="21" fill="#0b1018" stroke="rgba(255,255,255,0.16)" strokeWidth="1.4" />
      <circle cx="46" cy="36" r="21" fill="none" stroke={AZUL} strokeWidth="1.6" strokeDasharray="34 100" opacity="0.85" />
      <path d="M46 24v13l9 5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Fio d="M70 36h44" />
      <Bloco x={116} y={10} cor={AZUL} largura={58} altura={24} linhas={1} />
      <Bloco x={116} y={40} cor={VERDE} largura={58} altura={24} linhas={1} />
      <Fio d="M70 36C92 36 96 52 116 52" />
    </Canvas>
  )
}

/** Triagem: duas pistas, e uma delas é curta de propósito. */
function DesenhoTriagem() {
  return (
    <Canvas id="t-triagem">
      <Fio d="M66 36C90 36 92 14 116 14" />
      <Fio d="M66 36C90 36 92 58 116 58" />
      <Bloco x={12} y={24} cor={AZUL} largura={54} altura={24} linhas={1} />
      <Bloco x={116} y={4} cor={VERDE} largura={50} altura={20} linhas={1} />
      <Bloco x={116} y={48} cor={ROXO} largura={50} altura={20} linhas={1} />
      <Fio d="M166 58h16" />
      <Bloco x={182} y={48} cor={ROXO} largura={50} altura={20} linhas={1} />
    </Canvas>
  )
}

/** Recado: duas perguntas e a entrega para uma pessoa. */
function DesenhoRecado() {
  return (
    <Canvas id="t-recado">
      <Fio d="M66 36h30" />
      <Fio d="M150 36h20" />
      <Bloco x={12} y={22} cor={AZUL} largura={54} altura={28} linhas={1} />
      <Bloco x={96} y={22} cor={ROXO} largura={54} altura={28} linhas={1} />
      {/* A pessoa que assume: cabeça e ombros, na mesma geometria chapada. */}
      <g transform="translate(170 16)">
        <rect width="60" height="40" rx="8" fill="#0b1018" stroke="rgba(255,255,255,0.14)" />
        <circle cx="30" cy="16" r="6.5" fill={VERDE} opacity="0.85" />
        <path d="M17 33c2.6-7 23.4-7 26 0" fill={VERDE} opacity="0.4" />
      </g>
    </Canvas>
  )
}

/** Fora do expediente: duas linhas, e a lua. */
function DesenhoForaDoExpediente() {
  return (
    <Canvas id="t-fora">
      {/* A lua é um círculo **menos** outro, por máscara. A primeira tentativa
          desenhou o crescente à mão num `path` e virou uma bolha. */}
      <defs>
        <mask id="lua-fora-do-expediente">
          <rect width="248" height="72" fill="black" />
          <circle cx="46" cy="36" r="16" fill="white" />
          <circle cx="54" cy="29" r="13" fill="black" />
        </mask>
      </defs>
      <circle cx="46" cy="36" r="16" fill={AZUL} opacity="0.14" />
      <circle
        cx="46"
        cy="36"
        r="16"
        fill={AZUL}
        opacity="0.75"
        mask="url(#lua-fora-do-expediente)"
      />
      <circle cx="72" cy="18" r="1.6" fill="rgba(255,255,255,0.35)" />
      <circle cx="80" cy="27" r="1.1" fill="rgba(255,255,255,0.22)" />
      <Fio d="M86 36h28" />
      <Bloco x={114} y={19} cor={AZUL} largura={80} altura={34} />
    </Canvas>
  )
}

/** Quando um template ainda não tem desenho próprio. */
function DesenhoGenerico() {
  return (
    <Canvas id="t-generico">
      <Fio d="M74 24C96 24 98 48 120 48" />
      <Bloco x={16} y={10} cor={AZUL} largura={58} altura={28} linhas={1} />
      <Bloco x={120} y={34} cor={ROXO} largura={58} altura={28} linhas={1} />
    </Canvas>
  )
}

const DESENHOS: Record<string, () => ReactNode> = {
  'menu-atendimento': DesenhoMenu,
  'qualificar-sdr': DesenhoFunil,
  'carrinho-abandonado': DesenhoCarrinho,
  'status-do-pedido': DesenhoPedido,
  'pesquisa-nps': DesenhoNps,
  'cobranca-amigavel': DesenhoCobranca,
  agendamento: DesenhoAgenda,
  reagendamento: DesenhoReagenda,
  lembrete: DesenhoLembrete,
  triagem: DesenhoTriagem,
  recado: DesenhoRecado,
  'recado-curto': DesenhoForaDoExpediente,
}

/**
 * O desenho de um template.
 *
 * Id desconhecido cai no genérico em vez de sumir: template novo entra na
 * galeria no mesmo commit em que nasce, e um cartão sem imagem no meio de doze
 * com imagem parece defeito.
 */
export function DesenhoDoTemplate({ id }: { id: string }) {
  const Desenho = DESENHOS[id] ?? DesenhoGenerico
  return <Desenho />
}
