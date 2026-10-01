'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAcaoOtimista } from '@/components/design/acao-otimista'
import { useCitacao } from '@/components/lead/citacao'
import { acaoReagir } from '@/server/acoes-reacao'
import { acaoFavoritarMensagem } from '@/server/acoes-marcadores'

/**
 * A bolha com o que mora nela: a seta do menu no canto e as reações embaixo.
 *
 * ---------------------------------------------------------------------------
 * Por que as duas coisas moram no mesmo componente
 * ---------------------------------------------------------------------------
 *
 * Antes eram dois: `ReacoesNaBolha` desenhava no servidor e `AcoesDaMensagem`
 * clicava no cliente. Funcionava, e era lento de um jeito que a tela não tinha
 * como esconder: clicar no emoji mandava para o servidor, que mandava para a
 * Meta, que respondia, e só então o `revalidatePath` refazia a página e a
 * reação aparecia. Segundos, para um clique que o WhatsApp resolve na hora.
 *
 * Para a reação aparecer antes da resposta, quem a desenha tem que ser quem
 * a clicou. Por isso os dois viraram um.
 *
 * ---------------------------------------------------------------------------
 * Reagir é otimista, e enviar mensagem continua não sendo
 * ---------------------------------------------------------------------------
 *
 * `acao-otimista.ts` diz, com razão, que nada que sai do sistema deve ser
 * otimista: fingir que uma mensagem saiu é mentir sobre algo que outra pessoa
 * ia receber. **Reagir é a exceção, e ela é estreita de propósito:**
 *
 * - A reação é um comentário sobre uma mensagem que já existe, não uma
 *   afirmação nova na conversa.
 * - Se a Meta recusar, o emoji **volta** e o erro aparece ali do lado. A janela
 *   em que a tela mostrou algo que não existiu dura o tempo de uma requisição,
 *   e o estado que sobra é o certo.
 * - É o que o próprio WhatsApp faz. Esperar aqui não é honestidade: é uma tela
 *   que parece quebrada, e leva a pessoa a clicar de novo.
 *
 * Mandar texto, foto ou áudio segue esperando o servidor. A diferença é o que
 * está em jogo quando erra.
 */

/** Uma reação já grudada nesta mensagem, como o servidor a leu. */
type ReacaoNaBolha = {
  emoji: string
  de: 'entrada' | 'saida'
  id: string
}

/** Os seis do WhatsApp, na ordem dele. */
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

const ITEM =
  'flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13.5px] text-ink transition hover:bg-surface disabled:opacity-50'

export function RodapeDaMensagem({
  clienteId,
  contatoId,
  waMessageId,
  podeReagir,
  reacoes,
  nome,
  texto,
  deQuem,
  nossa,
  mensagemId,
  favorita,
  children,
}: {
  clienteId: string
  contatoId: string
  /** `null` = saída ainda não confirmada: sem id da Meta não dá para reagir nem citar. */
  waMessageId: string | null
  /** `false` = passou dos 30 dias. Só o reagir some; citar continua. */
  podeReagir: boolean
  reacoes: ReacaoNaBolha[]
  /** Como chamar quem está do outro lado, no `title` da reação dela. */
  nome: string | null
  texto: string | null
  /** Como nomear o autor na prévia da citação: "ao atendimento" ou o nome dela. */
  deQuem: string
  nossa: boolean
  /**
   * O id **interno** da mensagem (`messages.id`), que é o que a estrela guarda.
   *
   * Não é o `waMessageId`: o da Meta é texto, some na saída ainda não
   * confirmada e não tem chave estrangeira para nada. Ver a 0063.
   */
  mensagemId: string
  /** Se **eu** já guardei esta mensagem. */
  favorita: boolean
  /** A bolha. Ela vem com `max-w-full`: a largura máxima é deste invólucro. */
  children: ReactNode
}) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [emojisAbertos, setEmojisAbertos] = useState(false)
  const [copiado, setCopiado] = useState(false)
  /** Perto do fim da área que rola, o menu abre para cima, como no WhatsApp. */
  const [paraCima, setParaCima] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)
  /** `null` fora do provedor, a tela que não monta citação ainda reage. */
  const citacao = useCitacao()

  /*
   * A nossa reação é o único pedaço deste rodapé que muda por clique daqui, e
   * por isso é o único que vira estado. A da outra pessoa chega por webhook e
   * continua sendo verdade do servidor.
   */
  const daOutraPessoa = reacoes.filter((r) => r.de === 'entrada')
  const nossaDoServidor = reacoes.find((r) => r.de === 'saida')?.emoji ?? null
  const { valor: minhaReacao, erro, agir, limparErro } = useAcaoOtimista<string | null>(nossaDoServidor)

  /*
   * A estrela tem otimismo próprio, e não divide o de `agir`: são gestos
   * independentes, e um estado só faria o erro de um aparecer no outro.
   * Guardar é otimista porque nada sai do sistema.
   */
  const {
    valor: guardada,
    erro: erroDaEstrela,
    agir: agirNaEstrela,
  } = useAcaoOtimista<boolean>(favorita)

  // Clique fora ou Esc fecha o que estiver aberto, como no WhatsApp.
  useEffect(() => {
    if (!menuAberto && !emojisAbertos) return
    const fora = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) {
        setMenuAberto(false)
        setEmojisAbertos(false)
      }
    }
    const esc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setMenuAberto(false)
        setEmojisAbertos(false)
      }
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [menuAberto, emojisAbertos])

  function reagir(emoji: string) {
    if (!waMessageId) return
    setEmojisAbertos(false)

    /*
     * Clicar no emoji que já está lá **remove**, string vazia é como a Meta
     * desfaz uma reação. Sem isto, não haveria caminho nenhum para tirar.
     */
    const escolhido = emoji === minhaReacao ? '' : emoji

    agir(escolhido === '' ? null : escolhido, () =>
      acaoReagir(clienteId, contatoId, { waMessageId, emoji: escolhido }),
    )
  }

  function copiar() {
    setMenuAberto(false)
    if (!texto) return
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(true)
        setTimeout(() => setCopiado(false), 1500)
      })
      .catch(() => {})
  }

  const chips = [
    ...daOutraPessoa.map((r) => ({ chave: r.id, emoji: r.emoji, dono: nome ?? 'cliente' })),
    ...(minhaReacao ? [{ chave: 'nossa', emoji: minhaReacao, dono: 'atendimento' }] : []),
  ]
  const lado = nossa ? 'right-0' : 'left-0'

  return (
    <div
      ref={caixa}
      className={`group relative flex min-w-0 max-w-[78%] flex-col ${nossa ? 'items-end' : 'items-start'}`}
    >
      {children}

      {/*
        A seta no canto da bolha, como no WhatsApp: some até o mouse passar,
        e no celular, que não tem hover, fica sempre. O menu abre embaixo dela.
        Antes eram três botões pequenos embaixo de toda bolha, sempre à vista.
      */}
      <button
        type="button"
        onClick={() => {
          limparErro()
          setEmojisAbertos(false)
          if (!menuAberto && caixa.current) setParaCima(espacoAbaixo(caixa.current) < 230)
          setMenuAberto((a) => !a)
        }}
        title="Mais opções"
        aria-label="Mais opções desta mensagem"
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        className={`absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-panel/85 text-muted shadow-[0_1px_4px_rgba(19,25,34,0.12)] backdrop-blur-sm transition hover:text-ink focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 ${menuAberto ? '!opacity-100' : ''}`}
      >
        <IconeSeta />
      </button>

      {menuAberto && (
        <div
          role="menu"
          className={`absolute ${paraCima ? 'bottom-full mb-1' : 'top-8'} ${lado} z-30 min-w-[196px] overflow-hidden rounded-[12px] border border-line bg-panel py-1.5 shadow-[0_8px_28px_rgba(19,25,34,0.16)]`}
        >
          {citacao && waMessageId && (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                setMenuAberto(false)
                citacao.citar({ waMessageId, texto, deQuem })
              }}
            >
              <IconeResponder /> Responder
            </button>
          )}
          {texto && (
            <button type="button" role="menuitem" className={ITEM} onClick={copiar}>
              <IconeCopiar /> Copiar
            </button>
          )}
          {podeReagir && waMessageId && (
            <button
              type="button"
              role="menuitem"
              className={ITEM}
              onClick={() => {
                setMenuAberto(false)
                setEmojisAbertos(true)
              }}
            >
              <IconeReagir /> Reagir
            </button>
          )}
          {/*
            A estrela não depende do `waMessageId`: guarda pelo id interno, que
            existe até na saída que a Meta ainda não confirmou.
          */}
          <button
            type="button"
            role="menuitem"
            aria-pressed={guardada}
            className={ITEM}
            onClick={() => {
              setMenuAberto(false)
              agirNaEstrela(!guardada, () => acaoFavoritarMensagem(clienteId, mensagemId, !guardada))
            }}
          >
            <IconeEstrela cheia={guardada} /> {guardada ? 'Desfavoritar' : 'Favoritar'}
          </button>
        </div>
      )}

      {emojisAbertos && (
        <div
          role="menu"
          aria-label="Reagir"
          className={`absolute bottom-full ${lado} z-30 mb-1.5 flex gap-1 rounded-full border border-line bg-panel px-2 py-1.5 shadow-[0_8px_28px_rgba(19,25,34,0.16)]`}
        >
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => reagir(emoji)}
              title={emoji === minhaReacao ? 'Tirar a reação' : `Reagir com ${emoji}`}
              className={`grid h-9 w-9 place-items-center rounded-full text-[22px] leading-none transition hover:scale-125 ${emoji === minhaReacao ? 'bg-primary/20' : ''}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/*
        As reações ficam **fora** da bolha, encostadas na borda de baixo, como
        no WhatsApp: a reação comenta a mensagem, não faz parte dela.
      */}
      {(chips.length > 0 || guardada || copiado || erro || erroDaEstrela) && (
        <span className={`-mt-1.5 flex flex-wrap items-center gap-1 px-2 ${nossa ? 'flex-row-reverse' : ''}`}>
          {chips.map((chip) => (
            <span
              key={chip.chave}
              title={`${chip.dono} reagiu`}
              className="rounded-full border border-line bg-panel px-1.5 py-0.5 text-[15px] leading-none shadow-[0_1px_2px_rgba(19,25,34,0.055)]"
            >
              {chip.emoji}
            </span>
          ))}
          {guardada && (
            <span title="Favoritada" className="text-[13px] leading-none text-primary">
              ★
            </span>
          )}
          {copiado && <span className="text-[11px] text-muted">Copiado</span>}
          {(erro || erroDaEstrela) && (
            <span className="max-w-[220px] text-[11px] leading-4 text-perigo" role="alert">
              {erro ?? erroDaEstrela}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

/** Quanto cabe entre o topo da bolha e o fim do primeiro ancestral que rola. */
function espacoAbaixo(el: HTMLElement): number {
  const topo = el.getBoundingClientRect().top
  for (let pai = el.parentElement; pai; pai = pai.parentElement) {
    const { overflowY } = getComputedStyle(pai)
    if (overflowY === 'auto' || overflowY === 'scroll') return pai.getBoundingClientRect().bottom - topo
  }
  return window.innerHeight - topo
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-muted">
      {children}
    </svg>
  )
}

function IconeSeta() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function IconeResponder() {
  return (
    <Svg>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Svg>
  )
}

function IconeCopiar() {
  return (
    <Svg>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </Svg>
  )
}

function IconeReagir() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </Svg>
  )
}

function IconeEstrela({ cheia }: { cheia: boolean }) {
  return (
    <Svg>
      <path
        d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z"
        fill={cheia ? 'currentColor' : 'none'}
      />
    </Svg>
  )
}
