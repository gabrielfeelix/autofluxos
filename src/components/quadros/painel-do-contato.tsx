'use client'

import Link from 'next/link'
import { hrefDaFicha } from '@/core/volta-da-ficha'
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
import { comoDinheiro } from '@/core/crm'
import {
  IconeDaSecao,
  iconeEtiqueta,
  iconeFicha,
  iconeFunil,
  iconeLapis,
  iconeLinhaDoTempo,
  iconeRelogio,
} from '@/components/lead-crm/icones'
import { comoParado, type Temperatura } from '@/core/quadros'
import { LinhaDoTempo, agruparEventos } from '@/components/lead-crm/linha-do-tempo'
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
  volta,
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
  /** O funil aberto, para a ficha voltar para ele. */
  volta?: string
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
  const grupos = agruparEventos(dados?.eventos ?? [])

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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {/* Tudo o que é da negociação mora num cartão só, o único em destaque:
            os dados do contato, embaixo, são consulta; aqui é onde se age. */}
        <section className="crm-opportunity">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {dados || falhou ? (
              <span className="crm-eyebrow">{funil?.quadro ?? 'Oportunidade'}</span>
            ) : (
              <span className="h-3 w-28 animate-pulse rounded bg-surface-strong" />
            )}
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
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            {aoMover && etapas.length > 0 ? (
              <div className="crm-field">
                <span className="flex items-baseline justify-between gap-3">
                  Etapa no funil
                  <span className="text-[10.5px] font-normal text-dim">
                    {comoParado(cartao.entrouNaColunaEm)} nesta etapa
                  </span>
                </span>
                <Dropdown
                  rotuloAcessivel="Etapa no funil"
                  valor={cartao.colunaId}
                  desabilitado={movendo}
                  aoMudar={aoMover}
                  opcoes={etapas.map((etapa) => ({ valor: etapa.id, rotulo: etapa.nome }))}
                />
              </div>
            ) : (
              <div>
                <p className="text-xs font-medium">{etapaNome ?? funil?.etapa ?? 'No funil'}</p>
                <p className="mt-1 text-[10.5px] text-dim">
                  {comoParado(cartao.entrouNaColunaEm)} nesta etapa
                </p>
              </div>
            )}
            {erroDeMovimento && (
              <p role="alert" className="-mt-2 text-xs text-perigo">
                {erroDeMovimento}
              </p>
            )}
            <div className="crm-field">
              <span>Temperatura</span>
              <TemperaturaDaOportunidade
                clienteId={clienteId}
                cartaoId={cartao.id}
                temperatura={cartao.temperatura ?? null}
              />
            </div>
            <div className="crm-field">
              <span>Produto ou serviço de interesse</span>
              <InteresseDaOportunidade
                clienteId={clienteId}
                cartaoId={cartao.id}
                produtoId={cartao.produtoId ?? null}
                produtoNome={cartao.produtoNome ?? null}
              />
            </div>
          </div>
          {aberta && (
            <div className="mt-5 flex gap-2">
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
          <div role="alert" className="crm-folha">
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
          <EsqueletoDoPainel />
        ) : (
          /* Uma folha só, com as seções separadas por linha: cinco cartões
             brancos iguais diziam que tudo pesava o mesmo. */
          <div className="crm-folha">
            <Secao titulo="Contato" icone={iconeFicha}>
              <dl className="crm-props">
                <div>
                  <dt>Estágio</dt>
                  <dd>
                    <EstagioDoContato
                      clienteId={clienteId}
                      contatoId={contatoId}
                      estagio={ficha.estagio}
                      expandido
                    />
                  </dd>
                </div>
                <div>
                  <dt>Responsável</dt>
                  <dd>
                    <ResponsavelDoContato
                      clienteId={clienteId}
                      contatoId={contatoId}
                      equipe={dados?.equipe ?? []}
                      responsavelId={ficha.atribuidoA}
                      expandido
                    />
                  </dd>
                </div>
                <div>
                  <dt>Contato desde</dt>
                  <dd title={horaExata(ficha.criadoEm)}>{quando(ficha.criadoEm)}</dd>
                </div>
                <div>
                  <dt>Última interação</dt>
                  <dd title={ficha.ultimaEntradaEm ? horaExata(ficha.ultimaEntradaEm) : undefined}>
                    {ficha.ultimaEntradaEm ? quando(ficha.ultimaEntradaEm) : 'Ainda não escreveu'}
                  </dd>
                </div>
                {origem && (
                  <div>
                    <dt>Origem</dt>
                    <dd>{origem.titulo || origem.nome}</dd>
                  </div>
                )}
                {resumo && resumo.compras !== null && resumo.compras > 0 && (
                  <div>
                    <dt>Compras</dt>
                    <dd>
                      <span className="font-semibold text-ok tabular-nums">
                        {comoDinheiro(resumo.total)}
                      </span>
                      <span className="text-dim">
                        {' '}
                        · {resumo.compras} {resumo.compras === 1 ? 'compra' : 'compras'}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </Secao>
            {dados && dados.agendadas.length > 0 && (
              <Secao titulo="Mensagens agendadas" icone={iconeRelogio} tom="primary">
                <ul className="space-y-3">
                  {dados.agendadas.map((a) => (
                    <li key={a.id} className="rounded-[10px] bg-surface px-3 py-2">
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
            <Secao titulo="Etiquetas" icone={iconeEtiqueta}>
              <SeletorDeEtiquetas
                clienteId={clienteId}
                contatoId={contatoId}
                disponiveis={dados?.etiquetas ?? []}
                aplicadas={dados?.aplicadas ?? []}
                compacto
              />
            </Secao>
            <Secao titulo="Anotações da equipe" icone={iconeLapis} tom="aviso">
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
                <ListaDeAnotacoes
                  tom="nota"
                  vazio="Registre preferências e combinados importantes para o próximo atendimento."
                />
              </ProvedorDeAnotacoes>
            </Secao>
            {dados && dados.funis.length > 1 && (
              <Secao titulo="Outros funis" icone={iconeFunil}>
                <ul className="space-y-2">
                  {dados.funis
                    .filter((f) => f.cartaoId !== cartao.id)
                    .map((f) => (
                      <li
                        key={f.cartaoId}
                        className="flex items-center justify-between gap-3 rounded-[10px] bg-surface px-3 py-2 text-xs"
                      >
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
              <Secao titulo="Histórico recente" icone={iconeLinhaDoTempo}>
                {grupos.length === 0 ? (
                  <p className="text-xs leading-5 text-muted">
                    As próximas movimentações deste contato aparecerão aqui.
                  </p>
                ) : (
                  <LinhaDoTempo grupos={historicoCompleto ? grupos : grupos.slice(0, 5)} />
                )}
                {grupos.length > 5 && (
                  <button
                    type="button"
                    className="crm-edit mt-3"
                    onClick={() => setHistoricoCompleto((v) => !v)}
                  >
                    {historicoCompleto ? 'Mostrar menos' : `Ver mais ${grupos.length - 5} registros`}
                  </button>
                )}
              </Secao>
            )}
          </div>
        )}
      </div>
      {/* O diálogo é o gesto rápido; a página é onde se trabalha o negócio (F2). */}
      <footer className="flex shrink-0 gap-2 border-t border-line bg-panel px-5 py-4 sm:px-6">
        <Link
          href={`/clientes/${clienteId}/negocios/${cartao.id}`}
          className="botao-primario botao-md flex flex-1"
        >
          Detalhes do negócio
        </Link>
        <Link
          href={hrefDaFicha(clienteId, contatoId, { volta })}
          className="botao-secundario botao-md flex flex-1"
        >
          Ficha do contato
        </Link>
      </footer>
    </dialog>
  )
}
function Secao({
  titulo,
  icone,
  tom,
  children,
}: {
  titulo: string
  icone: ReactNode
  tom?: 'neutro' | 'primary' | 'aviso'
  children: ReactNode
}) {
  return (
    <section className="crm-folha-secao">
      <h3 className="crm-folha-titulo">
        <IconeDaSecao tom={tom}>{icone}</IconeDaSecao>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/** Mesmo desenho do que chega, para nada pular quando os dados entram. */
function EsqueletoDoPainel() {
  const barra = 'animate-pulse rounded bg-surface-strong'
  return (
    <div role="status" aria-label="Carregando dados do contato" className="crm-folha">
      <section className="crm-folha-secao">
        <div className={`mb-4 h-3 w-20 ${barra}`} />
        <div className="space-y-3">
          {[24, 28, 20, 24].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-3 w-24 shrink-0 ${barra}`} />
              <div className={`h-3 ${barra}`} style={{ width: `${w * 4}px` }} />
            </div>
          ))}
        </div>
      </section>
      <section className="crm-folha-secao">
        <div className={`mb-4 h-3 w-20 ${barra}`} />
        <div className="flex gap-1.5">
          <div className={`h-5 w-20 ${barra} rounded-full`} />
          <div className={`h-5 w-16 ${barra} rounded-full`} />
          <div className={`h-5 w-14 ${barra} rounded-full`} />
        </div>
      </section>
      <section className="crm-folha-secao">
        <div className={`mb-4 h-3 w-36 ${barra}`} />
        <div className={`h-9 ${barra} rounded-lg`} />
        <div className={`mt-2 h-14 ${barra} rounded-lg`} />
      </section>
      <section className="crm-folha-secao">
        <div className={`mb-4 h-3 w-28 ${barra}`} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-3 flex gap-3">
            <div className={`size-6 shrink-0 ${barra} rounded-full`} />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className={`h-3 w-40 ${barra}`} />
              <div className={`h-2.5 w-20 ${barra}`} />
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
