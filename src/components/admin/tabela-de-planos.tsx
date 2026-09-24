'use client'

import { useEffect, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { reais } from '@/core/contrato-do-plano'
import { RECURSOS_DO_PLANO } from '@/core/planos'
import {
  acaoAdminCriarPlano,
  acaoAdminExcluirPlano,
  acaoAdminImpedimentosDoPlano,
  acaoAdminMoverOrganizacoes,
  acaoAdminSalvarPlano,
  type DadosDoPlano,
  type PrecoParaQuemJaEsta,
} from '@/server/acoes-admin'
import { IconeDoQuadro, PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Selo, TelaDaAdministracao } from './partes'

export type PlanoNaTabela = DadosDoPlano & { id: string; organizacoes: number }

type Edicao = { modo: 'editar' | 'criar'; plano: PlanoNaTabela }

const VAZIO: PlanoNaTabela = {
  id: '',
  nome: '',
  preco: 0,
  conversas: 1000,
  numeros: 1,
  precoExcedente: 0.4,
  resumo: '',
  itens: [],
  recursos: ['crm'],
  ativo: true,
  organizacoes: 0,
}

/**
 * Os planos, e o que cada um libera. Criar, duplicar, editar e excluir; tudo
 * muda a tabela na hora e volta, com aviso, se o servidor recusar.
 */
export function TabelaDePlanos({
  planos: iniciais,
  editavel,
  titulo,
  descricao,
  antes,
}: {
  planos: PlanoNaTabela[]
  editavel: boolean
  titulo: string
  descricao: string
  /** Acima da tabela: o aviso de quando a edição está desligada. */
  antes?: React.ReactNode
}) {
  const [planos, setPlanos] = useState(iniciais)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [excluindo, setExcluindo] = useState<PlanoNaTabela | null>(null)
  const [aviso, setAviso] = useState<{ tom: 'erro' | 'neutro'; texto: string } | null>(null)
  const [, comecar] = useTransition()
  const rotulo = new Map<string, string>(RECURSOS_DO_PLANO.map((recurso) => [recurso.chave, recurso.rotulo]))

  const salvar = (plano: PlanoNaTabela, dados: DadosDoPlano, quemJaEsta: PrecoParaQuemJaEsta) => {
    const antes = planos
    setPlanos((lista) => lista.map((item) => (item.id === plano.id ? { ...item, ...dados } : item)))
    setEdicao(null)
    comecar(async () => {
      try {
        const r = await acaoAdminSalvarPlano(plano.id, dados, quemJaEsta)
        if (!r.ok) {
          setPlanos(antes)
          setAviso({ tom: 'erro', texto: r.erro ?? 'não deu para salvar o plano' })
        } else if (r.avisadas) {
          setAviso({ tom: 'neutro', texto: `${r.avisadas} ${r.avisadas === 1 ? 'organização recebe' : 'organizações recebem'} o aviso do preço novo, que vale em 30 dias.` })
        }
      } catch {
        setPlanos(antes)
        setAviso({ tom: 'erro', texto: 'sem conexão com o servidor' })
      }
    })
  }

  const criar = (dados: DadosDoPlano) => {
    const provisorio = `novo-${Date.now()}`
    setPlanos((lista) => [...lista, { ...dados, id: provisorio, organizacoes: 0 }])
    setEdicao(null)
    comecar(async () => {
      try {
        const r = await acaoAdminCriarPlano(dados)
        if (!r.ok || !r.id) {
          setPlanos((lista) => lista.filter((item) => item.id !== provisorio))
          setAviso({ tom: 'erro', texto: r.erro ?? 'não deu para criar o plano' })
          return
        }
        setPlanos((lista) => lista.map((item) => (item.id === provisorio ? { ...item, id: r.id! } : item)))
      } catch {
        setPlanos((lista) => lista.filter((item) => item.id !== provisorio))
        setAviso({ tom: 'erro', texto: 'sem conexão com o servidor' })
      }
    })
  }

  const excluir = (plano: PlanoNaTabela) => {
    const antes = planos
    setPlanos((lista) => lista.filter((item) => item.id !== plano.id))
    setExcluindo(null)
    comecar(async () => {
      const r = await acaoAdminExcluirPlano(plano.id).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (!r.ok) {
        setPlanos(antes)
        setAviso({ tom: 'erro', texto: r.erro ?? 'não deu para excluir o plano' })
      }
    })
  }

  const provisorio = (plano: PlanoNaTabela) => plano.id.startsWith('novo-')

  return (
    <TelaDaAdministracao
      titulo={titulo}
      descricao={descricao}
      acoes={
        <button
          type="button"
          disabled={!editavel}
          onClick={() => setEdicao({ modo: 'criar', plano: VAZIO })}
          className="app-primary-button px-[18px] py-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
        >
          + Novo plano
        </button>
      }
    >
      {antes}
      <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <RolagemDaTabela>
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${CLASSE_DO_CABECALHO} ${COLUNA_FIXA} z-[3] bg-panel`}>Plano</th>
                <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Preço</th>
                <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Conversas</th>
                <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`} title="Por conversa acima da faixa">Excedente</th>
                <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Números</th>
                <th scope="col" className={CLASSE_DO_CABECALHO}>O que libera</th>
                <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Organizações</th>
                <th scope="col" className={CLASSE_DO_CABECALHO}>Situação</th>
                <th scope="col" className="px-2 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {planos.map((plano) => (
                <tr key={plano.id} className={`group border-b border-line align-top last:border-0 ${FUNDO_DA_LINHA} ${provisorio(plano) ? 'opacity-60' : ''}`}>
                  <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                    <p className="text-[13.5px] font-bold">{plano.nome}</p>
                    <p className="mt-0.5 line-clamp-2 max-w-[280px] text-[11.5px] leading-[1.45] text-dim">{plano.resumo}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-[13px] font-semibold whitespace-nowrap tabular-nums">{reais(plano.preco)}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.conversas.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right text-[12.5px] whitespace-nowrap tabular-nums" title="Por conversa acima da faixa">
                    {reais(plano.precoExcedente)}
                  </td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.numeros}</td>
                  <td className="px-4 py-3">
                    <span className="flex min-w-[260px] max-w-[400px] flex-wrap gap-1">
                      {plano.recursos.length === 0 ? <span className="text-[12px] text-dim">nada além do básico</span> : plano.recursos.map((recurso) => <Selo key={recurso}>{rotulo.get(recurso) ?? recurso}</Selo>)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.organizacoes}</td>
                  <td className="px-4 py-3">{plano.ativo ? <Selo tom="ok">À venda</Selo> : <Selo>Fora de venda</Selo>}</td>
                  <td className="px-2 py-2.5">
                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={!editavel || provisorio(plano)}
                        onClick={() => setEdicao({ modo: 'editar', plano })}
                        className="app-secondary-button px-3 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Editar
                      </button>
                      {editavel && !provisorio(plano) && (
                        <PopoverDoQuadro rotulo={`Mais ações de ${plano.nome}`} largura={220} className="quadro-icon-button" gatilho={<IconeDoQuadro tipo="menu" />}>
                          <button
                            type="button"
                            data-fechar-popover
                            onClick={() => setEdicao({ modo: 'criar', plano: { ...plano, nome: `${plano.nome} (cópia)`.slice(0, 60), ativo: false, organizacoes: 0 } })}
                            className="quadro-menu-item"
                          >
                            <span className="flex-1">
                              Duplicar
                              <span className="block text-[11px] font-normal text-dim">Nasce fora de venda</span>
                            </span>
                          </button>
                          <button type="button" data-fechar-popover onClick={() => setExcluindo(plano)} className="quadro-menu-item text-perigo">
                            <span className="flex-1">Excluir</span>
                          </button>
                        </PopoverDoQuadro>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RolagemDaTabela>
      </div>
      {edicao && (
        <EditarPlano
          key={`${edicao.modo}-${edicao.plano.id}`}
          modo={edicao.modo}
          plano={edicao.plano}
          aoFechar={() => setEdicao(null)}
          aoSalvar={(dados, quemJaEsta) => (edicao.modo === 'criar' ? criar(dados) : salvar(edicao.plano, dados, quemJaEsta))}
        />
      )}
      {excluindo && (
        <ExcluirPlano
          plano={excluindo}
          outros={planos.filter((item) => item.id !== excluindo.id && !provisorio(item))}
          aoFechar={() => setExcluindo(null)}
          aoMover={(para, quantas) =>
            setPlanos((lista) =>
              lista.map((item) =>
                item.id === excluindo.id ? { ...item, organizacoes: 0 } : item.id === para ? { ...item, organizacoes: item.organizacoes + quantas } : item,
              ),
            )
          }
          aoExcluir={() => excluir(excluindo)}
        />
      )}
      {aviso && (
        <AvisoFlutuante tom={aviso.tom} aoSumir={() => setAviso(null)}>
          {aviso.texto}
        </AvisoFlutuante>
      )}
    </TelaDaAdministracao>
  )
}

function EditarPlano({
  modo,
  plano,
  aoFechar,
  aoSalvar,
}: {
  modo: 'editar' | 'criar'
  plano: PlanoNaTabela
  aoFechar: () => void
  aoSalvar: (dados: DadosDoPlano, quemJaEsta: PrecoParaQuemJaEsta) => void
}) {
  const [recursos, setRecursos] = useState<string[]>(plano.recursos)
  const [ativo, setAtivo] = useState(plano.ativo)
  const [preco, setPreco] = useState(String(plano.preco))
  const [quemJaEsta, setQuemJaEsta] = useState<PrecoParaQuemJaEsta>('manter')
  const campo = 'app-field px-[13px] py-[10px] text-[13.5px]'
  const mudouPreco = modo === 'editar' && plano.organizacoes > 0 && preco !== '' && Number(preco) !== plano.preco
  const quantas = `${plano.organizacoes} ${plano.organizacoes === 1 ? 'organização' : 'organizações'}`

  return (
    <Modal
      aberto
      aoFechar={aoFechar}
      titulo={modo === 'criar' ? (plano.id ? `Duplicar ${plano.nome.replace(/ \(cópia\)$/, '')}` : 'Novo plano') : `Editar ${plano.nome}`}
      descricao={
        modo === 'criar'
          ? 'O plano nasce com o id tirado do nome, que não muda depois. A página de planos do site não mostra plano novo sozinha.'
          : 'O limite de conversas não bloqueia nada: acima dele, cada conversa entra como excedente na fatura seguinte.'
      }
      largura={580}
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          const dados = new FormData(evento.currentTarget)
          aoSalvar(
            {
              nome: String(dados.get('nome') ?? ''),
              preco: Number(dados.get('preco')),
              conversas: Number(dados.get('conversas')),
              numeros: Number(dados.get('numeros')),
              precoExcedente: Number(String(dados.get('precoExcedente') ?? '0').replace(',', '.')),
              resumo: String(dados.get('resumo') ?? ''),
              itens: String(dados.get('itens') ?? '').split('\n'),
              recursos,
              ativo,
            },
            quemJaEsta,
          )
        }}
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label>
            <RotuloCampo>Nome</RotuloCampo>
            <input name="nome" required maxLength={60} defaultValue={plano.nome} placeholder="Exemplo: Operação" className={campo} />
          </label>
          <label>
            <RotuloCampo>Preço por mês (R$)</RotuloCampo>
            <input name="preco" type="number" min={0} step={1} required value={preco} onChange={(evento) => setPreco(evento.target.value)} placeholder="Exemplo: 597" className={campo} />
          </label>
          <label>
            <RotuloCampo>Conversas por mês</RotuloCampo>
            <input name="conversas" type="number" min={0} step={1} required defaultValue={plano.conversas} placeholder="Exemplo: 3000" className={campo} />
          </label>
          <label>
            <RotuloCampo>Excedente por conversa (R$)</RotuloCampo>
            <input name="precoExcedente" type="number" min={0} step={0.01} required defaultValue={plano.precoExcedente} placeholder="Exemplo: 0,30" className={campo} />
          </label>
          <label>
            <RotuloCampo>Números de WhatsApp</RotuloCampo>
            <input name="numeros" type="number" min={1} step={1} required defaultValue={plano.numeros} placeholder="Exemplo: 1" className={campo} />
          </label>
        </div>

        {mudouPreco && (
          <fieldset className="rounded-[12px] border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
            <legend className="sr-only">Preço para quem já está no plano</legend>
            <p className="mb-2 text-[12.5px] leading-5 text-soft">
              O preço novo vale para organização nova. E para as {quantas} que já estão no {plano.nome}?
            </p>
            {(
              [
                { valor: 'manter', titulo: 'Manter o preço de hoje', detalhe: `Continuam pagando ${reais(plano.preco)} (preço de legado).` },
                { valor: 'avisar', titulo: 'Aplicar com aviso de 30 dias', detalhe: 'Recebem o aviso no app e por e-mail; o preço novo vale daqui a 30 dias.' },
              ] as const
            ).map((opcao) => (
              <label key={opcao.valor} className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-1.5 py-1.5 text-[12.5px] leading-5 hover:bg-surface">
                <input type="radio" name="quemJaEsta" checked={quemJaEsta === opcao.valor} onChange={() => setQuemJaEsta(opcao.valor)} className="mt-1 size-3.5 accent-[var(--primary)]" />
                <span>
                  <span className="font-semibold text-ink">{opcao.titulo}</span>
                  <span className="block text-dim">{opcao.detalhe}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <label>
          <RotuloCampo>Para quem é</RotuloCampo>
          <input name="resumo" maxLength={160} defaultValue={plano.resumo} placeholder="Exemplo: Para quem já tem gente atendendo junto." className={campo} />
        </label>
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-semibold text-muted">O que libera</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RECURSOS_DO_PLANO.map((recurso) => (
              <label key={recurso.chave} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] hover:bg-surface">
                <input
                  type="checkbox"
                  checked={recursos.includes(recurso.chave)}
                  onChange={() => setRecursos((lista) => (lista.includes(recurso.chave) ? lista.filter((item) => item !== recurso.chave) : [...lista, recurso.chave]))}
                  className="size-3.5 accent-[var(--primary)]"
                />
                {recurso.rotulo}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <RotuloCampo>Itens da página de planos (um por linha)</RotuloCampo>
          <textarea name="itens" rows={4} defaultValue={plano.itens.join('\n')} placeholder={'Exemplo: Até 3.000 conversas por mês'} className={`${campo} resize-y leading-6`} />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
          <input type="checkbox" checked={ativo} onChange={(evento) => setAtivo(evento.target.checked)} className="size-4 accent-[var(--primary)]" />
          À venda (aparece para as organizações escolherem)
        </label>
        <div className="mt-1 flex gap-2.5">
          <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
            Cancelar
          </button>
          <button type="submit" className="app-primary-button flex-[1.35] px-4 py-2.5 text-[13px]">
            {modo === 'criar' ? 'Criar plano' : 'Salvar plano'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

type Impedimentos = Awaited<ReturnType<typeof acaoAdminImpedimentosDoPlano>>

/**
 * Excluir: bloqueado enquanto houver organização no plano ou pedido aberto
 * para ele. O modal lista quais e oferece mover todas antes.
 */
function ExcluirPlano({
  plano,
  outros,
  aoFechar,
  aoMover,
  aoExcluir,
}: {
  plano: PlanoNaTabela
  outros: PlanoNaTabela[]
  aoFechar: () => void
  aoMover: (para: string, quantas: number) => void
  aoExcluir: () => void
}) {
  const [estado, setEstado] = useState<Impedimentos | null>(null)
  const [destino, setDestino] = useState(outros.find((item) => item.ativo)?.id ?? outros[0]?.id ?? '')
  const [movendo, setMovendo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    acaoAdminImpedimentosDoPlano(plano.id)
      .then((r) => vivo && setEstado(r))
      .catch(() => vivo && setEstado({ ok: false, erro: 'sem conexão com o servidor' }))
    return () => {
      vivo = false
    }
  }, [plano.id])

  const organizacoes = estado?.organizacoes ?? []
  const pode = Boolean(estado?.ok) && !estado?.motivo && organizacoes.length === 0 && (estado?.pedidos ?? 0) === 0

  const mover = async () => {
    setErro(null)
    setMovendo(true)
    const antes = estado
    setEstado((atual) => (atual ? { ...atual, organizacoes: [] } : atual))
    const r = await acaoAdminMoverOrganizacoes(plano.id, destino).catch(() => ({ ok: false, erro: 'sem conexão com o servidor', movidas: 0 }))
    setMovendo(false)
    if (!r.ok) {
      setEstado(antes)
      setErro(r.erro ?? 'não deu para mover')
      return
    }
    aoMover(destino, r.movidas ?? organizacoes.length)
  }

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Excluir ${plano.nome}`} descricao="Excluir não tem volta. Tirar de venda é o caminho sem perda: quem está no plano fica, ninguém novo entra." largura={500}>
      {!estado ? (
        <div className="flex flex-col gap-3" aria-busy>
          <div className="h-14 animate-pulse rounded-[12px] bg-surface" />
          <div className="h-20 animate-pulse rounded-[12px] bg-surface" />
        </div>
      ) : !estado.ok ? (
        <p role="alert" className="rounded-[10px] border border-perigo/30 bg-perigo/[0.06] px-3 py-2.5 text-[12.5px] text-perigo">
          {estado.erro}
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {estado.motivo && <p className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[12.5px] leading-5 text-soft">{estado.motivo}</p>}

          {!estado.motivo && organizacoes.length > 0 && (
            <div className="rounded-[12px] border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
              <p className="text-[12.5px] font-semibold text-soft">
                {organizacoes.length} {organizacoes.length === 1 ? 'organização está' : 'organizações estão'} neste plano
              </p>
              <ul className="mt-2 flex max-h-[160px] flex-col gap-1 overflow-y-auto text-[12.5px] text-muted">
                {organizacoes.map((organizacao) => (
                  <li key={organizacao.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{organizacao.nome}</span>
                    {organizacao.agendada && <span className="shrink-0 text-[11px] text-dim">descida agendada para ele</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <RotuloCampo>Mover todas para</RotuloCampo>
                  <Dropdown
                    rotuloAcessivel="Plano de destino"
                    valor={destino}
                    aoMudar={setDestino}
                    opcoes={outros.map((item) => ({ valor: item.id, rotulo: item.nome, detalhe: item.ativo ? reais(item.preco) : 'fora de venda' }))}
                  />
                </div>
                <button type="button" disabled={!destino || movendo} onClick={mover} className="app-secondary-button px-4 py-2.5 text-[12.5px] disabled:opacity-50">
                  Mover todas
                </button>
              </div>
              <p className="mt-2 text-[11.5px] leading-5 text-dim">Vale na hora, e o preço contratado de cada uma não muda.</p>
            </div>
          )}

          {!estado.motivo && (estado.pedidos ?? 0) > 0 && (
            <p className="rounded-[12px] border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-[12.5px] leading-5 text-soft">
              Há {estado.pedidos === 1 ? 'um pedido de troca aberto' : `${estado.pedidos} pedidos de troca abertos`} para este plano. Atenda ou recuse em Pedidos de plano antes de excluir.
            </p>
          )}

          {pode && <p className="text-[12.5px] leading-5 text-muted">Nenhuma organização está neste plano. Pode excluir.</p>}
          {erro && (
            <p role="alert" className="text-[12px] text-perigo">
              {erro}
            </p>
          )}
        </div>
      )}
      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={aoFechar} className="app-secondary-button flex-1 px-4 py-2.5 text-[13px]">
          {pode ? 'Cancelar' : 'Fechar'}
        </button>
        {pode && (
          <button
            type="button"
            onClick={aoExcluir}
            className="flex-[1.35] rounded-[10px] border border-rose-400/40 bg-rose-400/[0.16] px-4 py-2.5 text-[13px] font-bold text-perigo transition hover:bg-rose-400/[0.24]"
          >
            Excluir {plano.nome}
          </button>
        )}
      </div>
    </Modal>
  )
}
