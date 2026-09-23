'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { SeletorDePessoa } from './seletor-de-pessoa'
import { paraParametros, type FiltroDaAgenda } from '@/core/atividades'
import {
  acaoBuscarContatosParaAtividade,
  acaoCriarAtividade,
  acaoNegociosParaAtividade,
  type ContatoParaAtividade,
  type NegocioParaAtividade,
} from '@/server/acoes-atividades'
import {
  CamposDaAtividade,
  pedidoDosCampos,
  VALORES_VAZIOS,
  type ValoresDaAtividade,
} from './campos-da-atividade'

/** Quanto esperar a pessoa parar de digitar antes de buscar contato. */
const ESPERA_DA_BUSCA = 250

/** Quanto tempo o aviso de "criada" fica na tela. */
const DURACAO_DO_AVISO = 8000

type Criada = { id: string; prazo: string | null; horaMarcada: boolean; contatoId: string; responsavelId: string }

/**
 * "Nova atividade" pela agenda (plano de UX de 23/09, tarefa 1.5).
 *
 * Na ficha e no Inbox o contato já está escolhido; aqui ele é a primeira
 * pergunta. Depois vêm os mesmos campos do Inbox (`CamposDaAtividade`) e a
 * mesma `acaoCriarAtividade`: não existe segunda regra de criação.
 *
 * Ao salvar, os filtros ficam como estavam. Se a atividade nova não couber
 * neles (outro dia, outro responsável, outra página), o aviso diz isso e leva
 * até ela; uma criação que some sem explicação parece que não aconteceu.
 */
export function NovaAtividade({
  clienteId,
  usuarioId,
  equipe,
  podeAtribuir,
  base,
  filtro,
  idsNaTela,
}: {
  clienteId: string
  usuarioId: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
  base: string
  filtro: FiltroDaAgenda
  idsNaTela: string[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [criada, setCriada] = useState<Criada | null>(null)
  const [atualizando, atualizar] = useTransition()

  useEffect(() => {
    if (!criada || atualizando) return
    const relogio = setTimeout(() => setCriada(null), DURACAO_DO_AVISO)
    return () => clearTimeout(relogio)
  }, [criada, atualizando])

  const apareceu = criada !== null && idsNaTela.includes(criada.id)
  const ver =
    criada &&
    `${base}?${paraParametros({
      ...filtro,
      situacao: 'aberta',
      recorte: null,
      busca: '',
      tipo: null,
      responsavel: criada.responsavelId === usuarioId ? null : criada.responsavelId,
      alcance: criada.responsavelId === usuarioId ? 'minhas' : 'equipe',
      pagina: 1,
    }).toString()}`

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="app-primary-button ml-auto shrink-0 px-3.5 py-2 text-[12.5px] md:px-4"
      >
        + Nova atividade
      </button>

      {aberto && (
        <DialogoDeNovaAtividade
          clienteId={clienteId}
          usuarioId={usuarioId}
          equipe={equipe}
          podeAtribuir={podeAtribuir}
          aoFechar={() => setAberto(false)}
          aoCriar={(nova) => {
            setCriada(nova)
            atualizar(() => router.refresh())
          }}
        />
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {criada && !atualizando && (
          <div className="pointer-events-auto flex max-w-[560px] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-ink px-4 py-2.5 text-[12.5px] text-white shadow-lg">
            {apareceu ? (
              <span>Atividade criada.</span>
            ) : (
              <>
                <span>
                  Atividade criada {paraQuando(criada)}. Ela não aparece com os filtros atuais.
                </span>
                {ver && (
                  <Link href={ver} className="font-bold text-primary-weak underline underline-offset-2">
                    Ver
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function paraQuando(c: Criada): string {
  if (c.prazo === null) return 'sem prazo'
  const data = new Date(c.prazo)
  const dia = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (!c.horaMarcada) return `para ${dia}`
  return `para ${dia} às ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function DialogoDeNovaAtividade({
  clienteId,
  usuarioId,
  equipe,
  podeAtribuir,
  aoFechar,
  aoCriar,
}: {
  clienteId: string
  usuarioId: string
  equipe: { id: string; nome: string }[]
  podeAtribuir: boolean
  aoFechar: () => void
  aoCriar: (criada: Criada) => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const abriu = useRef(false)
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pedidoDaBusca = useRef(0)

  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<ContatoParaAtividade[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [contato, setContato] = useState<ContatoParaAtividade | null>(null)
  const [negocios, setNegocios] = useState<NegocioParaAtividade[]>([])
  const [negocio, setNegocio] = useState('')
  const [valores, setValores] = useState<ValoresDaAtividade>(VALORES_VAZIOS)
  const [responsavel, setResponsavel] = useState(usuarioId)
  const [escolhendoResponsavel, setEscolhendoResponsavel] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  function buscar(texto: string) {
    setTermo(texto)
    if (espera.current) clearTimeout(espera.current)
    if (texto.trim().length < 2) {
      setAchados(null)
      setBuscando(false)
      return
    }
    setBuscando(true)
    const este = ++pedidoDaBusca.current
    espera.current = setTimeout(async () => {
      const r = await acaoBuscarContatosParaAtividade(clienteId, texto)
      // Só a resposta da última busca vale: uma lenta que chega depois da
      // rápida mostraria o resultado de um termo que já foi apagado.
      if (este !== pedidoDaBusca.current) return
      setBuscando(false)
      setAchados(r.ok ? (r.contatos ?? []) : [])
      if (!r.ok) setErro(r.erro ?? 'não deu para buscar')
    }, ESPERA_DA_BUSCA)
  }

  async function escolher(escolhido: ContatoParaAtividade) {
    setContato(escolhido)
    setNegocio('')
    setNegocios([])
    const r = await acaoNegociosParaAtividade(clienteId, escolhido.contatoId)
    if (r.ok) setNegocios(r.negocios ?? [])
  }

  function trocarContato() {
    setContato(null)
    setNegocios([])
    setNegocio('')
  }

  function criar() {
    if (!contato || valores.titulo.trim() === '') return
    setErro(null)
    comecar(async () => {
      const r = await acaoCriarAtividade(clienteId, {
        contatoId: contato.contatoId,
        cartaoId: negocio || null,
        responsavelId: responsavel,
        ...pedidoDosCampos(valores),
      })
      if (!r.ok || !r.criada) {
        setErro(r.erro ?? 'não deu para criar')
        return
      }
      aoCriar({
        id: r.criada.id,
        prazo: r.criada.prazo,
        horaMarcada: pedidoDosCampos(valores).hora ? true : false,
        contatoId: contato.contatoId,
        responsavelId: responsavel,
      })
      dialogo.current?.close()
    })
  }

  const mostrarResponsavel = podeAtribuir && equipe.length > 1
  const nomeDoResponsavel = rotuloDaPessoa(equipe.find((m) => m.id === responsavel), usuarioId)

  return (
    <dialog
      ref={(no) => {
        dialogo.current = no
        // Montado só quando é para abrir; fechar desmonta. Uma vez só.
        if (no && !abriu.current) {
          abriu.current = true
          no.showModal()
        }
      }}
      aria-labelledby="titulo-nova-atividade"
      onClose={aoFechar}
      onClick={(evento) => {
        if (evento.target === dialogo.current) dialogo.current?.close()
      }}
      className="app-dialog m-auto w-[480px] max-w-[calc(100vw-32px)] rounded-[18px] border border-line bg-panel p-6 text-ink shadow-[0_40px_100px_rgba(19,25,34,0.132)]"
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          criar()
        }}
        className="flex flex-col gap-2.5"
      >
        <h2 id="titulo-nova-atividade" className="text-[16px] font-bold">
          Nova atividade
        </h2>

        <span className="mt-1 text-[11.5px] font-medium text-muted">Contato</span>
        {contato ? (
          <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{contato.nome}</p>
              <p className="truncate text-[11.5px] text-dim">{contato.telefone}</p>
            </div>
            <button type="button" onClick={trocarContato} className="text-[12px] font-semibold text-primary hover:underline">
              Trocar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              type="search"
              value={termo}
              onChange={(evento) => buscar(evento.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar contato"
              autoFocus
              className="app-field w-full px-3 py-2.5 text-[13px]"
            />
            <ResultadoDaBusca termo={termo} buscando={buscando} achados={achados} aoEscolher={escolher} />
          </div>
        )}

        {contato && (
          <>
            <span className="mt-2 text-[11.5px] font-medium text-muted">O que fazer</span>
            <CamposDaAtividade valores={valores} aoMudar={setValores} tituloComFoco />

            {(mostrarResponsavel || negocios.length > 0) && (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                {mostrarResponsavel && (
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-[11.5px] font-medium text-muted">Responsável</span>
                    <button
                      type="button"
                      onClick={() => setEscolhendoResponsavel(true)}
                      aria-label={`Responsável: ${nomeDoResponsavel}. Trocar`}
                      className="app-field flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{nomeDoResponsavel}</span>
                      <span className="text-[12px] font-semibold text-primary">Trocar</span>
                    </button>
                  </div>
                )}
                {negocios.length > 0 && (
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-[11.5px] font-medium text-muted">Negócio (opcional)</span>
                    <Dropdown
                      rotuloAcessivel="Negócio"
                      valor={negocio}
                      aoMudar={setNegocio}
                      opcoes={[
                        { valor: '', rotulo: 'Nenhum' },
                        ...negocios.map((n) => ({ valor: n.cartaoId, rotulo: n.rotulo, detalhe: n.detalhe })),
                      ]}
                    />
                  </label>
                )}
              </div>
            )}
          </>
        )}

        {escolhendoResponsavel && (
          <SeletorDePessoa
            titulo="Responsável pela atividade"
            pessoas={equipe.map((m) => ({ id: m.id, nome: rotuloDaPessoa(m, usuarioId) }))}
            atual={responsavel}
            aoEscolher={setResponsavel}
            aoFechar={() => setEscolhendoResponsavel(false)}
          />
        )}

        {erro && (
          <span role="alert" className="text-[12px] font-semibold text-perigo">
            {erro}
          </span>
        )}

        <p className="mt-1 border-t border-line pt-3 text-[11.5px] leading-4 text-dim">
          É um lembrete para a equipe. <strong>Nada é enviado ao cliente.</strong>
        </p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={rodando || !contato || valores.titulo.trim() === ''}
            className="app-primary-button flex-[1.3] px-4 py-2.5 text-[13px] disabled:opacity-50"
          >
            {rodando ? 'Criando…' : 'Criar atividade'}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function rotuloDaPessoa(pessoa: { id: string; nome: string } | undefined, usuarioId: string): string {
  if (!pessoa) return 'Você'
  return pessoa.id === usuarioId ? `${pessoa.nome} (você)` : pessoa.nome
}

function ResultadoDaBusca({
  termo,
  buscando,
  achados,
  aoEscolher,
}: {
  termo: string
  buscando: boolean
  achados: ContatoParaAtividade[] | null
  aoEscolher: (contato: ContatoParaAtividade) => void
}) {
  if (termo.trim().length < 2) {
    return <p className="px-1 text-[11.5px] text-dim">Digite pelo menos 2 letras ou números.</p>
  }
  if (buscando && achados === null) return <p className="px-1 text-[11.5px] text-dim">Buscando…</p>
  if (!achados || achados.length === 0) {
    return <p className="px-1 text-[11.5px] text-dim">Nenhum contato com esse nome ou telefone.</p>
  }
  return (
    <ul aria-label="Contatos encontrados" className="max-h-[240px] overflow-y-auto rounded-[10px] border border-line">
      {achados.map((c) => (
        <li key={c.contatoId} className="border-b border-line last:border-b-0">
          <button
            type="button"
            onClick={() => aoEscolher(c)}
            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-surface focus-visible:bg-surface"
          >
            <span className="text-[13px] font-semibold">{c.nome}</span>
            <span className="text-[11.5px] text-dim">{c.telefone}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
