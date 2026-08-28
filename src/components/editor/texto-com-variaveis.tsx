'use client'

import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { chavesSimplesCitadas, fatiarVariaveis } from '@/core/engine/interpolar'
import { DICA_CHAVE_SIMPLES } from './realce-de-variaveis'
import { SeletorDeVariavel } from './escolher-variavel'

/**
 * Campo de texto que **mostra** onde há variável.
 *
 * `{{nome}}` digitado no meio de uma frase é indistinguível de texto comum, e a
 * consequência aparece tarde: a pessoa escreve `{{nomee}}`, publica, e descobre
 * na conversa de um cliente que ali sai vazio. O realce é o aviso no lugar certo
 * — na hora de escrever.
 *
 * **E ele distingue conhecida de desconhecida**, que é o que transforma enfeite
 * em informação. Variável que nenhum bloco preenche fica âmbar, com o mesmo
 * critério do `validar()`.
 *
 * ---------------------------------------------------------------------------
 * Fundo espelhado: como funciona, e o que já quebrou
 * ---------------------------------------------------------------------------
 *
 * Não dá para estilizar pedaço de conteúdo dentro de um `<textarea>`. A saída é
 * uma `<div>` atrás desenhando o texto fatiado, e o campo por cima com o texto
 * transparente e só o cursor visível. O `<textarea>` continua sendo um
 * `<textarea>` de verdade — `contenteditable` daria o mesmo efeito e quebraria
 * colar, desfazer, seleção nativa e a inserção de variável na posição do cursor.
 *
 * **As medidas vêm de `style` inline, e não de classe.** A primeira versão usava
 * classes utilitárias nas duas camadas e o texto apareceu dobrado, deslocado
 * alguns pixels: `.app-field` define `color: var(--ink)` e ganhava do
 * `text-transparent` do Tailwind por ordem de origem, então as duas camadas
 * pintavam texto. Estilo inline é a única forma de garantir que **a mesma
 * medida** vale para as duas — e aqui divergir um pixel significa o cursor numa
 * coluna e a cor em outra.
 *
 * O resto que a técnica exige, e cada item já quebrou em alguma implementação:
 *
 * - rolagem sincronizada, senão o realce descola do texto na quinta linha;
 * - um caractere depois da última quebra de linha, senão o fundo não reserva a
 *   linha vazia final e o texto sobe um degrau ao apertar `Enter`;
 * - `white-space: pre-wrap` e quebra por palavra idênticas nas duas.
 */

/**
 * Tudo que as duas camadas precisam ter igual, ao pixel.
 *
 * `font: inherit` não basta: o `<textarea>` tem fonte própria do agente de
 * usuário e não herda sozinho.
 */
const MEDIDAS: CSSProperties = {
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: '24px',
  letterSpacing: 'normal',
  padding: '10px 12px',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: 10,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'normal',
  margin: 0,
  /**
   * O vão da barra de rolagem, reservado sempre e nas duas camadas.
   *
   * Sem isto, o texto que passa da altura faz o `<textarea>` mostrar barra e
   * perder ~15px de largura útil — o espelho, que não tem barra, continua com a
   * largura cheia e quebra as linhas em pontos diferentes. É o mesmo defeito de
   * desalinhamento, só que aparecendo de repente na quarta linha.
   */
  scrollbarGutter: 'stable',
}

const FUNDO: CSSProperties = {
  ...MEDIDAS,
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  borderColor: 'transparent',
  background: 'transparent',
  color: 'var(--ink)',
}

const CAMPO: CSSProperties = {
  ...MEDIDAS,
  position: 'relative',
  width: '100%',
  display: 'block',
  outline: 'none',
  background: 'rgba(255,255,255,0.045)',
  borderColor: 'rgba(255,255,255,0.1)',
  // As duas linhas que fazem o espelho aparecer: o texto some, o cursor fica.
  color: 'transparent',
  caretColor: 'var(--ink)',
}

/**
 * O realce de uma variável — **sem mexer em uma medida sequer**.
 *
 * Era aqui o defeito que fazia o campo parecer duplicado: o realce tinha
 * `padding: 1px 3px` e `font-weight: 600`. Os dois mudam a largura do texto no
 * espelho, e o `<textarea>` por cima não sabe disso — ele desenha `{{nome}}`
 * com a largura normal. A partir da primeira variável as duas camadas passavam
 * a discordar de alguns pixels por variável, e o efeito na tela é exatamente o
 * que se vê: texto fantasma deslocado, e o cursor caindo numa coluna diferente
 * da letra que está sendo digitada.
 *
 * A regra desta técnica, que não abre exceção: **o espelho só pode mudar cor.**
 * Nada de padding, borda, negrito, `letter-spacing`, fonte ou transformação —
 * qualquer coisa que mova um glifo um pixel quebra a ilusão.
 *
 * O ar em volta do realce continua existindo, feito por `box-shadow`: sombra
 * não ocupa espaço no fluxo, então ela pinta a folga sem empurrar o que vem
 * depois.
 */
const REALCE_CONHECIDA: CSSProperties = {
  borderRadius: 4,
  background: 'color-mix(in oklab, var(--accent) 20%, transparent)',
  color: 'var(--accent)',
  boxShadow: '0 0 0 2px color-mix(in oklab, var(--accent) 20%, transparent)',
}

const REALCE_DESCONHECIDA: CSSProperties = {
  borderRadius: 4,
  background: 'rgba(252, 211, 77, 0.20)',
  color: '#fde68a',
  boxShadow: '0 0 0 2px rgba(252, 211, 77, 0.20)',
}

/**
 * A chave de uma só, vermelha — o erro que sai literal na frente do cliente.
 *
 * Vermelho e não âmbar de propósito: âmbar aqui já quer dizer "variável que
 * nenhum bloco preenche", que ao menos sai vazia. `{nome}` não é variável
 * nenhuma; o texto viaja como está. São dois problemas diferentes e a cor não
 * pode dizer que são o mesmo.
 *
 * Vale a regra do espelho, sem exceção: **só cor.** Nada de padding nem negrito
 * — qualquer coisa que mova um glifo desalinha o cursor do campo por cima.
 */
const REALCE_CHAVE_SIMPLES: CSSProperties = {
  borderRadius: 4,
  background: 'rgba(251, 113, 133, 0.22)',
  color: '#fda4af',
  boxShadow: '0 0 0 2px rgba(251, 113, 133, 0.22)',
}

function estiloDoPedaco(
  pedaco: { tipo: 'variavel' | 'chave-simples'; nome: string },
  conhecidas?: string[],
): CSSProperties {
  if (pedaco.tipo === 'chave-simples') return REALCE_CHAVE_SIMPLES
  if (conhecidas && !conhecidas.includes(pedaco.nome)) return REALCE_DESCONHECIDA
  return REALCE_CONHECIDA
}

function Pedacos({ valor, conhecidas }: { valor: string; conhecidas?: string[] }) {
  return (
    <>
      {fatiarVariaveis(valor).map((pedaco, i) =>
        pedaco.tipo === 'texto' ? (
          <span key={i}>{pedaco.texto}</span>
        ) : (
          <span key={i} style={estiloDoPedaco(pedaco, conhecidas)}>
            {pedaco.texto}
          </span>
        ),
      )}
      {/* Ver o comentário do topo: sem isto a última linha vazia some. */}
      {'​'}
    </>
  )
}

/**
 * A camada que faz a tag vermelha **responder ao mouse**.
 *
 * O espelho fica atrás do campo e tem `pointer-events: none`, então passar o
 * mouse por cima dele nunca acontece: quem recebe o ponteiro é o `<textarea>`.
 * Para a dica aparecer em cima do pedaço errado — e não numa frase solta embaixo
 * do campo — é preciso uma terceira camada **por cima**, invisível, onde só os
 * pedaços de chave simples recebem ponteiro.
 *
 * Ela é invisível porque o texto é transparente: existe apenas para ocupar
 * exatamente as mesmas posições, com as mesmas medidas do espelho. Só nasce
 * quando há chave simples no texto — sem erro, nada é sobreposto ao campo.
 *
 * Clicar na tag continua funcionando: o `mousedown` é devolvido ao campo, com o
 * cursor logo depois do pedaço clicado, que é onde se conserta a chave que
 * falta.
 */
function DicasDeChaveSimples({
  valor,
  campo,
  camada,
  estilo,
}: {
  valor: string
  campo: { current: HTMLTextAreaElement | HTMLInputElement | null }
  camada: { current: HTMLDivElement | null }
  estilo?: CSSProperties
}) {
  const pedacos = fatiarVariaveis(valor)
  if (!pedacos.some((p) => p.tipo === 'chave-simples')) return null

  // Onde cada pedaço começa no texto — calculado antes de desenhar, porque é o
  // que diz para onde mandar o cursor quando alguém clica na tag.
  const inicios: number[] = []
  pedacos.reduce((cursor, pedaco) => {
    inicios.push(cursor)
    return cursor + pedaco.texto.length
  }, 0)

  return (
    <div
      ref={camada}
      aria-hidden
      style={{ ...FUNDO, ...estilo, color: 'transparent', zIndex: 2 }}
    >
      {pedacos.map((pedaco, i) => {
        const inicio = inicios[i] as number
        const fim = inicio + pedaco.texto.length

        if (pedaco.tipo !== 'chave-simples') return <span key={i}>{pedaco.texto}</span>

        return (
          <span
            key={i}
            title={DICA_CHAVE_SIMPLES}
            style={{ pointerEvents: 'auto', cursor: 'text' }}
            onMouseDown={(evento) => {
              evento.preventDefault()
              const alvo = campo.current
              if (!alvo) return
              alvo.focus()
              alvo.setSelectionRange(inicio, fim)
            }}
          >
            {pedaco.texto}
          </span>
        )
      })}
      {'​'}
    </div>
  )
}

export function TextoComVariaveis({
  valor,
  aoMudar,
  area,
  rows = 4,
  erro = false,
  conhecidas,
  id,
}: {
  valor: string
  aoMudar: (valor: string) => void
  /** O mesmo `ref` que a barra de formatação usa para saber onde está o cursor. */
  area?: RefObject<HTMLTextAreaElement | null>
  rows?: number
  /** Pinta a borda de recusa — texto acima do limite da Meta, por exemplo. */
  erro?: boolean
  /** Quando vem, variável fora da lista é marcada como desconhecida. */
  conhecidas?: string[]
  id?: string
}) {
  const proprio = useRef<HTMLTextAreaElement>(null)
  const campo = area ?? proprio
  const fundo = useRef<HTMLDivElement>(null)
  const dicas = useRef<HTMLDivElement>(null)

  return (
    <div className="relative">
      <div ref={fundo} aria-hidden style={FUNDO}>
        <Pedacos valor={valor} conhecidas={conhecidas} />
      </div>

      <textarea
        id={id}
        ref={campo}
        value={valor}
        rows={rows}
        onChange={(e) => aoMudar(e.target.value)}
        onScroll={(e) => {
          // As três camadas rolam juntas, senão a cor — e a área que responde ao
          // mouse — descola do texto a partir da quinta linha.
          if (fundo.current) fundo.current.scrollTop = e.currentTarget.scrollTop
          if (dicas.current) dicas.current.scrollTop = e.currentTarget.scrollTop
        }}
        style={{
          ...CAMPO,
          resize: 'vertical',
          ...(erro ? { borderColor: 'rgba(251,113,133,0.6)' } : {}),
        }}
      />

      <DicasDeChaveSimples valor={valor} campo={campo} camada={dicas} />
    </div>
  )
}

/**
 * A mesma coisa numa linha só — para os campos curtos que interpolam.
 *
 * O botão de variável mora **dentro** do campo, encostado na direita. Campo de
 * uma linha não tem barra de formatação para hospedá-lo (asterisco não vira
 * negrito numa URL nem no valor do Guardar), e uma barra só para ele custaria
 * uma faixa de altura em cada campo do painel. O espaço dele é reservado no
 * `padding-right` das **duas** camadas, senão o espelho quebraria o texto num
 * ponto e o campo em outro.
 */
export function LinhaComVariaveis({
  valor,
  aoMudar,
  conhecidas,
  variaveis,
  placeholder,
  maxLength,
  mono = false,
}: {
  valor: string
  aoMudar: (valor: string) => void
  conhecidas?: string[]
  /** Quando vem, o campo ganha o botão que insere variável no cursor. */
  variaveis?: string[]
  placeholder?: string
  maxLength?: number
  mono?: boolean
}) {
  const fundo = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const dicas = useRef<HTMLDivElement>(null)

  const espaco = variaveis ? { paddingRight: 34 } : {}
  const fonte = mono ? { fontFamily: 'var(--font-mono, ui-monospace, monospace)' } : {}

  return (
    <div className="relative">
      <div
        ref={fundo}
        aria-hidden
        style={{ ...FUNDO, ...espaco, ...fonte, whiteSpace: 'pre' }}
      >
        {/* O texto do campo é transparente, então o `placeholder` nativo também
            seria — quem o desenha é o espelho, como desenha todo o resto. */}
        {valor === '' && placeholder ? (
          <span style={{ color: 'var(--dim, #6b7686)' }}>{placeholder}</span>
        ) : (
          <Pedacos valor={valor} conhecidas={conhecidas} />
        )}
      </div>

      <input
        ref={campo}
        value={valor}
        maxLength={maxLength}
        onChange={(e) => aoMudar(e.target.value)}
        onScroll={(e) => {
          if (fundo.current) fundo.current.scrollLeft = e.currentTarget.scrollLeft
          if (dicas.current) dicas.current.scrollLeft = e.currentTarget.scrollLeft
        }}
        style={{ ...CAMPO, ...espaco, ...fonte, whiteSpace: 'pre' }}
      />

      <DicasDeChaveSimples
        valor={valor}
        campo={campo}
        camada={dicas}
        estilo={{ ...espaco, ...fonte, whiteSpace: 'pre' }}
      />

      {variaveis && (
        <span className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <SeletorDeVariavel campo={campo} variaveis={variaveis} aoMudar={aoMudar} />
        </span>
      )}
    </div>
  )
}

/**
 * A legenda que explica a cor.
 *
 * Cor sem legenda é decoração: quem vê âmbar pela primeira vez precisa saber
 * que é aviso, e não estilo.
 */
export function LegendaDeVariaveis({
  valor,
  conhecidas,
  children,
}: {
  valor: string
  conhecidas?: string[]
  children?: ReactNode
}) {
  const citadas = fatiarVariaveis(valor).filter((p) => p.tipo === 'variavel')
  const desconhecidas = conhecidas
    ? [...new Set(citadas.map((p) => (p.tipo === 'variavel' ? p.nome : '')))].filter(
        (nome) => nome !== '' && !conhecidas.includes(nome),
      )
    : []

  /*
   * Uma chave só vem antes de tudo: é engano de digitação, não de desenho, e
   * some da conversa sem deixar rastro — `interpolar()` não reconhece, então
   * nem sai vazio, sai escrito.
   */
  const simples = chavesSimplesCitadas(valor)
  if (simples.length > 0) {
    // Vermelha, como a tag dentro do campo: a frase embaixo e o pedaço realçado
    // falam do mesmo erro, e cores diferentes fariam parecer dois.
    return (
      <span className="mt-1 block text-[10.5px] leading-4 text-rose-300">
        {simples.map((nome) => `{${nome}}`).join(', ')}{' '}
        {simples.length === 1 ? 'tem uma chave só' : 'têm uma chave só'} — o certo é{' '}
        {simples.map((nome) => `{{${nome}}}`).join(', ')}. Com uma, sai assim mesmo na conversa.
      </span>
    )
  }

  if (desconhecidas.length > 0) {
    return (
      <span className="mt-1 block text-[10.5px] leading-4 text-amber-200">
        {desconhecidas.map((nome) => `{{${nome}}}`).join(', ')}{' '}
        {desconhecidas.length === 1 ? 'não é preenchida' : 'não são preenchidas'} por nenhum bloco
        antes daqui — vai sair vazio na conversa.
      </span>
    )
  }

  return (
    <span className="mt-1 block text-[10.5px] text-dim">{children ?? 'aceita {{variavel}}'}</span>
  )
}
