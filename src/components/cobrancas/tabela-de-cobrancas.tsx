'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Gateway } from '@/channels/pagamento'
import { Avatar } from '@/components/design/avatar'
import { AvisoFlutuante } from '@/components/design/aviso-flutuante'
import { CabecalhoDaTela, Contagem, type TopoDaTela } from '@/components/design/cabecalho-da-tela'
import { useConfirmar } from '@/components/design/confirmar'
import { Pilula, type TomDaPilula } from '@/components/design/pilula'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { acaoCancelarCobranca } from '@/server/acoes-cobrancas'
import type { StatusDeCobranca } from '@/server/repos/cobrancas'

export type LinhaDeCobranca = {
  id: string
  contatoId: string | null
  contato: string
  descricao: string
  valorCentavos: number
  status: StatusDeCobranca
  gateway: Gateway
  pix: string | null
  link: string | null
  venceEm: string
  pagaEm: string | null
  criadoEm: string
  criadaPor: string | null
  origem: 'inbox' | 'fluxo' | 'ia' | 'api'
}

const STATUS: Record<StatusDeCobranca, { rotulo: string; tom: TomDaPilula }> = {
  pendente: { rotulo: 'Aguardando', tom: 'aviso' },
  paga: { rotulo: 'Paga', tom: 'ok' },
  vencida: { rotulo: 'Vencida', tom: 'neutro' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro' },
  estornada: { rotulo: 'Estornada', tom: 'perigo' },
}

const FILTROS: { id: StatusDeCobranca | 'todas'; rotulo: string }[] = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'pendente', rotulo: 'Aguardando' },
  { id: 'paga', rotulo: 'Pagas' },
  { id: 'vencida', rotulo: 'Vencidas' },
  { id: 'cancelada', rotulo: 'Canceladas' },
]

const PERIODOS = [
  { id: '7', rotulo: 'Últimos 7 dias', dias: 7 },
  { id: '30', rotulo: 'Últimos 30 dias', dias: 30 },
  { id: '90', rotulo: 'Últimos 90 dias', dias: 90 },
  { id: 'tudo', rotulo: 'Desde o começo', dias: null },
] as const

const DATA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const reais = (centavos: number) =>
  `R$ ${(centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** A data que importa para cada status: quando pagou, ou até quando vale. */
function quandoDaLinha(c: LinhaDeCobranca): string {
  if (c.status === 'paga' && c.pagaEm) return `Paga em ${DATA.format(new Date(c.pagaEm))}`
  if (c.status === 'pendente') return `Vence ${DATA.format(new Date(c.venceEm))}`
  return `Criada ${DATA.format(new Date(c.criadoEm))}`
}

/**
 * A lista de cobranças, com filtro por status, período e os dois totais que o
 * dono pergunta primeiro: quanto entrou e quanto está para entrar.
 *
 * Cancelar muda a linha na hora e desfaz se o servidor recusar. Se o gateway
 * disser que já foi pago, a linha vira paga em vez de cancelada, e o aviso diz.
 */
export function TabelaDeCobrancas({
  clienteId,
  inicial,
  topo,
}: {
  clienteId: string
  inicial: LinhaDeCobranca[]
  topo: TopoDaTela
}) {
  const [lista, setLista] = useState(inicial)
  const [filtro, setFiltro] = useState<StatusDeCobranca | 'todas'>('todas')
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]['id']>('30')
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null)
  const { confirmar, dialogo } = useConfirmar()
  // O relógio lido uma vez, na abertura da tela: o período não anda sozinho enquanto ela está aberta.
  const [agora] = useState(() => Date.now())

  const doPeriodo = useMemo(() => {
    const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? null
    if (dias === null) return lista
    const desde = agora - dias * 86_400_000
    return lista.filter((c) => new Date(c.criadoEm).getTime() >= desde)
  }, [lista, periodo, agora])

  const visiveis = filtro === 'todas' ? doPeriodo : doPeriodo.filter((c) => c.status === filtro)
  const recebido = doPeriodo.filter((c) => c.status === 'paga').reduce((soma, c) => soma + c.valorCentavos, 0)
  const aReceber = doPeriodo.filter((c) => c.status === 'pendente').reduce((soma, c) => soma + c.valorCentavos, 0)

  const copiarPix = async (c: LinhaDeCobranca) => {
    if (!c.pix) return
    try {
      await navigator.clipboard.writeText(c.pix)
      setRecado({ texto: 'Pix copia e cola copiado.' })
    } catch {
      setRecado({ texto: 'Não foi possível copiar. Abra o link e copie por lá.', erro: true })
    }
  }

  const cancelar = (c: LinhaDeCobranca) =>
    confirmar({
      titulo: `Cancelar a cobrança de ${reais(c.valorCentavos)}?`,
      descricao: 'O Pix e o link deixam de funcionar. A pessoa não é avisada: se for o caso, diga a ela na conversa.',
      rotulo: 'Cancelar cobrança',
      tom: 'perigo',
      aoConfirmar: async () => {
        setLista((atual) => atual.map((x) => (x.id === c.id ? { ...x, status: 'cancelada' } : x)))
        const r = await acaoCancelarCobranca(clienteId, c.id)
        if (!r.ok) {
          setLista((atual) => atual.map((x) => (x.id === c.id ? { ...x, status: c.status } : x)))
          return { ok: false, erro: r.erro }
        }
        setLista((atual) => atual.map((x) => (x.id === c.id ? { ...x, status: r.status } : x)))
        setRecado({ texto: r.status === 'paga' ? 'Esta cobrança já tinha sido paga. Ela ficou como paga.' : 'Cobrança cancelada.' })
        return { ok: true }
      },
    })

  return (
    <>
      <CabecalhoDaTela
        {...topo}
        contagem={<Contagem>{lista.length} {lista.length === 1 ? 'cobrança' : 'cobranças'}</Contagem>}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:max-w-[520px]">
        <div className="app-card px-4 py-3">
          <p className="text-[11.5px] font-semibold text-dim">Recebido</p>
          <p className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-ok tabular-nums">{reais(recebido)}</p>
        </div>
        <div className="app-card px-4 py-3">
          <p className="text-[11.5px] font-semibold text-dim">Aguardando pagamento</p>
          <p className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] tabular-nums">{reais(aReceber)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`h-8 rounded-full border px-3 text-[12px] font-semibold transition ${
                filtro === f.id ? 'border-primary/30 bg-primary-weak text-primary' : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <div className="w-44">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
            aria-label="Período"
            className="app-field h-8 px-2.5 text-[12px]"
          >
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="app-card overflow-hidden">
        {visiveis.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[13.5px] font-semibold text-soft">
              {lista.length === 0 ? 'Nenhuma cobrança ainda' : 'Nenhuma cobrança neste filtro'}
            </p>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] leading-5 text-dim">
              {lista.length === 0
                ? 'Na conversa, use o botão Cobrar da caixa de resposta. O Pix e o link saem ali, e a cobrança aparece aqui.'
                : 'Troque o status ou o período para ver as outras.'}
            </p>
          </div>
        ) : (
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className="border-b border-line bg-surface-strong/60 text-[11.5px] text-dim">
              <tr>
                <th className="px-4 py-2.5 font-semibold sm:px-5">Contato</th>
                <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Descrição</th>
                <th className="w-28 px-4 py-2.5 text-right font-semibold sm:w-32">Valor</th>
                <th className="hidden w-32 px-4 py-2.5 font-semibold sm:table-cell">Status</th>
                <th className="hidden w-44 px-4 py-2.5 font-semibold lg:table-cell">Quando</th>
                <th className="w-16 px-2 py-2.5">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr key={c.id} className="border-t border-line-soft align-middle first:border-t-0">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar nome={c.contato} tamanho={30} />
                      <div className="min-w-0">
                        {c.contatoId ? (
                          <Link
                            href={hrefDaFicha(clienteId, c.contatoId)}
                            className="block truncate text-[13px] font-semibold text-ink hover:text-primary"
                          >
                            {c.contato}
                          </Link>
                        ) : (
                          <span className="block truncate text-[13px] font-semibold text-dim">{c.contato}</span>
                        )}
                        <span className="block truncate text-[11.5px] text-dim md:hidden">{c.descricao}</span>
                        <span className="mt-1 inline-flex sm:hidden">
                          <Pilula tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Pilula>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="block truncate text-soft">{c.descricao}</span>
                    <span className="block truncate text-[11.5px] text-dim">
                      {c.origem === 'inbox' ? (c.criadaPor ? `por ${c.criadaPor}` : 'pelo Inbox') : c.origem === 'fluxo' ? 'pelo fluxo' : c.origem === 'api' ? 'pela API' : 'pela IA'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[13.5px] font-semibold tabular-nums">{reais(c.valorCentavos)}</td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Pilula tom={STATUS[c.status].tom}>{STATUS[c.status].rotulo}</Pilula>
                  </td>
                  <td className="hidden px-4 py-3 text-[12px] text-dim tabular-nums lg:table-cell">{quandoDaLinha(c)}</td>
                  <td className="px-2 py-2.5 text-right">
                    {(c.pix || c.link || c.status === 'pendente') && (
                      <PopoverDoQuadro
                        rotulo={`Ações da cobrança de ${c.contato}`}
                        largura={210}
                        gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
                      >
                        {c.status === 'pendente' && c.pix && (
                          <button type="button" data-fechar-popover className="quadro-menu-item" onClick={() => void copiarPix(c)}>
                            Copiar Pix copia e cola
                          </button>
                        )}
                        {c.link && (
                          <a href={c.link} target="_blank" rel="noreferrer" data-fechar-popover className="quadro-menu-item">
                            Abrir o link de pagamento
                          </a>
                        )}
                        {c.status === 'pendente' && (
                          <button
                            type="button"
                            data-fechar-popover
                            className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
                            onClick={() => cancelar(c)}
                          >
                            Cancelar cobrança…
                          </button>
                        )}
                      </PopoverDoQuadro>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {recado && (
        <AvisoFlutuante tom={recado.erro ? 'erro' : 'neutro'} aoSumir={() => setRecado(null)}>
          {recado.texto}
        </AvisoFlutuante>
      )}
      {dialogo}
    </>
  )
}
