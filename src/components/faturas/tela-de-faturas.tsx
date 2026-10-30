'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { DetalheDaFatura, EstadoDaFatura } from '@/channels/asaas-da-4yu'
import { Modal } from '@/components/design/modal'
import { FUNDO_DA_LINHA, Tabela, Th } from '@/components/design/tabela'
import { filtrarFaturas, FILTRO_INICIAL, reaisDeCentavos, resumoDasFaturas, type FiltroDeFaturas } from '@/core/mensalidade-da-4yu'
import type { FaturaDaConta } from '@/server/repos/faturas-da-conta'

/**
 * Faturas (docs/PLANO-MENSALIDADE-ASAAS.md): a assinatura no topo, os números
 * que importam, e a tabela com filtro, exportação e o detalhe ao lado.
 *
 * Os filtros rodam aqui, sem ida ao servidor: uma organização tem dezenas de
 * faturas, não milhares. O CSV recebe o mesmo filtro pelo endereço, e o
 * arquivo é o que a tela mostra.
 */

export type ResumoDaAssinatura = {
  estado: string | null
  plano: string
  ciclo: 'mensal' | 'anual'
  valorCentavos: number | null
}

const ESTADO: Record<EstadoDaFatura, { rotulo: string; cor: string }> = {
  pendente: { rotulo: 'Em aberto', cor: 'bg-info/10 text-info' },
  vencida: { rotulo: 'Vencida', cor: 'bg-perigo/10 text-perigo' },
  paga: { rotulo: 'Paga', cor: 'bg-ok/10 text-ok' },
  estornada: { rotulo: 'Estornada', cor: 'bg-surface text-muted' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-surface text-dim' },
}

const SITUACAO_DA_ASSINATURA: Record<string, { rotulo: string; cor: string }> = {
  ativa: {
    rotulo: 'Ativa',
    cor: 'border-emerald-400/25 bg-emerald-400/[0.08] text-ok',
  },
  aguardando: {
    rotulo: 'Aguardando o primeiro pagamento',
    cor: 'border-info/25 bg-info/10 text-info',
  },
  atrasada: {
    rotulo: 'Em atraso',
    cor: 'border-amber-300/30 bg-amber-300/[0.1] text-aviso',
  },
  suspensa: {
    rotulo: 'Suspensa por atraso',
    cor: 'border-perigo/25 bg-perigo/10 text-perigo',
  },
  pausada: {
    rotulo: 'Pausada por atraso',
    cor: 'border-perigo/25 bg-perigo/10 text-perigo',
  },
  cancelada_por_atraso: {
    rotulo: 'Cancelada por atraso',
    cor: 'border-perigo/25 bg-perigo/10 text-perigo',
  },
  cancelada: {
    rotulo: 'Cancelada',
    cor: 'border-line bg-surface text-muted',
  },
}

const SITUACOES: { valor: FiltroDeFaturas['situacao']; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'em_aberto', rotulo: 'Em aberto' },
  { valor: 'pagas', rotulo: 'Pagas' },
  { valor: 'vencidas', rotulo: 'Vencidas' },
  { valor: 'canceladas', rotulo: 'Canceladas' },
]

const dia = (aaaammdd: string) =>
  new Date(`${aaaammdd}T12:00:00Z`).toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
  })
const quando = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const rotuloDoTipo = (tipo: FaturaDaConta['tipo']) => (tipo === 'excedente' ? 'Conversas acima da faixa' : 'Mensalidade')
const emAberto = (estado: EstadoDaFatura) => estado === 'pendente' || estado === 'vencida'

export function TelaDeFaturas({
  faturas,
  assinatura,
  podeMexer,
  combinada = null,
  planoHref,
  csvHref,
  hoje,
  lerDetalhe,
  cancelar,
}: {
  faturas: FaturaDaConta[]
  assinatura: ResumoDaAssinatura | null
  podeMexer: boolean
  /** Cobrança combinada com a 4YU (0148): o cartão diz isso no lugar de "Escolher um plano". */
  combinada?: 'por_fora' | 'cortesia' | null
  planoHref: string
  /** O endereço do CSV, sem o filtro: a tela acrescenta. */
  csvHref: string
  /** `aaaa-mm-dd` em São Paulo, do servidor: o ano dos números não muda na virada do fuso. */
  hoje: string
  lerDetalhe: (faturaId: string) => Promise<{ ok: true; detalhe: DetalheDaFatura } | { ok: false; erro: string }>
  cancelar: () => Promise<{ ok: boolean; erro?: string }>
}) {
  const [filtro, setFiltro] = useState<FiltroDeFaturas>(FILTRO_INICIAL)
  const [aberta, setAberta] = useState<FaturaDaConta | null>(null)
  const [estadoLocal, setEstadoLocal] = useState<string | null>(null)
  const estadoDaAssinatura = estadoLocal ?? assinatura?.estado ?? null

  const visiveis = useMemo(() => filtrarFaturas(faturas, filtro), [faturas, filtro])
  const ano = hoje.slice(0, 4)
  const numeros = resumoDasFaturas(faturas, ano)
  const anos = [...new Set(faturas.map((f) => f.vencimento.slice(0, 4)))].sort().reverse()
  const contagem = (valor: FiltroDeFaturas['situacao']) => filtrarFaturas(faturas, { ...filtro, situacao: valor }).length
  const aPagar = faturas.filter((f) => emAberto(f.estado)).sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const proxima = aPagar[0] ?? null
  const filtrando = filtro.situacao !== 'todas' || filtro.tipo !== 'todos' || filtro.ano !== 'todos'
  const parametros = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v !== 'todas' && v !== 'todos'))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <div className="sm:col-span-3 lg:col-span-1 flex">
          <CartaoDaAssinatura
            assinatura={assinatura}
            combinada={combinada}
            estado={estadoDaAssinatura}
            podeMexer={podeMexer}
            planoHref={planoHref}
            linkParaPagar={proxima?.link ?? null}
            cancelar={async () => {
              const r = await cancelar()
              if (r.ok) setEstadoLocal('cancelada')
              return r
            }}
          />
        </div>
        <Numero
          rotulo="Em aberto"
          valor={reaisDeCentavos(numeros.emAberto)}
          detalhe={numeros.abertas === 0 ? 'Nada a pagar' : `${numeros.abertas} ${numeros.abertas === 1 ? 'fatura' : 'faturas'}`}
          tom={numeros.emAberto > 0 ? (aPagar.some((f) => f.estado === 'vencida') ? 'perigo' : 'aviso') : 'neutro'}
        />
        <Numero
          rotulo="Próximo vencimento"
          valor={proxima ? dia(proxima.vencimento) : 'Nenhum'}
          detalhe={proxima ? reaisDeCentavos(proxima.valorCentavos) : 'Sem fatura em aberto'}
        />
        <Numero rotulo={`Pago em ${ano}`} valor={reaisDeCentavos(numeros.pagoNoAno)} detalhe="Mensalidades e excedentes" />
      </div>

      <section aria-labelledby="titulo-historico" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titulo-historico" className="text-[15px] font-bold tracking-[-0.01em]">
            Histórico
          </h2>
          <a
            href={`${csvHref}${parametros.size > 0 ? `?${parametros}` : ''}`}
            className={`botao-secundario botao-sm inline-flex items-center gap-1.5 ${visiveis.length === 0 ? 'pointer-events-none opacity-50' : ''}`}
            aria-disabled={visiveis.length === 0}
            download
          >
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
            </svg>
            Exportar CSV
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* No celular, os chips rolam de lado em vez de quebrar em duas linhas. */}
          <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
            <div role="radiogroup" aria-label="Situação" className="flex w-max gap-1 rounded-[11px] border border-line bg-surface p-0.5">
              {SITUACOES.map((s) => {
                const aceso = filtro.situacao === s.valor
                return (
                  <button
                    key={s.valor}
                    type="button"
                    role="radio"
                    aria-checked={aceso}
                    onClick={() => setFiltro((f) => ({ ...f, situacao: s.valor }))}
                    className={`rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold transition ${aceso ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-soft'}`}
                  >
                    {s.rotulo}
                    <span className={`ml-1.5 tabular-nums ${aceso ? 'text-dim' : 'text-dim/80'}`}>{contagem(s.valor)}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <select
            aria-label="Tipo"
            value={filtro.tipo}
            onChange={(e) =>
              setFiltro((f) => ({
                ...f,
                tipo: e.target.value as FiltroDeFaturas['tipo'],
              }))
            }
            className="app-field h-9 !w-auto flex-1 px-2.5 text-[13px] sm:flex-none"
          >
            <option value="todos">Todos os tipos</option>
            <option value="mensalidade">Mensalidade</option>
            <option value="excedente">Conversas acima da faixa</option>
          </select>
          <select
            aria-label="Ano"
            value={filtro.ano}
            onChange={(e) => setFiltro((f) => ({ ...f, ano: e.target.value }))}
            className="app-field h-9 !w-auto flex-1 px-2.5 text-[13px] sm:flex-none"
          >
            <option value="todos">Todos os anos</option>
            {anos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          {filtrando && (
            <button
              type="button"
              onClick={() => setFiltro(FILTRO_INICIAL)}
              className="text-[12px] font-semibold text-primary hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {faturas.length === 0 ? (
          <Vazio
            titulo="Nenhuma fatura ainda"
            texto="A primeira aparece aqui assim que a assinatura for criada. Cada cobrança traz o recibo e, quando emitida, a nota fiscal."
          />
        ) : visiveis.length === 0 ? (
          <Vazio titulo="Nenhuma fatura com esses filtros" texto="Troque a situação, o tipo ou o ano, ou limpe os filtros." />
        ) : (
          <>
            {/* Desktop: a tabela da casa. Celular: um cartão por fatura. */}
            <div className="hidden md:flex">
              <Tabela largura={820}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>Vencimento</Th>
                    <Th>Descrição</Th>
                    <Th className="text-right">Valor</Th>
                    <Th>Situação</Th>
                    <Th>Paga em</Th>
                    <Th className="text-right">
                      <span className="sr-only">Ações</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((f) => (
                    <tr
                      key={f.id}
                      onClick={() => setAberta(f)}
                      className={`group cursor-pointer border-b border-line last:border-b-0 ${FUNDO_DA_LINHA} ${aberta?.id === f.id ? 'bg-primary/[0.05]' : ''}`}
                    >
                      <td className="px-4 py-3 text-[13px] tabular-nums text-soft">{dia(f.vencimento)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left text-[13px] font-semibold text-soft group-hover:text-ink"
                          onClick={() => setAberta(f)}
                        >
                          {rotuloDoTipo(f.tipo)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-soft">
                        {reaisDeCentavos(f.valorCentavos)}
                      </td>
                      <td className="px-4 py-3">
                        <SeloDaFatura estado={f.estado} />
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-muted">
                        {f.pagaEm ? quando(f.pagaEm) : <span className="text-dim">Não paga</span>}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <AcoesDaFatura fatura={f} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {visiveis.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setAberta(f)} className="app-card flex w-full flex-col gap-2 p-4 text-left">
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-[13px] font-semibold text-soft">{rotuloDoTipo(f.tipo)}</span>
                        <span className="block text-[11.5px] text-dim">
                          {f.estado === 'paga' && f.pagaEm ? `Paga em ${quando(f.pagaEm)}` : `Vence em ${dia(f.vencimento)}`}
                        </span>
                      </span>
                      <span className="text-[13.5px] font-semibold tabular-nums text-soft">{reaisDeCentavos(f.valorCentavos)}</span>
                    </span>
                    <span className="flex items-center justify-between">
                      <SeloDaFatura estado={f.estado} />
                      <span className="text-[12px] font-semibold text-primary">Ver detalhe</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {aberta && <PainelDaFatura fatura={aberta} lerDetalhe={lerDetalhe} aoFechar={() => setAberta(null)} />}
    </div>
  )
}

function SeloDaFatura({ estado }: { estado: EstadoDaFatura }) {
  const s = ESTADO[estado]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${s.cor}`}>{s.rotulo}</span>
}

function AcoesDaFatura({ fatura }: { fatura: FaturaDaConta }) {
  return (
    <span className="inline-flex justify-end gap-1.5">
      {fatura.notaFiscalUrl && (
        <a href={fatura.notaFiscalUrl} target="_blank" rel="noreferrer" className="botao-secundario botao-sm">
          Nota fiscal
        </a>
      )}
      {fatura.link && fatura.estado !== 'cancelada' && (
        <a
          href={fatura.link}
          target="_blank"
          rel="noreferrer"
          className={`${emAberto(fatura.estado) ? 'botao-primario' : 'botao-secundario'} botao-sm`}
        >
          {emAberto(fatura.estado) ? 'Pagar' : 'Recibo'}
        </a>
      )}
    </span>
  )
}

/**
 * Um número do topo. No celular vira linha (rótulo à esquerda, valor à
 * direita): três cartões altos empilhados empurravam a tabela para fora da tela.
 */
function Numero({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe: string
  tom?: 'neutro' | 'aviso' | 'perigo'
}) {
  const cor = tom === 'perigo' ? 'text-perigo' : tom === 'aviso' ? 'text-aviso' : 'text-ink'
  return (
    <div className="app-card flex items-center justify-between gap-3 px-4 py-3 sm:flex-col sm:items-stretch sm:p-5">
      <p className="text-[11.5px] font-semibold text-dim">{rotulo}</p>
      <div className="text-right sm:text-left">
        <p className={`text-[17px] font-bold tracking-[-0.02em] tabular-nums sm:text-[22px] ${cor}`}>{valor}</p>
        <p className="mt-0.5 text-[11.5px] text-dim sm:text-[12px]">{detalhe}</p>
      </div>
    </div>
  )
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="app-card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-primary/[0.08] text-primary">
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8.5h6M9 12h6" />
        </svg>
      </span>
      <p className="text-[14px] font-bold">{titulo}</p>
      <p className="max-w-[420px] text-[12.5px] leading-6 text-dim">{texto}</p>
    </div>
  )
}

function CartaoDaAssinatura({
  assinatura,
  combinada,
  estado,
  podeMexer,
  planoHref,
  linkParaPagar,
  cancelar,
}: {
  assinatura: ResumoDaAssinatura | null
  combinada: 'por_fora' | 'cortesia' | null
  estado: string | null
  podeMexer: boolean
  planoHref: string
  linkParaPagar: string | null
  cancelar: () => Promise<{ ok: boolean; erro?: string }>
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [rodando, comecar] = useTransition()

  if (!assinatura && combinada) {
    return (
      <div className="app-card flex w-full flex-col justify-between gap-4 p-5">
        <div>
          <p className="text-[11.5px] font-semibold text-dim">Assinatura</p>
          <p className="mt-1 text-[17px] font-bold tracking-[-0.02em]">
            {combinada === 'cortesia' ? 'Cortesia da 4YU' : 'Combinada com a 4YU'}
          </p>
          <p className="mt-1 text-[12.5px] leading-5 text-dim">
            {combinada === 'cortesia'
              ? 'Esta organização não tem cobrança. Para mudar de plano, peça em Plano e consumo.'
              : 'O pagamento desta organização é combinado direto com a 4YU. Dúvidas: contato@4yu.com.br.'}
          </p>
        </div>
      </div>
    )
  }

  if (!assinatura) {
    return (
      <div className="app-card flex w-full flex-col justify-between gap-4 p-5">
        <div>
          <p className="text-[11.5px] font-semibold text-dim">Assinatura</p>
          <p className="mt-1 text-[17px] font-bold tracking-[-0.02em]">Ainda sem assinatura</p>
          <p className="mt-1 text-[12.5px] leading-5 text-dim">Escolha um plano e pague por cartão, Pix ou boleto, com nota fiscal.</p>
        </div>
        <Link href={planoHref} className="botao-primario botao-md self-start">
          Escolher um plano
        </Link>
      </div>
    )
  }

  const situacao = SITUACAO_DA_ASSINATURA[estado ?? ''] ?? SITUACAO_DA_ASSINATURA.aguardando!
  const cancelada = estado === 'cancelada' || estado === 'cancelada_por_atraso'
  return (
    <div className="app-card flex w-full flex-col justify-between gap-4 p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] font-semibold text-dim">Assinatura</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${situacao.cor}`}>{situacao.rotulo}</span>
        </div>
        <p className="mt-1 text-[19px] font-bold tracking-[-0.02em]">
          {assinatura.plano} <span className="text-[13px] font-semibold text-muted">{assinatura.ciclo}</span>
        </p>
        {assinatura.valorCentavos !== null && !cancelada && (
          <p className="mt-0.5 text-[12.5px] text-muted">
            {reaisDeCentavos(assinatura.valorCentavos)} {assinatura.ciclo === 'anual' ? 'por ano' : 'por mês'}, no cartão, Pix ou boleto
          </p>
        )}
        {cancelada && (
          <p className="mt-0.5 text-[12.5px] text-muted">Sem cobranças novas. O acesso segue até o fim do período já pago.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {linkParaPagar && (
          <a href={linkParaPagar} target="_blank" rel="noreferrer" className="botao-primario botao-sm">
            Pagar agora
          </a>
        )}
        <Link href={planoHref} className="botao-secundario botao-sm">
          {cancelada ? 'Assinar de novo' : 'Mudar de plano'}
        </Link>
        {!cancelada && podeMexer && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="ml-auto text-[12px] font-semibold text-dim hover:text-perigo"
          >
            Cancelar assinatura
          </button>
        )}
      </div>

      <Modal
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Cancelar a assinatura"
        descricao="As cobranças param a partir de agora. Faturas já pagas continuam com recibo e nota fiscal."
        largura={460}
      >
        <p className="text-[12.5px] leading-6 text-muted">
          O acesso segue até o fim do período já pago. Na primeira assinatura, quem cancela em até 7 dias recebe o valor integral de
          volta. Nada é apagado: fluxos, contatos e conversas ficam guardados.
        </p>
        {erro && (
          <p role="alert" className="mt-3 text-[12.5px] text-perigo">
            {erro}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmando(false)} className="botao-secundario botao-md">
            Manter assinatura
          </button>
          <button
            type="button"
            disabled={rodando}
            onClick={() =>
              comecar(async () => {
                setErro(null)
                const r = await cancelar()
                if (r.ok) setConfirmando(false)
                else setErro(r.erro ?? 'não foi possível cancelar')
              })
            }
            className="botao-perigo botao-md"
          >
            {rodando ? 'Cancelando...' : 'Cancelar assinatura'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

/** "Dialogon Operação, mensal: plano R$ 597,00 + 2 atendentes extras R$ 118,00" em linhas de rótulo e valor. */
function composicao(descricao: string | null): { rotulo: string; valor: string }[] | null {
  const depois = descricao?.split(': ')[1]
  if (!depois) return null
  const linhas = depois.split(' + ').map((parte) => {
    const achado = parte.match(/^(.*?)\s+(R\$\s?[\d.,]+)$/)
    if (!achado) return null
    const rotulo = achado[1]!
    return {
      rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1),
      valor: achado[2]!,
    }
  })
  return linhas.every(Boolean) ? (linhas as { rotulo: string; valor: string }[]) : null
}

function PainelDaFatura({
  fatura,
  lerDetalhe,
  aoFechar,
}: {
  fatura: FaturaDaConta
  lerDetalhe: (faturaId: string) => Promise<{ ok: true; detalhe: DetalheDaFatura } | { ok: false; erro: string }>
  aoFechar: () => void
}) {
  const [lido, setLido] = useState<{
    id: string
    detalhe?: DetalheDaFatura
    erro?: string
  } | null>(null)
  // Em ref: a função muda a cada render do pai, e relê-la refaria a ida ao Asaas.
  const fechar = useRef(aoFechar)
  useEffect(() => {
    fechar.current = aoFechar
  })

  useEffect(() => {
    let vivo = true
    lerDetalhe(fatura.id)
      .then((r) => vivo && setLido(r.ok ? { id: fatura.id, detalhe: r.detalhe } : { id: fatura.id, erro: r.erro }))
      .catch(
        () =>
          vivo &&
          setLido({
            id: fatura.id,
            erro: 'não foi possível carregar o detalhe agora',
          }),
      )
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current()
    window.addEventListener('keydown', tecla)
    return () => {
      vivo = false
      window.removeEventListener('keydown', tecla)
    }
  }, [fatura.id, lerDetalhe])

  // O que a linha já sabe aparece na hora; o resto chega do Asaas.
  const carregando = lido?.id !== fatura.id
  const detalhe = carregando ? undefined : lido?.detalhe
  const erro = carregando ? undefined : lido?.erro
  const partes = composicao(detalhe?.descricao ?? null)
  const nota = detalhe?.nota ?? null
  const aberto = emAberto(fatura.estado)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Fechar detalhe" onClick={aoFechar} className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${rotuloDoTipo(fatura.tipo)} de ${dia(fatura.vencimento)}`}
        className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto border-l border-line bg-panel shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
          <div>
            <p className="text-[11.5px] font-semibold text-dim">{rotuloDoTipo(fatura.tipo)}</p>
            <p className="mt-1 text-[26px] font-bold tracking-[-0.02em] tabular-nums">{reaisDeCentavos(fatura.valorCentavos)}</p>
            <div className="mt-2">
              <SeloDaFatura estado={fatura.estado} />
            </div>
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="botao-icone">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-6 py-5">
          <Bloco titulo="Composição">
            {carregando ? (
              <Linhas quantas={2} />
            ) : partes ? (
              <dl className="flex flex-col gap-2">
                {partes.map((p) => (
                  <div key={p.rotulo} className="flex justify-between gap-4 text-[13px]">
                    <dt className="text-muted">{p.rotulo}</dt>
                    <dd className="font-semibold tabular-nums text-soft">{p.valor}</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between gap-4 border-t border-line pt-2 text-[13px]">
                  <dt className="font-semibold text-soft">Total</dt>
                  <dd className="font-bold tabular-nums">{reaisDeCentavos(fatura.valorCentavos)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-[13px] leading-6 text-muted">{detalhe?.descricao ?? rotuloDoTipo(fatura.tipo)}</p>
            )}
          </Bloco>

          <Bloco titulo="Pagamento">
            <dl className="flex flex-col gap-2 text-[13px]">
              <Item rotulo="Vencimento" valor={dia(fatura.vencimento)} />
              <Item rotulo="Paga em" valor={fatura.pagaEm ? quando(fatura.pagaEm) : 'Ainda não'} />
              <Item
                rotulo="Forma"
                valor={carregando ? null : (detalhe?.forma ?? (aberto ? 'Escolhida na hora de pagar' : 'Não informada'))}
              />
              {detalhe?.numero && <Item rotulo="Número da cobrança" valor={detalhe.numero} />}
            </dl>
          </Bloco>

          <Bloco titulo="Nota fiscal">
            {carregando ? (
              <Linhas quantas={1} />
            ) : nota?.emitida && nota.pdf ? (
              <a href={nota.pdf} target="_blank" rel="noreferrer" className="botao-secundario botao-sm self-start">
                Baixar nota {nota.numero ? `nº ${nota.numero}` : ''}
              </a>
            ) : (
              <p className="text-[12.5px] leading-6 text-dim">
                {fatura.estado === 'paga'
                  ? 'Em emissão. Aparece aqui assim que a prefeitura autorizar.'
                  : 'Emitida depois que o pagamento é confirmado.'}
              </p>
            )}
          </Bloco>

          {erro && (
            <p role="alert" className="text-[12.5px] text-perigo">
              {erro}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap gap-2 border-t border-line px-6 py-4">
          {fatura.link && fatura.estado !== 'cancelada' && (
            <a
              href={fatura.link}
              target="_blank"
              rel="noreferrer"
              className={`${aberto ? 'botao-primario' : 'botao-secundario'} botao-md flex-1 text-center`}
            >
              {aberto ? 'Pagar agora' : 'Ver recibo'}
            </a>
          )}
          {aberto && detalhe?.boleto && (
            <a href={detalhe.boleto} target="_blank" rel="noreferrer" className="botao-secundario botao-md">
              Boleto
            </a>
          )}
        </footer>
      </aside>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase">{titulo}</h3>
      {children}
    </section>
  )
}

function Item({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{rotulo}</dt>
      <dd className="text-right font-semibold text-soft">
        {valor ?? <span className="inline-block h-3 w-24 animate-pulse rounded bg-surface" />}
      </dd>
    </div>
  )
}

function Linhas({ quantas }: { quantas: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: quantas }, (_, i) => (
        <span key={i} className="h-3.5 animate-pulse rounded bg-surface" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}
