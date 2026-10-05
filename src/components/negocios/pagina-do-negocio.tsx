'use client'

import { Alternador } from '@/components/design/alternador'
import { Trilha } from '@/components/design/trilha'
import { FimDaTrilha } from '@/components/design/fim-da-trilha'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { Avatar } from '@/components/inbox/avatar'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { VazioDoCartao } from '@/components/lead-crm/vazio-do-cartao'
import { IlustracaoAnotacoes } from '@/components/design/ilustracoes'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { AcaoDaFicha } from '@/components/lead-crm/acoes-da-ficha'
import { CampoDeDinheiro } from '@/components/design/campo-de-dinheiro'
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
import { NOME_DO_TIPO, statusDaAtividade, type TipoDeAtividade } from '@/core/atividades'
import { IconeDoTipo, rotuloDoPrazo } from '@/components/atividades/linha-da-agenda'
import { SeloDoStatus } from '@/components/atividades/selo-do-status'
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
import { dataEHora, dataEHoraComRelativo, horaExata, quando } from '@/lib/quando'
import { acaoMoverCartao, acaoTirarDoQuadro } from '@/server/acoes'
import { acaoAtribuirCartao, acaoDescreverCartao, acaoReabrirCartao } from '@/server/acoes-crm'
import { acaoCriarAtividade } from '@/server/acoes-atividades'
import {
  acaoAnotarNoNegocio,
  acaoPreverFechamento,
  acaoTrocarDeFunil,
} from '@/server/acoes-negocio'

/** Quanto o "pronto" da troca de funil fica na tela antes de sumir sozinho. */
const TEMPO_DA_CONFIRMACAO = 6000

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
  /**
   * O funil para onde o negócio está indo, enquanto a página do funil novo
   * não chega.
   *
   * A troca de funil é a única ação desta página que **não** é otimista: outro
   * funil é outra régua de etapas, e a régua vem do servidor. Até 03/10/2026 o
   * aviso "Levando para o funil…" era ligado no clique e nunca desligado no
   * sucesso, então ficava na tela para sempre, sem dizer se tinha terminado.
   * Agora quem desliga é a chegada das props do funil de destino: o aviso de
   * "pronto" só aparece quando a régua nova já está desenhada.
   */
  const [levando, setLevando] = useState<{ id: string; nome: string } | null>(null)
  const [confirmacao, setConfirmacao] = useState<string | null>(null)
  if (doServidor !== props) {
    setDoServidor(props)
    setNegocio(props.negocio)
    setHistorico(props.historico)
    setAtividades(props.atividades)
    if (levando && props.quadro.id === levando.id) {
      setLevando(null)
      setConfirmacao(`Negócio agora está no funil ${levando.nome}.`)
    }
  }

  // A confirmação é passageira: ela responde "terminou?", e depois de lida
  // só ocupa espaço em cima da página.
  useEffect(() => {
    if (!confirmacao) return
    const relogio = setTimeout(() => setConfirmacao(null), TEMPO_DA_CONFIRMACAO)
    return () => clearTimeout(relogio)
  }, [confirmacao])

  const [aba, setAba] = useState<'geral' | 'historico'>('geral')
  const [filtro, setFiltro] = useState<FiltroDoHistorico>('tudo')
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [fechando, setFechando] = useState<{ situacao: 'ganha' | 'perdida'; voltarPara?: string } | null>(null)
  const [novaAtividade, setNovaAtividade] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [, comecar] = useTransition()
  /** O modal "Anotar"; `rascunho` volta para ele se a anotação não gravar. */
  const [anotando, setAnotando] = useState(false)
  const [rascunho, setRascunho] = useState('')

  const aberto = !negocio.situacao || negocio.situacao === 'aberta'
  const titulo = tituloDoNegocio(negocio)
  const degrau = degrauDaEtapa(quadro.etapas, negocio.colunaId)
  const etapaAtual = quadro.etapas.find((etapa) => etapa.id === negocio.colunaId)
  const naEtapa = diasDesde(negocio.entrouNaColunaEm, agora)
  const abertoHa = negocio.criadoEm ? diasDesde(negocio.criadoEm, agora) : null
  const ehVenda = fechando?.situacao === 'ganha' && quadro.finalidade === 'comercial'
  const anotacoes = historico.filter((item) => item.tipo === 'nota')
  const semNotas = historico.filter((item) => item.tipo !== 'nota')

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
    if (!destino) return
    setErro(null)
    setAviso(null)
    setConfirmacao(null)
    setLevando({ id: destino.id, nome: destino.nome })
    comecar(async () => {
      const r = await acaoTrocarDeFunil(clienteId, negocio.id, quadroId)
      if (!r.ok) {
        setLevando(null)
        setErro(r.erro ?? 'não deu para trocar de funil')
        return
      }
      // Outro funil é outra régua de etapas: aqui sim a página precisa do
      // servidor. O aviso sai quando as props do funil novo chegarem.
      router.refresh()
    })
  }

  const voltar = `/clientes/${clienteId}/quadros?q=${quadro.id}`
  const conversa = `/clientes/${clienteId}/inbox?conversa=${encodeURIComponent(contato.id)}`

  return (
    <main className="w-full px-4 pt-[22px] pb-12 md:px-7">
      {/* No computador o caminho mora no cabeçalho ("CRM › Negócios › Comercial ›
          o negócio"); a trilha da página fica para o celular, que não tem cabeçalho. */}
      <FimDaTrilha caminho={[{ rotulo: quadro.nome, href: voltar }, { rotulo: titulo.texto }]} />
      <div className="md:hidden">
        <Trilha caminho={[{ rotulo: 'Negociações', href: voltar }, { rotulo: quadro.nome }]} />
      </div>

      {/*
        O topo mora direto no azul, sem cartão, como o da ficha do contato: o
        que é, quanto vale, em que pé está e, à direita, as ações com ícone em
        cima e palavra embaixo. Ganho e Perdido ficam à vista porque são as
        duas coisas que se fazem com um negócio; o menu guarda só o raro.
      */}
      <header className="mb-[18px] flex flex-wrap items-center gap-x-3.5 gap-y-3">
        <span
          aria-hidden
          className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-primary-weak text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8.5h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-10Z" />
            <path d="M9 8.5V6.2A1.7 1.7 0 0 1 10.7 4.5h2.6A1.7 1.7 0 0 1 15 6.2v2.3M4 13h16" />
          </svg>
        </span>
        <div className="min-w-[12rem] flex-1">
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
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] text-dim">
            <SeloDaSituacao situacao={negocio.situacao ?? 'aberta'} />
            {podeVerValor && (
              <span className={`text-[15px] font-bold tabular-nums ${negocio.valor == null ? 'text-dim' : 'text-ink'}`}>
                {negocio.valor == null ? 'Sem valor' : comoDinheiro(negocio.valor)}
              </span>
            )}
            {negocio.temperatura && <SeloDaTemperatura temperatura={negocio.temperatura} />}
            <span aria-hidden>·</span>
            <span className="flex items-center gap-1.5">
              <Avatar nome={contato.nome} tamanho={18} />
              {contato.nome}
            </span>
          </div>
        </div>

        {/* No celular as ações descem para a linha delas, inteira; no desktop ficam à direita do título. */}
        <div className="flex w-full items-center justify-between sm:w-auto sm:justify-end">
        <span role="group" aria-label="Para a equipe" className="flex items-center">
          <AcaoDaFicha
            rotulo="Anotar"
            titulo="Para a equipe: anotar"
            aoClicar={() => setAnotando(true)}
            icone={
              <>
                <path d="M4.5 19.5h15" />
                <path d="M6 15.2 15.4 5.8a2 2 0 0 1 2.8 2.8L8.8 18 5 19l1-3.8Z" />
              </>
            }
          />
          <AcaoDaFicha
            rotulo="Atividade"
            titulo="Para a equipe: marcar atividade"
            aoClicar={() => setNovaAtividade(true)}
            icone={
              <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.5 12.2 2.4 2.4 4.6-4.9" />
              </>
            }
          />
          <AcaoDaFicha
            rotulo="Mensagem"
            titulo="Abrir a conversa com o contato"
            aoClicar={() => router.push(conversa)}
            icone={<path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8.5A1.5 1.5 0 0 1 19 17h-9l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />}
          />
        </span>
        <span aria-hidden className="h-8 w-px bg-line max-sm:hidden" />
        <span role="group" aria-label="O negócio" className="flex items-center">
          {aberto ? (
            <>
              <AcaoDaFicha
                rotulo="Ganho"
                titulo="Marcar como ganho"
                aoClicar={() => setFechando({ situacao: 'ganha' })}
                icone={
                  <>
                    <path d="M8 4.5h8v4.2a4 4 0 0 1-8 0V4.5Z" />
                    <path d="M8 6.2H5.5v1.3A2.6 2.6 0 0 0 8 10.1M16 6.2h2.5v1.3a2.6 2.6 0 0 1-2.5 2.6" />
                    <path d="M12 12.7v3.3M9 19.5h6M10 16h4" />
                  </>
                }
              />
              <AcaoDaFicha
                rotulo="Perdido"
                titulo="Marcar como perdido"
                aoClicar={() => setFechando({ situacao: 'perdida' })}
                icone={
                  <>
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="m9.3 9.3 5.4 5.4M14.7 9.3l-5.4 5.4" />
                  </>
                }
              />
            </>
          ) : (
            <AcaoDaFicha
              rotulo="Reabrir"
              titulo="Reabrir negócio"
              aoClicar={reabrir}
              icone={
                <>
                  <path d="M4.8 12a7.2 7.2 0 1 0 2.1-5.1" />
                  <path d="M4.8 4.6v3.6h3.6" />
                </>
              }
            />
          )}
          {props.outrosFunis.length > 0 && (
            <PopoverDoQuadro
              rotulo="Levar para outro funil"
              gatilho={
                <>
                  <svg aria-hidden viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 8h12M13 4.5 16.5 8 13 11.5M19.5 16h-12M11 12.5 7.5 16l3.5 3.5" />
                  </svg>
                  Funil
                </>
              }
              className="flex w-[54px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10.5px] text-muted sm:w-[62px] transition hover:bg-surface hover:text-primary"
              largura={250}
            >
              <p className="quadro-menu-label">Levar para outro funil</p>
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
            </PopoverDoQuadro>
          )}
        </span>
        {/* A única ação sem volta, em vermelho cheio, como "Apagar" na ficha do contato. */}
        <AcaoDaFicha
          rotulo="Excluir"
          titulo="Excluir negócio"
          tom="perigo"
          aoClicar={() => setExcluindo(true)}
          icone={
            <>
              <path d="M5 7h14M10 7V5.2h4V7" />
              <path d="m7 7 .8 12h8.4L17 7" />
            </>
          }
        />
        </div>
      </header>

      {erro ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-rose-300/50 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-perigo dark:bg-rose-400/10"
        >
          {erro}
        </p>
      ) : levando ? (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-soft">
          <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-primary" />
          Levando para o funil <strong className="font-semibold text-ink">{levando.nome}</strong>…
        </p>
      ) : aviso || confirmacao ? (
        <p
          role="status"
          className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] ${confirmacao && !aviso ? 'border-emerald-300/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-line bg-surface text-soft'}`}
        >
          {confirmacao && !aviso && (
            <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          )}
          {aviso ?? confirmacao}
        </p>
      ) : null}

      <Alternador
        rotulo="Seções do negócio"
        className="mb-4"
        ativa={aba}
        aoEscolher={setAba}
        opcoes={[
          { chave: 'geral', rotulo: 'Visão geral' },
          { chave: 'historico', rotulo: 'Histórico', contagem: historico.length },
        ]}
      />

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
                    {negocio.fechadoEm && ` em ${dataEHora(negocio.fechadoEm, agora)}`}
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

            {/*
              As anotações moram num cartão delas, da mais nova para a mais
              antiga, e não no histórico recente: anotação é o que a equipe
              sabe do negócio, o histórico é o que aconteceu com ele. Escrever
              é pelo "Anotar" do cabeçalho, num modal.
            */}
            <Cartao
              titulo="Anotações"
              acao={
                anotacoes.length > 0 && (
                  <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setAnotando(true)}>
                    + Anotar
                  </button>
                )
              }
            >
              {anotacoes.length === 0 ? (
                <VazioDoCartao className="" ilustracao={<IlustracaoAnotacoes />}>
                  Nenhuma anotação neste negócio ainda. Use o Anotar no alto para guardar o que a
                  equipe precisa saber; fica com a data e o nome de quem escreveu.
                </VazioDoCartao>
              ) : (
                <ol className="flex flex-col gap-2" aria-label="Anotações do negócio">
                  {anotacoes.map((nota) => (
                    <li key={nota.id} className={`crm-nota rounded-[10px] border px-2.5 py-2 ${nota.pendente ? 'opacity-60' : ''}`}>
                      <p className="text-[12.5px] leading-5 whitespace-pre-line text-soft">{nota.frase}</p>
                      <p className="mt-1 text-[11px] text-dim">
                        {nota.autor ?? 'Alguém da equipe'} · {dataEHora(nota.quando)}
                        {nota.pendente && <span className="ml-1">· guardando…</span>}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Cartao>

            <Cartao
              titulo="Histórico recente"
              acao={
                semNotas.length > 5 && (
                  <button type="button" className="text-[12px] font-semibold text-primary hover:underline" onClick={() => setAba('historico')}>
                    Ver tudo
                  </button>
                )
              }
            >
              <LinhaDoTempo itens={semNotas.slice(0, 5)} agora={agora} />
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
                <Campo rotulo="Qualificação">
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
                  <span className="text-soft tabular-nums">{negocio.criadoEm ? dataEHora(negocio.criadoEm, agora) : '·'}</span>
                </Campo>
                <Campo rotulo="Última alteração">
                  <span className="text-soft tabular-nums">
                    {historico[0]
                      ? dataEHoraComRelativo(historico[0].quando, agora)
                      : negocio.criadoEm
                        ? dataEHora(negocio.criadoEm, agora)
                        : '·'}
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
              <Link href={conversa} className="botao-primario botao-md mt-3 flex w-full">
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
                <ul className="flex flex-col gap-3">
                  {atividades.map((a) => {
                    const status = statusDaAtividade({ prazo: a.prazo, situacao: 'aberta' }, agora)
                    return (
                      <li key={a.id} className="flex items-start gap-2.5">
                        <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-surface text-muted" title={NOME_DO_TIPO[a.tipo]}>
                          <IconeDoTipo tipo={a.tipo} className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold">{a.titulo}</span>
                          <span className={`block text-[11px] tabular-nums ${status === 'atrasada' ? 'font-semibold text-perigo' : 'text-dim'}`}>
                            {rotuloDoPrazo(a, agora)}
                          </span>
                        </span>
                        <SeloDoStatus status={status} compacto className="mt-0.5" />
                      </li>
                    )
                  })}
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

      <Modal
        aberto={anotando}
        aoFechar={() => setAnotando(false)}
        titulo="Anotar no negócio"
        descricao="Fica nas Anotações deste negócio e na ficha da pessoa, com a data e o seu nome. Nada é enviado ao cliente."
      >
        {anotando && (
          <NovaAnotacao
            inicial={rascunho}
            aoCancelar={() => setAnotando(false)}
            aoAnotar={(texto) => {
              setRascunho('')
              setAnotando(false)
              anotar(texto, (devolvido) => {
                setRascunho(devolvido)
                setAnotando(true)
              })
            }}
          />
        )}
      </Modal>

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
    return <p className="text-[12px] leading-5 text-dim">O que acontecer com este negócio aparece aqui: etapas, atividades, mudanças.</p>
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
              {item.pendente ? (
                'salvando…'
              ) : (
                <time dateTime={item.quando} className="tabular-nums">
                  {dataEHoraComRelativo(item.quando, agora)}
                </time>
              )}
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
      <Alternador
        rotulo="Filtrar histórico"
        className="alternador-sm mb-5 max-w-full overflow-x-auto"
        ativa={filtro}
        aoEscolher={aoFiltrar}
        opcoes={FILTROS_DO_HISTORICO.map((f) => ({ chave: f, rotulo: NOME_DO_FILTRO[f], contagem: contagem(f) }))}
      />
      {visiveis.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-dim">Nada deste tipo ainda.</p>
      ) : (
        <LinhaDoTempo itens={visiveis} agora={agora} />
      )}
    </section>
  )
}

function NovaAnotacao({
  inicial,
  aoAnotar,
  aoCancelar,
}: {
  inicial: string
  aoAnotar: (texto: string) => void
  aoCancelar: () => void
}) {
  const [texto, setTexto] = useState(inicial)
  const limpo = texto.trim()

  function enviar() {
    if (limpo) aoAnotar(limpo)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
      className="flex flex-col gap-3"
    >
      <textarea
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            enviar()
          }
        }}
        maxLength={LIMITE_DA_NOTA}
        rows={4}
        aria-label="Nova anotação sobre o negócio"
        placeholder="Exemplo: pediu desconto à vista, retornar na sexta."
        className="app-field min-h-[104px] resize-y px-3 py-2 text-[13px] leading-5"
      />
      <span className="flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className="botao-secundario botao-md">
          Cancelar
        </button>
        <button type="submit" disabled={!limpo} className="botao-primario botao-md">
          Salvar anotação
        </button>
      </span>
    </form>
  )
}

/** O título no lugar: clicar vira campo, Enter grava, Esc desiste. */
/**
 * O título, com o lápis ao lado que abre um modal pequeno: o mesmo gesto do
 * nome na ficha do contato. Antes o próprio título virava um campo do tamanho
 * da linha ao clicar, e um "editar" aparecia no hover desbotando o título.
 *
 * O título provisório (gerado do nome do contato) sai em branco como os
 * outros: desbotado sobre o azul, ele parecia desabilitado.
 */
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

  return (
    <>
      <h1 className="flex flex-wrap items-center gap-2 text-[21px] font-bold tracking-[-0.02em] text-ink">
        <span className="min-w-0 break-words">{provisorio ?? titulo}</span>
        <button
          type="button"
          onClick={() => {
            setTexto(titulo)
            setEditando(true)
          }}
          title="Editar o título"
          aria-label="Editar o título"
          className="grid size-7 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:border-primary/40 hover:text-primary"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
            <path
              d="M11.2 2.3a1.4 1.4 0 0 1 2 2l-6.6 6.6-2.7.7.7-2.7 6.6-6.6ZM10 3.6l2.4 2.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h1>
      <Modal aberto={editando} aoFechar={() => setEditando(false)} titulo="Título do negócio">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setEditando(false)
            if (texto.trim() !== titulo) aoSalvar(texto.trim())
          }}
        >
          <input
            autoFocus
            value={texto}
            maxLength={LIMITE_DO_TITULO}
            onChange={(e) => setTexto(e.currentTarget.value)}
            aria-label="Título do negócio"
            placeholder="Exemplo: Plano anual com 2 aulas por semana"
            className="app-field px-3 py-2 text-[13.5px]"
          />
          <span className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className="botao-secundario botao-md">
              Cancelar
            </button>
            <button type="submit" className="botao-primario botao-md">
              Salvar
            </button>
          </span>
        </form>
      </Modal>
    </>
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
        {inputMode === 'decimal' ? (
          <CampoDeDinheiro
            autoFocus
            valor={texto}
            aoMudar={(novo) => {
              setTexto(novo)
              setErro(null)
            }}
            onBlur={gravar}
            onKeyDown={(e) => {
              if (e.key === 'Enter') gravar()
              if (e.key === 'Escape') setEditando(false)
            }}
            aria-label={rotulo}
            placeholder="0,00"
            className="app-field h-8 px-2.5 text-[13px]"
          />
        ) : (
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
        )}
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
          className="botao-primario botao-md mt-1 w-full"
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
