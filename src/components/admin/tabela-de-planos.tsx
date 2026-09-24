'use client'

import { useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { RolagemDaTabela } from '@/components/lead/rolagem-da-tabela'
import { RECURSOS_DO_PLANO } from '@/core/planos'
import { acaoAdminSalvarPlano, type DadosDoPlano } from '@/server/acoes-admin'
import { CLASSE_DO_CABECALHO, COLUNA_FIXA, FUNDO_DA_FIXA, FUNDO_DA_LINHA, Selo } from './partes'

export type PlanoNaTabela = DadosDoPlano & { id: string; organizacoes: number }

/**
 * Os planos, e o que cada um libera. Editar abre o formulário; salvar muda a
 * linha na hora e volta, com aviso, se o servidor recusar.
 */
export function TabelaDePlanos({ planos: iniciais, editavel }: { planos: PlanoNaTabela[]; editavel: boolean }) {
  const [planos, setPlanos] = useState(iniciais)
  const [editando, setEditando] = useState<PlanoNaTabela | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [, comecar] = useTransition()
  const rotulo = new Map<string, string>(RECURSOS_DO_PLANO.map((recurso) => [recurso.chave, recurso.rotulo]))

  const salvar = (plano: PlanoNaTabela, dados: DadosDoPlano) => {
    const antes = planos
    setPlanos((lista) => lista.map((item) => (item.id === plano.id ? { ...item, ...dados } : item)))
    setEditando(null)
    comecar(async () => {
      try {
        const r = await acaoAdminSalvarPlano(plano.id, dados)
        if (!r.ok) {
          setPlanos(antes)
          setAviso(r.erro ?? 'não deu para salvar o plano')
        }
      } catch {
        setPlanos(antes)
        setAviso('sem conexão com o servidor')
      }
    })
  }

  return (
    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
      <RolagemDaTabela>
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={`${CLASSE_DO_CABECALHO} ${COLUNA_FIXA} z-[3] bg-panel`}>Plano</th>
              <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Preço</th>
              <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Conversas</th>
              <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Números</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>O que libera</th>
              <th scope="col" className={`${CLASSE_DO_CABECALHO} text-right`}>Organizações</th>
              <th scope="col" className={CLASSE_DO_CABECALHO}>Situação</th>
              <th scope="col" className="w-20 px-2 py-3">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {planos.map((plano) => (
              <tr key={plano.id} className={`group border-b border-line align-top last:border-0 ${FUNDO_DA_LINHA}`}>
                <td className={`${COLUNA_FIXA} ${FUNDO_DA_FIXA} px-4 py-3`}>
                  <p className="text-[13.5px] font-bold">{plano.nome}</p>
                  <p className="mt-0.5 line-clamp-2 max-w-[280px] text-[11.5px] leading-[1.45] text-dim">{plano.resumo}</p>
                </td>
                <td className="px-4 py-3 text-right text-[13px] font-semibold whitespace-nowrap tabular-nums">R$ {plano.preco.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.conversas.toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.numeros}</td>
                <td className="px-4 py-3">
                  <span className="flex max-w-[360px] flex-wrap gap-1">
                    {plano.recursos.length === 0 ? <span className="text-[12px] text-dim">nada além do básico</span> : plano.recursos.map((recurso) => <Selo key={recurso}>{rotulo.get(recurso) ?? recurso}</Selo>)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums">{plano.organizacoes}</td>
                <td className="px-4 py-3">{plano.ativo ? <Selo tom="ok">À venda</Selo> : <Selo>Fora de venda</Selo>}</td>
                <td className="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={!editavel}
                    title={editavel ? `Editar ${plano.nome}` : 'A edição chega com a migration de planos'}
                    onClick={() => setEditando(plano)}
                    className="app-secondary-button px-3 py-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RolagemDaTabela>
      {editando && <EditarPlano plano={editando} aoFechar={() => setEditando(null)} aoSalvar={(dados) => salvar(editando, dados)} />}
      {aviso && (
        <AvisoFlutuante tom="erro" aoSumir={() => setAviso(null)}>
          {aviso}
        </AvisoFlutuante>
      )}
    </div>
  )
}

function EditarPlano({ plano, aoFechar, aoSalvar }: { plano: PlanoNaTabela; aoFechar: () => void; aoSalvar: (dados: DadosDoPlano) => void }) {
  const [recursos, setRecursos] = useState<string[]>(plano.recursos)
  const [ativo, setAtivo] = useState(plano.ativo)
  const campo = 'app-field px-[13px] py-[10px] text-[13.5px]'

  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Editar ${plano.nome}`} descricao="Vale para as organizações neste plano a partir de agora. O limite de conversas não bloqueia nada: ele aparece no consumo." largura={560}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(evento) => {
          evento.preventDefault()
          const dados = new FormData(evento.currentTarget)
          aoSalvar({
            nome: String(dados.get('nome') ?? ''),
            preco: Number(dados.get('preco')),
            conversas: Number(dados.get('conversas')),
            numeros: Number(dados.get('numeros')),
            resumo: String(dados.get('resumo') ?? ''),
            itens: String(dados.get('itens') ?? '').split('\n'),
            recursos,
            ativo,
          })
        }}
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label>
            <RotuloCampo>Nome</RotuloCampo>
            <input name="nome" required maxLength={60} defaultValue={plano.nome} placeholder="Exemplo: Operação" className={campo} />
          </label>
          <label>
            <RotuloCampo>Preço por mês (R$)</RotuloCampo>
            <input name="preco" type="number" min={0} step={1} required defaultValue={plano.preco} placeholder="Exemplo: 597" className={campo} />
          </label>
          <label>
            <RotuloCampo>Conversas por mês</RotuloCampo>
            <input name="conversas" type="number" min={0} step={1} required defaultValue={plano.conversas} placeholder="Exemplo: 3000" className={campo} />
          </label>
          <label>
            <RotuloCampo>Números de WhatsApp</RotuloCampo>
            <input name="numeros" type="number" min={1} step={1} required defaultValue={plano.numeros} placeholder="Exemplo: 1" className={campo} />
          </label>
        </div>
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
          <textarea name="itens" rows={5} defaultValue={plano.itens.join('\n')} placeholder={'Exemplo: Até 3.000 conversas por mês'} className={`${campo} resize-y leading-6`} />
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
            Salvar plano
          </button>
        </div>
      </form>
    </Modal>
  )
}
