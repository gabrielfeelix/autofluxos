'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import {
  DIAS_PARA_MARCAR_PARADO,
  LIMITE_DE_ETAPAS,
  cartoesPorEtapa,
  comoParado,
  estaParado,
  type Cartao,
  type Etapa,
} from '@/core/quadros'
import {
  acaoApagarEtapa,
  acaoMoverCartao,
  acaoMoverEtapa,
  acaoRenomearEtapa,
  acaoTirarDoQuadro,
} from '@/server/acoes'

/**
 * O quadro: em que etapa cada contato está (C1).
 *
 * **Arrastar é nativo, sem biblioteca.** HTML5 drag-and-drop resolve o gesto em
 * três handlers, e uma biblioteca de DnD custaria mais bundle do que toda a
 * tela. O que ela daria de bonito — animação de reordenação — não é o que faz
 * esta tela valer; o que faz é saber quem está parado.
 *
 * **E arrastar nunca é o único caminho.** Todo cartão tem um menu com as etapas
 * escritas: no celular não há arrasto, e com teclado também não. Uma tela em que
 * a única forma de agir é o gesto é uma tela que exclui metade de quem opera.
 *
 * O estado é otimista porque o servidor revalida a rota inteira a cada movida —
 * esperar o retorno faria o cartão voltar para a coluna antiga por meio segundo,
 * que é a coisa que mais faz alguém achar que o clique não funcionou.
 */
export function Quadro({
  clienteId,
  quadroId,
  etapas,
  cartoesIniciais,
  /** Calculado no servidor: data relativa no cliente diverge na hidratação. */
  agora,
}: {
  clienteId: string
  quadroId: string
  etapas: Etapa[]
  cartoesIniciais: Cartao[]
  agora: number
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  const porEtapa = cartoesPorEtapa(cartoes)

  function mover(cartaoId: string, colunaId: string) {
    const antes = cartoes
    const alvo = cartoes.find((c) => c.id === cartaoId)
    if (!alvo || alvo.colunaId === colunaId) return

    setErro(null)
    // O relógio da etapa também é otimista: o servidor faz a mesma conta, e
    // deixar o cartão dizendo "há 6 dias" logo depois de ser movido seria a
    // tela contradizendo o gesto que a pessoa acabou de fazer.
    setCartoes((atuais) =>
      atuais.map((c) =>
        c.id === cartaoId
          ? { ...c, colunaId, entrouNaColunaEm: new Date(agora).toISOString() }
          : c,
      ),
    )

    comecar(async () => {
      try {
        const r = await acaoMoverCartao(clienteId, cartaoId, colunaId)
        if (!r.ok) {
          setCartoes(antes)
          setErro(r.erro ?? 'não deu para mover')
        }
      } catch {
        setCartoes(antes)
        setErro('não deu para mover agora — tente de novo')
      }
    })
  }

  function tirar(cartaoId: string) {
    const antes = cartoes
    setErro(null)
    setCartoes((atuais) => atuais.filter((c) => c.id !== cartaoId))

    comecar(async () => {
      try {
        const r = await acaoTirarDoQuadro(clienteId, cartaoId)
        if (!r.ok) {
          setCartoes(antes)
          setErro(r.erro ?? 'não deu para tirar do quadro')
        }
      } catch {
        setCartoes(antes)
        setErro('não deu para tirar do quadro agora')
      }
    })
  }

  return (
    <>
      {erro && (
        <p role="alert" className="mb-3 text-[12px] font-semibold text-rose-300">
          {erro}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-3">
        {etapas.map((etapa, indice) => {
          const daEtapa = porEtapa.get(etapa.id) ?? []
          const alvoDoArrasto = sobre === etapa.id && arrastando !== null

          return (
            <section
              key={etapa.id}
              onDragOver={(e) => {
                // Sem `preventDefault` o navegador recusa o solte — é a linha
                // que todo mundo esquece e faz o arrasto "não funcionar".
                e.preventDefault()
                setSobre(etapa.id)
              }}
              onDragLeave={() => setSobre((atual) => (atual === etapa.id ? null : atual))}
              onDrop={(e) => {
                e.preventDefault()
                setSobre(null)
                const cartaoId = e.dataTransfer.getData('text/plain') || arrastando
                if (cartaoId) mover(cartaoId, etapa.id)
                setArrastando(null)
              }}
              className={`flex w-[248px] shrink-0 flex-col rounded-xl border transition ${
                alvoDoArrasto
                  ? 'border-accent/50 bg-accent/[0.06]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <header className="flex items-center gap-1.5 border-b border-white/[0.05] px-3 py-2.5">
                <NomeDaEtapa
                  clienteId={clienteId}
                  quadroId={quadroId}
                  etapa={etapa}
                />
                <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] text-dim">
                  {daEtapa.length}
                </span>
                <span className="ml-auto flex items-center gap-0.5">
                  <BotaoDeLado
                    clienteId={clienteId}
                    quadroId={quadroId}
                    etapaId={etapa.id}
                    direcao="esquerda"
                    desabilitado={indice === 0}
                  />
                  <BotaoDeLado
                    clienteId={clienteId}
                    quadroId={quadroId}
                    etapaId={etapa.id}
                    direcao="direita"
                    desabilitado={indice === etapas.length - 1}
                  />
                  <ApagarEtapa
                    clienteId={clienteId}
                    quadroId={quadroId}
                    etapaId={etapa.id}
                    nome={etapa.nome}
                    ocupada={daEtapa.length}
                  />
                </span>
              </header>

              <ul className="flex min-h-[64px] flex-col gap-2 p-2">
                {daEtapa.length === 0 ? (
                  <li className="px-1 py-3 text-center text-[11px] leading-4 text-dim">
                    {/* Estado vazio que responde a pergunta certa: não é "não há
                        ninguém", é "arraste alguém para cá". */}
                    Arraste um contato para esta etapa
                  </li>
                ) : (
                  daEtapa.map((cartao) => (
                    <li
                      key={cartao.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', cartao.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setArrastando(cartao.id)
                      }}
                      onDragEnd={() => {
                        setArrastando(null)
                        setSobre(null)
                      }}
                      className={`group rounded-lg border bg-panel px-2.5 py-2 transition ${
                        arrastando === cartao.id
                          ? 'border-accent/40 opacity-50'
                          : 'border-white/[0.07] hover:border-white/[0.14]'
                      } ${estaParado(cartao.entrouNaColunaEm, agora) ? 'border-l-2 border-l-amber-300/70' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <Link
                          href={`/clientes/${clienteId}/leads/${cartao.contatoId}`}
                          className="min-w-0 flex-1"
                        >
                          <strong className="block truncate text-[12.5px] font-semibold">
                            {cartao.nome}
                          </strong>
                          <span
                            title={`Nesta etapa desde ${comoParado(cartao.entrouNaColunaEm, agora)}`}
                            className={`mt-0.5 block text-[10.5px] ${
                              estaParado(cartao.entrouNaColunaEm, agora)
                                ? 'text-amber-200'
                                : 'text-dim'
                            }`}
                          >
                            {comoParado(cartao.entrouNaColunaEm, agora)}
                          </span>
                        </Link>

                        <MenuDoCartao
                          etapas={etapas}
                          etapaAtual={etapa.id}
                          aoMover={(destino) => mover(cartao.id, destino)}
                          aoTirar={() => tirar(cartao.id)}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          )
        })}

        {etapas.length >= LIMITE_DE_ETAPAS && (
          <p className="w-[210px] shrink-0 self-start rounded-xl border border-dashed border-white/[0.12] p-3 text-[11px] leading-[1.6] text-dim">
            {LIMITE_DE_ETAPAS} etapas é o teto — acima disso elas não cabem lado a lado, e funil
            maior que isso costuma ser dois funis.
          </p>
        )}
      </div>

      <p className="mt-2 text-[11px] text-dim">
        A faixa âmbar marca quem está parado há {DIAS_PARA_MARCAR_PARADO} dias ou mais na mesma
        etapa.
      </p>
    </>
  )
}

/** O nome da etapa, editável no lugar. Sai do modo de edição ao sair do campo. */
function NomeDaEtapa({
  clienteId,
  quadroId,
  etapa,
}: {
  clienteId: string
  quadroId: string
  etapa: Etapa
}) {
  const [editando, setEditando] = useState(false)
  const [, comecar] = useTransition()

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        title="Renomear esta etapa"
        className="min-w-0 truncate text-left text-[12px] font-bold tracking-[0.03em] text-soft uppercase transition hover:text-accent"
      >
        {etapa.nome}
      </button>
    )
  }

  return (
    <input
      autoFocus
      defaultValue={etapa.nome}
      aria-label="Nome da etapa"
      maxLength={32}
      onBlur={(e) => {
        const novo = e.currentTarget.value
        setEditando(false)
        if (novo.trim() === etapa.nome) return
        comecar(async () => {
          try {
            await acaoRenomearEtapa(clienteId, quadroId, etapa.id, novo)
          } catch {
            // A rota revalida sozinha; o nome volta ao que o banco tem.
          }
        })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setEditando(false)
      }}
      className="app-field min-w-0 flex-1 px-2 py-1 text-[12px]"
    />
  )
}

function BotaoDeLado({
  clienteId,
  quadroId,
  etapaId,
  direcao,
  desabilitado,
}: {
  clienteId: string
  quadroId: string
  etapaId: string
  direcao: 'esquerda' | 'direita'
  desabilitado: boolean
}) {
  const [, comecar] = useTransition()

  return (
    <button
      type="button"
      disabled={desabilitado}
      aria-label={direcao === 'esquerda' ? 'Mover etapa para a esquerda' : 'Mover etapa para a direita'}
      onClick={() =>
        comecar(async () => {
          try {
            await acaoMoverEtapa(clienteId, quadroId, etapaId, direcao)
          } catch {
            // Ponta da lista, ou rede. A rota revalida e a ordem se corrige.
          }
        })
      }
      // Desabilitado em vez de escondido: um botão que some muda a largura do
      // cabeçalho e move os vizinhos de lugar a cada etapa.
      className="rounded px-1 py-0.5 text-[11px] text-dim transition hover:bg-white/[0.06] hover:text-soft disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {direcao === 'esquerda' ? '‹' : '›'}
    </button>
  )
}

function ApagarEtapa({
  clienteId,
  quadroId,
  etapaId,
  nome,
  ocupada,
}: {
  clienteId: string
  quadroId: string
  etapaId: string
  nome: string
  ocupada: number
}) {
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  return (
    <span className="relative">
      <button
        type="button"
        aria-label={`Apagar a etapa ${nome}`}
        title={
          ocupada > 0
            ? `${ocupada} contato(s) estão aqui. Mova-os antes de apagar.`
            : 'Apagar esta etapa'
        }
        onClick={() => {
          setErro(null)
          comecar(async () => {
            try {
              const r = await acaoApagarEtapa(clienteId, quadroId, etapaId)
              if (!r.ok) setErro(r.erro ?? 'não deu para apagar')
            } catch {
              setErro('não deu para apagar agora')
            }
          })
        }}
        className="rounded px-1 py-0.5 text-[11px] text-dim transition hover:bg-rose-400/10 hover:text-rose-300"
      >
        ×
      </button>

      {erro && (
        <span
          role="alert"
          className="absolute top-6 right-0 z-10 w-[210px] rounded-lg border border-rose-400/25 bg-panel p-2 text-[10.5px] leading-4 text-rose-200 shadow-lg"
        >
          {erro}
        </span>
      )}
    </span>
  )
}

/**
 * O caminho que não é arrasto.
 *
 * Existe para o celular e para o teclado, e é ele que torna a tela operável sem
 * mouse — arrasto é o atalho, não a funcionalidade.
 */
function MenuDoCartao({
  etapas,
  etapaAtual,
  aoMover,
  aoTirar,
}: {
  etapas: Etapa[]
  etapaAtual: string
  aoMover: (colunaId: string) => void
  aoTirar: () => void
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label="Ações do cartão"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="rounded px-1 text-[13px] leading-none text-dim transition hover:text-soft"
      >
        ⋯
      </button>

      {aberto && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <span className="absolute top-5 right-0 z-20 flex w-[190px] flex-col rounded-lg border border-white/10 bg-panel p-1 shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
            <span className="px-2 py-1 text-[10px] font-bold tracking-[0.05em] text-dim uppercase">
              Mover para
            </span>
            {etapas
              .filter((etapa) => etapa.id !== etapaAtual)
              .map((etapa) => (
                <button
                  key={etapa.id}
                  type="button"
                  onClick={() => {
                    setAberto(false)
                    aoMover(etapa.id)
                  }}
                  className="truncate rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
                >
                  {etapa.nome}
                </button>
              ))}

            <span className="my-1 border-t border-white/[0.06]" />
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                aoTirar()
              }}
              title="Tira do quadro. O contato continua na lista, na conversa e nas etiquetas."
              className="rounded px-2 py-1.5 text-left text-[12px] text-rose-300 transition hover:bg-rose-400/10"
            >
              Tirar do quadro
            </button>
          </span>
        </>
      )}
    </span>
  )
}
