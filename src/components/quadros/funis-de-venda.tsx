'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Modal } from '@/components/design/modal'
import { Dropdown } from '@/components/design/dropdown'
import { useConfirmar } from '@/components/design/confirmar'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { DivisoriaDoMenu, GrupoDoMenu, ItemDoMenu } from '@/components/design/menu-suspenso'
import {
  CLASSE_DA_COR,
  CORES_DA_ETAPA,
  LIMITE_DE_ETAPAS,
  LIMITE_DO_NOME,
  type CorDaEtapa,
  type TipoDeEtapa,
} from '@/core/quadros'
import {
  acaoApagarEtapa,
  acaoApagarQuadro,
  acaoCriarEtapaDireto,
  acaoDefinirQuadroPadrao,
  acaoMoverEtapa,
  acaoRenomearEtapa,
  acaoRenomearQuadro,
} from '@/server/acoes'
import {
  acaoCriarQuadroComModelo,
  acaoDefinirCorDaEtapa,
  acaoDefinirTipoDaEtapa,
  acaoEncadearQuadro,
} from '@/server/acoes-crm'

export type EtapaDoFunil = {
  id: string
  nome: string
  tipo: TipoDeEtapa
  limiteDeDias: number | null
  cor: CorDaEtapa | null
}

export type FunilDeVenda = {
  id: string
  nome: string
  padrao: boolean
  seguinteId: string | null
  etapas: EtapaDoFunil[]
}

type Resultado = { ok: boolean; erro?: string }

const NOME_DO_TIPO: Record<TipoDeEtapa, string> = {
  normal: 'Etapa comum',
  ganho: 'Fecha como ganho',
  perdido: 'Fecha como perdido',
}

/**
 * Configurações > Funis de venda: todos os funis da conta numa tela, com as
 * etapas em trilha, como o RD mostra. O quadro continua sendo onde se trabalha
 * (arrastar cartão); aqui é onde se monta o funil.
 *
 * **O que entrou do RD, e o que ficou de fora.** Renomear, marcar como padrão,
 * excluir, adicionar funil e configurar etapa já existiam no servidor e faltava
 * um lugar para eles. "Preferências do funil" virou o funil seguinte (para onde
 * o negócio ganho passa), que é a preferência que este produto tem. "Destacar
 * negociações esfriando" é o limite de dias da etapa, que já pinta o cartão
 * parado no quadro. "Equipes do funil" ficou de fora: a conta não tem equipe
 * por funil, e um interruptor que não muda nada é pior que nenhum.
 *
 * Otimista: renomear, cor e tipo mudam no clique; criar, mover e apagar pedem
 * a lista de novo ao servidor (`router.refresh`), porque precisam de id e ordem
 * que só ele sabe.
 */
export function FunisDeVenda({ clienteId, funis: doServidor }: { clienteId: string; funis: FunilDeVenda[] }) {
  const router = useRouter()
  const [funis, setFunis] = useState(doServidor)
  const [ultimo, setUltimo] = useState(doServidor)
  if (ultimo !== doServidor) {
    setUltimo(doServidor)
    setFunis(doServidor)
  }
  const [erro, setErro] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()

  const [criandoFunil, setCriandoFunil] = useState(false)
  const [renomeando, setRenomeando] = useState<FunilDeVenda | null>(null)
  const [novaEtapaEm, setNovaEtapaEm] = useState<FunilDeVenda | null>(null)
  const [configurando, setConfigurando] = useState<{ funil: FunilDeVenda; etapa: EtapaDoFunil } | null>(null)

  /** Muda na tela, grava por trás; se o servidor recusar, volta e diz por quê. */
  function otimista(novos: FunilDeVenda[], acao: () => Promise<Resultado>) {
    const antes = funis
    setErro(null)
    setFunis(novos)
    comecar(async () => {
      try {
        const r = await acao()
        if (!r.ok) throw new Error(r.erro)
      } catch (e) {
        setFunis(antes)
        setErro(e instanceof Error && e.message ? e.message : 'não deu para salvar')
      }
    })
  }

  /** Para o que precisa de id ou ordem do servidor. Devolve o erro, ou `null`. */
  async function eRecarrega(acao: () => Promise<Resultado>): Promise<string | null> {
    setErro(null)
    try {
      const r = await acao()
      if (!r.ok) return r.erro ?? 'não deu para salvar'
      router.refresh()
      return null
    } catch {
      return 'sem conexão com o servidor'
    }
  }

  const trocarFunil = (id: string, mudanca: Partial<FunilDeVenda>) =>
    funis.map((f) => (f.id === id ? { ...f, ...mudanca } : f))
  const trocarEtapa = (funilId: string, etapaId: string, mudanca: Partial<EtapaDoFunil>) =>
    funis.map((f) =>
      f.id === funilId ? { ...f, etapas: f.etapas.map((e) => (e.id === etapaId ? { ...e, ...mudanca } : e)) } : f,
    )

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="rounded-[10px] border border-perigo/30 bg-perigo/5 px-3 py-2 text-[12px] text-perigo">
          {erro}
        </p>
      )}

      {funis.map((funil) => {
        const seguinte = funis.find((f) => f.id === funil.seguinteId)
        return (
          <section key={funil.id} className="app-card overflow-hidden">
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-bold">{funil.nome}</h2>
              {funil.padrao && (
                <span
                  title="Contato novo entra neste funil sozinho"
                  className="rounded-full border border-primary/25 bg-primary/[0.07] px-2 py-0.5 text-[10.5px] font-bold text-primary"
                >
                  Padrão
                </span>
              )}
              {seguinte && (
                <span className="text-[11.5px] text-dim">Ganho passa para {seguinte.nome}</span>
              )}
              <span className="flex-1" />
              <Link
                href={`/clientes/${clienteId}/quadros?q=${funil.id}`}
                className="text-[12px] font-semibold text-muted transition hover:text-primary"
              >
                Abrir funil
              </Link>
              <PopoverDoQuadro
                rotulo={`Opções do funil ${funil.nome}`}
                largura={240}
                gatilho={
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
                    <circle cx="12" cy="5.5" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="12" cy="18.5" r="1.6" />
                  </svg>
                }
              >
                <GrupoDoMenu>
                  <ItemDoMenu aoEscolher={() => setRenomeando(funil)}>Renomear</ItemDoMenu>
                  <ItemDoMenu
                    ativo={funil.padrao}
                    aoEscolher={() =>
                      otimista(
                        funis.map((f) => ({ ...f, padrao: f.id === funil.id ? !funil.padrao : false })),
                        () => acaoDefinirQuadroPadrao(clienteId, funil.id, !funil.padrao),
                      )
                    }
                  >
                    Funil padrão
                  </ItemDoMenu>
                </GrupoDoMenu>
                <DivisoriaDoMenu />
                <GrupoDoMenu titulo="Quando ganhar, passa para">
                  <ItemDoMenu
                    ativo={funil.seguinteId === null}
                    aoEscolher={() =>
                      otimista(trocarFunil(funil.id, { seguinteId: null }), () =>
                        acaoEncadearQuadro(clienteId, funil.id, null),
                      )
                    }
                  >
                    Nenhum, fica aqui
                  </ItemDoMenu>
                  {funis
                    .filter((f) => f.id !== funil.id)
                    .map((outro) => (
                      <ItemDoMenu
                        key={outro.id}
                        ativo={funil.seguinteId === outro.id}
                        aoEscolher={() =>
                          otimista(trocarFunil(funil.id, { seguinteId: outro.id }), () =>
                            acaoEncadearQuadro(clienteId, funil.id, outro.id),
                          )
                        }
                      >
                        {outro.nome}
                      </ItemDoMenu>
                    ))}
                </GrupoDoMenu>
                <DivisoriaDoMenu />
                <button
                  type="button"
                  data-fechar-popover=""
                  className="quadro-menu-item text-perigo"
                  onClick={() =>
                    confirmar({
                      titulo: `Excluir o funil ${funil.nome}?`,
                      descricao:
                        'As etapas e a posição dos negócios neste funil somem. Os contatos continuam na conta, com as conversas e anotações.',
                      rotulo: 'Excluir funil',
                      tom: 'perigo',
                      aoConfirmar: async () => {
                        const r = await acaoApagarQuadro(clienteId, funil.id)
                        if (r.ok) setFunis((atuais) => atuais.filter((f) => f.id !== funil.id))
                        return r
                      },
                    })
                  }
                >
                  Excluir funil
                </button>
              </PopoverDoQuadro>
            </header>

            {/*
              A trilha: no desktop as etapas em linha, ligadas por um traço, na
              ordem em que o negócio anda. No celular a mesma trilha desce, uma
              etapa por linha, porque oito colunas em 390px viram oito palitos.
            */}
            <ol className="relative grid grid-cols-1 gap-0 px-5 py-4 md:auto-cols-fr md:grid-flow-col md:gap-3">
              {funil.etapas.map((etapa, i) => (
                <li key={etapa.id} className="relative flex gap-3 pb-4 md:block md:pb-0">
                  {/* O traço que liga uma etapa à próxima. */}
                  <span
                    aria-hidden
                    className="absolute top-[18px] bottom-0 left-[7px] w-px md:top-[7px] md:right-[-12px] md:bottom-auto md:left-[16px] md:h-px md:w-auto bg-primary/25"
                  />
                  <span
                    aria-hidden
                    className={`relative z-[1] mt-0.5 block size-[15px] shrink-0 rounded-full border-2 border-panel ${
                      etapa.cor ? `${CLASSE_DA_COR[etapa.cor]} ring-1 ring-line` : 'bg-panel ring-2 ring-primary/60'
                    }`}
                  />
                  <span className="block min-w-0 md:mt-2.5">
                    <span className="block text-[10.5px] font-semibold text-dim tabular-nums">Etapa {i + 1}</span>
                    <strong className="block truncate text-[13px] font-bold" title={etapa.nome}>
                      {etapa.nome}
                    </strong>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {etapa.tipo !== 'normal' && (
                        <span
                          className={`rounded-full border px-1.5 py-px text-[10px] font-bold ${
                            etapa.tipo === 'ganho'
                              ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-ok'
                              : 'border-line bg-surface text-muted'
                          }`}
                        >
                          {etapa.tipo === 'ganho' ? 'Ganho' : 'Perdido'}
                        </span>
                      )}
                      <span className="text-[11px] text-dim">
                        {etapa.limiteDeDias ? `esfria em ${etapa.limiteDeDias} dias` : 'esfria no padrão'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfigurando({ funil, etapa })}
                      className="mt-1.5 text-[12px] font-semibold text-primary hover:underline"
                    >
                      Configurar etapa
                    </button>
                  </span>
                </li>
              ))}
              {funil.etapas.length < LIMITE_DE_ETAPAS && (
                <li className="flex md:block">
                  <button
                    type="button"
                    onClick={() => setNovaEtapaEm(funil)}
                    title="Adicionar etapa no fim do funil"
                    className="flex items-center gap-2 rounded-[10px] border border-dashed border-strong px-3 py-2 text-[12px] font-semibold text-dim transition hover:border-primary/40 hover:text-primary md:mt-0"
                  >
                    <span aria-hidden className="grid size-[18px] place-items-center rounded-full bg-primary text-[13px] leading-none text-white">
                      +
                    </span>
                    Etapa
                  </button>
                </li>
              )}
            </ol>
          </section>
        )
      })}

      <div>
        <button type="button" onClick={() => setCriandoFunil(true)} className="botao-primario botao-md">
          + Adicionar funil
        </button>
      </div>

      {/* Novo funil */}
      <Modal aberto={criandoFunil} aoFechar={() => setCriandoFunil(false)} titulo="Novo funil" descricao="Nasce com três etapas (Novo, Em conversa, Fechado), que dá para renomear aqui mesmo.">
        {criandoFunil && (
          <CampoDeNome
            rotulo="Nome do funil"
            exemplo="Exemplo: Vendas de móveis"
            acao="Criar funil"
            aoCancelar={() => setCriandoFunil(false)}
            aoSalvar={async (nome) => {
              const falhou = await eRecarrega(() => acaoCriarQuadroComModelo(clienteId, nome, null))
              if (!falhou) setCriandoFunil(false)
              return falhou
            }}
          />
        )}
      </Modal>

      {/* Renomear funil */}
      <Modal aberto={renomeando !== null} aoFechar={() => setRenomeando(null)} titulo="Renomear funil">
        {renomeando && (
          <CampoDeNome
            rotulo="Nome do funil"
            inicial={renomeando.nome}
            acao="Salvar"
            aoCancelar={() => setRenomeando(null)}
            aoSalvar={async (nome) => {
              otimista(trocarFunil(renomeando.id, { nome }), () => acaoRenomearQuadro(clienteId, renomeando.id, nome))
              setRenomeando(null)
              return null
            }}
          />
        )}
      </Modal>

      {/* Nova etapa */}
      <Modal
        aberto={novaEtapaEm !== null}
        aoFechar={() => setNovaEtapaEm(null)}
        titulo="Nova etapa"
        descricao={novaEtapaEm ? `Entra no fim de ${novaEtapaEm.nome}. Depois dá para mover.` : undefined}
      >
        {novaEtapaEm && (
          <CampoDeNome
            rotulo="Nome da etapa"
            exemplo="Exemplo: Proposta enviada"
            acao="Adicionar etapa"
            aoCancelar={() => setNovaEtapaEm(null)}
            aoSalvar={async (nome) => {
              const falhou = await eRecarrega(() => acaoCriarEtapaDireto(clienteId, novaEtapaEm.id, nome))
              if (!falhou) setNovaEtapaEm(null)
              return falhou
            }}
          />
        )}
      </Modal>

      {/* Configurar etapa */}
      <Modal
        aberto={configurando !== null}
        aoFechar={() => setConfigurando(null)}
        titulo="Configurar etapa"
        descricao={configurando ? `${configurando.funil.nome}, etapa ${configurando.funil.etapas.findIndex((e) => e.id === configurando.etapa.id) + 1}` : undefined}
      >
        {configurando && (
          <ConfigurarEtapa
            key={configurando.etapa.id}
            etapa={configurando.etapa}
            primeira={configurando.funil.etapas[0]?.id === configurando.etapa.id}
            ultima={configurando.funil.etapas.at(-1)?.id === configurando.etapa.id}
            aoCancelar={() => setConfigurando(null)}
            aoMover={async (direcao) => {
              const { funil, etapa } = configurando
              const falhou = await eRecarrega(() => acaoMoverEtapa(clienteId, funil.id, etapa.id, direcao))
              if (!falhou) setConfigurando(null)
              return falhou
            }}
            aoApagar={async () => {
              const { funil, etapa } = configurando
              const falhou = await eRecarrega(() => acaoApagarEtapa(clienteId, funil.id, etapa.id))
              if (!falhou) setConfigurando(null)
              return falhou
            }}
            aoSalvar={async (nova) => {
              const { funil, etapa } = configurando
              const tarefas: Promise<Resultado>[] = []
              if (nova.nome !== etapa.nome) tarefas.push(acaoRenomearEtapa(clienteId, funil.id, etapa.id, nova.nome))
              if (nova.cor !== etapa.cor) tarefas.push(acaoDefinirCorDaEtapa(clienteId, funil.id, etapa.id, nova.cor))
              if (nova.tipo !== etapa.tipo || nova.limiteDeDias !== etapa.limiteDeDias) {
                tarefas.push(acaoDefinirTipoDaEtapa(clienteId, funil.id, etapa.id, nova.tipo, nova.limiteDeDias))
              }
              otimista(trocarEtapa(funil.id, etapa.id, nova), async () => {
                const respostas = await Promise.all(tarefas)
                return respostas.find((r) => !r.ok) ?? { ok: true }
              })
              setConfigurando(null)
              return null
            }}
          />
        )}
      </Modal>

      {dialogo}
    </div>
  )
}

function CampoDeNome({
  rotulo,
  exemplo,
  inicial = '',
  acao,
  aoSalvar,
  aoCancelar,
}: {
  rotulo: string
  exemplo?: string
  inicial?: string
  acao: string
  /** Devolve a frase de erro, ou `null`. */
  aoSalvar: (nome: string) => Promise<string | null>
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (nome.trim() === '') return setErro('escreva um nome')
        setSalvando(true)
        setErro(await aoSalvar(nome.trim()))
        setSalvando(false)
      }}
      className="flex flex-col gap-3"
    >
      <label>
        <span className="mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase">{rotulo}</span>
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={LIMITE_DO_NOME}
          placeholder={exemplo}
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
      </label>
      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}
      <span className="flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className="botao-secundario botao-md">
          Cancelar
        </button>
        <button type="submit" disabled={salvando} className="botao-primario botao-md">
          {salvando ? 'Salvando…' : acao}
        </button>
      </span>
    </form>
  )
}

function ConfigurarEtapa({
  etapa,
  primeira,
  ultima,
  aoSalvar,
  aoMover,
  aoApagar,
  aoCancelar,
}: {
  etapa: EtapaDoFunil
  primeira: boolean
  ultima: boolean
  aoSalvar: (nova: EtapaDoFunil) => Promise<string | null>
  aoMover: (direcao: 'esquerda' | 'direita') => Promise<string | null>
  aoApagar: () => Promise<string | null>
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(etapa.nome)
  const [cor, setCor] = useState<CorDaEtapa | null>(etapa.cor)
  const [tipo, setTipo] = useState<TipoDeEtapa>(etapa.tipo)
  const [dias, setDias] = useState(etapa.limiteDeDias ? String(etapa.limiteDeDias) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function rodar(acao: () => Promise<string | null>) {
    setOcupado(true)
    setErro(await acao())
    setOcupado(false)
  }

  const rotulo = 'mb-1 block text-[11px] font-bold tracking-[0.04em] text-dim uppercase'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (nome.trim() === '') return setErro('a etapa precisa de um nome')
        const limite = dias.trim() === '' ? null : Number(dias)
        if (limite !== null && (!Number.isInteger(limite) || limite < 1 || limite > 365)) {
          return setErro('os dias vão de 1 a 365')
        }
        void rodar(() => aoSalvar({ ...etapa, nome: nome.trim(), cor, tipo, limiteDeDias: limite }))
      }}
      className="flex flex-col gap-4"
    >
      <label>
        <span className={rotulo}>Nome</span>
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={LIMITE_DO_NOME}
          className="app-field w-full px-3 py-2.5 text-[12.5px]"
        />
      </label>

      <div>
        <span className={rotulo}>Cor</span>
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCor(null)}
            aria-pressed={cor === null}
            title="Sem cor"
            className={`grid size-7 place-items-center rounded-full border border-strong bg-surface text-[11px] text-dim ${cor === null ? 'ring-2 ring-primary ring-offset-2 ring-offset-panel' : ''}`}
          >
            ∅
          </button>
          {CORES_DA_ETAPA.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setCor(opcao)}
              aria-pressed={cor === opcao}
              aria-label={opcao}
              title={opcao}
              className={`size-7 rounded-full ${CLASSE_DA_COR[opcao]} ${cor === opcao ? 'ring-2 ring-primary ring-offset-2 ring-offset-panel' : ''}`}
            />
          ))}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <span className={rotulo}>O que a etapa faz</span>
          <Dropdown
            rotuloAcessivel="O que a etapa faz"
            valor={tipo}
            aoMudar={(v) => setTipo(v as TipoDeEtapa)}
            className="w-full"
            opcoes={(['normal', 'ganho', 'perdido'] as const).map((t) => ({ valor: t, rotulo: NOME_DO_TIPO[t] }))}
          />
        </div>
        <label>
          <span className={rotulo}>
            Esfria depois de <span className="font-normal normal-case">(dias)</span>
          </span>
          <input
            value={dias}
            onChange={(e) => setDias(e.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="Padrão"
            className="app-field w-full px-3 py-2.5 text-[12.5px]"
          />
        </label>
      </div>
      <p className="-mt-2 text-[11px] leading-4 text-dim">
        Negócio parado aqui por mais dias que isso aparece como esfriando no funil. Em branco, vale o
        padrão do produto.
      </p>

      {erro && (
        <p role="alert" className="text-[11.5px] text-perigo">
          {erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <button type="button" disabled={ocupado || primeira} onClick={() => rodar(() => aoMover('esquerda'))} className="botao-secundario botao-sm">
          ← Antes
        </button>
        <button type="button" disabled={ocupado || ultima} onClick={() => rodar(() => aoMover('direita'))} className="botao-secundario botao-sm">
          Depois →
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => rodar(aoApagar)}
          className="ml-auto text-[12px] font-semibold text-perigo hover:underline disabled:opacity-50"
        >
          Apagar etapa
        </button>
      </div>

      <span className="flex justify-end gap-2">
        <button type="button" onClick={aoCancelar} className="botao-secundario botao-md">
          Cancelar
        </button>
        <button type="submit" disabled={ocupado} className="botao-primario botao-md">
          Salvar etapa
        </button>
      </span>
    </form>
  )
}
