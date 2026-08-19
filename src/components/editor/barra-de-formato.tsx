'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { SeletorDeVariavel } from './escolher-variavel'
import { GRUPOS_DE_EMOJI, TODOS_OS_EMOJIS } from './emojis'
import { alternarMarca, type Marca } from './formatar'

/**
 * A barra de negrito, itálico, riscado, monoespaçado e emoji.
 *
 * **Ela nasceu dentro do bloco de Mensagem e ficou presa lá.** Enquanto só
 * aquele bloco mandava texto isso passou despercebido; hoje a Pergunta, o
 * Handoff e a legenda da Mídia também mandam, e quem escreve a saudação com
 * negrito e a pergunta seguinte sem entende — corretamente — que a segunda tela
 * está quebrada. Um componente só é o que impede as duas de divergirem de novo.
 *
 * O que ela **não** faz continua valendo: não muda o formato do que é gravado.
 * O WhatsApp não recebe HTML, ele recebe `*negrito*` e renderiza sozinho, então
 * o que fica no banco é exatamente o que sai. A barra existe para ninguém
 * precisar decorar que itálico é sublinhado dos dois lados.
 *
 * Onde ela **não** entra, e de propósito: campo que não vira mensagem. O valor
 * do bloco Guardar, o motivo interno do Handoff, a instrução da IA e a URL do
 * arquivo não passam por render nenhum — asterisco ali é asterisco literal, e
 * oferecer o botão seria ensinar a estragar o dado.
 */

export function BarraDeFormato({
  area,
  aoMudar,
  variaveis,
  children,
}: {
  /** O campo em que a barra age. Ela lê a seleção dele, não um estado próprio. */
  area: RefObject<HTMLTextAreaElement | null>
  aoMudar: (valor: string) => void
  /**
   * As variáveis do fluxo. Quando vêm, a barra ganha o botão que insere uma
   * delas no cursor — é o lugar certo dele: ao lado do negrito e do emoji, no
   * campo em que se escreve, e não numa lista no rodapé do painel.
   */
  variaveis?: string[]
  /** O que vai à direita — hoje, o contador de caracteres. */
  children?: ReactNode
}) {
  const [emojisAbertos, setEmojisAbertos] = useState(false)

  function aplicar(marca: Marca) {
    const elemento = area.current
    if (!elemento) return

    const { proximo, selecaoInicio, selecaoFim } = alternarMarca(
      elemento.value,
      elemento.selectionStart,
      elemento.selectionEnd,
      marca,
    )
    aoMudar(proximo)

    // O campo é controlado: esperar um frame devolve foco e seleção depois de
    // o valor novo chegar ao DOM.
    requestAnimationFrame(() => {
      elemento.focus()
      elemento.setSelectionRange(selecaoInicio, selecaoFim)
    })
  }

  function inserirEmoji(emoji: string) {
    const elemento = area.current
    if (!elemento) return

    const de = elemento.selectionStart
    const ate = elemento.selectionEnd
    const proximo = elemento.value.slice(0, de) + emoji + elemento.value.slice(ate)
    aoMudar(proximo)
    setEmojisAbertos(false)

    requestAnimationFrame(() => {
      elemento.focus()
      const cursor = de + emoji.length
      elemento.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div className="mb-1.5 flex items-center gap-1">
      <BotaoDeMarca rotulo="Negrito" marca="negrito" aoClicar={aplicar}>
        <strong>B</strong>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Itálico" marca="italico" aoClicar={aplicar}>
        <em>I</em>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Riscado" marca="riscado" aoClicar={aplicar}>
        <s>S</s>
      </BotaoDeMarca>
      <BotaoDeMarca rotulo="Monoespaçado" marca="mono" aoClicar={aplicar}>
        <span className="font-mono">{'{}'}</span>
      </BotaoDeMarca>

      {variaveis && <SeletorDeVariavel campo={area} variaveis={variaveis} aoMudar={aoMudar} />}

      <SeletorDeEmoji aoEscolher={inserirEmoji} aberto={emojisAbertos} aoAbrir={setEmojisAbertos} />

      {children && <span className="ml-auto">{children}</span>}
    </div>
  )
}

function BotaoDeMarca({
  rotulo,
  marca,
  aoClicar,
  children,
}: {
  rotulo: string
  marca: Marca
  aoClicar: (marca: Marca) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      // `onMouseDown` com `preventDefault` em vez de `onClick`: clicar num
      // botão tira o foco do textarea antes do clique acontecer, e com o foco
      // vai a seleção — que é justamente o que a barra precisa saber.
      onMouseDown={(evento) => {
        evento.preventDefault()
        aoClicar(marca)
      }}
      className="w-6 rounded-md py-0.5 text-[12px] text-dim transition hover:bg-white/[0.06] hover:text-white"
    >
      {children}
    </button>
  )
}


/**
 * O seletor de emoji: busca em português, agrupado, e **ancorado no botão**.
 *
 * Os três defeitos que ele corrige eram um só sintoma cada:
 *
 * 1. **Ele aparecia longe do botão**, no canto da tela, porque usava
 *    `.app-dropdown-menu` — que é `position: fixed` para servir ao `Dropdown`,
 *    que calcula coordenada em JS. Aqui o certo é `.app-popover`, absoluto,
 *    colado no próprio botão.
 * 2. **Não tinha busca**, então achar um emoji era varrer a grade com o olho.
 * 3. **Tinha trinta**, o que garantia que o procurado quase nunca estava lá.
 */
function SeletorDeEmoji({
  aoEscolher,
  aberto,
  aoAbrir,
}: {
  aoEscolher: (emoji: string) => void
  aberto: boolean
  aoAbrir: (aberto: boolean) => void
}) {
  const [busca, setBusca] = useState('')
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    const fechar = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) aoAbrir(false)
    }
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoAbrir(false)
    }

    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto, aoAbrir])

  const procurado = busca.trim().toLowerCase()
  // Busca varre a lista inteira e ignora os grupos: quem digitou "coração" quer
  // ver os oito de uma vez, não descobrir em qual gaveta cada um mora.
  const achados = procurado === '' ? null : TODOS_OS_EMOJIS.filter(([, chaves]) => chaves.includes(procurado))

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-label="Inserir emoji"
        aria-expanded={aberto}
        title="Inserir emoji"
        // Mesmo motivo de `BotaoDeMarca`: o clique não pode roubar o foco do
        // campo antes de a gente saber onde o cursor estava.
        onMouseDown={(evento) => {
          evento.preventDefault()
          aoAbrir(!aberto)
        }}
        className={`rounded-md px-1.5 py-0.5 text-[12px] transition ${
          aberto ? 'bg-accent/15 text-accent' : 'text-dim hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        ☺
      </button>

      {aberto && (
        <div className="app-popover left-0 w-[268px] p-1.5">
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar emoji… (ex.: coração, festa)"
            className="app-field mb-1 px-2 py-1.5 text-[12px]"
          />

          <div className="max-h-[212px] overflow-y-auto">
            {achados ? (
              achados.length === 0 ? (
                <p className="px-2 py-2 text-[11px] leading-4 text-dim">
                  Nenhum emoji com esse nome. O teclado do sistema continua funcionando.
                </p>
              ) : (
                <Grade itens={achados} aoEscolher={aoEscolher} />
              )
            ) : (
              GRUPOS_DE_EMOJI.map((grupo) => (
                <div key={grupo.nome} className="mb-1">
                  <p className="px-1 pt-1 pb-0.5 text-[9.5px] font-bold tracking-[0.06em] text-dim uppercase">
                    {grupo.nome}
                  </p>
                  <Grade itens={grupo.itens} aoEscolher={aoEscolher} />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Grade({
  itens,
  aoEscolher,
}: {
  itens: [string, string][]
  aoEscolher: (emoji: string) => void
}) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {itens.map(([emoji, chaves]) => (
        <button
          key={emoji}
          type="button"
          title={chaves.split(' ')[0]}
          onMouseDown={(evento) => {
            evento.preventDefault()
            aoEscolher(emoji)
          }}
          className="rounded p-1 text-[17px] leading-none transition hover:bg-white/[0.08]"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
