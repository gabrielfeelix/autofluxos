'use client'

import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { useConfirmar } from '@/components/design/confirmar'
import { Modal } from '@/components/design/modal'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { explicarSegmento, type Segmento } from '@/core/segmentos'
import { acaoApagarSegmento, acaoContarSegmento, acaoCriarSegmento } from '@/server/acoes-segmentos'
import type { SegmentoSalvo } from '@/server/repos/segmentos'
import { EditorDeSegmento } from './editor-de-segmento'

export type LinhaDeSegmento = {
  id: string
  nome: string
  regra: Segmento
  /** `null` enquanto a contagem de um segmento recém-salvo não chegou. */
  contatos: number | null
  criadoPor: string | null
  criadoEm: string
}

type Recado = { texto: string; erro?: boolean }

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })

const porNome = (a: LinhaDeSegmento, b: LinhaDeSegmento) => a.nome.localeCompare(b.nome, 'pt-BR')

/**
 * CRM > Segmentos como tabela, no mesmo desenho de Etiquetas.
 *
 * Criar e editar abrem o editor num modal; salvar troca a linha com o que o
 * servidor gravou, sem refazer a página, e a contagem de contatos chega logo
 * depois. Apagar confirma antes, porque não tem volta.
 *
 * A contagem é "quantos casam agora", no escopo de quem olha. Quem pode
 * **receber** mensagem é outra pergunta, e quem responde é a prévia do editor.
 */
export function TabelaDeSegmentos({ clienteId, inicial }: { clienteId: string; inicial: LinhaDeSegmento[] }) {
  const [lista, setLista] = useState(inicial)
  const [editando, setEditando] = useState<LinhaDeSegmento | 'novo' | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)
  const [duplicando, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()
  const sumir = useCallback(() => setRecado(null), [])

  const contar = (id: string, regra: Segmento) => {
    comecar(async () => {
      const r = await acaoContarSegmento(clienteId, regra).catch(() => null)
      if (r?.ok) setLista((atual) => atual.map((s) => (s.id === id ? { ...s, contatos: r.total } : s)))
    })
  }

  const gravado = (segmento: SegmentoSalvo, novo: boolean) => {
    const linha: LinhaDeSegmento = {
      id: segmento.id,
      nome: segmento.nome,
      regra: segmento.regra,
      contatos: null,
      criadoPor: segmento.criadoPor,
      criadoEm: segmento.criadoEm,
    }
    setLista((atual) => (novo ? [...atual, linha] : atual.map((s) => (s.id === linha.id ? linha : s))).sort(porNome))
    setEditando(null)
    setRecado({ texto: novo ? `Segmento “${linha.nome}” criado.` : 'Segmento salvo.' })
    contar(linha.id, linha.regra)
  }

  const duplicar = (s: LinhaDeSegmento) => {
    comecar(async () => {
      const r = await acaoCriarSegmento(clienteId, `${s.nome} (cópia)`, s.regra).catch(() => null)
      if (r?.ok && r.segmento) gravado(r.segmento, true)
      else setRecado({ texto: r?.erro ?? 'não deu para duplicar', erro: true })
    })
  }

  const apagar = (s: LinhaDeSegmento) =>
    confirmar({
      titulo: `Apagar “${s.nome}”?`,
      descricao: 'Os contatos não mudam: só a regra deixa de existir. Transmissões já feitas com ele continuam como estão.',
      rotulo: 'Apagar segmento',
      aoConfirmar: async () => {
        const r = await acaoApagarSegmento(clienteId, s.id)
        if (!r.ok) return { ok: false, erro: r.erro }
        setLista((atual) => atual.filter((x) => x.id !== s.id))
        setRecado({ texto: `Segmento “${s.nome}” apagado.` })
        return { ok: true }
      },
    })

  return (
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">
          {lista.length} {lista.length === 1 ? 'segmento' : 'segmentos'}
        </h2>
        <button type="button" onClick={() => setEditando('novo')} className="app-primary-button h-9 px-4 text-[13px]">
          + Novo segmento
        </button>
      </header>

      {lista.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-[13.5px] font-semibold text-soft">Nenhum segmento ainda</p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] leading-5 text-dim">
            Segmento é uma regra que escolhe contatos sozinha, como “quem não compra há 90 dias” ou “quem veio de
            anúncio este mês”. A lista se atualiza todo dia, sem ninguém mexer.
          </p>
          <button type="button" onClick={() => setEditando('novo')} className="app-primary-button mt-5 h-9 px-4 text-[13px]">
            Criar o primeiro segmento
          </button>
        </div>
      ) : (
        <table className="w-full table-fixed text-left text-[13px]">
          <thead className="border-b border-line bg-surface-strong/60 text-[11.5px] text-dim">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Segmento</th>
              <th className="w-24 px-4 py-2.5 text-right font-semibold sm:w-28">Contatos</th>
              <th className="hidden w-44 px-4 py-2.5 font-semibold lg:table-cell">Criado por</th>
              <th className="hidden w-32 px-4 py-2.5 font-semibold md:table-cell">Criado em</th>
              <th className="w-14 px-3 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id} className="border-t border-line-soft align-top first:border-t-0">
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => setEditando(s)}
                    className="block max-w-full truncate text-left text-[13.5px] font-semibold text-ink hover:text-primary"
                  >
                    {s.nome}
                  </button>
                  {/* Regra vazia é a base inteira (8.4): dito em destaque, não numa frase miúda. */}
                  {s.regra.condicoes.length === 0 ? (
                    <span className="mt-1 inline-block rounded-full border border-amber-400/50 px-2 py-0.5 text-[11px] font-semibold text-aviso">
                      Todos os contatos
                    </span>
                  ) : (
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-dim">{explicarSegmento(s.regra)}</p>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right text-[13.5px] font-semibold tabular-nums text-ink">
                  {s.contatos === null ? <span className="text-dim">…</span> : s.contatos}
                </td>
                <td className="hidden truncate px-4 py-3.5 text-soft lg:table-cell">{s.criadoPor ?? <span className="text-dim">-</span>}</td>
                <td className="hidden px-4 py-3.5 tabular-nums text-dim md:table-cell">{DATA.format(new Date(s.criadoEm))}</td>
                <td className="px-3 py-2.5 text-right">
                  <PopoverDoQuadro
                    rotulo={`Mais ações para ${s.nome}`}
                    largura={200}
                    gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
                  >
                    <button type="button" data-fechar-popover className="quadro-menu-item" onClick={() => setEditando(s)}>
                      Editar
                    </button>
                    <button type="button" data-fechar-popover disabled={duplicando} className="quadro-menu-item" onClick={() => duplicar(s)}>
                      Duplicar
                    </button>
                    <button
                      type="button"
                      data-fechar-popover
                      className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
                      onClick={() => apagar(s)}
                    >
                      Apagar…
                    </button>
                  </PopoverDoQuadro>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editando && (
        <Modal
          aberto
          largura={760}
          aoFechar={() => setEditando(null)}
          titulo={editando === 'novo' ? 'Novo segmento' : `Editar “${editando.nome}”`}
          descricao="Combine condições sobre os contatos. Veja quem entra antes de salvar."
        >
          <EditorDeSegmento
            key={editando === 'novo' ? 'novo' : editando.id}
            clienteId={clienteId}
            segmentoId={editando === 'novo' ? undefined : editando.id}
            nomeInicial={editando === 'novo' ? '' : editando.nome}
            regraInicial={editando === 'novo' ? undefined : editando.regra}
            aoCancelar={() => setEditando(null)}
            aoSalvar={(segmento) => gravado(segmento, editando === 'novo')}
          />
        </Modal>
      )}

      {dialogo}

      {/* Sempre montada: região viva que nasce junto do texto não é lida. */}
      <span role="status" className="sr-only">
        {recado?.texto ?? ''}
      </span>
      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={sumir}>
          {recado.texto}
        </AvisoFlutuante>
      )}
    </section>
  )
}
