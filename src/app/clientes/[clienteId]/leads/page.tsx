import Link from 'next/link'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Suspense } from 'react'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import {
  ETIQUETAS_DE_LEAD,
  LEADS_POR_PAGINA,
  limparBusca,
  paginarLeads,
  type EtiquetaDeLead,
  type Lead,
} from '@/server/repos/leads'
import { horaExata, quando } from '@/lib/quando'

export const dynamic = 'force-dynamic'

type Busca = { etiqueta?: string | string[]; busca?: string | string[]; pagina?: string | string[] }

const filtros: { etiqueta: EtiquetaDeLead; rotulo: string }[] = [
  { etiqueta: 'abriu_com_midia', rotulo: 'Abriu com áudio/mídia' },
  { etiqueta: 'foi_para_pessoa', rotulo: 'Foi para pessoa' },
  { etiqueta: 'nao_respondeu', rotulo: 'Não respondeu depois da primeira' },
]

function primeiro(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? ''
}

function etiquetaValida(valor: Busca['etiqueta']): EtiquetaDeLead | null {
  const unica = primeiro(valor)
  return ETIQUETAS_DE_LEAD.find((etiqueta) => etiqueta === unica) ?? null
}

/** Monta o endereço da própria tela preservando o que já estava escolhido. */
function endereco(
  clienteId: string,
  filtro: { etiqueta?: EtiquetaDeLead | null; busca?: string; pagina?: number },
): string {
  const parametros = new URLSearchParams()
  if (filtro.etiqueta) parametros.set('etiqueta', filtro.etiqueta)
  if (filtro.busca) parametros.set('busca', filtro.busca)
  if (filtro.pagina && filtro.pagina > 1) parametros.set('pagina', String(filtro.pagina))

  const consulta = parametros.toString()
  return `/clientes/${clienteId}/leads${consulta ? `?${consulta}` : ''}`
}

/** A exportação leva o mesmo filtro da tela — ver o porquê na própria rota. */
function enderecoDoCsv(clienteId: string, etiqueta: EtiquetaDeLead | null, busca: string): string {
  const parametros = new URLSearchParams()
  if (etiqueta) parametros.set('etiqueta', etiqueta)
  if (busca) parametros.set('busca', busca)

  const consulta = parametros.toString()
  return `/api/clientes/${clienteId}/leads/csv${consulta ? `?${consulta}` : ''}`
}

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Busca>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const etiqueta = etiquetaValida(busca.etiqueta)
  const termo = limparBusca(primeiro(busca.busca))
  const pagina = Math.max(1, Number(primeiro(busca.pagina)) || 1)

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="flex min-h-full flex-col px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Suspense key={`${etiqueta}-${termo}-${pagina}`} fallback={<Esqueleto />}>
          <Tabela clienteId={cliente.id} etiqueta={etiqueta} termo={termo} pagina={pagina} />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

function Esqueleto() {
  return (
    <div className="app-card overflow-hidden">
      <div className="h-11 border-b border-white/[0.07] bg-white/[0.018]" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-14 animate-pulse items-center gap-3 border-b border-white/[0.045] px-3.5">
          <span className="size-8 rounded-full bg-white/[0.06]" />
          <span className="h-3 w-36 rounded bg-white/[0.06]" />
        </div>
      ))}
      <span className="sr-only">Carregando os contatos…</span>
    </div>
  )
}

function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

async function Tabela({
  clienteId,
  etiqueta,
  termo,
  pagina: pedida,
}: {
  clienteId: string
  etiqueta: EtiquetaDeLead | null
  termo: string
  pagina: number
}) {
  const filtrando = etiqueta !== null || termo !== ''
  const { leads, total, pagina, paginas } = await paginarLeads(clienteId, {
    etiqueta,
    busca: termo,
    pagina: pedida,
  })

  // Sem filtro e sem nenhum lead, a tela ainda é de primeira vez: o que ajuda
  // é dizer o que falta ligar, não uma tabela vazia com um cabeçalho bonito.
  if (total === 0 && !filtrando) {
    const canais = await listarCanais(clienteId)
    return <PrimeiraVez clienteId={clienteId} temCanal={canais.length > 0} />
  }

  const colunas = colunasDosCampos(leads)
  const esperando = leads.filter((lead) => lead.aguardando).length
  const primeiroDaPagina = (pagina - 1) * LEADS_POR_PAGINA + 1
  const ultimoDaPagina = primeiroDaPagina + leads.length - 1

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center justify-end gap-2 md:-mt-[53px]">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-muted">
          {total} {total === 1 ? 'pessoa' : 'pessoas'}
          {filtrando && ' no filtro'}
        </span>
        {esperando > 0 && (
          <span className="rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-3 py-1 text-[11px] font-bold text-rose-300">
            {esperando} esperando humano nesta página
          </span>
        )}
        <Link
          href={`/clientes/${clienteId}/leads/importar`}
          className="app-secondary-button px-3 py-1.5 text-[11.5px]"
          title="Casar a planilha do cliente com quem já conversou, e corrigir os nomes"
        >
          Importar
        </Link>
        <a
          href={enderecoDoCsv(clienteId, etiqueta, termo)}
          className="app-secondary-button px-3 py-1.5 text-[11.5px]"
          title="Baixar como planilha exatamente o que este filtro mostra"
        >
          Baixar CSV
        </a>
      </div>

      <form action={`/clientes/${clienteId}/leads`} className="mb-3 flex flex-wrap gap-2">
        {etiqueta && <input type="hidden" name="etiqueta" value={etiqueta} />}
        <label className="flex-1 basis-[240px]">
          <span className="sr-only">Buscar por nome ou telefone</span>
          <input
            type="search"
            name="busca"
            defaultValue={termo}
            placeholder="Buscar por nome ou telefone"
            className="app-field px-3 py-2 text-[12.5px]"
          />
        </label>
        <button type="submit" className="app-secondary-button px-4 py-2 text-[12px]">
          Buscar
        </button>
        {termo !== '' && (
          <Link
            href={endereco(clienteId, { etiqueta })}
            className="self-center text-[11.5px] font-semibold text-accent hover:underline"
          >
            Limpar busca
          </Link>
        )}
      </form>

      {/* Sem contagem por etiqueta de propósito: cada número desses obrigava a
          ler o histórico do cliente inteiro a cada visita — exatamente o que a
          paginação veio evitar. O número que importa continua acima. */}
      <nav aria-label="Filtrar contatos por etiqueta" className="mb-3 flex flex-wrap gap-2">
        <Link
          href={endereco(clienteId, { busca: termo })}
          aria-current={etiqueta === null ? 'page' : undefined}
          className={classeDoFiltro(etiqueta === null)}
          scroll={false}
        >
          Todos
        </Link>
        {filtros.map((filtro) => (
          <Link
            key={filtro.etiqueta}
            href={endereco(clienteId, { etiqueta: filtro.etiqueta, busca: termo })}
            aria-current={etiqueta === filtro.etiqueta ? 'page' : undefined}
            className={classeDoFiltro(etiqueta === filtro.etiqueta)}
            scroll={false}
          >
            {filtro.rotulo}
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <div className="app-card py-14 text-center">
          <p className="text-[13px] font-bold">
            {termo !== '' ? `Ninguém com "${termo}"` : 'Ninguém com esta etiqueta'}
          </p>
          <Link
            href={`/clientes/${clienteId}/leads`}
            className="mt-2 inline-block text-[11.5px] font-semibold text-accent hover:underline"
            scroll={false}
          >
            Limpar filtro
          </Link>
        </div>
      ) : (
        <>
          <div className="app-card overflow-x-auto overflow-y-hidden">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.07]">
                  <Cabecalho>Contato</Cabecalho>
                  {colunas.map((coluna) => <Cabecalho key={coluna} mono>{coluna}</Cabecalho>)}
                  <Cabecalho>Situação</Cabecalho>
                  <Cabecalho>Última mensagem</Cabecalho>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                <tr key={lead.contatoId} className="border-b border-white/[0.045] transition last:border-0 hover:bg-white/[0.03]">
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nome={lead.nome} />
                      <div className="min-w-0">
                        <Link
                          href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
                          className="block truncate text-[13px] font-bold transition hover:text-accent"
                        >
                          {lead.nome ?? 'sem nome'}
                        </Link>
                        <span className="block whitespace-nowrap font-mono text-[10px] text-dim">{telefoneLegivel(lead.waId)}</span>
                      </div>
                    </div>
                  </td>
                  {colunas.map((coluna) => (
                    <td key={coluna} className="max-w-48 truncate px-3.5 py-3 font-mono text-[11px] text-[#97a2b4]">
                      {lead.campos[coluna] || <span className="text-dim">—</span>}
                    </td>
                  ))}
                  <td className="px-3.5 py-3">
                    {lead.aguardando ? (
                      <>
                        <span className="inline-flex rounded-full border border-rose-400/25 bg-rose-400/[0.09] px-2.5 py-1 text-[10.5px] font-bold text-rose-300">
                          AGUARDANDO HUMANO
                        </span>
                        <span className="mt-1 block max-w-52 truncate text-[10.5px] text-dim" title={horaExata(lead.aguardando.desde)}>
                          {quando(lead.aguardando.desde)} · {lead.aguardando.motivo}
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10.5px] font-bold text-emerald-300">
                        COM O BOT
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-[11.5px] whitespace-nowrap text-muted">
                    {lead.ultimaEm ? (
                      <>
                        <span title={horaExata(lead.ultimaEm)}>{quando(lead.ultimaEm)}</span>
                        {lead.ultimoTexto && (
                          <span className="block max-w-52 truncate text-[10.5px] text-dim">
                            {lead.ultimaDirecao === 'saida' && `${lead.ultimaEntregue ? 'bot: ' : 'envio não confirmado: '}`}{lead.ultimoTexto}
                          </span>
                        )}
                      </>
                    ) : 'sem mensagem'}
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <nav
              aria-label="Páginas de leads"
              className="mt-3 flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-[11.5px] text-muted">
                {primeiroDaPagina}–{ultimoDaPagina} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Passo
                  href={endereco(clienteId, { etiqueta, busca: termo, pagina: pagina - 1 })}
                  ativo={pagina > 1}
                >
                  ‹ Anterior
                </Passo>
                <span className="text-[11.5px] font-semibold text-muted">
                  Página {pagina} de {paginas}
                </span>
                <Passo
                  href={endereco(clienteId, { etiqueta, busca: termo, pagina: pagina + 1 })}
                  ativo={pagina < paginas}
                >
                  Próxima ›
                </Passo>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  )
}

function PrimeiraVez({ clienteId, temCanal }: { clienteId: string; temCanal: boolean }) {
  return (
    <div className="mx-auto mt-16 max-w-[420px] text-center">
      {!temCanal ? (
        <>
          <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-dim">SEM CANAL</p>
          <h2 className="text-[15.5px] font-bold">Nenhum número conectado</h2>
          <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
            Sem um número de WhatsApp ligado a um fluxo publicado, ninguém consegue conversar com o bot — e nenhum contato entra aqui.
          </p>
          <Link href={`/clientes/${clienteId}`} className="app-secondary-button mt-5 inline-block px-5 py-2.5 text-[13px]">
            Conectar um número
          </Link>
        </>
      ) : (
        <>
          <span className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1 text-[11px] font-bold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" /> Número no ar
          </span>
          <h2 className="text-[15.5px] font-bold">Nenhum contato ainda</h2>
          <p className="mt-1.5 text-[12.5px] leading-6 text-muted">
            Quando alguém conversar com o bot, a pessoa aparece aqui com tudo o que o fluxo coletar.
          </p>
        </>
      )}
    </div>
  )
}

function Passo({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  const classe = 'rounded-lg border px-3 py-1.5 text-[11.5px] font-semibold transition'
  if (!ativo) {
    return (
      <span aria-disabled="true" className={`${classe} border-white/[0.06] text-dim`}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} className={`${classe} border-white/10 text-muted hover:border-white/20 hover:text-white`}>
      {children}
    </Link>
  )
}

function classeDoFiltro(ativo: boolean): string {
  return `rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
    ativo
      ? 'border-accent/35 bg-accent/12 text-accent'
      : 'border-white/10 bg-white/[0.025] text-muted hover:border-white/20 hover:text-white'
  }`
}

function Cabecalho({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <th className={`px-3.5 py-3.5 text-[10.5px] font-bold tracking-[0.06em] text-dim uppercase ${mono ? 'font-mono normal-case tracking-[0.02em]' : ''}`}>
      {children}
    </th>
  )
}

function Avatar({ nome }: { nome: string | null }) {
  const iniciais = (nome ?? '?').split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-white/[0.05] text-[10px] font-bold text-[#97a2b4]">
      {iniciais}
    </span>
  )
}
