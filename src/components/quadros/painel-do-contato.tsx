'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dropdown } from '@/components/design/dropdown'
import { Avatar } from '@/components/inbox/avatar'
import { EstagioDoContato } from '@/components/lead-crm/estagio-do-contato'
import { ResponsavelDoContato } from '@/components/lead-crm/responsavel-do-contato'
import { EditarTextoDoContato, DetalhesDaOportunidade } from '@/components/lead-crm/editores'
import { EntradaDeAnotacao, ListaDeAnotacoes, ProvedorDeAnotacoes } from '@/components/inbox/anotacoes'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { TemperaturaDaOportunidade } from './temperatura-da-oportunidade'
import { InteresseDaOportunidade } from './interesse-da-oportunidade'
import { SeletorDeEtiquetas } from '@/components/etiquetas/seletor'
import { comoDinheiro, comoFrase } from '@/core/crm'
import { comoParado, type Temperatura } from '@/core/quadros'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { origemDoContato } from '@/core/contatos/origem'
import { horaExata, quando } from '@/lib/quando'
import { acaoAbrirPainelDoContato, acaoAnotar } from '@/server/acoes-crm'

type CartaoDoPainel = {
  id: string
  colunaId?: string
  nome: string
  telefone: string
  entrouNaColunaEm: string
  titulo?: string | null
  valor?: number | null
  situacao?: string
  temperatura?: Temperatura | null
  produtoId?: string | null
  produtoNome?: string | null
}

/** Dados sob demanda. O diálogo mantém o quadro e a posição de rolagem atrás dele. */
export function PainelDoContato({
  clienteId,
  contatoId,
  cartao,
  etapaNome,
  etapas = [],
  aoMover,
  movendo = false,
  erroDeMovimento,
  aoFechar,
  aoGanharOuPerder,
  aoAtualizarCartao,
}: {
  clienteId: string
  contatoId: string | null
  cartao: CartaoDoPainel | null
  etapaNome?: string
  etapas?: { id: string; nome: string }[]
  aoMover?: (colunaId: string) => void
  movendo?: boolean
  erroDeMovimento?: string | null
  aoFechar: () => void
  aoGanharOuPerder: (situacao: 'ganha' | 'perdida') => void
  aoAtualizarCartao?: (dados: Partial<Pick<CartaoDoPainel, 'nome' | 'titulo' | 'valor'>>) => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [dados, setDados] = useState<Awaited<ReturnType<typeof acaoAbrirPainelDoContato>> | null>(
    null,
  )
  const [falhou, setFalhou] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [historicoCompleto, setHistoricoCompleto] = useState(false)
  const [nomeEditado, setNomeEditado] = useState<string | null>(null)

  useEffect(() => {
    if (contatoId && !dialogo.current?.open) dialogo.current?.showModal()
  }, [contatoId])

  useEffect(() => {
    if (!contatoId) return
    let atual = true
    acaoAbrirPainelDoContato(clienteId, contatoId)
      .then((r) => {
        if (atual) {
          setDados(r)
          setFalhou(!r.ficha)
        }
      })
      .catch(() => {
        if (atual) setFalhou(true)
      })
    return () => {
      atual = false
    }
  }, [clienteId, contatoId, tentativa])

  if (!contatoId || !cartao) return null
  const ficha = dados?.ficha
  const nome = nomeEditado ?? ficha?.nome ?? cartao.nome
  const resumo = dados?.resumo
  const funil = dados?.funis.find((item) => item.cartaoId === cartao.id)
  const aberta = !cartao.situacao || cartao.situacao === 'aberta'
  const origem = ficha ? origemDoContato(ficha.campos) : null
  const eventos = historicoCompleto ? dados?.eventos : dados?.eventos.slice(0, 5)

  return (
    <dialog
      ref={dialogo}
      aria-label={`Perfil de ${nome}`}
      className="crm-drawer"
      onCancel={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault()
          aoFechar()
        }
      }}
      onClose={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            aoFechar()
        }
      }}
    >
      <header className="shrink-0 border-b border-line bg-panel px-5 py-5 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="crm-eyebrow">Contato · Visão rápida</span>
          <button
            type="button"
            autoFocus
            aria-label="Fechar painel"
            onClick={aoFechar}
            className="crm-icon-button"
          >
            ×
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Avatar nome={nome} tamanho={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h2 className="min-w-0 flex-1 break-words text-[20px] leading-tight font-semibold tracking-[-0.025em]">
                {nome}
              </h2>
              <EditarTextoDoContato
                clienteId={clienteId}
                contatoId={contatoId}
                tipo="nome"
                valor={nome}
                aoSalvar={(valor) => {
                  setNomeEditado(valor)
                  aoAtualizarCartao?.({ nome: valor })
                }}
              />
            </div>
            <a
              href={`tel:+${cartao.telefone}`}
              className="mt-1 inline-block text-xs text-muted hover:text-primary"
            >
              {telefoneLegivel(cartao.telefone)}
            </a>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        <section className="crm-opportunity">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="crm-eyebrow">{funil?.quadro ?? 'Oportunidade'}</span>
            <span
              className={`crm-badge ml-auto ${aberta ? 'text-primary' : cartao.situacao === 'ganha' ? 'text-ok' : 'text-perigo'}`}
            >
              {aberta ? 'Em aberto' : cartao.situacao === 'ganha' ? 'Ganha' : 'Perdida'}
            </span>
          </div>
          <DetalhesDaOportunidade
            key={`${cartao.id}:${cartao.titulo}:${cartao.valor}`}
            clienteId={clienteId}
            cartaoId={cartao.id}
            titulo={cartao.titulo ?? null}
            valor={cartao.valor ?? null}
            aoSalvar={aoAtualizarCartao}
          />
          <div className="mt-4 border-t border-line pt-3">
            {aoMover && etapas.length > 0 ? (
              <div className="crm-field">
                <span>Etapa no funil</span>
                <Dropdown
                  rotuloAcessivel="Etapa no funil"
                  valor={cartao.colunaId}
                  desabilitado={movendo}
                  aoMudar={aoMover}
                  opcoes={etapas.map((etapa) => ({ valor: etapa.id, rotulo: etapa.nome }))}
                />
              </div>
            ) : (
              <p className="text-xs font-medium">{etapaNome ?? funil?.etapa ?? 'No funil'}</p>
            )}
            <p className="mt-2 text-[11px] text-muted">
              {comoParado(cartao.entrouNaColunaEm)} nesta etapa
            </p>
            {erroDeMovimento && (
              <p role="alert" className="mt-2 text-xs text-perigo">
                {erroDeMovimento}
              </p>
            )}
          </div>
          {aberta && (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => aoGanharOuPerder('ganha')}
                className="crm-button flex-1 border-emerald-500/25 text-ok"
              >
                Marcar como ganha
              </button>
              <button
                type="button"
                onClick={() => aoGanharOuPerder('perdida')}
                className="crm-button flex-1"
              >
                Marcar como perdida
              </button>
            </div>
          )}
        </section>
        {falhou ? (
          <div role="alert" className="crm-section">
            <p className="text-sm text-muted">Não foi possível carregar os dados deste contato.</p>
            <button
              type="button"
              className="crm-button mt-3"
              onClick={() => {
                setFalhou(false)
                setTentativa((v) => v + 1)
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : !ficha ? (
          <div role="status" aria-label="Carregando dados do contato" className="space-y-3">
            <div className="h-4 w-32 animate-pulse rounded bg-surface-strong" />
            <div className="h-24 animate-pulse rounded-xl bg-surface" />
          </div>
        ) : (
          <>
            <Secao titulo="Qualificação da oportunidade">
              <div className="crm-field">
                <span>Temperatura</span>
                <TemperaturaDaOportunidade
                  clienteId={clienteId}
                  cartaoId={cartao.id}
                  temperatura={cartao.temperatura ?? null}
                />
              </div>
              <div className="crm-field mt-4">
                <span>Produto ou serviço de interesse</span>
                <InteresseDaOportunidade
                  clienteId={clienteId}
                  cartaoId={cartao.id}
                  produtoId={cartao.produtoId ?? null}
                  produtoNome={cartao.produtoNome ?? null}
                />
              </div>
            </Secao>
            <Secao titulo="Relacionamento">
              <div className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
                <div className="crm-field">
                  <span>Estágio do contato</span>
                  <EstagioDoContato
                    clienteId={clienteId}
                    contatoId={contatoId}
                    estagio={ficha.estagio}
                    expandido
                  />
                </div>
                <div className="crm-field">
                  <span>Responsável pelo contato</span>
                  <ResponsavelDoContato
                    clienteId={clienteId}
                    contatoId={contatoId}
                    equipe={dados?.equipe ?? []}
                    responsavelId={ficha.atribuidoA}
                    expandido
                  />
                </div>
              </div>
              <dl className="mt-4 space-y-3 border-t border-line pt-4">
                <Linha rotulo="Contato desde">{quando(ficha.criadoEm)}</Linha>
                <Linha rotulo="Última interação">
                  {ficha.ultimaEntradaEm ? quando(ficha.ultimaEntradaEm) : 'Ainda não escreveu'}
                </Linha>
                {origem && <Linha rotulo="Origem">{origem.titulo || origem.rotulo}</Linha>}
              </dl>
            </Secao>
            {dados && dados.agendadas.length > 0 && (
              <Secao titulo="Mensagens agendadas">
                <ul className="space-y-3">
                  {dados.agendadas.map((a) => (
                    <li key={a.id}>
                      <p
                        className={`text-xs font-medium ${a.estado === 'falhou' ? 'text-perigo' : 'text-primary'}`}
                      >
                        {a.estado === 'falhou' ? 'Falha no envio' : horaExata(a.quando)}
                      </p>
                      <p className="mt-1 text-xs text-muted line-clamp-2">{a.texto}</p>
                    </li>
                  ))}
                </ul>
              </Secao>
            )}
            <Secao titulo="Etiquetas">
              <SeletorDeEtiquetas
                clienteId={clienteId}
                contatoId={contatoId}
                disponiveis={dados?.etiquetas ?? []}
                aplicadas={dados?.aplicadas ?? []}
              />
            </Secao>
            <Secao titulo="Anotações da equipe">
              {/* A mesma lista do Inbox e da ficha (5.9): anotar aqui aparece lá. */}
              <ProvedorDeAnotacoes
                iniciais={dados?.anotacoes ?? []}
                antiga={ficha.notas}
                autor={dados?.autor ?? null}
                anotar={acaoAnotar.bind(null, clienteId, contatoId)}
              >
                <div className="mb-2">
                  <EntradaDeAnotacao limite={LIMITE_DA_NOTA} />
                </div>
                <ListaDeAnotacoes vazio="Registre preferências e combinados importantes para o próximo atendimento." />
              </ProvedorDeAnotacoes>
            </Secao>
          </>
        )}
        {resumo && resumo.compras !== null && resumo.compras > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Numero titulo="Total em compras" valor={comoDinheiro(resumo.total)} />
            <Numero titulo="Compras realizadas" valor={String(resumo.compras)} />
          </div>
        )}
        {dados && dados.funis.length > 1 && (
          <Secao titulo="Outros funis">
            <ul className="space-y-3">
              {dados.funis
                .filter((f) => f.cartaoId !== cartao.id)
                .map((f) => (
                  <li key={f.cartaoId} className="flex justify-between gap-3 text-xs">
                    <span className="font-medium">{f.quadro}</span>
                    <span className="text-muted">
                      {f.etapa} · {f.situacao === 'aberta' ? 'em aberto' : f.situacao}
                    </span>
                  </li>
                ))}
            </ul>
          </Secao>
        )}
        {dados && (
          <Secao titulo="Histórico recente">
            <ol className="space-y-4">
              {eventos?.map((evento) => (
                <li key={evento.id} className="relative border-l border-line pl-4">
                  <span className="absolute top-1.5 -left-[3px] size-[5px] rounded-full bg-primary/40" />
                  <p className="text-xs leading-5">{comoFrase(evento)}</p>
                  <p className="mt-1 text-[11px] text-dim">
                    {horaExata(evento.criadoEm)}
                    {evento.autor && ` · ${evento.autor}`}
                  </p>
                </li>
              ))}
            </ol>
            {dados.eventos.length === 0 && (
              <p className="text-xs leading-5 text-muted">
                As próximas movimentações deste contato aparecerão aqui.
              </p>
            )}
            {dados.eventos.length > 5 && (
              <button
                type="button"
                className="crm-edit mt-4"
                onClick={() => setHistoricoCompleto((v) => !v)}
              >
                {historicoCompleto
                  ? 'Mostrar menos'
                  : `Ver mais ${dados.eventos.length - 5} registros`}
              </button>
            )}
          </Secao>
        )}
      </div>
      <footer className="shrink-0 border-t border-line bg-panel px-5 py-4 sm:px-6">
        <Link
          href={`/clientes/${clienteId}/leads/${contatoId}`}
          className="crm-button w-full justify-between"
        >
          Ver ficha completa <span aria-hidden>↗</span>
        </Link>
      </footer>
    </dialog>
  )
}
function Secao({
  titulo,
  acao,
  children,
}: {
  titulo: string
  acao?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="crm-section">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="crm-section-title">{titulo}</h3>
        {acao}
      </header>
      {children}
    </section>
  )
}
function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <dt className="shrink-0 text-muted">{rotulo}</dt>
      <dd className="break-words text-right text-soft">{children}</dd>
    </div>
  )
}
function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="crm-section">
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 text-[11px] text-muted">{titulo}</p>
    </div>
  )
}
