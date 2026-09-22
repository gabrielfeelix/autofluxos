'use client'

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useReactFlow,
  useStore,
  Position,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { ICONES, NOMES } from './nos'

/** O desvio que quem monta deu na linha, em coordenadas do desenho. */
export type Desvio = { x: number; y: number }

export type AcoesDaAresta = {
  apagar: (id: string) => void
  desviar: (id: string, desvio: Desvio | null) => void
}

/**
 * Quem sabe apagar a linha, e guardar o desvio dela, é o editor (é ele que tem
 * `edges` em estado controlado). O contexto leva as duas funções até a linha.
 * Chamar `useReactFlow().setEdges` daqui não serve: com `edges` vindo por prop,
 * mexer no store interno deixa o estado de fora desatualizado.
 */
const AcaoDaAresta = createContext<AcoesDaAresta | null>(null)

export const AcaoDaArestaProvider = AcaoDaAresta.Provider

/**
 * Qual linha está debaixo do ponteiro, para todas as outras saírem da frente.
 *
 * Mora aqui e não no editor de propósito: pôr isto no estado que controla
 * `edges` faria cada passada de mouse reescrever o array inteiro de arestas,
 * que é justamente a escrita inútil descrita em `OPCOES_PADRAO_DA_ARESTA`.
 * Aqui o hover troca um `string | null` e só as linhas se redesenham.
 */
const Realce = createContext<{
  realcada: string | null
  realcar: (id: string | null) => void
}>({ realcada: null, realcar: () => {} })

/**
 * Apagar o realce espera um instante; acender é imediato.
 *
 * **Sem essa espera o ✕ pisca sem parar e o cursor entra em looping.** O botão
 * e a faixa que recebe o gesto estão em camadas diferentes (um é HTML, a outra
 * é SVG), então mover o ponteiro da linha para o botão dispara, nessa ordem:
 * sai da linha → o realce cai → o botão perde `pointer-events` → o ponteiro
 * volta a estar sobre a linha → entra na linha → o realce sobe → o botão volta
 * a receber ponteiro → sai da linha. E de novo, sessenta vezes por segundo,
 * alternando o cursor entre a régua e a mãozinha.
 *
 * Os 90ms quebram o ciclo na raiz: a saída só vira desligamento se ninguém
 * acender nesse meio-tempo, e o `onPointerEnter` do próprio botão acende. Nada
 * de estado oscila, então nada de `pointer-events` oscila.
 */
const ESPERA_PARA_APAGAR = 90

export function RealceDeArestasProvider({ children }: { children: ReactNode }) {
  const [realcada, definir] = useState<string | null>(null)
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null)

  const realcar = useCallback((id: string | null) => {
    if (relogio.current) {
      clearTimeout(relogio.current)
      relogio.current = null
    }
    if (id !== null) {
      definir(id)
      return
    }
    relogio.current = setTimeout(() => definir(null), ESPERA_PARA_APAGAR)
  }, [])

  const valor = useMemo(() => ({ realcada, realcar }), [realcada, realcar])
  return <Realce.Provider value={valor}>{children}</Realce.Provider>
}

/**
 * Quanto o alvo precisa estar à direita da origem para a curva simples servir.
 *
 * Abaixo disto a Bézier horizontal não tem espaço para ir e voltar: as duas
 * alças apontam uma contra a outra, a linha se dobra sobre si mesma e passa por
 * dentro dos dois cartões. É o "fio embaraçado" de fluxo com retorno , menu que
 * volta, "voltar ao menu", repetição de pergunta.
 */
const FOLGA_PARA_CURVA = 60

/**
 * O caminho de uma linha que foi puxada para fora do lugar.
 *
 * É **uma quadrática só**, e o ponto de controle é calculado para a curva
 * passar exatamente onde o ponteiro está: `Q = 2M − (S+T)/2` é a inversa do
 * ponto médio de uma Bézier de grau 2, onde `t = 0,5` cai em
 * `(S + 2Q + T)/4`. Uma quadrática não tem como formar laço nem bico: com um
 * controle só, não há duas alças para se cruzarem.
 *
 * **A primeira versão era outra, e estava errada.** Eram duas cúbicas emendadas
 * no ponto arrastado, com as alças horizontais nas duas pontas, para a linha
 * sair do bloco na direção da bolinha. O problema é que alça horizontal fixa
 * ignora para onde a pessoa puxou: arrastando para cima, a saída insistia em ir
 * para a direita, voltava para alcançar o ponto e a linha dava a volta em si
 * mesma. Com `Math.abs` na força da alça, puxar para a esquerda do bloco de
 * origem virava um laço fechado , o "círculo" que aparecia no desenho.
 *
 * O preço é que a linha não sai mais perfeitamente horizontal da bolinha: ela
 * sai inclinada na direção do desvio. Vale: inclinação de alguns graus se lê
 * como "essa linha vai para lá", e laço não se lê como nada.
 */
function caminhoDesviado(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  mx: number,
  my: number,
): string {
  const controleX = 2 * mx - (sx + tx) / 2
  const controleY = 2 * my - (sy + ty) / 2
  return `M ${sx},${sy} Q ${controleX},${controleY} ${tx},${ty}`
}

/** Um ponto por onde o fio passa, em coordenadas do desenho. */
type Ponto = { x: number; y: number }

/**
 * A partir de que distância o fio deixa de ser desenhado e vira um atalho.
 *
 * **Este é o remédio para o que sobrou do emaranhado.** Corredor resolveu fio
 * passando por cima de cartão; não resolve, e não tem como resolver, o fato de
 * uma ligação da primeira coluna para a última atravessar o desenho inteiro e
 * amarrar visualmente o começo do fluxo no fim dele. O fio é longo porque a
 * ligação é longa.
 *
 * A saída é a mesma de todo editor de diálogo maduro , Voiceflow ("Go to
 * block"), Twine, Yarn, Articy: ligação longa **não se desenha**, vira um
 * crachá na saída dizendo para onde vai. O fio continua existindo e reaparece
 * quando a pessoa pede (ponteiro no crachá, ou o bloco selecionado). É o mesmo
 * princípio do bloco "Ir para outra automação" que este produto já tem , só que
 * dentro do próprio fluxo.
 *
 * Mais de três colunas para frente (a coluna tem 248 + 110 de vão), ou volta de
 * mais de uma coluna. Abaixo disso o fio é curto, se lê num relance, e esconder
 * seria tirar informação de graça , são também exatamente as ligações que o
 * arrumador consegue pôr em corredor, ver `MAXIMO_DE_COLUNAS_COM_CORREDOR`.
 */
const LONGE_PARA_FRENTE = 3.5 * (248 + 110)
const LONGE_PARA_TRAS = 248 + 110

/**
 * Como o bloco de destino se chama no crachá.
 *
 * Lê campos genéricos de propósito. O resumo bonito de cada tipo mora no
 * `painel.tsx`, junto com o schema do grafo, e puxar aquilo para cá traria a
 * camada de fio para dentro do conhecimento do grafo por causa de um rótulo de
 * quinze caracteres. Sem texto, o nome do tipo já orienta.
 */
function apelidoDoBloco(tipo: string, dados: Record<string, unknown> | undefined): string {
  const bruto = primeiroTexto(dados)
  const limpo = bruto.trim().replace(/\s+/g, ' ')
  const nome = (NOMES as Record<string, string>)[tipo] ?? 'Bloco'
  if (limpo === '') return nome
  return limpo.length > 24 ? `${limpo.slice(0, 24)}…` : limpo
}

/**
 * O primeiro texto que o bloco tem para mostrar, seja qual for o formato.
 *
 * `partes` e `mensagens` vêm primeiro porque são os formatos **novos**: a
 * mensagem virou lista de pedaços e o handoff virou lista de falas, e os campos
 * antigos (`texto`, `mensagem`) seguem no schema só para as conversas que já
 * estavam rodando quando a mudança saiu. Ler o antigo primeiro era o bug do
 * crachá: todo bloco de mensagem aparecia como "Mensagem", sem nada dentro.
 */
function primeiroTexto(dados: Record<string, unknown> | undefined): string {
  if (!dados) return ''

  const partes = dados.partes
  if (Array.isArray(partes)) {
    for (const parte of partes) {
      if (parte && typeof parte === 'object' && typeof (parte as { texto?: unknown }).texto === 'string') {
        return (parte as { texto: string }).texto
      }
    }
  }

  const mensagens = dados.mensagens
  if (Array.isArray(mensagens) && typeof mensagens[0] === 'string') return mensagens[0]

  for (const campo of ['texto', 'legenda', 'instrucao', 'mensagem', 'nome', 'url'] as const) {
    const valor = dados[campo]
    if (typeof valor === 'string' && valor.trim() !== '') return valor
  }

  return ''
}

/**
 * O caminho que segue os corredores reservados pelo arrumador.
 *
 * Recebe a origem, os pontos de dobra e o destino, e emenda tudo com cúbicas
 * de **tangente horizontal nas duas pontas de cada trecho**. Duas consequências
 * e as duas são o ponto:
 *
 * - trecho entre dois pontos da mesma altura (a travessia de uma coluna) sai
 *   **reto**, porque os controles ficam em cima da própria reta. É isso que
 *   transforma seis fios de passagem em seis faixas paralelas;
 * - trecho que troca de altura vira um S suave, e nunca um bico, porque a
 *   tangente entra e sai na horizontal , a mesma direção das alças.
 *
 * A força do controle é metade do avanço horizontal, com piso de 18px: sem o
 * piso, dois pontos quase na mesma vertical dariam controle nulo e o S viraria
 * canto vivo.
 */
function caminhoPorCorredor(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  pontos: Ponto[],
): string {
  const todos: Ponto[] = [{ x: sx, y: sy }, ...pontos, { x: tx, y: ty }]
  let d = `M ${todos[0]!.x},${todos[0]!.y}`
  for (let i = 0; i < todos.length - 1; i++) {
    const a = todos[i]!
    const b = todos[i + 1]!
    const forca = Math.max(Math.abs(b.x - a.x) * 0.5, 18)
    d += ` C ${a.x + forca},${a.y} ${b.x - forca},${b.y} ${b.x},${b.y}`
  }
  return d
}

/**
 * A linha entre dois blocos: com um **✕ no meio** e **puxável**.
 *
 * Duas coisas faltavam. Não havia como desfazer uma ligação, o jeito de "apagar
 * o link" era apagar um dos blocos e refazer o trabalho; e não havia como
 * desviar a linha, então num fluxo com muitos ramos elas cruzavam por cima dos
 * cartões e não dava para seguir nenhuma com o olho.
 *
 * O ✕ aparece de leve sempre e acende no ponteiro, linha de fluxo com um botão
 * aceso em cada uma vira campo de minas visual.
 *
 * O desvio é o mesmo gesto do FigJam: **a linha inteira é a alça**. Arrastar em
 * qualquer ponto dela sobe ou desce o caminho, dois cliques devolvem ao
 * automático. Não há bolinha de controle no meio: ela brigaria com o ✕ pelo
 * mesmo pixel, e obrigaria a mirar num alvo de 8px para começar o gesto.
 *
 * ## Por que o desenho é assim
 *
 * Num fluxo grande o problema deixa de ser "a linha existe?" e passa a ser
 * "essa linha aí sai de onde e chega onde?". Quatro decisões atacam isso, e
 * todas são o que editor de nó maduro faz (n8n, Retool, ComfyUI, Figma):
 *
 * 1. **Ida é curva, volta é canto.** Alvo à direita: Bézier. Alvo à esquerda ou
 *    colado: caminho ortogonal arredondado, que sai, desce por um corredor e
 *    entra pela esquerda. Bézier de volta vira laço; canto de volta se lê.
 * 2. **Repouso é fraco, foco é forte.** No descanso a linha é fina e cinza
 *    quase apagada, e o desenho vira "cartões com fiação", não "fiação com
 *    cartões". Sob o ponteiro ela engrossa e vira azul.
 * 3. **O que está em foco passa por cima.** A linha realçada ganha um contorno
 *    da cor do canvas por baixo do traço, e todas as outras caem para 12% de
 *    opacidade. SVG não tem `z-index`, então quem ordena a leitura é o
 *    contraste: com o resto apagado, a linha em foco é a única coisa legível do
 *    começo ao fim.
 * 4. **Clicar no cartão acende a fiação dele.** Seleção de bloco realça as
 *    linhas que entram e saem dele. É a resposta direta a "não sei onde começa
 *    e onde termina", sem precisar perseguir traço com o olho.
 *
 * A seta na ponta existe pelo mesmo motivo: com linha longa cruzando meia tela,
 * direção não se deduz da curva. Como toda entrada é pela esquerda do cartão,
 * ela sempre aponta para a direita, e não precisa de `marker` no SVG , que não
 * herda cor e ficaria cinza mesmo com a linha acesa.
 */
function ArestaRemovivel({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  data,
}: EdgeProps) {
  const acoes = useContext(AcaoDaAresta)
  const { realcada, realcar } = useContext(Realce)
  const tela = useReactFlow()
  const { screenToFlowPosition } = tela
  const [arrastando, setArrastando] = useState(false)

  /**
   * Se um dos dois cartões desta linha está selecionado.
   *
   * Lê do store do React Flow em vez de receber por prop porque a alternativa
   * é o editor recalcular `edges` a cada clique num bloco , de novo a escrita
   * que reacende o canvas inteiro.
   */
  const presaAoSelecionado = useStore((s) => {
    const no = s.nodeLookup
    return Boolean(no.get(source)?.selected || no.get(target)?.selected)
  })

  /**
   * Existe algum cartão selecionado na tela?
   *
   * Precisa ser uma pergunta separada: é ela que autoriza **esta** linha a se
   * apagar. Sem ela, selecionar um bloco acenderia a fiação dele e deixaria o
   * resto no mesmo tom de sempre , metade do efeito, que é justamente a metade
   * que não resolve o novelo.
   */
  const haCartaoSelecionado = useStore((s) => {
    for (const no of s.nodeLookup.values()) if (no.selected) return true
    return false
  })

  /**
   * Como o destino se chama, para o crachá. Sai do seletor já como texto: o
   * seletor do React Flow compara o que devolve a cada desenho, e devolver um
   * objeto novo aqui redesenharia todas as linhas sem parar.
   */
  const nomeDoDestino = useStore((s) => {
    const no = s.nodeLookup.get(target)
    if (!no) return ''
    return apelidoDoBloco(no.type ?? '', no.data as Record<string, unknown> | undefined)
  })
  const iconeDoDestino = useStore((s) => {
    const tipo = s.nodeLookup.get(target)?.type ?? ''
    return (ICONES as Record<string, string>)[tipo] ?? '→'
  })

  /**
   * De onde o gesto partiu, e qual era o desvio naquele instante.
   *
   * O desvio novo é sempre `base + (ponteiro agora − ponteiro no início)`, nunca
   * a posição absoluta do ponteiro: assim a linha não salta para debaixo do
   * cursor quando o gesto começa longe do traço, e a conta já sai em
   * coordenadas do desenho, então o zoom não muda a sensibilidade.
   */
  const gesto = useRef<{ de: Desvio; base: Desvio } | null>(null)

  const desvio = (data?.desvio ?? null) as Desvio | null

  /**
   * A linha volta para trás (ou o alvo está colado na origem)?
   *
   * `targetX` é a alça de entrada, na esquerda do cartão de destino, e
   * `sourceX` a de saída, na direita do de origem. Se a de entrada não está
   * pelo menos `FOLGA_PARA_CURVA` adiante, não há espaço para curva.
   */
  const paraTras = targetX < sourceX + FOLGA_PARA_CURVA

  const [caminhoCurvo, meioCurvoX, meioCurvoY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    // Padrão do React Flow é 0,25. Mais baixo encurta a barriga da curva: em
    // tela cheia de cartão, barriga larga é o que faz linha de um ramo passar
    // por dentro do ramo vizinho.
    curvature: 0.2,
  })

  const [caminhoDeVolta, meioDeVoltaX, meioDeVoltaY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetX,
    targetY,
    targetPosition: targetPosition ?? Position.Left,
    // Quanto a linha avança para fora do cartão antes de virar. 28px passa
    // folgado pela borda e pela alça sem encostar no cartão vizinho.
    offset: 28,
    // Canto arredondado, não canto vivo: acompanha o raio dos cartões e evita
    // o visual de esquema elétrico.
    borderRadius: 14,
  })

  const [caminhoAutomatico, meioAutomaticoX, meioAutomaticoY] = paraTras
    ? [caminhoDeVolta, meioDeVoltaX, meioDeVoltaY]
    : [caminhoCurvo, meioCurvoX, meioCurvoY]

  const meioX = (sourceX + targetX) / 2 + (desvio?.x ?? 0)
  const meioY = (sourceY + targetY) / 2 + (desvio?.y ?? 0)

  /*
   * Os corredores que o arrumador reservou para esta linha, se houver.
   *
   * Eles mandam mais que a curva automática e menos que o desvio à mão: quem
   * puxou a linha com o dedo decidiu depois do arrumador, e decisão de pessoa
   * ganha de conta de máquina. Dois cliques na linha devolvem o corredor.
   */
  const pontos = (data?.pontos ?? null) as Ponto[] | null

  const caminho = desvio
    ? caminhoDesviado(sourceX, sourceY, targetX, targetY, meioX, meioY)
    : pontos && pontos.length > 0
      ? caminhoPorCorredor(sourceX, sourceY, targetX, targetY, pontos)
      : caminhoAutomatico

  // No corredor, o ✕ vai para o meio da própria fiação, e não para o meio da
  // reta entre as pontas , que num fio que dá a volta cai longe do fio.
  const noMeioDoCorredor = pontos && pontos.length > 0 ? pontos[Math.floor(pontos.length / 2)]! : null

  const rotuloX = desvio ? meioX : (noMeioDoCorredor?.x ?? meioAutomaticoX)
  const rotuloY = desvio ? meioY : (noMeioDoCorredor?.y ?? meioAutomaticoY)

  /**
   * A ligação é longa demais para valer a pena desenhar?
   *
   * Desvio à mão manda mais: quem puxou o fio com o dedo quis vê-lo ali.
   */
  const dobrada =
    !desvio && (targetX - sourceX > LONGE_PARA_FRENTE || sourceX - targetX > LONGE_PARA_TRAS)

  const sobOPonteiro = realcada === id
  const acesa = Boolean(sobOPonteiro || selected || arrastando || presaAoSelecionado)
  // Só apaga as outras quando há de fato algo em foco. Sem esta condição o
  // canvas parado ficaria com tudo a 12% e ninguém veria ligação nenhuma.
  const haFoco = realcada !== null || haCartaoSelecionado
  const esmaecida = haFoco && !acesa

  function pegar(evento: PointerEvent<SVGPathElement>) {
    if (evento.button !== 0) return
    // Sem isto o React Flow entende o gesto como "arrastar a tela", e o fluxo
    // inteiro anda junto com a linha.
    evento.stopPropagation()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    const ponteiro = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
    gesto.current = { de: ponteiro, base: desvio ?? { x: 0, y: 0 } }
    setArrastando(true)
  }

  function mover(evento: PointerEvent<SVGPathElement>) {
    const emCurso = gesto.current
    if (!emCurso) return
    const ponteiro = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })
    acoes?.desviar(id, {
      x: emCurso.base.x + (ponteiro.x - emCurso.de.x),
      y: emCurso.base.y + (ponteiro.y - emCurso.de.y),
    })
  }

  function soltar(evento: PointerEvent<SVGPathElement>) {
    if (!gesto.current) return
    evento.currentTarget.releasePointerCapture(evento.pointerId)
    gesto.current = null
    setArrastando(false)
  }

  /**
   * O fio só aparece quando há motivo.
   *
   * Ligação curta: sempre. Ligação longa: só em foco , ponteiro no crachá,
   * linha selecionada ou um dos dois cartões selecionado. É aqui que o desenho
   * deixa de ser novelo: o que some é justamente o fio que atravessa a tela.
   */
  const mostrarFio = !dobrada || acesa

  return (
    <>
      {mostrarFio && (
        <>
          {/*
            O contorno: um traço da cor do canvas, mais grosso, por baixo do de
            verdade. É o que faz a linha em foco cortar visualmente as que ela
            cruza, em vez de virar mais um fio do novelo. Só aparece acesa,
            porque contorno em toda linha engorda o desenho sem informar nada.
          */}
          {acesa && !esmaecida && (
            <path
              d={caminho}
              fill="none"
              stroke="var(--canvas)"
              strokeWidth={8}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          )}

          <BaseEdge
            id={id}
            path={caminho}
            interactionWidth={0}
            style={{
              ...style,
              strokeWidth: acesa ? 2.5 : 1.5,
              strokeLinecap: 'round',
              stroke: acesa ? 'var(--color-primary, #2563eb)' : (style?.stroke ?? 'var(--fio)'),
              opacity: esmaecida ? 0.12 : 1,
              transition: 'opacity 120ms ease, stroke 120ms ease, stroke-width 120ms ease',
            }}
          />

          {/*
            A seta de chegada. Desenhada à mão, e não com `markerEnd`, porque
            `marker` em SVG não herda a cor do traço que o usa: acendendo a
            linha, a ponta continuaria cinza.
          */}
          <path
            d={`M ${targetX - 1},${targetY} L ${targetX - 9},${targetY - 4.5} L ${targetX - 9},${targetY + 4.5} Z`}
            fill={acesa ? 'var(--color-primary, #2563eb)' : 'var(--fio)'}
            style={{
              pointerEvents: 'none',
              opacity: esmaecida ? 0.12 : 1,
              transition: 'opacity 120ms ease, fill 120ms ease',
            }}
          />

          {/*
            A faixa que recebe o gesto. Fica por cima do traço, invisível e
            larga: o traço tem 1,5px e mirar nele é teste de pontaria.
            `nodrag`/`nopan` porque, sem eles, o React Flow reivindica o mesmo
            arrasto para mover a tela. O cursor é `ns-resize` porque o que se
            organiza aqui é altura de linha, e é ele que avisa, antes do
            clique, que a linha se mexe.

            Ligação dobrada não ganha faixa nenhuma enquanto está escondida:
            faixa invisível de 26px atravessando a tela inteira rouba o arrasto
            do canvas num lugar onde não há nada desenhado.
          */}
          <path
            d={caminho}
            fill="none"
            stroke="transparent"
            strokeWidth={26}
            className="nodrag nopan"
            style={{ pointerEvents: 'stroke', cursor: arrastando ? 'grabbing' : 'ns-resize' }}
            onPointerEnter={() => realcar(id)}
            onPointerLeave={() => {
              if (!gesto.current) realcar(null)
            }}
            onPointerDown={pegar}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onDoubleClick={(evento) => {
              evento.stopPropagation()
              acoes?.desviar(id, null)
            }}
          >
            <title>
              {desvio
                ? 'Arraste para mover esta ligação; dois cliques devolvem ao caminho automático'
                : 'Arraste para mover esta ligação'}
            </title>
          </path>
        </>
      )}

      {/*
        O toco de fio entre a alça e o crachá.

        Sem ele o crachá flutua no vazio e não se lê como ligação , foi
        exatamente o que aconteceu: "isso aí é o quê?". Doze pixels bastam para
        o olho fechar a conta de que aquilo sai dali.
      */}
      {dobrada && (
        <path
          d={`M ${sourceX},${sourceY} L ${sourceX + 12},${sourceY}`}
          stroke={acesa ? 'var(--color-primary, #2563eb)' : 'var(--fio)'}
          strokeWidth={acesa ? 2.5 : 1.5}
          strokeLinecap="round"
          style={{ pointerEvents: 'none', opacity: esmaecida ? 0.12 : 1 }}
        />
      )}

      <EdgeLabelRenderer>
        <div
          // `pointer-events-none` no contêiner e `auto` no que é clicável: o
          // rótulo cobre um retângulo inteiro em cima do desenho, e sem isso
          // ele engoliria o clique de quem só queria arrastar a tela por ali.
          //
          // O `onPointerEnter` aqui é metade do conserto do piscar: ele segura
          // o realce enquanto o ponteiro está no botão, e o `realcar(null)` que
          // a linha agendou ao ser deixada nunca chega a valer. Ver
          // `ESPERA_PARA_APAGAR`.
          style={{
            position: 'absolute',
            transform: dobrada
              ? `translate(0, -50%) translate(${sourceX + 12}px, ${sourceY}px)`
              : `translate(-50%, -50%) translate(${rotuloX}px, ${rotuloY}px)`,
          }}
          className="nodrag nopan pointer-events-none"
          onPointerEnter={() => realcar(id)}
          onPointerLeave={() => realcar(null)}
        >
          {dobrada ? (
            /*
              O crachá que substitui o fio longo.

              Clicar leva a câmera até o destino, que é a pergunta real de quem
              olha para uma ligação dessas ("vai parar onde?") , e leva em menos
              tempo do que seguir o traço com o olho levava.
            */
            <span
              className={`pointer-events-auto flex items-center gap-1 rounded-full border bg-panel py-[3px] pr-[3px] pl-2 text-[10px] whitespace-nowrap shadow-[0_2px_10px_rgba(19,25,34,0.12)] transition ${
                acesa ? 'border-primary/40 text-primary' : 'border-line text-muted'
              }`}
            >
              <button
                type="button"
                title={`Esta saída leva ao bloco "${nomeDoDestino}". Clique para ir até lá.`}
                onClick={(evento) => {
                  evento.stopPropagation()
                  tela.fitView({ nodes: [{ id: target }], duration: 400, maxZoom: 1.1 })
                }}
                className="flex items-center gap-1"
              >
                {/*
                  "vai para" escrito por extenso, e não só uma seta.

                  A primeira versão era ícone + nome + ↗, e ninguém entendeu o
                  que era , dois dos três símbolos eram seta (o ícone do bloco
                  de mensagem também é `↗`) e nenhum dizia que aquilo era uma
                  ligação. Duas palavras resolvem o que três glifos não
                  resolveram.
                */}
                <span className="text-[9px] tracking-wide text-soft">vai para</span>
                <span aria-hidden>{iconeDoDestino}</span>
                <span className="max-w-[120px] truncate font-medium">{nomeDoDestino}</span>
              </button>
              <button
                type="button"
                title="Apagar esta ligação"
                aria-label="Apagar esta ligação"
                onClick={(evento) => {
                  evento.stopPropagation()
                  acoes?.apagar(id)
                }}
                className={`flex size-[16px] items-center justify-center rounded-full text-[9px] transition hover:bg-rose-400/15 hover:text-perigo ${
                  acesa ? 'opacity-100' : 'opacity-0'
                }`}
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              type="button"
              title="Apagar esta ligação"
              aria-label="Apagar esta ligação"
              onClick={(evento) => {
                evento.stopPropagation()
                acoes?.apagar(id)
              }}
              // Aparece **só** quando a linha está em foco (ponteiro, seleção
              // da linha ou de um dos cartões). Antes ficava de leve em todas
              // ao mesmo tempo: num fluxo de trinta ligações isso é trinta
              // botões de apagar espalhados pelo desenho, e era metade da
              // poluição que fazia a tela parecer novelo. Some durante o
              // arrasto, quando fica debaixo do ponteiro esperando um clique
              // acidental.
              className={`flex size-[20px] items-center justify-center rounded-full border border-line bg-panel text-[10px] text-muted transition hover:scale-110 hover:border-rose-400/50 hover:bg-rose-400/15 hover:text-perigo ${
                acesa && !arrastando
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const tiposDeAresta: EdgeTypes = { removivel: ArestaRemovivel }
