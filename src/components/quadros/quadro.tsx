'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  CLASSE_DA_COR,
  CORES_DA_ETAPA,
  DIAS_PARA_MARCAR_PARADO,
  LIMITE_DE_ETAPAS,
  LIMITE_DO_NOME,
  cartoesPorEtapa,
  comoParado,
  FILTRO_VAZIO,
  filtrarCartoes,
  estaParado,
  aoArrastarPara,
  type Cartao,
  type CorDaEtapa,
  type Etapa,
  type FiltroDoQuadro,
  type OrdemDoQuadro,
  type TipoDeEtapa,
} from '@/core/quadros'
import { comoDinheiro } from '@/core/crm'
import { comoDias, diasDesde, tituloDoNegocio } from '@/core/negocios'
import {
  acaoAtribuirCartao,
  acaoDefinirCorDaEtapa,
  acaoDefinirTipoDaEtapa,
  acaoReabrirCartao,
  acaoTrazerTodosParaOQuadro,
} from '@/server/acoes-crm'
import { IconeDoQuadro, PopoverDoQuadro } from './popover-do-quadro'
import { BarraDoQuadro } from './barra-do-quadro'
import { Avatar } from '@/components/inbox/avatar'
import { Dropdown } from '@/components/design/dropdown'
import { IlustracaoQuadros } from '@/components/design/ilustracoes'
import { FecharCartao } from './fechar-cartao'
import { RegistrarVenda } from './registrar-venda'
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
import { Caixa } from '@/components/design/caixa'
import { telefoneLegivel } from '@/core/contatos/telefone'

/**
 * O quadro (C1), redesenhado para funcionar como um quadro de verdade.
 *
 * A primeira versão tinha as colunas com altura de conteúdo e os formulários de
 * criação soltos embaixo, competindo com o próprio quadro pela tela. Três coisas
 * mudaram, e todas pelo mesmo motivo, **o quadro é a tela, não um bloco nela**:
 *
 * - as colunas ocupam a altura toda e rolam por dentro. Coluna que cresce
 *   empurrando a página faz o quadro de dez cartões perder a visão de conjunto,
 *   que é a única coisa que ele dá e uma lista não dá;
 * - **dá para adicionar contato de dentro da coluna.** Antes só pela tela de
 *   Contatos, ou seja, o quadro abria vazio e não havia nada a fazer nele. Um
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
  finalidade = 'operacional',
  seguinte,
}: {
  clienteId: string
  quadroId: string
  etapas: Etapa[]
  cartoesIniciais: Cartao[]
  agora: number
  /** Quem pode assumir um cartão. Disponíveis primeiro, ver `membrosDaConta`. */
  equipe: { id: string; nome: string }[]
  /** A lista fechada de por que se perde nesta conta. */
  motivos: { id: string; nome: string }[]
  /**
   * Comercial pede **registro de venda** ao ganhar; operacional só fecha.
   *
   * É a separação da 0071: marcar "Resolvido" no Atendimento, "Qualificado" na
   * Captação ou "Compareceu" na Agenda não é compra, e tratar as três como
   * venda foi o defeito que fazia a clínica aparecer com dez compras que
   * ninguém faturou.
   */
  finalidade?: 'operacional' | 'comercial'
  /** O funil que este entrega ao ganhar, pelo nome. `null` = não entrega. */
  seguinte?: string | null
}) {
  const [cartoes, setCartoes] = useState(cartoesIniciais)
  const [ultimoDoServidor, setUltimoDoServidor] = useState(cartoesIniciais)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{
    cartao: Cartao
    situacao: 'ganha' | 'perdida'
    /**
     * De onde o cartão saiu, quando ele chegou aqui **arrastado** (RB-23).
     *
     * `undefined` quer dizer que o fechamento foi aberto por botão, e aí não
     * há movimento otimista a desfazer. Ver `cancelarFechamento`.
     */
    voltarPara?: string
  } | null>(null)
  const [noPainel, setNoPainel] = useState<Cartao | null>(null)
  /*
   * A barra de ações é **estado de cliente**, e some numa navegação, de
   * propósito. Filtro que sobrevive à visita seguinte é a causa clássica do
   * "sumiram os cartões": alguém filtra por si mesmo numa terça, volta na
   * quinta e vê um funil vazio que ninguém quebrou.
   */
  const [filtro, setFiltro] = useState<FiltroDoQuadro>(FILTRO_VAZIO)
  const [ordem, setOrdem] = useState<OrdemDoQuadro>('espera')
  const [movendo, comecar] = useTransition()

  /**
   * O servidor é a verdade: quando a rota revalida, alguém criou etapa, o
   * fluxo moveu alguém , o estado otimista tem que ceder o lugar.
   *
   * Ajustado **durante o render**, e não num `useEffect`. É o padrão que o
   * próprio React documenta para "resetar estado quando uma prop muda", e a
   * versão com efeito faz o componente pintar uma vez com o dado velho antes de
   * corrigir, que aqui é o cartão piscando na coluna errada.
   */
  if (ultimoDoServidor !== cartoesIniciais) {
    setUltimoDoServidor(cartoesIniciais)
    setCartoes(cartoesIniciais)
  }

  const visiveis = filtrarCartoes(cartoes, filtro)
  const porEtapa = cartoesPorEtapa(visiveis, ordem)

  /*
   * Só quem tem cartão aqui aparece na barra. Uma conta com doze pessoas e um
   * funil tocado por duas encheria a barra de avatares que filtram para o
   * vazio, e clicar num deles seria indistinguível de um defeito.
   */
  const comCartao = new Set(cartoes.map((cartao) => cartao.responsavelId).filter(Boolean))
  const equipeDoQuadro = equipe.filter((pessoa) => comCartao.has(pessoa.id))

  /** Ganho em funil comercial: é venda, e não só fechamento (RB-30). */
  const ehVenda = fechando?.situacao === 'ganha' && finalidade === 'comercial'

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
     * coisa nos dois lados do funil, e o modal ainda é onde se anota o valor,
     * que é a informação que ninguém volta para preencher depois.
     */
    const destino = etapas.find((e) => e.id === colunaId)
    const gesto = destino ? aoArrastarPara(alvo, destino) : { tipo: 'mover' as const }
    if (gesto.tipo === 'concluir') {
      setNoPainel(null)
      setFechando({
        cartao: { ...alvo, colunaId },
        situacao: gesto.situacao,
        voltarPara: gesto.voltarPara,
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

    setNoPainel((atual) =>
      atual?.id === cartaoId
        ? { ...atual, colunaId, entrouNaColunaEm: new Date(agora).toISOString() }
        : atual,
    )
    comecar(async () => {
      try {
        const r = await acaoMoverCartao(clienteId, cartaoId, colunaId)
        if (!r.ok) {
          setCartoes(antes)
          setNoPainel((atual) => (atual?.id === cartaoId ? alvo : atual))
          setErro(r.erro ?? 'não deu para mover')
        }
      } catch {
        setCartoes(antes)
        setNoPainel((atual) => (atual?.id === cartaoId ? alvo : atual))
        setErro('não deu para mover agora, tente de novo')
      }
    })
  }

  /**
   * Cancelar o fechamento **desfaz o arrasto** (RB-23).
   *
   * O defeito era este: arrastar movia o cartão otimista e abria o modal, e
   * cancelar só fechava o modal. O cartão ficava parado na etapa de ganho,
   * visualmente concluído, sem conclusão nenhuma no servidor, que é o
   * "sucesso visual persistente antes da confirmação" que a regra proíbe.
   *
   * O servidor já recebeu o `acaoMoverCartao`, e isso está certo: mover de
   * etapa é uma coisa, concluir é outra. O que se desfaz aqui é a etapa, com
   * um movimento de volta, e não um `setCartoes` local, senão a tela e o
   * banco discordariam no próximo recarregamento.
   */
  function cancelarFechamento() {
    const cancelado = fechando
    setFechando(null)
    if (!cancelado?.voltarPara) return
    mover(cancelado.cartao.id, cancelado.voltarPara)
  }

  /*
   * Atribuir e reabrir pelo menu mudam o cartão na hora; a resposta devolve o
   * de antes quando o servidor recusa. Esperar a volta do cache do funil era o
   * cartão ficar parado um segundo depois do clique.
   */
  function mudarCartao(cartaoId: string, mudanca: Partial<Cartao>): () => void {
    const antes = cartoes.find((c) => c.id === cartaoId)
    setCartoes((atuais) => atuais.map((c) => (c.id === cartaoId ? { ...c, ...mudanca } : c)))
    return () => {
      if (antes) setCartoes((atuais) => atuais.map((c) => (c.id === cartaoId ? antes : c)))
    }
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
          setErro(r.erro ?? 'não deu para tirar do funil')
        }
      } catch {
        setCartoes(antes)
        setErro('não deu para tirar do funil agora')
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

      {cartoes.length > 0 && (
        <BarraDoQuadro
          filtro={filtro}
          aoFiltrar={setFiltro}
          ordem={ordem}
          aoOrdenar={setOrdem}
          equipe={equipeDoQuadro}
          visiveis={visiveis.length}
          somaAberta={somaDosAbertos(visiveis)}
          escondidos={cartoes.length - visiveis.length}
        />
      )}

      {/* `min-h-0` é o que faz a rolagem acontecer **dentro** das colunas em vez
          de a página inteira crescer. Sem ele o flex não deixa o filho encolher,
          e a altura calculada some por baixo sem nada quebrar para avisar.

          **`flex-1` só quando há cartão.** Com o funil vazio as colunas têm um
          palmo de altura, e mandá-las ocupar a tela toda empurrava o convite
          logo abaixo para o rodapé da janela, longe do kanban que ele explica,
          com um vão de tela vazia no meio. Sem cartão elas ficam do tamanho que
          têm, e o convite encosta nelas. */}
      <div
        className={`flex min-h-0 gap-3 overflow-x-auto pb-2 ${
          /*
            `items-start` **só no funil vazio**, e é o que faltava consertar.

            Com ele, cada coluna é do tamanho do conteúdo dela, e `max-h-full`
            não tem altura nenhuma para limitar: a lista nunca ganha rolagem e o
            flex espreme os cartões para caber todos, que era a coluna virando
            baralho. Com cartão, as colunas esticam (`items-stretch`, o padrão) e
            a lista de dentro passa a rolar.

            Vazio segue `items-start` pela razão do comentário acima: coluna de
            um palmo esticada até o rodapé empurra o convite para longe do
            kanban que ele explica.
          */
          cartoes.length === 0 ? 'shrink-0 items-start' : 'flex-1'
        }`}
      >
        {etapas.map((etapa, indice) => {
          const daEtapa = porEtapa.get(etapa.id) ?? []
          const alvoDoArrasto = sobre === etapa.id && arrastando !== null

          return (
            <section
              key={etapa.id}
              onDragOver={(e) => {
                // Sem `preventDefault` o navegador recusa o solte, é a linha
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
              // `min-h-0` no `flex-col`: sem ele o filho que rola não pode
              // encolher abaixo do conteúdo, e a rolagem vaza para a página.
              className={`flex h-full min-h-0 w-[290px] shrink-0 flex-col rounded-xl border transition sm:w-[300px] ${
                alvoDoArrasto ? 'border-primary/50 bg-primary/[0.07]' : 'border-line/60 bg-surface'
              }`}
            >
              <header className="flex shrink-0 items-center gap-2 px-3 py-3">
                {/*
                  A cor antes do nome, e não em vez dele.

                  O funil é lido de relance, várias vezes por dia: com sete
                  cabeçalhos cinzas idênticos, achar "Proposta" custa ler os
                  sete nomes. A bolinha é reconhecida antes da leitura, e por
                  isso vem primeiro, na borda por onde o olho entra na coluna.

                  Etapas sem cor usam um ponto neutro para manter o alinhamento.
                */}
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${etapa.cor ? CLASSE_DA_COR[etapa.cor] : 'bg-slate-400/70'}`}
                />
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
                <AdicionarContato
                  clienteId={clienteId}
                  quadroId={quadroId}
                  colunaId={etapa.id}
                  etapaNome={etapa.nome}
                  aparencia="icone"
                />
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
                  <li className="shrink-0 rounded-lg border border-dashed border-line px-2 py-4 text-center text-[11px] leading-4 text-dim">
                    {/* Estado vazio que responde a pergunta certa: não é "não há
                        ninguém", é "o que eu faço aqui". */}
                    Arraste um negócio para cá
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
                      className={`group min-h-[68px] shrink-0 cursor-grab overflow-hidden rounded-lg border bg-panel py-2 pr-2 pl-2.5 shadow-[0_1px_2px_rgba(19,25,34,0.06)] transition active:cursor-grabbing ${
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
                          nenhum, quem está esperando demais, o que já fechou, e
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
                          className="flex min-h-12 min-w-0 flex-1 items-start gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-primary"
                        >
                          {/*
                            **O negócio na frente, a pessoa embaixo** (F2, 5.2).

                            O cartão sempre foi a negociação, e abria com o
                            avatar e o nome do contato: o funil parecia uma
                            lista de pessoas. Agora o título e o valor vêm
                            primeiro; sem título, "Negócio de <nome>" em cinza,
                            para ninguém confundir com o nome da pessoa.
                          */}
                          <span className="min-w-0 flex-1">
                            <strong
                              className={`line-clamp-2 text-[13px] leading-[1.3] font-semibold ${
                                tituloDoNegocio(cartao).provisorio ? 'text-dim' : 'text-ink'
                              }`}
                            >
                              {tituloDoNegocio(cartao).texto}
                            </strong>
                            {cartao.valor != null && (
                              <span className="mt-0.5 block text-[12.5px] font-bold tabular-nums text-soft">
                                {comoDinheiro(cartao.valor)}
                              </span>
                            )}

                            {/*
                              O mesmo avatar da fila do Inbox, e não um parecido:
                              a cor derivada do nome só vira identificação se for
                              a mesma cor nas duas telas.
                            */}
                            <span className="mt-2 flex items-center gap-1.5 border-t border-line/70 pt-2">
                              <Avatar nome={cartao.nome} tamanho={18} />
                              <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                                {cartao.nome}
                                {cartao.telefone && cartao.telefone !== cartao.nome && (
                                  <span className="text-dim"> · {telefoneLegivel(cartao.telefone)}</span>
                                )}
                              </span>
                              {cartao.temperatura && (
                                <span
                                  title={`Temperatura: ${cartao.temperatura}`}
                                  className={`shrink-0 rounded-full px-1.5 text-[9.5px] font-bold capitalize ${
                                    cartao.temperatura === 'quente'
                                      ? 'bg-rose-400/15 text-rose-600'
                                      : cartao.temperatura === 'morno'
                                        ? 'bg-amber-400/15 text-amber-700'
                                        : 'bg-sky-400/15 text-sky-700'
                                  }`}
                                >
                                  {cartao.temperatura}
                                </span>
                              )}
                            </span>

                            <span className="mt-[5px] flex items-center gap-1.5">
                              <span
                                className={`shrink-0 text-[10.5px] font-semibold ${
                                  parado(cartao, etapa, agora) ? 'text-aviso' : 'text-muted'
                                }`}
                              >
                                {comoDias(diasDesde(cartao.entrouNaColunaEm, agora))} na etapa
                              </span>
                              {/* Quando a pessoa falou continua no cartão, mais
                                  discreto: é o que diz de quem se deve resposta. */}
                              {cartao.ultimaMensagemEm && (
                                <span className="min-w-0 truncate text-[10.5px] text-dim">
                                  · {espera(cartao, agora)}
                                </span>
                              )}

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
                          aoMudar={(mudanca) => mudarCartao(cartao.id, mudanca)}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          )
        })}

        {/* A coluna-fantasma do fim: é onde o olho procura por "mais uma etapa",
            e é o mesmo lugar em que o Trello a põe. */}
        {etapas.length < LIMITE_DE_ETAPAS ? (
          <NovaEtapa clienteId={clienteId} quadroId={quadroId} />
        ) : (
          <p className="flex w-[220px] shrink-0 items-center rounded-xl border border-dashed border-line p-3 text-[11px] leading-[1.6] text-dim">
            {LIMITE_DE_ETAPAS} etapas é o teto, acima disso elas não cabem lado a lado, e funil
            maior que isso costuma ser dois funis.
          </p>
        )}
      </div>

      {cartoes.length === 0 && (
        /*
          **O convite fica embaixo das colunas, não acima delas.**
          
          Ele nasceu no topo e empurrava o funil inteiro para fora da tela: quem
          abre a tela de Funis quer ver o funil, mesmo vazio, são as etapas que
          dizem o que este quadro faz. O convite responde "e agora?", que é a
          pergunta seguinte, e pergunta seguinte fica no lugar seguinte.
        */
        <div className="mt-3 shrink-0 rounded-xl border border-dashed border-line bg-panel px-5 py-7 text-center">
          <IlustracaoQuadros />
          <p className="mt-4 text-[13.5px] font-semibold text-soft">Nenhuma pessoa neste funil</p>
          <p className="mx-auto mt-1.5 max-w-[460px] text-[12px] leading-5 text-dim">
            O funil só recebe sozinho quem chega depois que ele existe. Quem já estava na sua lista
            entra por aqui.
          </p>
          <span className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <TrazerMeusContatos clienteId={clienteId} quadroId={quadroId} aoAvisar={setAviso} />
            {etapas[0] && (
              <AdicionarContato
                clienteId={clienteId}
                quadroId={quadroId}
                colunaId={etapas[0].id}
                etapaNome={etapas[0].nome}
                aparencia="botao"
              />
            )}
          </span>
        </div>
      )}

      {aviso && (
        <p
          role="status"
          className="mt-1 shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-[11.5px] text-soft"
        >
          {aviso}
        </p>
      )}

      {/*
        Ganhar num funil **comercial** abre o registro de venda; ganhar num
        operacional, e perder em qualquer um, continuam no fechamento de
        sempre. Dois modais, e não um com `if` dentro: o que se preenche é
        diferente (data da compra, itens) e o que a operação grava é diferente
        (venda + conclusão numa transação, contra só conclusão).
      */}
      <RegistrarVenda
        key={`venda:${fechando?.cartao.id ?? 'vazio'}`}
        clienteId={clienteId}
        cartao={ehVenda ? (fechando?.cartao ?? null) : null}
        aoFechar={cancelarFechamento}
        aoConcluir={() => {
          setFechando(null)
          setAviso('Venda registrada. A oportunidade foi marcada como ganha.')
        }}
      />

      <FecharCartao
        key={`fechar:${fechando?.cartao.id ?? 'vazio'}`}
        clienteId={clienteId}
        cartao={ehVenda ? null : (fechando?.cartao ?? null)}
        situacao={fechando?.situacao ?? 'ganha'}
        motivos={motivos}
        seguinte={seguinte ?? null}
        aoFechar={cancelarFechamento}
        aoConcluir={({ abriuEm }) => {
          setFechando(null)
          // A passagem para o funil seguinte precisa ser dita: o cartão some do
          // quadro do SDR sem explicação nenhuma se ninguém avisar.
          setAviso(abriuEm ? `Ganho. O contato entrou no funil ${abriuEm}.` : null)
        }}
      />

      {/*
        A `key` é o que reseta o painel ao trocar de cartão. Sem ela, o painel
        abriria com a linha do tempo da pessoa anterior até a nova chegar, e
        limpar isso à mão dentro de um efeito é o padrão que o React pede para
        não usar.
      */}
      <PainelDoContato
        key={`painel:${noPainel?.id ?? 'vazio'}`}
        clienteId={clienteId}
        volta={`/clientes/${clienteId}/quadros?q=${quadroId}`}
        contatoId={noPainel?.contatoId ?? null}
        cartao={noPainel}
        etapas={etapas}
        movendo={movendo}
        erroDeMovimento={erro}
        aoMover={(colunaId) => {
          if (noPainel) mover(noPainel.id, colunaId)
        }}
        etapaNome={etapas.find((etapa) => etapa.id === noPainel?.colunaId)?.nome}
        aoAtualizarCartao={(dados) => {
          if (!noPainel) return
          setCartoes((atuais) =>
            atuais.map((cartao) => (cartao.id === noPainel.id ? { ...cartao, ...dados } : cartao)),
          )
          setNoPainel((atual) => (atual ? { ...atual, ...dados } : atual))
        }}
        aoFechar={() => setNoPainel(null)}
        aoGanharOuPerder={(situacao) => {
          // Fecha o painel e abre o modal do quadro: a lista de motivos e o
          // aviso de passagem para o funil seguinte moram lá, e são a razão de
          // não existir um segundo modal de fechar venda.
          if (!noPainel) return
          // Sem `voltarPara`: veio de botão, não de arrastar, então não há
          // movimento otimista a desfazer se a pessoa cancelar.
          setFechando({ cartao: noPainel, situacao })
          setNoPainel(null)
        }}
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
export function AdicionarContato({
  clienteId,
  quadroId,
  colunaId,
  etapaNome,
  aparencia = 'coluna',
}: {
  clienteId: string
  quadroId: string
  colunaId: string
  etapaNome: string
  /** `coluna` é o rodapé da etapa; `botao` é o estado vazio do funil. */
  aparencia?: 'coluna' | 'botao' | 'principal' | 'icone'
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
        aria-label={aparencia === 'icone' ? `Adicionar contato em ${etapaNome}` : undefined}
        title={aparencia === 'icone' ? `Adicionar contato em ${etapaNome}` : undefined}
        className={
          aparencia === 'principal'
            ? 'app-primary-button h-9 px-4 text-xs'
            : aparencia === 'icone'
              ? 'grid size-7 shrink-0 place-items-center rounded-md text-lg text-dim transition hover:bg-surface-strong hover:text-ink'
              : aparencia === 'botao'
                ? 'app-secondary-button px-4 py-2 text-[12.5px]'
                : 'shrink-0 rounded-b-xl border-t border-line px-3 py-2 text-center text-[11.5px] text-dim transition hover:bg-surface hover:text-soft'
        }
      >
        {aparencia === 'icone'
          ? '+'
          : aparencia === 'principal'
            ? '+ Contato'
            : aparencia === 'botao'
              ? 'Adicionar contato'
              : '+ Adicionar contato'}
      </button>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo={`Adicionar em “${etapaNome}”`}
        descricao="Só aparece quem ainda não está no funil. Para pôr muita gente de uma vez, use a seleção em lote na tela de Contatos."
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
                ? 'Todo mundo deste cliente já está no funil, ou ainda não há contato nenhum.'
                : 'Ninguém com esse nome fora do funil.'}
            </li>
          ) : (
            achados.map((contato) => (
              <li key={contato.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface-strong">
                  <Caixa
                    marcada={marcados.includes(contato.id)}
                    aoMudar={() =>
                      setMarcados((atuais) =>
                        atuais.includes(contato.id)
                          ? atuais.filter((id) => id !== contato.id)
                          : [...atuais, contato.id],
                      )
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[12.5px] font-semibold">
                      {contato.nome}
                    </strong>
                    <span className="block truncate text-[10.5px] text-dim tabular-nums">
                      {telefoneLegivel(contato.telefone)}
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
          <button
            type="button"
            onClick={fechar}
            className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
          >
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
            {rodando
              ? 'adicionando…'
              : `Adicionar${marcados.length > 0 ? ` (${marcados.length})` : ''}`}
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
        className="flex h-11 w-[160px] shrink-0 items-center justify-center self-start rounded-lg border border-dashed border-strong px-3 py-3 text-center text-[12px] text-dim transition hover:border-strong hover:bg-surface hover:text-soft"
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
          <button
            type="button"
            onClick={fechar}
            className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
          >
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
 * Renomear, mover e apagar são ações de arrumação, raras, e que não competem
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
  const [renomeando, setRenomeando] = useState(false)
  const [configurando, setConfigurando] = useState(false)
  const [tipo, setTipo] = useState<TipoDeEtapa>(etapa.tipo ?? 'normal')
  const [limite, setLimite] = useState(etapa.limiteDeDias ? String(etapa.limiteDeDias) : '')
  const [cor, setCor] = useState<CorDaEtapa | null>(etapa.cor ?? null)
  const [nome, setNome] = useState(etapa.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()

  function agir(acao: () => Promise<{ ok: boolean; erro?: string }>) {
    setErro(null)
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
      <PopoverDoQuadro
        rotulo={`Ações da etapa ${etapa.nome}`}
        gatilho={<IconeDoQuadro tipo="menu" />}
        className="quadro-stage-menu"
        largura={240}
      >
        <div className="flex flex-col" data-fechar-popover>
          <button
            type="button"
            onClick={() => {
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
                ? 'Um funil precisa de pelo menos uma etapa'
                : ocupada > 0
                  ? `${ocupada} contato(s) estão aqui. Mova-os antes de apagar.`
                  : 'Apagar esta etapa'
            }
            onClick={() => agir(() => acaoApagarEtapa(clienteId, quadroId, etapa.id))}
            className="rounded px-2 py-1.5 text-left text-[12px] text-perigo transition hover:bg-rose-400/10 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            Apagar etapa
          </button>
        </div>
      </PopoverDoQuadro>

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

        <div className="mt-3 block">
          <span className="mb-1 block text-[11.5px] font-semibold text-soft">
            Cor <span className="font-normal text-dim">(para achar a coluna de relance)</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {/*
              "Sem cor" é a primeira opção e não o fim da lista: é o estado de
              todo funil que já existe, e quem se arrependeu de pintar precisa
              achar a saída antes de procurar outro tom.
            */}
            <button
              type="button"
              onClick={() => setCor(null)}
              aria-pressed={cor === null}
              title="Sem cor"
              className={`size-[26px] rounded-full border text-[10px] text-dim transition ${
                cor === null
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-line hover:border-strong'
              }`}
            >
              -
            </button>
            {CORES_DA_ETAPA.map((opcao) => (
              <button
                key={opcao}
                type="button"
                onClick={() => setCor(opcao)}
                aria-pressed={cor === opcao}
                title={opcao}
                className={`size-[26px] rounded-full border transition ${CLASSE_DA_COR[opcao]} ${
                  cor === opcao ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

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
              agir(async () => {
                const r = await acaoDefinirTipoDaEtapa(
                  clienteId,
                  quadroId,
                  etapa.id,
                  tipo,
                  limite === '' ? null : Number(limite),
                )
                // A cor só vai ao banco se mudou: é o mesmo modal, e reescrever
                // o que não mudou é escrita paga por nada.
                if (!r.ok || cor === (etapa.cor ?? null)) return r
                return acaoDefinirCorDaEtapa(clienteId, quadroId, etapa.id, cor)
              })
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

/** O caminho que não é arrasto, para o celular e para o teclado. */
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
  aoMudar,
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
  /** Aplica a mudança no cartão já; devolve quem desfaz. */
  aoMudar: (mudanca: Partial<Cartao>) => () => void
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
   * `fixed` escapa do corte porque sai do fluxo da coluna, e como nenhum
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

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      setAberto(false)
      botao.current?.focus()
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  const fechado = Boolean(cartao.situacao && cartao.situacao !== 'aberta')

  function agir(acao: () => Promise<{ ok: boolean; erro?: string }>, feito?: string, mudanca?: Partial<Cartao>) {
    setAberto(false)
    setVendo('acoes')
    const desfazer = mudanca ? aoMudar(mudanca) : null
    if (mudanca && feito) aoAvisar(feito)
    comecar(async () => {
      try {
        const r = await acao()
        if (!r.ok) desfazer?.()
        aoAvisar(r.ok ? (feito ?? null) : (r.erro ?? 'não deu certo'))
      } catch {
        desfazer?.()
        aoAvisar('não deu certo agora, tente de novo')
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
        className="grid size-6 place-items-center rounded text-dim transition hover:bg-surface hover:text-soft focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100"
      >
        <IconeDoQuadro tipo="menu" />
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
                      agir(() => acaoReabrirCartao(clienteId, cartao.id), 'Cartão reaberto.', { situacao: 'aberta' })
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
                  Ver resumo
                </Item>
                <Link
                  href={`/clientes/${clienteId}/negocios/${cartao.id}`}
                  className="truncate rounded px-2 py-1.5 text-left text-[12px] transition hover:bg-surface-strong"
                >
                  Abrir negócio
                </Link>

                <span className="my-1 border-t border-line" />
                <Item
                  perigo
                  title="Tira do funil. O contato continua na lista, na conversa e nas etiquetas."
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
                        { responsavelId: pessoa.id, responsavelNome: pessoa.nome },
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
                          { responsavelId: null, responsavelNome: null },
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

/**
 * "Trazer meus contatos", no estado vazio.
 *
 * A faixa `TrazerTodos` já faz isso no topo da página, e ela some quando não há
 * ninguém de fora. Aqui o botão aparece junto do que explica o vazio, e diz o
 * resultado em número, porque "trazidos" sem quantidade deixa quem clicou sem
 * saber se aconteceu alguma coisa.
 */
function TrazerMeusContatos({
  clienteId,
  quadroId,
  aoAvisar,
}: {
  clienteId: string
  quadroId: string
  aoAvisar: (aviso: string) => void
}) {
  const [rodando, comecar] = useTransition()

  return (
    <button
      type="button"
      disabled={rodando}
      onClick={() =>
        comecar(async () => {
          try {
            const r = await acaoTrazerTodosParaOQuadro(clienteId, quadroId)
            if (!r.ok) {
              aoAvisar(r.erro ?? 'não deu para trazer')
              return
            }
            aoAvisar(
              r.faltaram
                ? `${r.postos} trazidos. Faltaram ${r.faltaram}, clique de novo.`
                : `${r.postos} trazidos para a primeira etapa.`,
            )
          } catch {
            aoAvisar('não deu para trazer agora, tente de novo')
          }
        })
      }
      className="app-primary-button px-4 py-2 text-[12.5px] disabled:opacity-50"
    >
      {rodando ? 'trazendo…' : 'Trazer meus contatos'}
    </button>
  )
}
