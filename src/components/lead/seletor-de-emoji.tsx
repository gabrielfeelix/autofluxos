'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dica } from '@/components/design/dica'
import { IconeCarinha } from '@/components/lead/icones-da-barra'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { buscarEmojis, carregarEmojis, guardarRecente, lerRecentes, type CategoriaDeEmoji } from '@/core/emojis-completos'

/**
 * A telinha de escolher emoji, ao lado do clipe de anexo.
 *
 * ---------------------------------------------------------------------------
 * Por que ela é diferente dos seis da reação
 * ---------------------------------------------------------------------------
 *
 * Reagir compete com responder: se escolher o emoji custar mais que digitar
 * "ok", ninguém reage, por isso ali são seis e acabou. Aqui a pessoa já está
 * escrevendo, e o emoji entra no meio de uma frase que ela pensou. O custo de
 * procurar já foi pago; o que não pode é **não achar**.
 *
 * ---------------------------------------------------------------------------
 * Emoji nunca foi recurso de API
 * ---------------------------------------------------------------------------
 *
 * O WhatsApp trata emoji como texto: digitar 👍 no campo sempre funcionou, e
 * continua funcionando sem esta tela. O que faltava era **achar** o emoji sem
 * sair do navegador, e é só isso que este componente resolve.
 *
 * O emoji entra no cursor, e não no fim: quem escreveu "ótimo, combinado" e
 * quer o 👍 antes da vírgula não deveria ter que recortar a frase.
 */
export function SeletorDeEmoji({
  aoEscolher,
  desabilitado = false,
}: {
  aoEscolher: (emoji: string) => void
  desabilitado?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  /*
   * Fechar clicando fora e no Esc.
   *
   * Sem isso a telinha fica por cima da conversa até alguém acertar de novo o
   * botão, e no meio de uma resposta ela tapa justamente a mensagem que a
   * pessoa está respondendo. O `Esc` existe pelo mesmo motivo do `Enter` que
   * envia: é o que a mão já faz sozinha.
   */
  useEffect(() => {
    if (!aberto) return

    function foraDaqui(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false)
    }
    function noEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('mousedown', foraDaqui)
    document.addEventListener('keydown', noEsc)
    return () => {
      document.removeEventListener('mousedown', foraDaqui)
      document.removeEventListener('keydown', noEsc)
    }
  }, [aberto])

  return (
    <div className="relative shrink-0" ref={caixa}>
      <Dica texto="Emoji" lado="cima">
        <button
          type="button"
          disabled={desabilitado}
          onClick={() => setAberto((a) => !a)}
          aria-label="Escolher emoji"
          aria-expanded={aberto}
          className={BOTAO_DA_BARRA}
        >
          <IconeCarinha />
        </button>
      </Dica>

      {aberto && (
        <PainelDeEmojis
          aoEscolher={aoEscolher}
          /*
           * Abre para cima porque o campo de resposta mora no rodapé da tela:
           * para baixo, a telinha nasceria fora da janela.
           */
          className="absolute bottom-full left-0 z-30 mb-2"
        />
      )}
    </div>
  )
}


/**
 * O painel inteiro, no modelo do WhatsApp: as abas de categoria em cima, a
 * busca, e uma rolagem só com todas as categorias em seção, começando pelos
 * recentes. A aba acende conforme a rolagem passa pela seção, e clicar nela
 * leva até lá.
 *
 * Sem o botão: o mesmo painel serve o campo de resposta e o "+" das reações.
 */
export function PainelDeEmojis({
  aoEscolher,
  placeholder = 'Pesquisar emoji',
  className = '',
}: {
  aoEscolher: (emoji: string) => void
  placeholder?: string
  className?: string
}) {
  const [categorias, setCategorias] = useState<CategoriaDeEmoji[] | null>(null)
  // O painel só nasce num clique, nunca no servidor: ler aqui é seguro.
  const [recentes, setRecentes] = useState<string[]>(lerRecentes)
  const [busca, setBusca] = useState('')
  const [ativa, setAtiva] = useState('')
  const rolagem = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let vivo = true
    carregarEmojis()
      .then((lidas) => vivo && setCategorias(lidas))
      .catch(() => vivo && setCategorias([]))
    return () => {
      vivo = false
    }
  }, [])

  const secoes = [
    ...(recentes.length > 0 ? [{ chave: 'recentes', nome: 'Recentes', emojis: recentes }] : []),
    ...(categorias ?? []).map((c) => ({ chave: c.chave, nome: c.nome, emojis: c.itens.map(([emoji]) => emoji) })),
  ]
  const procurando = busca.trim() !== ''
  const achados = procurando && categorias ? buscarEmojis(categorias, busca) : []
  const acesa = ativa || secoes[0]?.chave || ''

  function escolher(emoji: string) {
    setRecentes(guardarRecente(emoji))
    aoEscolher(emoji)
  }

  function irPara(chave: string) {
    setBusca('')
    setAtiva(chave)
    // Depois do render: com busca aberta, a seção ainda não está na tela.
    requestAnimationFrame(() => {
      const caixa = rolagem.current
      const alvo = caixa?.querySelector<HTMLElement>(`[data-secao="${chave}"]`)
      if (caixa && alvo) caixa.scrollTo({ top: alvo.offsetTop - caixa.offsetTop - 4 })
    })
  }

  function aoRolar() {
    const caixa = rolagem.current
    if (!caixa || procurando) return
    let atual = secoes[0]?.chave ?? ''
    for (const secao of caixa.querySelectorAll<HTMLElement>('[data-secao]')) {
      if (secao.offsetTop - caixa.offsetTop - 12 <= caixa.scrollTop) atual = secao.dataset.secao ?? atual
    }
    if (atual !== ativa) setAtiva(atual)
  }

  return (
    <div
      role="dialog"
      aria-label="Emojis"
      className={`flex w-[352px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_12px_36px_rgba(19,25,34,0.16)] ${className}`}
    >
      <div className="flex border-b border-line px-1.5" role="tablist" aria-label="Categorias">
        {ABAS.filter((aba) => aba.chave !== 'recentes' || recentes.length > 0).map((aba) => {
          const ligada = !procurando && aba.chave === acesa
          return (
            <button
              key={aba.chave}
              type="button"
              role="tab"
              aria-selected={ligada}
              title={aba.nome}
              aria-label={aba.nome}
              onClick={() => irPara(aba.chave)}
              className={`relative grid h-10 flex-1 place-items-center transition ${ligada ? 'text-primary' : 'text-dim hover:text-ink'}`}
            >
              {aba.icone}
              <span className={`absolute inset-x-2 bottom-0 h-[2.5px] rounded-full bg-primary transition-opacity ${ligada ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          )
        })}
      </div>

      <div className="px-3 pt-3 pb-1">
        <label className="relative block">
          <span className="sr-only">{placeholder}</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={busca}
            autoFocus
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(evento) => {
              /*
               * **Enter aqui não pode enviar a mensagem.**
               *
               * Esta telinha abre de dentro do `<form>` da resposta, e um
               * `Enter` em campo de formulário dispara o `submit`: quem
               * digitasse "festa" e apertasse Enter para buscar mandaria a
               * resposta pela metade para o cliente. O Enter escolhe o
               * primeiro resultado, que é o que a mão esperava.
               */
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              if (achados[0]) escolher(achados[0])
            }}
            placeholder={placeholder}
            className="app-field h-9 rounded-full pr-3 pl-9 text-[13px]"
          />
        </label>
      </div>

      <div
        ref={rolagem}
        onScroll={aoRolar}
        className="h-[300px] overflow-y-auto px-2.5 pb-2"
        style={{ fontFamily: 'var(--font-emoji)' }}
      >
        {categorias === null ? (
          /*
            O esqueleto da grade, e não só a frase. A frase saía na fonte de
            emoji que o contêiner usa para os botões, enorme e quebrada em duas
            linhas (05/out/2026): o texto aqui leva a fonte da interface.
          */
          <div role="status" className="pt-3" style={{ fontFamily: 'var(--font-outfit), sans-serif' }}>
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-surface-strong" />
            <div className="grid grid-cols-9 gap-1.5">
              {Array.from({ length: 36 }, (_, i) => (
                <span key={i} className="mx-auto size-7 animate-pulse rounded-full bg-surface" />
              ))}
            </div>
            <p className="mt-3 text-center text-[12px] text-dim">Carregando os emojis…</p>
          </div>
        ) : procurando ? (
          <Secao nome={achados.length > 0 ? 'Resultados' : undefined}>
            {achados.length === 0 ? (
              <p
                className="col-span-9 px-1 py-8 text-center text-[12.5px] leading-5 text-dim"
                style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
              >
                Nada com esse nome. Tente uma palavra só, como &ldquo;festa&rdquo;, &ldquo;obrigado&rdquo; ou &ldquo;dinheiro&rdquo;.
              </p>
            ) : (
              achados.map((emoji) => <Emoji key={emoji} emoji={emoji} aoEscolher={escolher} />)
            )}
          </Secao>
        ) : (
          secoes.map((secao) => (
            <Secao key={secao.chave} chave={secao.chave} nome={secao.nome}>
              {secao.emojis.map((emoji) => (
                <Emoji key={emoji} emoji={emoji} aoEscolher={escolher} />
              ))}
            </Secao>
          ))
        )}
      </div>
    </div>
  )
}

function Secao({ chave, nome, children }: { chave?: string; nome?: string; children: ReactNode }) {
  return (
    <section data-secao={chave} className="[content-visibility:auto] [contain-intrinsic-size:auto_400px]">
      {nome && <h3
          className="px-1 pt-3 pb-1.5 text-[12px] font-semibold text-muted"
          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
        >{nome}</h3>}
      <div className="grid grid-cols-9">{children}</div>
    </section>
  )
}

function Emoji({ emoji, aoEscolher }: { emoji: string; aoEscolher: (emoji: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => aoEscolher(emoji)}
      title={emoji}
      className="grid aspect-square place-items-center rounded-[8px] text-[24px] leading-none transition hover:bg-surface-strong"
    >
      {emoji}
    </button>
  )
}

/** As abas, na ordem do WhatsApp. Traço fino, a cor vem da aba acesa. */
const ABAS: { chave: string; nome: string; icone: ReactNode }[] = [
  { chave: 'recentes', nome: 'Recentes', icone: <Icone><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icone> },
  { chave: 'rostos', nome: 'Smileys e pessoas', icone: <Icone><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2M9 10h.01M15 10h.01" /></Icone> },
  { chave: 'natureza', nome: 'Animais e natureza', icone: <Icone><path d="M5 19c0-7 5-13 14-14-1 9-7 14-14 14Z" /><path d="M5 19 13 11" /></Icone> },
  { chave: 'comida', nome: 'Comidas e bebidas', icone: <Icone><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8.5 3.5v2.5M12 3.5v2.5" /></Icone> },
  { chave: 'atividades', nome: 'Atividades', icone: <Icone><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5v17M6 6c2.5 2 3.5 4 3.5 6S8.5 16 6 18M18 6c-2.5 2-3.5 4-3.5 6s1 4 3.5 6" /></Icone> },
  { chave: 'viagens', nome: 'Viagens e lugares', icone: <Icone><path d="M5 16v-4l2-5h10l2 5v4H5Z" /><path d="M5 12h14M7 16v2M17 16v2" /><circle cx="8" cy="14" r=".5" /><circle cx="16" cy="14" r=".5" /></Icone> },
  { chave: 'objetos', nome: 'Objetos', icone: <Icone><path d="M9 17h6M10 20h4M12 3.5a6 6 0 0 0-3.5 10.9V17h7v-2.6A6 6 0 0 0 12 3.5Z" /></Icone> },
  { chave: 'simbolos', nome: 'Símbolos', icone: <Icone><path d="M6 4l5 7M11 4 6 11M14 13h6M17 10v6M5 20l5-6M15 20h5" /></Icone> },
  { chave: 'bandeiras', nome: 'Bandeiras', icone: <Icone><path d="M6 21V4M6 4h11l-2 4 2 4H6" /></Icone> },
]

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}
