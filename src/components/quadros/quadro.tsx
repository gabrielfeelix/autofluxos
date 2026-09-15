'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  DIAS_PARA_MARCAR_PARADO,
  LIMITE_DE_ETAPAS,
  LIMITE_DO_NOME,
  cartoesPorEtapa,
  comoParado,
  estaParado,
  type Cartao,
  type Etapa,
  type TipoDeEtapa,
} from '@/core/quadros'
import { comoDinheiro } from '@/core/crm'
import { acaoAtribuirCartao, acaoDefinirTipoDaEtapa, acaoReabrirCartao } from '@/server/acoes-crm'
import { Avatar } from '@/components/inbox/avatar'
import { Dropdown } from '@/components/design/dropdown'
import { FecharCartao } from './fechar-cartao'
import { PainelDoContato } from './painel-do-contato'
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
  equipe,
  motivos,
}: {
  clienteId: string
  quadroId: string
  etapas: Etapa[]
  cartoesIniciais: Cartao[]
  agora: number
  /** Quem pode assumir um cartão. Disponíveis primeiro — ver `membrosDaConta`. */
  equipe: { id: string; nome: string }[]
  /** A lista fechada de por que se perde nesta conta. */
  motivos: { id: string; nome: string }[]
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais)
  const [ultimoDoServidor, setUltimoDoServidor] = useState(cartoesIniciais)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{ cartao: Cartao; situacao: 'ganha' | 'perdida' } | null>(
    null,
  )
  const [noPainel, setNoPainel] = useState<Cartao | null>(null)
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

    /**
     * Arrastar para uma etapa de ganho ou de perda **abre o fechamento**, não
     * fecha sozinho.
     *
     * Perder exige motivo, e fechar em silêncio no solte produziria exatamente o
     * relatório que o motivo existe para evitar. Ganhar poderia ser automático,
     * mas tratar os dois gestos igual é o que faz a etapa significar a mesma
     * coisa nos dois lados do funil — e o modal ainda é onde se anota o valor,
     * que é a informação que ninguém volta para preencher depois.
     */
    const destino = etapas.find((e) => e.id === colunaId)
    if (destino?.tipo === 'ganho' || destino?.tipo === 'perdido') {
      setFechando({
        cartao: { ...alvo, colunaId },
        situacao: destino.tipo === 'ganho' ? 'ganha' : 'perdida',
      })
    }

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
        <p role="alert" className="mb-2 shrink-0 text-[12px] font-semibold text-perigo">
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
                  ? 'border-primary/50 bg-primary/[0.07]'
                  : 'border-line bg-panel'
              }`}
            >
              <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
                <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-soft">
                  {etapa.nome}
                </h3>
                {/* A etapa de ganho e a de perda precisam se anunciar: soltar um
                    cartão nelas tem consequência, e consequência sem aviso na
                    coluna é surpresa. */}
                {etapa.tipo && etapa.tipo !== 'normal' && (
                  <span
                    title={
                      etapa.tipo === 'ganho'
                        ? 'Soltar aqui fecha a venda como ganha'
                        : 'Soltar aqui pede o motivo da perda'
                    }
                    className={`shrink-0 rounded-full px-1.5 py-[1px] text-[9.5px] font-bold ${
                      etapa.tipo === 'ganho'
                        ? 'bg-emerald-400/15 text-emerald-600'
                        : 'bg-rose-400/15 text-rose-600'
                    }`}
                  >
                    {etapa.tipo === 'ganho' ? 'ganho' : 'perda'}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-surface-strong px-1.5 py-0.5 text-[10.5px] text-dim">
                  {daEtapa.length}
                </span>
                {/*
                  A soma é **só dos abertos**. Somar os fechados junto faria a
                  coluna de ganho crescer para sempre e a previsão do funil
                  virar um número que nunca desce.
                */}
                {somaDosAbertos(daEtapa) > 0 && (
                  <span
                    title="Soma das negociações abertas nesta etapa"
                    className="shrink-0 text-[10.5px] font-semibold text-dim"
                  >
                    {comoDinheiro(somaDosAbertos(daEtapa))}
                  </span>
                )}
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
                  <li className="rounded-lg border border-dashed border-line px-2 py-4 text-center text-[11px] leading-4 text-dim">
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
                      className={`group cursor-grab overflow-hidden rounded-lg border bg-panel py-2 pr-2 pl-2.5 shadow-[0_1px_2px_rgba(19,25,34,0.06)] transition active:cursor-grabbing ${
                        arrastando === cartao.id
                          ? 'border-primary/40 opacity-40'
                          : cartao.situacao && cartao.situacao !== 'aberta'
                            ? 'border-line opacity-70 hover:opacity-100'
                            : 'border-line hover:border-strong hover:shadow-[0_2px_8px_rgba(19,25,34,0.08)]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/*
                          A barra à esquerda substituiu o pontinho âmbar: com ela
                          a coluna inteira se lê de cima a baixo sem ler texto
                          nenhum — quem está esperando demais, o que já fechou, e
                          o que está em dia.
                        */}
                        <span
                          aria-hidden
                          className={`-my-2 -ml-2.5 w-[3px] self-stretch rounded-l-lg ${
                            cartao.situacao === 'ganha'
                              ? 'bg-emerald-400'
                              : cartao.situacao === 'perdida'
                                ? 'bg-rose-300'
                                : parado(cartao, etapa, agora)
                                  ? 'bg-amber-300'
                                  : 'bg-transparent'
                          }`}
                        />

                        <button
                          type="button"
                          onClick={() => setNoPainel(cartao)}
                          className="flex min-w-0 flex-1 items-start gap-2 text-left"
                        >
                          {/*
                            O mesmo avatar da fila do Inbox, e não um parecido:
                            a cor derivada do nome só vira identificação se for a
                            mesma cor nas duas telas. Dois geradores de cor
                            fariam a mesma pessoa mudar de cor ao trocar de aba.
                          */}
                          <Avatar nome={cartao.nome} tamanho={26} />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <strong className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.3] font-semibold">
                                {cartao.nome}
                              </strong>
                              {cartao.valor != null && (
                                <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-soft">
                                  {comoDinheiro(cartao.valor)}
                                </span>
                              )}
                            </span>

                            {cartao.titulo && (
                              <span className="mt-[3px] block truncate text-[11px] leading-4 text-muted">
                                {cartao.titulo}
                              </span>
                            )}

                            <span className="mt-[5px] flex items-center gap-1.5">
                              <span
                                className={`truncate text-[10.5px] ${
                                  parado(cartao, etapa, agora) ? 'text-aviso' : 'text-dim'
                                }`}
                              >
                                {espera(cartao, agora)}
                              </span>

                              {cartao.situacao === 'ganha' && (
                                <span className="shrink-0 text-[10.5px] font-semibold text-ok">
                                  ganho
                                </span>
                              )}
                              {cartao.situacao === 'perdida' && (
                                <span className="shrink-0 text-[10.5px] font-semibold text-perigo">
                                  perdido
                                </span>
                              )}

                              {cartao.responsavelNome && (
                                <span
                                  title={cartao.responsavelNome}
                                  className="ml-auto shrink-0 rounded-full border border-line px-1.5 text-[9.5px] font-bold text-muted"
                                >
                                  {iniciais(cartao.responsavelNome)}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>

                        <MenuDoCartao
                          etapas={etapas}
                          etapaAtual={etapa.id}
                          cartao={cartao}
                          equipe={equipe}
                          clienteId={clienteId}
                          aoMover={(destino) => mover(cartao.id, destino)}
                          aoTirar={() => tirar(cartao.id)}
                          aoFechar={(situacao) => setFechando({ cartao, situacao })}
                          aoAbrirPainel={() => setNoPainel(cartao)}
                          aoAvisar={setAviso}
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
          <p className="w-[220px] shrink-0 rounded-xl border border-dashed border-line p-3 text-[11px] leading-[1.6] text-dim">
            {LIMITE_DE_ETAPAS} etapas é o teto — acima disso elas não cabem lado a lado, e funil
            maior que isso costuma ser dois funis.
          </p>
        )}
      </div>

      <p className="mt-2 shrink-0 text-[11px] text-dim">
        O ponto âmbar marca quem está parado há {DIAS_PARA_MARCAR_PARADO} dias ou mais na mesma
        etapa — ou além do limite da etapa, quando ela tem um.
      </p>

      {aviso && (
        <p
          role="status"
          className="mt-1 shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-soft"
        >
          {aviso}
        </p>
      )}

      <FecharCartao
        key={fechando?.cartao.id ?? 'vazio'}
        clienteId={clienteId}
        cartao={fechando?.cartao ?? null}
        situacao={fechando?.situacao ?? 'ganha'}
        motivos={motivos}
        aoFechar={() => setFechando(null)}
        aoConcluir={({ abriuEm }) => {
          setFechando(null)
          // A passagem para o funil seguinte precisa ser dita: o cartão some do
          // quadro do SDR sem explicação nenhuma se ninguém avisar.
          setAviso(abriuEm ? `Ganho. O contato entrou no funil ${abriuEm}.` : null)
        }}
      />

      {/*
        A `key` é o que reseta o painel ao trocar de cartão. Sem ela, o painel
        abriria com a linha do tempo da pessoa anterior até a nova chegar — e
        limpar isso à mão dentro de um efeito é o padrão que o React pede para
        não usar.
      */}
      <PainelDoContato
        key={noPainel?.id ?? 'vazio'}
        clienteId={clienteId}
        contato={noPainel}
        aoFechar={() => setNoPainel(null)}
      />
    </div>
  )
}

/**
 * A espera que o cartão mostra.
 *
 * **Quando a pessoa falou** ganha de **quando o cartão mudou de etapa**, e a
 * ordem importa: o cartão parado há seis dias numa etapa em que a pessoa
 * escreveu ontem não é um esquecimento, e o cartão movido hoje cuja última
 * mensagem é de semana passada é. A segunda é a informação que faz agir.
 */
function espera(cartao: Cartao, agora: number): string {
  if (!cartao.ultimaMensagemEm) return comoParado(cartao.entrouNaColunaEm, agora)

  const dias = Math.max(0, Math.floor((agora - Date.parse(cartao.ultimaMensagemEm)) / 86_400_000))
  if (dias === 0) return 'falou hoje'
  return dias === 1 ? 'falou há 1 dia' : `falou há ${dias} dias`
}

/** O alerta usa o limite da etapa quando ela tem um. Cartão fechado nunca acende. */
function parado(cartao: Cartao, etapa: Etapa, agora: number): boolean {
  if (cartao.situacao && cartao.situacao !== 'aberta') return false
  return estaParado(cartao.entrouNaColunaEm, agora, etapa.limiteDeDias)
}

function somaDosAbertos(cartoes: Cartao[]): number {
  return cartoes.reduce(
    (soma, cartao) =>
      soma + (!cartao.situacao || cartao.situacao === 'aberta' ? (cartao.valor ?? 0) : 0),
    0,
  )
}

/** "Ana Paula" vira "AP". Duas letras cabem no cartão; um nome inteiro não. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''
  return (primeira + ultima).toUpperCase()
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
        className="shrink-0 rounded-b-xl border-t border-line px-3 py-2 text-left text-[11.5px] text-dim transition hover:bg-surface hover:text-soft"
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
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-strong">
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
          <p role="alert" className="mt-2 text-[11.5px] text-perigo">
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
        className="w-[220px] shrink-0 rounded-xl border border-dashed border-strong px-3 py-3 text-left text-[12px] text-dim transition hover:border-strong hover:bg-surface hover:text-soft"
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
          <p role="alert" className="mt-2 text-[11.5px] leading-5 text-perigo">
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
  const [configurando, setConfigurando] = useState(false)
  const [tipo, setTipo] = useState<TipoDeEtapa>(etapa.tipo ?? 'normal')
  const [limite, setLimite] = useState(etapa.limiteDeDias ? String(etapa.limiteDeDias) : '')
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
          <span className="absolute top-5 right-0 z-20 flex w-[178px] flex-col rounded-lg border border-line bg-panel p-1 shadow-[0_18px_40px_rgba(19,25,34,0.11)]">
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                setNome(etapa.nome)
                setRenomeando(true)
              }}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-surface-strong"
            >
              Renomear
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                setConfigurando(true)
              }}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-surface-strong"
            >
              O que esta etapa significa
            </button>
            <button
              type="button"
              disabled={ehPrimeira}
              onClick={() => agir(() => acaoMoverEtapa(clienteId, quadroId, etapa.id, 'esquerda'))}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-surface-strong disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ← Mover para a esquerda
            </button>
            <button
              type="button"
              disabled={ehUltima}
              onClick={() => agir(() => acaoMoverEtapa(clienteId, quadroId, etapa.id, 'direita'))}
              className="rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-surface-strong disabled:opacity-30 disabled:hover:bg-transparent"
            >
              → Mover para a direita
            </button>
            <span className="my-1 border-t border-line" />
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
              className="rounded px-2 py-1.5 text-left text-[12px] text-perigo transition hover:bg-rose-400/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              Apagar etapa
            </button>
          </span>
        </>
      )}

      {erro && (
        <span
          role="alert"
          className="absolute top-6 right-0 z-30 w-[228px] rounded-lg border border-rose-400/25 bg-panel p-2 text-[10.5px] leading-4 text-perigo shadow-lg"
          onClick={() => setErro(null)}
        >
          {erro}
        </span>
      )}

      <Modal
        aberto={configurando}
        aoFechar={() => setConfigurando(false)}
        titulo={`O que "${etapa.nome}" significa`}
        descricao="Etapa de ganho e de perda são as duas que o sistema entende: soltar um cartão nelas abre o fechamento da venda, e ganhar faz o contato virar cliente."
      >
        <div className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-soft">Papel da etapa</span>
          <Dropdown
            rotuloAcessivel="Papel da etapa"
            valor={tipo}
            aoMudar={(escolhido) => setTipo(escolhido as TipoDeEtapa)}
            className="w-full"
            opcoes={[
              { valor: 'normal', rotulo: 'Etapa comum', detalhe: 'só uma posição no funil' },
              { valor: 'ganho', rotulo: 'Etapa de ganho', detalhe: 'fecha a venda' },
              { valor: 'perdido', rotulo: 'Etapa de perda', detalhe: 'pede o motivo' },
            ]}
          />
        </div>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11.5px] font-semibold text-soft">
            Avisar quando parar aqui por <span className="text-dim">(dias)</span>
          </span>
          <input
            value={limite}
            onChange={(e) => setLimite(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder={`vazio usa ${DIAS_PARA_MARCAR_PARADO} dias`}
            className="app-field w-full px-3 py-2.5 text-[12.5px]"
          />
          <span className="mt-1.5 block text-[11px] leading-4 text-dim">
            A paciência é por etapa: três dias em &ldquo;Aguardando pagamento&rdquo; é rotina, três
            dias em &ldquo;Primeiro contato&rdquo; é lead perdido.
          </span>
        </label>

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => setConfigurando(false)}
            className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfigurando(false)
              agir(() =>
                acaoDefinirTipoDaEtapa(
                  clienteId,
                  quadroId,
                  etapa.id,
                  tipo,
                  limite === '' ? null : Number(limite),
                ),
              )
            }}
            className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]"
          >
            Salvar
          </button>
        </div>
      </Modal>

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
  cartao,
  equipe,
  clienteId,
  aoMover,
  aoTirar,
  aoFechar,
  aoAbrirPainel,
  aoAvisar,
}: {
  etapas: Etapa[]
  etapaAtual: string
  cartao: Cartao
  equipe: { id: string; nome: string }[]
  clienteId: string
  aoMover: (colunaId: string) => void
  aoTirar: () => void
  aoFechar: (situacao: 'ganha' | 'perdida') => void
  aoAbrirPainel: () => void
  aoAvisar: (texto: string | null) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [vendo, setVendo] = useState<'acoes' | 'mover' | 'assumir'>('acoes')
  const [, comecar] = useTransition()

  /**
   * O menu é **posicionado no clique, em coordenadas de tela**.
   *
   * Ele já foi `absolute` dentro do cartão, e aí não havia CSS que o salvasse: a
   * coluna rola por dentro (`overflow-y-auto`), e overflow corta filho
   * posicionado por mais alto que seja o `z-index`. O resultado era o menu
   * aparecendo dentro do próprio cartão, com metade das opções invisíveis.
   *
   * `fixed` escapa do corte porque sai do fluxo da coluna — e como nenhum
   * ancestral usa `transform`, ele fica preso à janela, que é o que se quer.
   */
  const botao = useRef<HTMLButtonElement>(null)
  const [onde, setOnde] = useState<{ topo: number; direita: number } | null>(null)

  function abrir() {
    const caixa = botao.current?.getBoundingClientRect()
    if (caixa) {
      // Abre para cima quando não há espaço embaixo: menu que nasce cortado no
      // rodapé da tela é o mesmo defeito por outro caminho.
      const cabeEmbaixo = window.innerHeight - caixa.bottom > 300
      setOnde({
        topo: cabeEmbaixo ? caixa.bottom + 4 : Math.max(8, caixa.top - 304),
        direita: Math.max(8, window.innerWidth - caixa.right),
      })
    }
    setVendo('acoes')
    setAberto(true)
  }

  const fechado = Boolean(cartao.situacao && cartao.situacao !== 'aberta')

  function agir(acao: () => Promise<{ ok: boolean; erro?: string }>, feito?: string) {
    setAberto(false)
    setVendo('acoes')
    comecar(async () => {
      try {
        const r = await acao()
        aoAvisar(r.ok ? (feito ?? null) : (r.erro ?? 'não deu certo'))
      } catch {
        aoAvisar('não deu certo agora — tente de novo')
      }
    })
  }

  return (
    <span className="relative shrink-0">
      <button
        ref={botao}
        type="button"
        aria-label="Ações do cartão"
        aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="rounded px-1 text-[13px] leading-none text-dim opacity-0 transition group-hover:opacity-100 hover:text-soft focus:opacity-100"
      >
        ⋯
      </button>

      {aberto && (
        <>
          <span className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <span
            style={onde ? { top: onde.topo, right: onde.direita } : undefined}
            className="fixed z-50 flex max-h-[300px] w-[214px] flex-col overflow-y-auto rounded-xl border border-line bg-panel p-1 shadow-[0_24px_60px_rgba(19,25,34,0.18)]"
          >
            {vendo === 'acoes' && (
              <>
                {/*
                  Ganhar e perder vêm primeiro porque são o que fecha o trabalho,
                  e porque é o gesto que o resto do sistema escuta: é ele que faz
                  o contato virar cliente e abre o cartão no funil seguinte.
                */}
                {fechado ? (
                  <Item
                    onClick={() =>
                      agir(() => acaoReabrirCartao(clienteId, cartao.id), 'Cartão reaberto.')
                    }
                  >
                    Reabrir negociação
                  </Item>
                ) : (
                  <>
                    <Item
                      onClick={() => {
                        setAberto(false)
                        aoFechar('ganha')
                      }}
                    >
                      Marcar como ganho
                    </Item>
                    <Item
                      onClick={() => {
                        setAberto(false)
                        aoFechar('perdida')
                      }}
                    >
                      Marcar como perdido
                    </Item>
                  </>
                )}

                <span className="my-1 border-t border-line" />

                <Item onClick={() => setVendo('assumir')}>
                  {cartao.responsavelNome ? `Com ${cartao.responsavelNome} →` : 'Atribuir a →'}
                </Item>
                <Item onClick={() => setVendo('mover')}>Mover para →</Item>
                <Item
                  onClick={() => {
                    setAberto(false)
                    aoAbrirPainel()
                  }}
                >
                  Abrir perfil
                </Item>

                <span className="my-1 border-t border-line" />
                <Item
                  perigo
                  title="Tira do quadro. O contato continua na lista, na conversa e nas etiquetas."
                  onClick={() => {
                    setAberto(false)
                    aoTirar()
                  }}
                >
                  Tirar do quadro
                </Item>
              </>
            )}

            {vendo === 'mover' && (
              <>
                <Voltar aoVoltar={() => setVendo('acoes')}>Mover para</Voltar>
                {etapas
                  .filter((etapa) => etapa.id !== etapaAtual)
                  .map((etapa) => (
                    <Item
                      key={etapa.id}
                      onClick={() => {
                        setAberto(false)
                        setVendo('acoes')
                        aoMover(etapa.id)
                      }}
                    >
                      {etapa.nome}
                    </Item>
                  ))}
              </>
            )}

            {vendo === 'assumir' && (
              <>
                <Voltar aoVoltar={() => setVendo('acoes')}>Atribuir a</Voltar>
                {equipe.length === 0 && (
                  <span className="px-2 py-1.5 text-[11.5px] leading-4 text-dim">
                    Ninguém na equipe ainda. Convide alguém em Ajustes.
                  </span>
                )}
                {equipe.map((pessoa) => (
                  <Item
                    key={pessoa.id}
                    onClick={() =>
                      agir(
                        () => acaoAtribuirCartao(clienteId, cartao.id, pessoa.id),
                        `${pessoa.nome} assumiu ${cartao.nome}.`,
                      )
                    }
                  >
                    {pessoa.nome}
                  </Item>
                ))}
                {cartao.responsavelId && (
                  <>
                    <span className="my-1 border-t border-line" />
                    {/* Largar o que se pegou é ação legítima: quem sai de férias
                        precisa poder devolver o cartão à fila de ninguém. */}
                    <Item
                      onClick={() =>
                        agir(
                          () => acaoAtribuirCartao(clienteId, cartao.id, null),
                          'Cartão devolvido para a fila.',
                        )
                      }
                    >
                      Ninguém
                    </Item>
                  </>
                )}
              </>
            )}
          </span>
        </>
      )}
    </span>
  )
}

function Item({
  children,
  onClick,
  perigo,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  perigo?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`truncate rounded px-2 py-1.5 text-left text-[12px] transition ${
        perigo ? 'text-perigo hover:bg-rose-400/10' : 'hover:bg-surface-strong'
      }`}
    >
      {children}
    </button>
  )
}

function Voltar({ children, aoVoltar }: { children: React.ReactNode; aoVoltar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoVoltar}
      className="mb-0.5 flex items-center gap-1 rounded px-2 py-1 text-left text-[10px] font-bold tracking-[0.05em] text-dim uppercase transition hover:bg-surface-strong"
    >
      ← {children}
    </button>
  )
}
