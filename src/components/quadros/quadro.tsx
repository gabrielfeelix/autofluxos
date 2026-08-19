'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import {
  DIAS_PARA_MARCAR_PARADO,
  LIMITE_DE_ETAPAS,
  LIMITE_DO_NOME,
  cartoesPorEtapa,
  comoParado,
  estaParado,
  type Cartao,
  type Etapa,
} from '@/core/quadros'
import {
  acaoApagarEtapa,
  acaoBuscarContatosDoQuadro,
  acaoCriarEtapaDireto,
  acaoMoverCartao,
  acaoMoverEtapa,
  acaoPorNaEtapa,
  acaoRenomearEtapa,
  acaoTirarDoQuadro,
} from '@/server/acoes'
import { Modal } from '@/components/design/modal'

/**
 * O quadro (C1), redesenhado para funcionar como um quadro de verdade.
 *
 * A primeira versão tinha as colunas com altura de conteúdo e os formulários de
 * criação soltos embaixo, competindo com o próprio quadro pela tela. Três coisas
 * mudaram, e todas pelo mesmo motivo — **o quadro é a tela, não um bloco nela**:
 *
 * - as colunas ocupam a altura toda e rolam por dentro. Coluna que cresce
 *   empurrando a página faz o quadro de dez cartões perder a visão de conjunto,
 *   que é a única coisa que ele dá e uma lista não dá;
 * - **dá para adicionar contato de dentro da coluna.** Antes só pela tela de
 *   Contatos — ou seja, o quadro abria vazio e não havia nada a fazer nele. Um
 *   quadro que só se enche de outro lugar é um quadro que ninguém enche;
 * - criar e renomear são **modais**, não blocos no fim da página.
 *
 * **Arrastar é nativo, e nunca é o único caminho.** HTML5 DnD resolve o gesto em
 * três handlers e uma biblioteca custaria mais que a tela inteira. Todo cartão
 * tem menu com as etapas escritas: no celular não há arrasto, e com teclado
 * também não.
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
  const [ultimoDoServidor, setUltimoDoServidor] = useState(cartoesIniciais)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  /**
   * O servidor é a verdade: quando a rota revalida — alguém criou etapa, o
   * fluxo moveu alguém —, o estado otimista tem que ceder o lugar.
   *
   * Ajustado **durante o render**, e não num `useEffect`. É o padrão que o
   * próprio React documenta para "resetar estado quando uma prop muda", e a
   * versão com efeito faz o componente pintar uma vez com o dado velho antes de
   * corrigir — que aqui é o cartão piscando na coluna errada.
   */
  if (ultimoDoServidor !== cartoesIniciais) {
    setUltimoDoServidor(cartoesIniciais)
    setCartoes(cartoesIniciais)
  }

  const porEtapa = cartoesPorEtapa(cartoes)

  function mover(cartaoId: string, colunaId: string) {
    const antes = cartoes
    const alvo = cartoes.find((c) => c.id === cartaoId)
    if (!alvo || alvo.colunaId === colunaId) return

    setErro(null)
    // O relógio também é otimista: deixar o cartão dizendo "há 6 dias" logo
    // depois de ser movido seria a tela contradizendo o gesto que acabou de
    // acontecer.
    setCartoes((atuais) =>
      atuais.map((c) =>
        c.id === cartaoId ? { ...c, colunaId, entrouNaColunaEm: new Date(agora).toISOString() } : c,
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
    <div className="flex min-h-0 flex-1 flex-col">
      {erro && (
        <p role="alert" className="mb-2 shrink-0 text-[12px] font-semibold text-rose-300">
          {erro}
        </p>
      )}

      {/* `min-h-0` é o que faz a rolagem acontecer **dentro** das colunas em vez
          de a página inteira crescer. Sem ele o flex não deixa o filho encolher,
          e a altura calculada some por baixo sem nada quebrar para avisar. */}
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto pb-2">
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
              className={`flex max-h-full w-[272px] shrink-0 flex-col rounded-xl border transition ${
                alvoDoArrasto
                  ? 'border-accent/50 bg-accent/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.025]'
              }`}
            >
              <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
                <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-soft">
                  {etapa.nome}
                </h3>
                <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-dim">
                  {daEtapa.length}
                </span>
                <MenuDaEtapa
                  clienteId={clienteId}
                  quadroId={quadroId}
                  etapa={etapa}
                  ocupada={daEtapa.length}
                  ehPrimeira={indice === 0}
                  ehUltima={indice === etapas.length - 1}
                  ehUnica={etapas.length === 1}
                />
              </header>

              <ul className="flex min-h-[52px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {daEtapa.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-white/[0.08] px-2 py-4 text-center text-[11px] leading-4 text-dim">
                    {/* Estado vazio que responde a pergunta certa: não é "não há
                        ninguém", é "o que eu faço aqui". */}
                    Arraste um cartão, ou use + abaixo
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
                      className={`group cursor-grab rounded-lg border bg-panel px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition active:cursor-grabbing ${
                        arrastando === cartao.id
                          ? 'border-accent/40 opacity-40'
                          : 'border-white/[0.08] hover:border-white/[0.18]'
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <Link
                          href={`/clientes/${clienteId}/leads/${cartao.contatoId}`}
                          className="min-w-0 flex-1"
                        >
                          <strong className="block truncate text-[12.5px] font-semibold">
                            {cartao.nome}
                          </strong>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            {estaParado(cartao.entrouNaColunaEm, agora) && (
                              <span
                                aria-hidden
                                className="size-1.5 shrink-0 rounded-full bg-amber-300"
                              />
                            )}
                            <span
                              className={`truncate text-[10.5px] ${
                                estaParado(cartao.entrouNaColunaEm, agora)
                                  ? 'text-amber-200'
                                  : 'text-dim'
                              }`}
                            >
                              {comoParado(cartao.entrouNaColunaEm, agora)}
                            </span>
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

              <AdicionarContato
                clienteId={clienteId}
                quadroId={quadroId}
                colunaId={etapa.id}
                etapaNome={etapa.nome}
              />
            </section>
          )
        })}

        {/* A coluna-fantasma do fim: é onde o olho procura por "mais uma etapa",
            e é o mesmo lugar em que o Trello a põe. */}
        {etapas.length < LIMITE_DE_ETAPAS ? (
          <NovaEtapa clienteId={clienteId} quadroId={quadroId} />
        ) : (
          <p className="w-[220px] shrink-0 rounded-xl border border-dashed border-white/[0.1] p-3 text-[11px] leading-[1.6] text-dim">
            {LIMITE_DE_ETAPAS} etapas é o teto — acima disso elas não cabem lado a lado, e funil
            maior que isso costuma ser dois funis.
          </p>
        )}
      </div>

      <p className="mt-2 shrink-0 text-[11px] text-dim">
        O ponto âmbar marca quem está parado há {DIAS_PARA_MARCAR_PARADO} dias ou mais na mesma
        etapa.
      </p>
    </div>
  )
}

/**
 * Adicionar contato **de dentro da coluna**.
 *
 * O cartão entra na etapa em que a pessoa clicou, e não na primeira: ela clicou
 * dentro de uma coluna, e cair noutra seria ignorar o gesto.
 */
function AdicionarContato({
  clienteId,
  quadroId,
  colunaId,
  etapaNome,
}: {
  clienteId: string
  quadroId: string
  colunaId: string
  etapaNome: string
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<{ id: string; nome: string; telefone: string }[] | null>(
    null,
  )
  const [marcados, setMarcados] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  // Busca com respiro: uma ida ao banco por tecla digitada transformaria um
  // seletor numa fila de requisições que chegam fora de ordem.
  useEffect(() => {
    if (!aberto) return
    let valeu = true
    const relogio = window.setTimeout(async () => {
      try {
        const r = await acaoBuscarContatosDoQuadro(clienteId, quadroId, termo)
        if (valeu) setAchados(r.contatos ?? [])
      } catch {
        if (valeu) setAchados([])
      }
    }, 220)
    return () => {
      valeu = false
      window.clearTimeout(relogio)
    }
  }, [aberto, termo, clienteId, quadroId])

  function fechar() {
    setAberto(false)
    setTermo('')
    setAchados(null)
    setMarcados([])
    setErro(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="shrink-0 rounded-b-xl border-t border-white/[0.05] px-3 py-2 text-left text-[11.5px] text-dim transition hover:bg-white/[0.04] hover:text-soft"
      >
        + Adicionar contato
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={`Adicionar em “${etapaNome}”`}
        descricao="Só aparece quem ainda não está no quadro. Para pôr muita gente de uma vez, use a seleção em lote na tela de Contatos."
      >
        <input
          autoFocus
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar contato"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />

        <ul className="mt-3 flex max-h-[280px] flex-col gap-1 overflow-y-auto">
          {achados === null ? (
            <li className="px-1 py-3 text-[11.5px] text-dim">carregando…</li>
          ) : achados.length === 0 ? (
            <li className="px-1 py-3 text-[11.5px] leading-5 text-dim">
              {termo.trim() === ''
                ? 'Todo mundo deste cliente já está no quadro — ou ainda não há contato nenhum.'
                : 'Ninguém com esse nome fora do quadro.'}
            </li>
          ) : (
            achados.map((contato) => (
              <li key={contato.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.05]">
                  <input
                    type="checkbox"
                    checked={marcados.includes(contato.id)}
                    onChange={() =>
                      setMarcados((atuais) =>
                        atuais.includes(contato.id)
                          ? atuais.filter((id) => id !== contato.id)
                          : [...atuais, contato.id],
                      )
                    }
                    className="size-3.5 accent-[#56d0f5]"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[12.5px] font-semibold">
                      {contato.nome}
                    </strong>
                    <span className="block truncate font-mono text-[10.5px] text-dim">
                      {contato.telefone}
                    </span>
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>

        {erro && (
          <p role="alert" className="mt-2 text-[11.5px] text-rose-300">
            {erro}
          </p>
        )}

        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={fechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={rodando || marcados.length === 0}
            onClick={() => {
              setErro(null)
              comecar(async () => {
                try {
                  const r = await acaoPorNaEtapa(clienteId, quadroId, colunaId, marcados)
                  if (!r.ok) {
                    setErro(r.erro ?? 'não deu para adicionar')
                    return
                  }
                  fechar()
                } catch {
                  setErro('não deu para adicionar agora')
                }
              })
            }}
            className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px] disabled:opacity-50"
          >
            {rodando ? 'adicionando…' : `Adicionar${marcados.length > 0 ? ` (${marcados.length})` : ''}`}
          </button>
        </div>
      </Modal>
    </>
  )
}

/** A coluna-fantasma que cria uma etapa. Modal, como toda criação do sistema. */
function NovaEtapa({ clienteId, quadroId }: { clienteId: string; quadroId: string }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function fechar() {
    setAberto(false)
    setNome('')
    setErro(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-[220px] shrink-0 rounded-xl border border-dashed border-white/[0.12] px-3 py-3 text-left text-[12px] text-dim transition hover:border-white/25 hover:bg-white/[0.03] hover:text-soft"
      >
        + Nova etapa
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo="Nova etapa"
        descricao="Entra no fim do funil. Dá para mover de lugar depois, pelo menu da coluna."
      >
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && salvar()}
          maxLength={LIMITE_DO_NOME}
          placeholder="ex.: Aula experimental agendada"
          aria-label="Nome da etapa"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
        {erro && (
          <p role="alert" className="mt-2 text-[11.5px] leading-5 text-rose-300">
            {erro}
          </p>
        )}
        <div className="mt-4 flex gap-2.5">
          <button type="button" onClick={fechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Cancelar
          </button>
          <button
            type="button"
            disabled={rodando}
            onClick={salvar}
            className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]"
          >
            {rodando ? 'criando…' : 'Criar etapa'}
          </button>
        </div>
      </Modal>
    </>
  )

  function salvar() {
    setErro(null)
    comecar(async () => {
      try {
        const r = await acaoCriarEtapaDireto(clienteId, quadroId, nome)
        if (!r.ok) {
          setErro(r.erro ?? 'não deu para criar')
          return
        }
        fechar()
      } catch {
        setErro('não deu para criar agora')
      }
    })
  }
}

/**
 * Um menu por coluna, e não três botões soltos no cabeçalho.
 *
 * Renomear, mover e apagar são ações de arrumação — raras, e que não competem
 * pelo espaço com o nome da etapa e a contagem, que são o que se lê o tempo
 * todo. Três ícones ali dentro deixavam o cabeçalho apertado e o nome truncado
 * antes da hora.
 */
function MenuDaEtapa({
  clienteId,
  quadroId,
  etapa,
  ocupada,
  ehPrimeira,
  ehUltima,
  ehUnica,
}: {
  clienteId: string
  quadroId: string
  etapa: Etapa
  ocupada: number
  ehPrimeira: boolean
  ehUltima: boolean
  ehUnica: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [renomeando, setRenomeando] = useState(false)
  const [nome, setNome] = useState(etapa.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  function agir(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
    setAberto(false)
    comecar(async () => {
      try {
        const r = await acao()
        if (!r.ok) setErro(r.erro ?? 'não deu certo')
      } catch {
        setErro('não deu certo agora')
      }
    })
  }

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label={`Ações da etapa ${etapa.nome}`}
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="rounded px-1 text-[13px] leading-none text-dim transition hover:text-soft"
      >
        ⋯
      </button>

      {aberto && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <span className="absolute top-5 right-0 z-20 flex w-[178px] flex-col rounded-lg border border-white/10 bg-panel p-1 shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                setNome(etapa.nome)
                setRenomeando(true)
              }}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06]"
            >
              Renomear
            </button>
            <button
              type="button"
              disabled={ehPrimeira}
              onClick={() => agir(() => acaoMoverEtapa(clienteId, quadroId, etapa.id, 'esquerda'))}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ← Mover para a esquerda
            </button>
            <button
              type="button"
              disabled={ehUltima}
              onClick={() => agir(() => acaoMoverEtapa(clienteId, quadroId, etapa.id, 'direita'))}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-white/[0.06] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              → Mover para a direita
            </button>
            <span className="my-1 border-t border-white/[0.06]" />
            <button
              type="button"
              disabled={ehUnica}
              title={
                ehUnica
                  ? 'Um quadro precisa de pelo menos uma etapa'
                  : ocupada > 0
                    ? `${ocupada} contato(s) estão aqui. Mova-os antes de apagar.`
                    : 'Apagar esta etapa'
              }
              onClick={() => agir(() => acaoApagarEtapa(clienteId, quadroId, etapa.id))}
              className="rounded px-2 py-1.5 text-left text-[12px] text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              Apagar etapa
            </button>
          </span>
        </>
      )}

      {erro && (
        <span
          role="alert"
          className="absolute top-6 right-0 z-30 w-[228px] rounded-lg border border-rose-400/25 bg-panel p-2 text-[10.5px] leading-4 text-rose-200 shadow-lg"
          onClick={() => setErro(null)}
        >
          {erro}
        </span>
      )}

      <Modal
        aberto={renomeando}
        aoFechar={() => setRenomeando(false)}
        titulo="Renomear etapa"
        descricao="O nome aparece no topo da coluna e nas sequências que disparam por ela."
      >
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setRenomeando(false)
              agir(() => acaoRenomearEtapa(clienteId, quadroId, etapa.id, nome))
            }
          }}
          maxLength={LIMITE_DO_NOME}
          aria-label="Nome da etapa"
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => setRenomeando(false)}
            className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setRenomeando(false)
              agir(() => acaoRenomearEtapa(clienteId, quadroId, etapa.id, nome))
            }}
            className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]"
          >
            Salvar
          </button>
        </div>
      </Modal>
    </span>
  )
}

/** O caminho que não é arrasto — para o celular e para o teclado. */
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
        className="rounded px-1 text-[13px] leading-none text-dim opacity-0 transition group-hover:opacity-100 hover:text-soft focus:opacity-100"
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
