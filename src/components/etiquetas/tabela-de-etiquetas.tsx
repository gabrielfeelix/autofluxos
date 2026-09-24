'use client'

import Link from 'next/link'
import { useCallback, useState, useTransition } from 'react'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { useConfirmar } from '@/components/design/confirmar'
import { Dropdown } from '@/components/design/dropdown'
import { Modal } from '@/components/design/modal'
import { RotuloCampo } from '@/components/design/modal-formulario'
import { FichaDeEtiqueta } from '@/components/etiquetas/ficha'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { CLASSE_DA_COR, CORES_DE_ETIQUETA, LIMITE_DO_NOME, ROTULO_DA_COR, type CorDeEtiqueta } from '@/core/etiquetas'
import { acaoJuntarEtiquetas, acaoNovaEtiqueta, acaoSalvarEtiqueta, acaoTirarEtiqueta } from '@/server/acoes-etiquetas'

export type LinhaDeEtiqueta = {
  id: string
  nome: string
  cor: CorDeEtiqueta
  contatos: number
  criadoEm: string
}

type Recado = { texto: string; erro?: boolean }

type Edicao = { tipo: 'nova' } | { tipo: 'renomear'; etiqueta: LinhaDeEtiqueta } | { tipo: 'juntar'; etiqueta: LinhaDeEtiqueta }

const OPCOES_DE_COR = CORES_DE_ETIQUETA.map((cor) => ({ valor: cor, rotulo: ROTULO_DA_COR[cor] }))

const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' })

const porNome = (a: LinhaDeEtiqueta, b: LinhaDeEtiqueta) => a.nome.localeCompare(b.nome, 'pt-BR')

const plural = (n: number) => `${n} ${n === 1 ? 'contato' : 'contatos'}`

/**
 * CRM > Etiquetas como tabela (plano de navegação e CRM, 5.4).
 *
 * Criar, renomear e repintar mudam a linha na hora e desfazem se o servidor
 * recusar. Juntar e apagar tiram uma etiqueta de gente de verdade, então
 * pedem confirmação e esperam a resposta antes de mudar a tabela.
 *
 * O número de contatos é um link para Contatos filtrado por ela: é a pergunta
 * seguinte de quem olha "32 contatos" ("quem são?").
 */
export function TabelaDeEtiquetas({ clienteId, inicial }: { clienteId: string; inicial: LinhaDeEtiqueta[] }) {
  const [lista, setLista] = useState(inicial)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)
  const [, comecar] = useTransition()
  const { confirmar, dialogo } = useConfirmar()
  const sumir = useCallback(() => setRecado(null), [])

  const criar = (nome: string, cor: CorDeEtiqueta) => {
    const provisorio = `novo-${Date.now()}`
    const linha: LinhaDeEtiqueta = { id: provisorio, nome: nome.trim(), cor, contatos: 0, criadoEm: new Date().toISOString() }
    setLista((atual) => [...atual, linha].sort(porNome))
    setEdicao(null)
    comecar(async () => {
      const r = await acaoNovaEtiqueta(clienteId, { nome, cor }).catch(() => ({ ok: false, erro: 'sem conexão com o servidor', etiqueta: undefined }))
      if (r.ok && r.etiqueta) {
        const criada = r.etiqueta
        setLista((atual) => atual.map((e) => (e.id === provisorio ? { ...e, id: criada.id, nome: criada.nome } : e)))
        setRecado({ texto: `Etiqueta “${criada.nome}” criada.` })
      } else {
        setLista((atual) => atual.filter((e) => e.id !== provisorio))
        setRecado({ texto: r.erro ?? 'não deu para criar', erro: true })
      }
    })
  }

  const salvar = (etiqueta: LinhaDeEtiqueta, nome: string, cor: CorDeEtiqueta) => {
    const antes = etiqueta
    setLista((atual) => atual.map((e) => (e.id === etiqueta.id ? { ...e, nome: nome.trim(), cor } : e)).sort(porNome))
    setEdicao(null)
    comecar(async () => {
      const r = await acaoSalvarEtiqueta(clienteId, etiqueta.id, { nome, cor }).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
      if (r.ok) {
        setRecado({ texto: 'Etiqueta salva.' })
      } else {
        setLista((atual) => atual.map((e) => (e.id === antes.id ? antes : e)).sort(porNome))
        setRecado({ texto: r.erro ?? 'não deu para salvar', erro: true })
      }
    })
  }

  const juntar = async (origem: LinhaDeEtiqueta, destinoId: string) => {
    const r = await acaoJuntarEtiquetas(clienteId, origem.id, destinoId)
    if (!r.ok) return { ok: false, erro: r.erro }
    const destino = lista.find((e) => e.id === destinoId)
    setLista((atual) =>
      atual
        .filter((e) => e.id !== origem.id)
        .map((e) => (e.id === destinoId ? { ...e, contatos: e.contatos + (r.movidos ?? 0) } : e)),
    )
    setEdicao(null)
    setRecado({ texto: `“${origem.nome}” juntou-se a “${destino?.nome ?? 'outra etiqueta'}”.` })
    return { ok: true }
  }

  const apagar = (etiqueta: LinhaDeEtiqueta) =>
    confirmar({
      titulo: `Apagar “${etiqueta.nome}”?`,
      descricao:
        etiqueta.contatos === 0
          ? 'Nenhum contato tem esta etiqueta.'
          : `Ela sai de ${plural(etiqueta.contatos)}. Não dá para desfazer.`,
      rotulo: 'Apagar etiqueta',
      aoConfirmar: async () => {
        const r = await acaoTirarEtiqueta(clienteId, etiqueta.id)
        if (!r.ok) return { ok: false, erro: r.erro }
        setLista((atual) => atual.filter((e) => e.id !== etiqueta.id))
        setRecado({ texto: `Etiqueta “${etiqueta.nome}” apagada.` })
        return { ok: true }
      },
    })

  return (
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="text-[14.5px] font-bold">
          {lista.length} {lista.length === 1 ? 'etiqueta' : 'etiquetas'}
        </h2>
        <button type="button" onClick={() => setEdicao({ tipo: 'nova' })} className="app-primary-button h-9 px-4 text-[13px]">
          + Nova etiqueta
        </button>
      </header>

      {lista.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <p className="text-[13.5px] font-semibold text-soft">Nenhuma etiqueta ainda</p>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[12.5px] leading-5 text-dim">
            Etiqueta é a sua lista: quem já recebeu proposta, quem é aluno antigo, quem não quer mais mensagem. Ela vira
            filtro em Contatos e público de transmissão.
          </p>
          <button type="button" onClick={() => setEdicao({ tipo: 'nova' })} className="app-primary-button mt-5 h-9 px-4 text-[13px]">
            Criar a primeira etiqueta
          </button>
        </div>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line bg-surface-strong/60 text-[11.5px] text-dim">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Etiqueta</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Cor</th>
              <th className="px-4 py-2.5 text-right font-semibold">Contatos</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Criada em</th>
              <th className="w-12 px-3 py-2.5">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => {
              const provisoria = e.id.startsWith('novo-')
              return (
                <tr key={e.id} className={`border-t border-line-soft first:border-t-0 ${provisoria ? 'opacity-60' : ''}`}>
                  <td className="max-w-0 px-5 py-3">
                    <FichaDeEtiqueta nome={e.nome} cor={e.cor} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span className="inline-flex items-center gap-2 text-soft">
                      <span className={`flex size-4 items-center justify-center rounded-full border ${CLASSE_DA_COR[e.cor]}`} aria-hidden>
                        <span className="size-2 rounded-full bg-current" />
                      </span>
                      {ROTULO_DA_COR[e.cor]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {e.contatos === 0 || provisoria ? (
                      <span className="text-dim">0</span>
                    ) : (
                      <Link
                        href={`/clientes/${clienteId}/leads?marca=${e.id}`}
                        title={`Ver os ${plural(e.contatos)} com “${e.nome}”`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {e.contatos}
                      </Link>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-dim md:table-cell">{DATA.format(new Date(e.criadoEm))}</td>
                  <td className="px-3 py-2 text-right">
                    {!provisoria && (
                      <PopoverDoQuadro
                        rotulo={`Mais ações para ${e.nome}`}
                        largura={220}
                        gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
                      >
                        <button type="button" data-fechar-popover className="quadro-menu-item" onClick={() => setEdicao({ tipo: 'renomear', etiqueta: e })}>
                          Renomear
                        </button>
                        <button
                          type="button"
                          data-fechar-popover
                          disabled={lista.length < 2}
                          className="quadro-menu-item disabled:cursor-not-allowed disabled:opacity-100 disabled:hover:bg-transparent"
                          onClick={() => setEdicao({ tipo: 'juntar', etiqueta: e })}
                        >
                          {/* Desligado sem dizer por quê parece botão quebrado. */}
                          {lista.length < 2 ? (
                            <span className="flex flex-col items-start text-dim">
                              Juntar com outra…
                              <span className="text-[11px]">Crie outra etiqueta antes</span>
                            </span>
                          ) : (
                            'Juntar com outra…'
                          )}
                        </button>
                        <button
                          type="button"
                          data-fechar-popover
                          className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
                          onClick={() => apagar(e)}
                        >
                          Apagar…
                        </button>
                      </PopoverDoQuadro>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {edicao?.tipo === 'nova' && <FormularioDaEtiqueta titulo="Nova etiqueta" rotulo="Criar etiqueta" aoFechar={() => setEdicao(null)} aoSalvar={criar} />}
      {edicao?.tipo === 'renomear' && (
        <FormularioDaEtiqueta
          titulo={`Renomear “${edicao.etiqueta.nome}”`}
          descricao="Quem já tem a etiqueta continua com ela: renomear não é recriar."
          rotulo="Salvar"
          inicial={edicao.etiqueta}
          aoFechar={() => setEdicao(null)}
          aoSalvar={(nome, cor) => salvar(edicao.etiqueta, nome, cor)}
        />
      )}
      {edicao?.tipo === 'juntar' && (
        <FormularioDeJuntar
          origem={edicao.etiqueta}
          outras={lista.filter((e) => e.id !== edicao.etiqueta.id && !e.id.startsWith('novo-'))}
          aoFechar={() => setEdicao(null)}
          aoJuntar={(destinoId) => juntar(edicao.etiqueta, destinoId)}
        />
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

function FormularioDaEtiqueta({
  titulo,
  descricao,
  rotulo,
  inicial,
  aoFechar,
  aoSalvar,
}: {
  titulo: string
  descricao?: string
  rotulo: string
  inicial?: { nome: string; cor: CorDeEtiqueta }
  aoFechar: () => void
  aoSalvar: (nome: string, cor: CorDeEtiqueta) => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [cor, setCor] = useState<CorDeEtiqueta>(inicial?.cor ?? 'cinza')
  const vazio = nome.trim() === ''
  return (
    <Modal aberto aoFechar={aoFechar} titulo={titulo} descricao={descricao}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (!vazio) aoSalvar(nome, cor)
        }}
      >
        <label>
          <RotuloCampo>Nome</RotuloCampo>
          <input
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
            autoFocus
            maxLength={LIMITE_DO_NOME}
            placeholder="Exemplo: orçamento enviado"
            className="app-field px-[13px] py-[11px] text-[13.5px]"
          />
        </label>
        <div>
          <RotuloCampo>Cor</RotuloCampo>
          <Dropdown rotuloAcessivel="Cor da etiqueta" valor={cor} aoMudar={(v) => setCor(v as CorDeEtiqueta)} opcoes={OPCOES_DE_COR} />
          <p className="mt-2 flex items-center gap-2 text-[12px] text-dim">
            Assim ela aparece: <FichaDeEtiqueta nome={nome.trim() || 'etiqueta'} cor={cor} />
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} className="app-secondary-button h-9 px-4 text-[13px]">
            Cancelar
          </button>
          <button type="submit" disabled={vazio} className="app-primary-button h-9 px-4 text-[13px]">
            {rotulo}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FormularioDeJuntar({
  origem,
  outras,
  aoFechar,
  aoJuntar,
}: {
  origem: LinhaDeEtiqueta
  outras: LinhaDeEtiqueta[]
  aoFechar: () => void
  aoJuntar: (destinoId: string) => Promise<{ ok: boolean; erro?: string }>
}) {
  const [destino, setDestino] = useState(outras[0]?.id ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()
  const escolhida = outras.find((e) => e.id === destino)
  return (
    <Modal
      aberto
      aoFechar={() => !rodando && aoFechar()}
      titulo={`Juntar “${origem.nome}” com outra`}
      descricao="Para duas etiquetas que querem dizer a mesma coisa. Não dispara sequência nenhuma."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          setErro(null)
          comecar(async () => {
            const r = await aoJuntar(destino).catch(() => ({ ok: false, erro: 'sem conexão com o servidor' }))
            if (!r.ok) setErro(r.erro ?? 'não deu para juntar')
          })
        }}
      >
        <div>
          <RotuloCampo>Juntar em</RotuloCampo>
          <Dropdown
            rotuloAcessivel="Etiqueta que fica"
            valor={destino}
            aoMudar={setDestino}
            opcoes={outras.map((e) => ({ valor: e.id, rotulo: e.nome, detalhe: plural(e.contatos) }))}
          />
        </div>
        {escolhida && origem.contatos === 0 && (
          <p className="rounded-lg bg-surface-strong px-3.5 py-3 text-[12.5px] leading-5 text-soft">
            Nenhum contato tem <FichaDeEtiqueta nome={origem.nome} cor={origem.cor} />: ela só deixa de existir.
          </p>
        )}
        {escolhida && origem.contatos > 0 && (
          <p className="rounded-lg bg-surface-strong px-3.5 py-3 text-[12.5px] leading-5 text-soft">
            Os {plural(origem.contatos)} com <FichaDeEtiqueta nome={origem.nome} cor={origem.cor} /> passam a ter{' '}
            <FichaDeEtiqueta nome={escolhida.nome} cor={escolhida.cor} />, e “{origem.nome}” deixa de existir. Não dá para
            desfazer.
          </p>
        )}
        {erro && (
          <p role="alert" className="text-[12.5px] text-perigo">
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={aoFechar} disabled={rodando} className="app-secondary-button h-9 px-4 text-[13px]">
            Cancelar
          </button>
          <button type="submit" disabled={rodando || !escolhida} className="app-primary-button h-9 px-4 text-[13px]">
            {rodando ? 'Juntando…' : 'Juntar etiquetas'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
