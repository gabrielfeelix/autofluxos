'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, type ReactNode, type RefObject } from 'react'
import { Avatar } from '@/components/inbox/avatar'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { FecharCartao } from '@/components/quadros/fechar-cartao'
import { RegistrarVenda } from '@/components/quadros/registrar-venda'
import { TemperaturaDaOportunidade } from '@/components/quadros/temperatura-da-oportunidade'
import { InteresseDaOportunidade } from '@/components/quadros/interesse-da-oportunidade'
import {
  CamposDaAtividade,
  pedidoDosCampos,
  VALORES_VAZIOS,
  type ValoresDaAtividade,
} from '@/components/atividades/campos-da-atividade'
import { NOME_DO_TIPO, type TipoDeAtividade } from '@/core/atividades'
import { comoDinheiro, lerValor, LIMITE_DO_TITULO } from '@/core/crm'
import { CLASSE_DA_COR as COR_DA_ETIQUETA, type CorDeEtiqueta } from '@/core/etiquetas'
import { CLASSE_DA_COR, aoArrastarPara, type Cartao, type CorDaEtapa, type TipoDeEtapa } from '@/core/quadros'
import {
  FILTROS_DO_HISTORICO,
  NOME_DO_FILTRO,
  categoriaDoEvento,
  comoDias,
  degrauDaEtapa,
  diasDesde,
  filtrarHistorico,
  fraseDaAtividade,
  fraseDoNegocio,
  tituloDoNegocio,
  type FiltroDoHistorico,
} from '@/core/negocios'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { dataCurta, horaExata, quando } from '@/lib/quando'
import { acaoMoverCartao, acaoTirarDoQuadro } from '@/server/acoes'
import { acaoAtribuirCartao, acaoDescreverCartao, acaoReabrirCartao } from '@/server/acoes-crm'
import { acaoCriarAtividade } from '@/server/acoes-atividades'
import {
  acaoAnotarNoNegocio,
  acaoPreverFechamento,
  acaoTrocarDeFunil,
} from '@/server/acoes-negocio'

export type ItemDoHistorico = {
  id: string
  tipo: string
  frase: string
  autor: string | null
  quando: string
  /** Ainda indo para o servidor: a linha aparece, mais apagada. */
  pendente?: boolean
}

type Etapa = { id: string; nome: string; tipo?: TipoDeEtapa; cor?: CorDaEtapa | null }

type AtividadeAberta = {
  id: string
  tipo: TipoDeAtividade
  titulo: string
  prazo: string | null
  horaMarcada: boolean
}

type Negocio = Cartao & { quadroId: string; motivo: string | null; fechadoEm: string | null }

type Props = {
  clienteId: string
  agora: number
  autor: string | null
  negocio: Negocio
  podeVerValor: boolean
  quadro: {
    id: string
    nome: string
    finalidade: 'operacional' | 'comercial'
    etapas: Etapa[]
    seguinte: string | null
  }
  outrosFunis: { id: string; nome: string }[]
  contato: {
    id: string
    nome: string
    telefone: string
    ultimaEntradaEm: string | null
    origem: string | null
    etiquetas: { id: string; nome: string; cor: CorDeEtiqueta }[]
  }
  historico: ItemDoHistorico[]
  atividades: AtividadeAberta[]
  outrosNegocios: {
    cartaoId: string
    titulo: string | null
    quadro: string
    etapa: string
    situacao: string
    valor: number | null
  }[]
  equipe: { id: string; nome: string }[]
  motivos: { id: string; nome: string }[]
}

/**
 * A página do negócio (F2, seção 5.1 do plano de 24/09).
 *
 * **Tudo aqui é otimista.** Mover pelos degraus, editar um campo, anotar: a
 * tela muda no clique, o servidor grava por trás, e só a falha desfaz, com a
 * frase do erro no lugar. Nenhuma ação revalida esta rota, então nada pisca.
 *
 * O estado nasce das props e **cede quando o servidor manda outras** (criar
 * atividade revalida o layout do cliente): o padrão de ajustar durante o
 * render, o mesmo do quadro, sem efeito que pinta o dado velho antes.
 */
export function PaginaDoNegocio(props: Props) {
  const { clienteId, agora, quadro, contato, podeVerValor } = props
  const router = useRouter()

  const [doServidor, setDoServidor] = useState(props)
  const [negocio, setNegocio] = useState(props.negocio)
  const [historico, setHistorico] = useState(props.historico)
  const [atividades, setAtividades] = useState(props.atividades)
  if (doServidor !== props) {
    setDoServidor(props)
    setNegocio(props.negocio)
    setHistorico(props.historico)
    setAtividades(props.atividades)
  }

  const [aba, setAba] = useState<'geral' | 'historico'>('geral')
  const [filtro, setFiltro] = useState<FiltroDoHistorico>('tudo')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{ situacao: 'ganha' | 'perdida'; voltarPara?: string } | null>(null)
  const [novaAtividade, setNovaAtividade] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [, comecar] = useTransition()
  const caixaDeNota = useRef<HTMLTextAreaElement>(null)

  const aberto = !negocio.situacao || negocio.situacao === 'aberta'
  const titulo = tituloDoNegocio(negocio)
  const degrau = degrauDaEtapa(quadro.etapas, negocio.colunaId)
  const etapaAtual = quadro.etapas.find((etapa) => etapa.id === negocio.colunaId)
  const naEtapa = diasDesde(negocio.entrouNaColunaEm, agora)
  const abertoHa = negocio.criadoEm ? diasDesde(negocio.criadoEm, agora) : null
  const ehVenda = fechando?.situacao === 'ganha' && quadro.finalidade === 'comercial'

  function registrar(item: Omit<ItemDoHistorico, 'id' | 'quando' | 'autor'>): string {
    const id = `local:${crypto.randomUUID()}`
    setHistorico((atual) => [
      { ...item, id, autor: props.autor, quando: new Date().toISOString() },
      ...atual,
    ])
    return id
  }

  function esquecer(id: string) {
    setHistorico((atual) => atual.filter((item) => item.id !== id))
  }

  function confirmar(id: string) {
    setHistorico((atual) => atual.map((item) => (item.id === id ? { ...item, pendente: false } : item)))
  }

  /** Muda o negócio na tela e grava; se o servidor recusar, volta e diz por quê. */
  function mudar(
    novo: Partial<Negocio>,
    acao: () => Promise<{ ok: boolean; erro?: string }>,
    evento?: Omit<ItemDoHistorico, 'id' | 'quando' | 'autor'>,
  ) {
    const antes = negocio
    setErro(null)
    setNegocio((atual) => ({ ...atual, ...novo }))
    const id = evento ? registrar({ ...evento, pendente: true }) : null
    comecar(async () => {
      try {
        const r = await acao()
        if (!r.ok) throw new Error(r.erro ?? 'não deu para salvar')
        if (id) confirmar(id)
      } catch (e) {
        setNegocio(antes)
        if (id) esquecer(id)
        setErro(e instanceof Error && e.message ? e.message : 'não deu para salvar agora')
      }
    })
  }

  function moverPara(colunaId: string) {
    if (colunaId === negocio.colunaId || !aberto) return
    const destino = quadro.etapas.find((etapa) => etapa.id === colunaId)
    if (!destino) return
    const gesto = aoArrastarPara(negocio, destino)
    const de = etapaAtual?.nome ?? ''
    mudar(
      { colunaId, entrouNaColunaEm: new Date().toISOString() },
      () => acaoMoverCartao(clienteId, negocio.id, colunaId),
      {
        tipo: 'mudou-de-etapa',
        frase: fraseDoNegocio({ tipo: 'mudou-de-etapa', dados: { de, para: destino.nome } }),
      },
    )
    // Etapa de ganho ou de perda pede o fechamento, como no quadro: perder
    // sem motivo é o relatório que o motivo existe para evitar.
    if (gesto.tipo === 'concluir') setFechando({ situacao: gesto.situacao, voltarPara: gesto.voltarPara })
  }

  function cancelarFechamento() {
    const cancelado = fechando
    setFechando(null)
    if (cancelado?.voltarPara) moverPara(cancelado.voltarPara)
  }

  function concluiu(situacao: 'ganha' | 'perdida', dados: { motivo?: string; abriuEm?: string } = {}) {
    setFechando(null)
    setNegocio((atual) => ({ ...atual, situacao, motivo: dados.motivo ?? null, fechadoEm: new Date().toISOString() }))
    registrar({
      tipo: situacao === 'ganha' ? 'ganhou' : 'perdeu',
      frase: fraseDoNegocio({
        tipo: situacao === 'ganha' ? 'ganhou' : 'perdeu',
        dados: dados.motivo ? { motivo: dados.motivo } : {},
      }),
    })
    setAviso(
      situacao === 'ganha'
        ? dados.abriuEm
          ? `Negócio ganho. O contato entrou no funil ${dados.abriuEm}.`
          : 'Negócio ganho.'
        : 'Negócio marcado como perdido.',
    )
  }

  function reabrir() {
    mudar({ situacao: 'aberta', motivo: null, fechadoEm: null }, () => acaoReabrirCartao(clienteId, negocio.id))
    setAviso(null)
  }

  function anotar(texto: string, aoFalhar: (texto: string) => void) {
    const id = registrar({ tipo: 'nota', frase: texto, pendente: true })
    comecar(async () => {
      try {
        const r = await acaoAnotarNoNegocio(clienteId, contato.id, negocio.id, texto)
        if (!r.ok) throw new Error(r.erro)
        setHistorico((atual) =>
          atual.map((item) =>
            item.id === id ? { ...item, id: r.anotacao.id, quando: r.anotacao.criadoEm, pendente: false } : item,
          ),
        )
      } catch (e) {
        esquecer(id)
        aoFalhar(texto)
        setErro(e instanceof Error && e.message ? e.message : 'não deu para guardar a anotação')
      }
    })
  }

  function excluir() {
    comecar(async () => {
      const r = await acaoTirarDoQuadro(clienteId, negocio.id)
      if (!r.ok) {
        setExcluindo(false)
        setErro(r.erro ?? 'não deu para excluir')
        return
      }
      router.push(`/clientes/${clienteId}/quadros?q=${quadro.id}`)
    })
  }

  function trocarDeFunil(quadroId: string) {
    const destino = props.outrosFunis.find((f) => f.id === quadroId)
    setErro(null)
    setAviso(destino ? `Levando para o funil ${destino.nome}…` : null)
    comecar(async () => {
      const r = await acaoTrocarDeFunil(clienteId, negocio.id, quadroId)
      if (!r.ok) {
        setAviso(null)
        setErro(r.erro ?? 'não deu para trocar de funil')
        return
      }
      // Outro funil é outra régua de etapas: aqui sim a página precisa do servidor.
      router.refresh()
    })
  }

  const voltar = `/clientes/${clienteId}/quadros?q=${quadro.id}`
  const conversa = `/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(contato.id)}`

  return (
    <main className="w-full px-4 pt-[22px] pb-12 md:px-7">
      <nav aria-label="Caminho" className="mb-3 flex items-center gap-1.5 text-[12px] text-dim">
        <Link href={voltar} className="text-muted transition hover:text-primary">
          ← Negócios
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate">{quadro.nome}</span>
      </nav>

      {/* O topo: o que é, quanto vale, em que pé está, e as ações. */}
      <header className="app-card mb-4 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <TituloEditavel
              titulo={negocio.titulo ?? ''}
              provisorio={titulo.provisorio ? titulo.texto : null}
              aoSalvar={(novo) =>
                mudar({ titulo: novo || null }, () =>
                  acaoDescreverCartao(clienteId, negocio.id, {
                    titulo: novo,
                    valor: negocio.valor == null ? '' : String(negocio.valor).replace('.', ','),
                  }),
                )
              }
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <SeloDaSituacao situacao={negocio.situacao ?? 'aberta'} />
              {podeVerValor && (
                <span
                  className={`text-[20px] leading-none font-bold tracking-[-0.02em] tabular-nums ${negocio.valor == null ? 'text-dim' : 'text-ink'}`}
                >
                  {negocio.valor == null ? 'Sem valor' : comoDinheiro(negocio.valor)}
                </span>
              )}
              {negocio.temperatura && <SeloDaTemperatura temperatura={negocio.temperatura} />}
              <span className="flex items-center gap-1.5 text-[12px] text-muted">
                <Avatar nome={contato.nome} tamanho={20} />
                {contato.nome}
              </span>
            </div>
          </div>

          {/* No celular as quatro ações cabem numa linha, em grade; no desktop, lado a lado. */}
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-1.5 sm:flex sm:gap-2 [&>*]:justify-center max-sm:[&>*]:px-2">
            <button
              type="button"
              className="quadro-tool"
              onClick={() => {
                setAba('geral')
                // O próximo quadro já tem a caixa na tela; focar antes dele
                // pintar acharia o elemento da aba anterior.
                requestAnimationFrame(() => caixaDeNota.current?.focus())
              }}
            >
              <IconeAnotacao /> Anotação
            </button>
            <Link href={conversa} className="quadro-tool">
              <IconeMensagem /> Mensagem
            </Link>
            <button type="button" className="quadro-tool" onClick={() => setNovaAtividade(true)}>
              <IconeMais /> Atividade
            </button>
            <PopoverDoQuadro
              rotulo="Mais ações do negócio"
              gatilho={<IconeDoQuadro tipo="menu" />}
              className="quadro-icon-button"
              largura={250}
            >
              {aberto ? (
                <>
                  <button
                    type="button"
                    data-fechar-popover
                    className="quadro-menu-item text-ok"
                    onClick={() => setFechando({ situacao: 'ganha' })}
                  >
                    Marcar como ganho
                  </button>
                  <button
                    type="button"
                    data-fechar-popover
                    className="quadro-menu-item"
                    onClick={() => setFechando({ situacao: 'perdida' })}
                  >
                    Marcar como perdido
                  </button>
                </>
              ) : (
                <button type="button" data-fechar-popover className="quadro-menu-item" onClick={reabrir}>
                  Reabrir negócio
                </button>
              )}
              {props.outrosFunis.length > 0 && (
                <>
                  <p className="quadro-menu-label mt-1 border-t border-line pt-2">Levar para outro funil</p>
                  {props.outrosFunis.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      data-fechar-popover
                      className="quadro-menu-item"
                      onClick={() => trocarDeFunil(f.id)}
                    >
                      <IconeDoQuadro tipo="quadro" />
                      <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="quadro-danger mt-1 border-t border-line pt-1">
                <button
                  type="button"
                  data-fechar-popover
                  className="quadro-menu-item text-perigo"
                  onClick={() => setExcluindo(true)}
                >
                  Excluir negócio
                </button>
              </div>
            </PopoverDoQuadro>
          </div>
        </div>
      </header>

      {(erro || aviso) && (
        <p
          role={erro ? 'alert' : 'status'}
          className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${erro ? 'border-rose-300/50 bg-rose-50 font-semibold text-perigo dark:bg-rose-400/10' : 'border-line bg-surface text-soft'}`}
        >
          {erro ?? aviso}
        </p>
      )}

      <div role="tablist" aria-label="Seções do negócio" className="mb-4 flex gap-1 border-b border-line">
        {(
          [
            ['geral', 'Visão geral'],
            ['historico', `Histórico · ${historico.length}`],
          ] as const
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            onClick={() => setAba(chave)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition ${aba === chave ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-soft'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'historico' ? (
        <Historico historico={historico} filtro={filtro} aoFiltrar={setFiltro} agora={agora} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_320px]">
          {/* Centro: a etapa, a anotação e o que aconteceu. No celular vem primeiro. */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">
            <Cartao titulo="Etapa atual" acao={degrau && <span className="text-[12px] text-dim tabular-nums">{degrau.posicao} de {degrau.total}</span>}>
              <p className="text-[17px] font-bold tracking-[-0.02em]">{etapaAtual?.nome ?? 'Etapa removida'}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {aberto ? (
                  <>
                    Nesta etapa há <strong className="text-soft">{comoDias(naEtapa)}</strong>
                    {abertoHa !== null && (
                      <>
                        {' '}· aberto há <strong className="text-soft">{comoDias(abertoHa)}</strong>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {negocio.situacao === 'ganha' ? 'Ganho' : 'Perdido'}
                    {negocio.fechadoEm && ` em ${dataCurta(negocio.fechadoEm)}`}
                    {negocio.situacao === 'perdida' && negocio.motivo && ` · motivo: ${negocio.motivo}`}
                  </>
                )}
              </p>

              <Degraus
                etapas={quadro.etapas}
                atual={negocio.colunaId}
                travado={!aberto}
                aoEscolher={moverPara}
              />

              {aberto && degrau?.ultima && (
                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center">
                  <p className="flex-1 text-[12.5px] text-muted">Última etapa. Como terminou?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFechando({ situacao: 'ganha' })}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-emerald-700"
                    >
                      Ganho
                    </button>
                    <button
                      type="button"
                      onClick={() => setFechando({ situacao: 'perdida' })}
                      className="rounded-lg border border-rose-300 px-4 py-2 text-[12.5px] font-bold text-rose-700 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
                    >
                      Perdido
                    </button>
                  </div>
                </div>
              )}
              {!aberto && (
                <button type="button" onClick={reabrir} className="quadro-tool mt-4">
                  Reabrir negócio
                </button>
              )}
            </Cartao>

            <Cartao titulo="Anotação">
              <NovaAnotacao caixa={caixaDeNota} aoAnotar={anotar} />
            </Cartao>

            <Cartao
              titulo="Histórico recente"
              acao={
                historico.length > 5 && (
                  <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setAba('historico')}>
                    Ver tudo
                  </button>
                )
              }
            >
              <LinhaDoTempo itens={historico.slice(0, 5)} agora={agora} />
            </Cartao>
          </div>

          {/* Esquerda: as informações, editáveis no lugar. */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-1">
            <Cartao titulo="Informações">
              <dl className="flex flex-col divide-y divide-line">
                {podeVerValor && (
                  <Campo rotulo="Valor">
                    <TextoEditavel
                      valor={negocio.valor == null ? '' : String(negocio.valor).replace('.', ',')}
                      mostrar={negocio.valor == null ? null : comoDinheiro(negocio.valor)}
                      vazio="Informar valor"
                      rotulo="Valor do negócio"
                      placeholder="Exemplo: 1.500,00"
                      inputMode="decimal"
                      conferir={(texto) => {
                        const lido = lerValor(texto)
                        return lido.ok ? null : lido.motivo
                      }}
                      aoSalvar={(texto) => {
                        const lido = lerValor(texto)
                        if (!lido.ok) return
                        mudar({ valor: lido.valor }, () =>
                          acaoDescreverCartao(clienteId, negocio.id, { titulo: negocio.titulo ?? '', valor: texto }),
                        )
                      }}
                    />
                  </Campo>
                )}
                <Campo rotulo="Produto">
                  <InteresseDaOportunidade
                    clienteId={clienteId}
                    cartaoId={negocio.id}
                    produtoId={negocio.produtoId ?? null}
                    produtoNome={negocio.produtoNome ?? null}
                  />
                </Campo>
                <Campo rotulo="Previsão de fechamento">
                  <DataEditavel
                    valor={negocio.previsao ?? ''}
                    aoSalvar={(data) =>
                      mudar({ previsao: data || null }, () => acaoPreverFechamento(clienteId, negocio.id, data))
                    }
                  />
                </Campo>
                <Campo rotulo="Responsável">
                  <Dropdown
                    rotuloAcessivel="Responsável pelo negócio"
                    valor={negocio.responsavelId ?? ''}
                    aoMudar={(id) => {
                      const nome = props.equipe.find((p) => p.id === id)?.nome ?? null
                      mudar(
                        { responsavelId: id || null, responsavelNome: nome },
                        () => acaoAtribuirCartao(clienteId, negocio.id, id || null),
                        {
                          tipo: 'assumiu',
                          frase: fraseDoNegocio({ tipo: 'assumiu', dados: { quem: nome ?? '' } }),
                        },
                      )
                    }}
                    opcoes={[
                      { valor: '', rotulo: 'Sem responsável' },
                      ...props.equipe.map((p) => ({ valor: p.id, rotulo: p.nome })),
                    ]}
                  />
                </Campo>
                <Campo rotulo="Temperatura">
                  <TemperaturaDaOportunidade
                    clienteId={clienteId}
                    cartaoId={negocio.id}
                    temperatura={negocio.temperatura ?? null}
                    aoMudar={(temperatura) => {
                      setNegocio((atual) => ({ ...atual, temperatura }))
                      registrar({
                        tipo: 'mudou-de-temperatura',
                        frase: fraseDoNegocio({ tipo: 'mudou-de-temperatura', dados: { para: temperatura ?? 'não avaliada' } }),
                      })
                    }}
                  />
                </Campo>
                <Campo rotulo="Origem do lead">
                  <span className={contato.origem ? 'text-soft' : 'text-dim'}>{contato.origem ?? 'Não registrada'}</span>
                </Campo>
                <Campo rotulo="Criado em">
                  <span className="text-soft">{negocio.criadoEm ? dataCurta(negocio.criadoEm) : '·'}</span>
                </Campo>
                <Campo rotulo="Última alteração">
                  <span className="text-soft" title={historico[0] ? horaExata(historico[0].quando) : undefined}>
                    {historico[0] ? quando(historico[0].quando, agora) : negocio.criadoEm ? dataCurta(negocio.criadoEm) : '·'}
                  </span>
                </Campo>
              </dl>
            </Cartao>
          </div>

          {/* Direita: a pessoa, o que falta fazer e os outros negócios dela. */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2 lg:grid lg:grid-cols-2 xl:col-span-1 xl:col-start-3 xl:row-start-1 xl:flex">
            <Cartao titulo="Contato">
              <div className="flex items-center gap-3">
                <Avatar nome={contato.nome} tamanho={40} />
                <div className="min-w-0">
                  <Link
                    href={`/clientes/${clienteId}/leads/${contato.id}`}
                    className="block truncate text-[14px] font-bold transition hover:text-primary"
                  >
                    {contato.nome}
                  </Link>
                  <a href={`tel:+${contato.telefone}`} className="block text-[12px] text-muted hover:text-primary">
                    {telefoneLegivel(contato.telefone)}
                  </a>
                </div>
              </div>
              {contato.etiquetas.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {contato.etiquetas.map((e) => (
                    <li key={e.id} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${COR_DA_ETIQUETA[e.cor]}`}>
                      {e.nome}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] text-muted">
                {contato.ultimaEntradaEm ? (
                  <>
                    Última mensagem <span title={horaExata(contato.ultimaEntradaEm)}>{quando(contato.ultimaEntradaEm, agora)}</span>
                  </>
                ) : (
                  'Ainda não escreveu'
                )}
              </p>
              <Link href={conversa} className="app-primary-button mt-3 flex w-full justify-center px-3 py-2 text-[12.5px]">
                Abrir conversa
              </Link>
            </Cartao>

            <Cartao
              titulo="Atividades abertas"
              acao={
                <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setNovaAtividade(true)}>
                  + Nova
                </button>
              }
            >
              {atividades.length === 0 ? (
                <p className="text-[12px] leading-5 text-dim">Nada marcado. Uma ligação ou proposta combinada entra aqui.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {atividades.map((a) => (
                    <li key={a.id} className="flex items-start gap-2.5">
                      <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold">{a.titulo}</span>
                        <span className={`block text-[11px] ${a.prazo && Date.parse(a.prazo) < agora ? 'font-semibold text-perigo' : 'text-dim'}`}>
                          {NOME_DO_TIPO[a.tipo]}
                          {a.prazo ? ` · ${a.horaMarcada ? horaExata(a.prazo) : dataCurta(a.prazo)}` : ' · sem prazo'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>

            {props.outrosNegocios.length > 0 && (
              <Cartao titulo="Outros negócios desta pessoa">
                <ul className="flex flex-col gap-2">
                  {props.outrosNegocios.map((o) => (
                    <li key={o.cartaoId}>
                      <Link
                        href={`/clientes/${clienteId}/negocios/${o.cartaoId}`}
                        className="block rounded-lg border border-line px-3 py-2 transition hover:border-strong hover:bg-surface"
                      >
                        <span className="flex items-baseline gap-2">
                          <span className={`min-w-0 flex-1 truncate text-[12.5px] font-semibold ${o.titulo ? '' : 'text-dim'}`}>
                            {o.titulo || `Negócio de ${contato.nome}`}
                          </span>
                          {o.valor != null && <span className="shrink-0 text-[11.5px] font-semibold tabular-nums">{comoDinheiro(o.valor)}</span>}
                        </span>
                        <span className="block truncate text-[11px] text-dim">
                          {o.quadro} · {o.etapa}
                          {o.situacao !== 'aberta' && ` · ${o.situacao === 'ganha' ? 'ganho' : 'perdido'}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
          </div>
        </div>
      )}

      <RegistrarVenda
        key={`venda:${fechando ? 'aberto' : 'fechado'}`}
        clienteId={clienteId}
        cartao={ehVenda ? { id: negocio.id, nome: contato.nome, titulo: negocio.titulo, valor: negocio.valor } : null}
        aoFechar={cancelarFechamento}
        aoConcluir={() => concluiu('ganha')}
      />
      <FecharCartao
        key={`fechar:${fechando?.situacao ?? 'fechado'}`}
        clienteId={clienteId}
        cartao={fechando && !ehVenda ? { id: negocio.id, nome: contato.nome, titulo: negocio.titulo, valor: negocio.valor } : null}
        situacao={fechando?.situacao ?? 'ganha'}
        motivos={props.motivos}
        seguinte={quadro.seguinte}
        aoFechar={cancelarFechamento}
        aoConcluir={(r) => concluiu(fechando?.situacao ?? 'ganha', r)}
      />

      <NovaAtividade
        aberto={novaAtividade}
        aoFechar={() => setNovaAtividade(false)}
        aoCriar={(valores) => {
          setNovaAtividade(false)
          const provisoria: AtividadeAberta = {
            id: `local:${crypto.randomUUID()}`,
            tipo: valores.tipo,
            titulo: valores.titulo.trim(),
            prazo: valores.prazo ? new Date(`${valores.prazo}T${valores.hora || '12:00'}`).toISOString() : null,
            horaMarcada: valores.hora !== '',
          }
          setAtividades((atual) => [...atual, provisoria])
          const idDoHistorico = registrar({
            tipo: 'atividade',
            frase: fraseDaAtividade(valores.tipo, 'aberta', provisoria.titulo),
            pendente: true,
          })
          comecar(async () => {
            try {
              const r = await acaoCriarAtividade(clienteId, {
                contatoId: contato.id,
                cartaoId: negocio.id,
                ...pedidoDosCampos(valores),
              })
              if (!r.ok) throw new Error(r.erro)
              confirmar(idDoHistorico)
            } catch (e) {
              setAtividades((atual) => atual.filter((a) => a.id !== provisoria.id))
              esquecer(idDoHistorico)
              setErro(e instanceof Error && e.message ? e.message : 'não deu para marcar a atividade')
            }
          })
        }}
      />

      <Modal
        aberto={excluindo}
        aoFechar={() => setExcluindo(false)}
        titulo="Excluir este negócio?"
        descricao="Some o negócio e a posição no funil. A pessoa, a conversa e as etiquetas ficam."
      >
        <div className="flex justify-end gap-2">
          <button type="button" className="quadro-tool" onClick={() => setExcluindo(false)}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={excluir}
            className="rounded-lg bg-rose-600 px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-rose-700"
          >
            Excluir negócio
          </button>
        </div>
      </Modal>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function Cartao({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="app-card px-5 py-4">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-bold tracking-[0.06em] text-dim uppercase">{titulo}</h2>
        {acao}
      </header>
      {children}
    </section>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <dt className="mb-1 text-[11px] font-semibold text-dim">{rotulo}</dt>
      <dd className="text-[13px]">{children}</dd>
    </div>
  )
}

function SeloDaSituacao({ situacao }: { situacao: string }) {
  const [rotulo, classe] =
    situacao === 'ganha'
      ? ['Ganho', 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300']
      : situacao === 'perdida'
        ? ['Perdido', 'border-rose-300/60 bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300']
        : ['Aberto', 'border-primary/25 bg-primary/[0.07] text-primary']
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold ${classe}`}>{rotulo}</span>
}

function SeloDaTemperatura({ temperatura }: { temperatura: string }) {
  const classe =
    temperatura === 'quente'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300'
      : temperatura === 'morno'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200'
        : 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
  return <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${classe}`}>{temperatura}</span>
}

/**
 * As etapas como degraus clicáveis.
 *
 * A barra de cima de cada degrau acende até a etapa atual: é o progresso lido
 * de relance, sem número. Clicar num degrau move o negócio para lá. No
 * celular os degraus rolam de lado em vez de espremer os nomes.
 */
function Degraus({
  etapas,
  atual,
  travado,
  aoEscolher,
}: {
  etapas: Etapa[]
  atual: string
  travado: boolean
  aoEscolher: (id: string) => void
}) {
  const indiceAtual = etapas.findIndex((etapa) => etapa.id === atual)
  return (
    <ol className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Etapas do funil">
      {etapas.map((etapa, i) => {
        const feita = i < indiceAtual
        const aqui = i === indiceAtual
        return (
          <li key={etapa.id} className="min-w-[96px] flex-1">
            <button
              type="button"
              disabled={travado || aqui}
              aria-current={aqui ? 'step' : undefined}
              title={aqui ? 'Etapa atual' : travado ? 'Reabra o negócio para mover' : `Mover para ${etapa.nome}`}
              onClick={() => aoEscolher(etapa.id)}
              className="group flex w-full flex-col gap-1.5 rounded-lg px-1 py-1 text-left transition enabled:hover:bg-surface disabled:cursor-default"
            >
              <span
                aria-hidden
                className={`h-1.5 w-full rounded-full transition ${
                  aqui
                    ? etapa.cor
                      ? CLASSE_DA_COR[etapa.cor]
                      : 'bg-primary'
                    : feita
                      ? 'bg-primary/45'
                      : 'bg-surface-strong group-enabled:group-hover:bg-primary/25'
                }`}
              />
              <span
                className={`line-clamp-2 text-[11.5px] leading-[1.3] ${aqui ? 'font-bold text-ink' : feita ? 'font-semibold text-soft' : 'text-dim group-enabled:group-hover:text-soft'}`}
              >
                {etapa.nome}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function LinhaDoTempo({ itens, agora }: { itens: ItemDoHistorico[]; agora: number }) {
  if (itens.length === 0) {
    return <p className="text-[12px] leading-5 text-dim">O que acontecer com este negócio aparece aqui: etapas, anotações, atividades.</p>
  }
  return (
    <ol className="flex flex-col">
      {itens.map((item) => (
        <li key={item.id} className={`group relative flex gap-3 pb-3.5 last:pb-0 ${item.pendente ? 'opacity-60' : ''}`}>
          <span aria-hidden className="relative flex w-5 shrink-0 justify-center">
            <span className="absolute top-5 bottom-[-6px] w-px bg-line group-last:hidden" />
            <IconeDoEvento tipo={item.tipo} />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[12.5px] leading-5 break-words ${item.tipo === 'nota' ? 'whitespace-pre-wrap text-ink' : 'text-soft'}`}>
              {item.frase}
            </p>
            <p className="mt-0.5 text-[11px] text-dim">
              <span title={horaExata(item.quando)}>{item.pendente ? 'salvando…' : quando(item.quando, agora)}</span>
              {item.autor && ` · ${item.autor}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Historico({
  historico,
  filtro,
  aoFiltrar,
  agora,
}: {
  historico: ItemDoHistorico[]
  filtro: FiltroDoHistorico
  aoFiltrar: (filtro: FiltroDoHistorico) => void
  agora: number
}) {
  const visiveis = filtrarHistorico(historico, filtro)
  const contagem = (f: FiltroDoHistorico) =>
    f === 'tudo' ? historico.length : historico.filter((item) => categoriaDoEvento(item.tipo) === f).length

  return (
    <section className="app-card px-5 py-4 md:px-6">
      <div role="group" aria-label="Filtrar histórico" className="mb-5 flex flex-wrap gap-1.5">
        {FILTROS_DO_HISTORICO.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => aoFiltrar(f)}
            className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition ${filtro === f ? 'border-primary bg-primary text-white' : 'border-line text-muted hover:border-strong hover:text-soft'}`}
          >
            {NOME_DO_FILTRO[f]} <span className={`tabular-nums ${filtro === f ? 'text-white/80' : 'text-dim'}`}>{contagem(f)}</span>
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-dim">Nada deste tipo ainda.</p>
      ) : (
        <LinhaDoTempo itens={visiveis} agora={agora} />
      )}
    </section>
  )
}

function NovaAnotacao({
  caixa,
  aoAnotar,
}: {
  caixa: RefObject<HTMLTextAreaElement | null>
  aoAnotar: (texto: string, aoFalhar: (texto: string) => void) => void
}) {
  const [texto, setTexto] = useState('')
  const limpo = texto.trim()

  function enviar() {
    if (!limpo) return
    setTexto('')
    aoAnotar(limpo, (devolvido) => setTexto(devolvido))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        ref={caixa}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            enviar()
          }
        }}
        maxLength={LIMITE_DA_NOTA}
        rows={2}
        aria-label="Nova anotação sobre o negócio"
        placeholder="Exemplo: pediu desconto à vista, retornar na sexta."
        className="app-field min-h-[64px] resize-y px-3 py-2 text-[13px] leading-5"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-dim">Fica no histórico do negócio e na ficha da pessoa.</span>
        <button type="submit" disabled={!limpo} className="app-primary-button px-3.5 py-1.5 text-[12.5px] disabled:opacity-50">
          Anotar
        </button>
      </div>
    </form>
  )
}

/** O título no lugar: clicar vira campo, Enter grava, Esc desiste. */
function TituloEditavel({
  titulo,
  provisorio,
  aoSalvar,
}: {
  titulo: string
  provisorio: string | null
  aoSalvar: (titulo: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(titulo)

  if (editando) {
    const gravar = () => {
      setEditando(false)
      if (texto.trim() !== titulo) aoSalvar(texto.trim())
    }
    return (
      <input
        autoFocus
        value={texto}
        maxLength={LIMITE_DO_TITULO}
        onChange={(e) => setTexto(e.currentTarget.value)}
        onBlur={gravar}
        onKeyDown={(e) => {
          if (e.key === 'Enter') gravar()
          if (e.key === 'Escape') {
            setTexto(titulo)
            setEditando(false)
          }
        }}
        aria-label="Título do negócio"
        placeholder="Exemplo: Plano anual com 2 aulas por semana"
        className="app-field w-full px-2.5 py-1.5 text-[22px] font-bold tracking-[-0.03em]"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTexto(titulo)
        setEditando(true)
      }}
      title="Clique para editar o título"
      className="group -mx-1.5 flex max-w-full items-center gap-2 rounded-lg px-1.5 py-0.5 text-left transition hover:bg-surface"
    >
      <h1 className={`min-w-0 text-[24px] leading-tight font-bold tracking-[-0.03em] break-words ${provisorio ? 'text-dim' : 'text-ink'}`}>
        {provisorio ?? titulo}
      </h1>
      <span aria-hidden className="shrink-0 text-[12px] text-dim opacity-0 transition group-hover:opacity-100">
        editar
      </span>
    </button>
  )
}

function TextoEditavel({
  valor,
  mostrar,
  vazio,
  rotulo,
  placeholder,
  inputMode,
  conferir,
  aoSalvar,
}: {
  valor: string
  mostrar: string | null
  vazio: string
  rotulo: string
  placeholder: string
  inputMode?: 'decimal' | 'text'
  conferir?: (texto: string) => string | null
  aoSalvar: (texto: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor)
  const [erro, setErro] = useState<string | null>(null)

  if (editando) {
    const gravar = () => {
      const problema = conferir?.(texto) ?? null
      if (problema) {
        setErro(problema)
        return
      }
      setEditando(false)
      if (texto.trim() !== valor) aoSalvar(texto.trim())
    }
    return (
      <span className="flex flex-col gap-1">
        <input
          autoFocus
          value={texto}
          inputMode={inputMode}
          onChange={(e) => {
            setTexto(e.currentTarget.value)
            setErro(null)
          }}
          onBlur={gravar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') gravar()
            if (e.key === 'Escape') setEditando(false)
          }}
          aria-label={rotulo}
          placeholder={placeholder}
          className="app-field h-8 px-2.5 text-[13px]"
        />
        {erro && <span role="alert" className="text-[11px] text-perigo">{erro}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTexto(valor)
        setErro(null)
        setEditando(true)
      }}
      className={`-mx-1.5 rounded-md px-1.5 py-0.5 text-left transition hover:bg-surface ${mostrar ? 'font-semibold text-ink tabular-nums' : 'text-primary'}`}
    >
      {mostrar ?? vazio}
    </button>
  )
}

function DataEditavel({ valor, aoSalvar }: { valor: string; aoSalvar: (data: string) => void }) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="date"
        value={valor}
        onChange={(e) => aoSalvar(e.currentTarget.value)}
        aria-label="Previsão de fechamento"
        className="app-field h-8 w-auto px-2.5 text-[13px]"
      />
      {valor && (
        <button type="button" onClick={() => aoSalvar('')} className="text-[11.5px] text-muted hover:text-perigo">
          limpar
        </button>
      )}
    </span>
  )
}

function NovaAtividade({
  aberto,
  aoFechar,
  aoCriar,
}: {
  aberto: boolean
  aoFechar: () => void
  aoCriar: (valores: ValoresDaAtividade) => void
}) {
  const [valores, setValores] = useState<ValoresDaAtividade>(VALORES_VAZIOS)
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Nova atividade" descricao="Fica presa a este negócio.">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valores.titulo.trim() === '') return
          aoCriar(valores)
          setValores(VALORES_VAZIOS)
        }}
        className="flex flex-col gap-2.5"
      >
        <CamposDaAtividade valores={valores} aoMudar={setValores} tituloComFoco />
        <button
          type="submit"
          disabled={valores.titulo.trim() === ''}
          className="app-primary-button mt-1 w-full px-3 py-2 text-[12.5px] disabled:opacity-50"
        >
          Marcar atividade
        </button>
        <p className="text-[11.5px] leading-4 text-dim">
          É um lembrete para a equipe. <strong>Nada é enviado ao cliente.</strong>
        </p>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Ícones
// ---------------------------------------------------------------------------

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-[15px] max-sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function IconeAnotacao() {
  return (
    <Svg>
      <path d="M5 4h10l4 4v12H5z" />
      <path d="M9 12h6M9 16h4" />
    </Svg>
  )
}

function IconeMensagem() {
  return (
    <Svg>
      <path d="M4 5h16v11H9l-5 4z" />
    </Svg>
  )
}

function IconeMais() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

/** Um ponto de cor por categoria: a linha do tempo se lê pela cor antes do texto. */
function IconeDoEvento({ tipo }: { tipo: string }) {
  const categoria = categoriaDoEvento(tipo)
  const cor =
    tipo === 'ganhou'
      ? 'bg-emerald-500'
      : tipo === 'perdeu'
        ? 'bg-rose-500'
        : categoria === 'anotacoes'
          ? 'bg-amber-400'
          : categoria === 'atividades'
            ? 'bg-violet-500'
            : categoria === 'etapas'
              ? 'bg-primary'
              : categoria === 'conversa'
                ? 'bg-emerald-400'
                : 'bg-slate-400'
  return (
    <span className="relative z-[1] mt-1 grid size-3.5 place-items-center rounded-full bg-panel ring-1 ring-line">
      <span className={`size-1.5 rounded-full ${cor}`} />
    </span>
  )
}
