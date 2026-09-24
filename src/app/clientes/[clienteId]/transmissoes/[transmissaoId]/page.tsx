import Link from 'next/link'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Paginacao } from '@/components/atividades/paginacao'
import {
  Numeros,
  ProximaAcao,
  ROTULO_DO_ESTADO,
} from '@/components/transmissoes/numeros'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { diaEHora } from '@/core/datas'
import { proximaAcaoDaTransmissao } from '@/core/transmissoes-na-tela'
import { acharCliente } from '@/server/repos/clientes'
import { lerTemplate } from '@/server/repos/templates'
import {
  ESTADOS_DO_DESTINATARIO,
  type EstadoDoDestinatario,
  lerTransmissao,
  listarDestinatarios,
  progressoDa,
} from '@/server/repos/transmissoes'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 50

const ROTULO_DO_DESTINATARIO: Record<EstadoDoDestinatario, { texto: string; cor: string }> = {
  na_fila: { texto: 'Na fila', cor: 'bg-line text-dim' },
  aceita: { texto: 'Saiu', cor: 'bg-sky-500/15 text-sky-600' },
  retida: { texto: 'Meta avaliando', cor: 'bg-amber-500/15 text-amber-600' },
  entregue: { texto: 'Chegou', cor: 'bg-emerald-500/15 text-emerald-600' },
  lida: { texto: 'Lida', cor: 'bg-emerald-500/15 text-emerald-600' },
  falhou: { texto: 'Não recebeu', cor: 'bg-red-500/15 text-red-600' },
}

/**
 * O detalhe de uma transmissão: os números, o que fazer depois e quem
 * recebeu o quê (tarefa 6.3, C11 e T02).
 *
 * A lista mostra "12 falharam"; aqui a pessoa vê **quais** 12 e por quê, e
 * chega na conversa de cada um. O filtro de estado mora no endereço, como o
 * resto das listas, para o link "ver as que falharam" poder ser mandado.
 *
 * A leitura fica dentro da moldura: quem não pode ver transmissões recebe a
 * tela de sem acesso, e a consulta nem roda.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string; transmissaoId: string }>
  searchParams: Promise<{ estado?: string; pagina?: string }>
}) {
  const { clienteId, transmissaoId } = await params
  const { estado, pagina } = await searchParams

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="transmissoes">
      <Detalhe
        clienteId={cliente.id}
        transmissaoId={transmissaoId}
        estado={ESTADOS_DO_DESTINATARIO.find((e) => e === estado)}
        pagina={Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1)}
      />
    </ClienteShell>
  )
}

async function Detalhe({
  clienteId,
  transmissaoId,
  estado,
  pagina,
}: {
  clienteId: string
  transmissaoId: string
  estado: EstadoDoDestinatario | undefined
  pagina: number
}) {
  const transmissao = await lerTransmissao(transmissaoId)
  // Id de outra conta responde igual a id que não existe: não confirma nada.
  if (!transmissao || transmissao.clienteId !== clienteId) notFound()

  const [progresso, template, destinatarios] = await Promise.all([
    progressoDa(transmissao.id),
    lerTemplate(transmissao.templateId),
    listarDestinatarios(transmissao.id, { estado, pagina, porPagina: POR_PAGINA }),
  ])
  const rotulo = ROTULO_DO_ESTADO[transmissao.estado]
  const proxima = proximaAcaoDaTransmissao(transmissao, progresso, clienteId)
  const base = `/clientes/${clienteId}/transmissoes/${transmissao.id}`
  const endereco = (novos: { estado?: string; pagina?: number }) => {
    const busca = new URLSearchParams()
    if (novos.estado) busca.set('estado', novos.estado)
    if (novos.pagina && novos.pagina > 1) busca.set('pagina', String(novos.pagina))
    const texto = busca.toString()
    return texto ? `${base}?${texto}` : base
  }

  const filtros: { valor?: EstadoDoDestinatario; rotulo: string; quantos: number }[] = [
    { rotulo: 'Todos', quantos: progresso.total },
    ...ESTADOS_DO_DESTINATARIO.filter((e) => progresso[e] > 0).map((e) => ({
      valor: e,
      rotulo: ROTULO_DO_DESTINATARIO[e].texto,
      quantos: progresso[e],
    })),
  ]

  return (
    <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
      <Link
        href={`/clientes/${clienteId}/transmissoes?aba=transmissoes`}
        className="text-[12.5px] font-semibold text-dim hover:text-ink"
      >
        ‹ Transmissões
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">{transmissao.nome}</h1>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rotulo.cor}`}>
          {rotulo.texto}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-5 text-dim">
        Modelo {template ? `"${template.nome.replace(/_/g, ' ')}"` : 'apagado'}
        {' · '}
        {transmissao.quando
          ? `marcada para ${diaEHora(transmissao.quando)}`
          : `criada em ${diaEHora(transmissao.criadaEm)}`}
        {transmissao.criadaPorNome ? ` por ${transmissao.criadaPorNome}` : ''}
      </p>

      <section className="app-card mt-5 px-5 py-4">
        <Numeros progresso={progresso} />
        {transmissao.erro && (
          <p className="mt-2 rounded-[10px] bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-700 dark:text-red-300">
            <strong>Por que parou:</strong> {transmissao.erro}
          </p>
        )}
        {proxima && <ProximaAcao acao={proxima} />}
      </section>

      <section className="app-card mt-4 overflow-hidden">
        <header className="border-b border-line px-5 py-3">
          <h2 className="text-[14.5px] font-bold">Destinatários</h2>
          <nav aria-label="Filtrar destinatários" className="mt-2 flex flex-wrap gap-1.5">
            {filtros.map((f) => {
              const ativo = f.valor === estado
              return (
                <Link
                  key={f.rotulo}
                  href={endereco({ estado: f.valor })}
                  aria-current={ativo ? 'page' : undefined}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold tabular-nums ${
                    ativo ? 'border-primary bg-primary/10 text-primary' : 'border-line text-dim hover:text-ink'
                  }`}
                >
                  {f.rotulo} {f.quantos}
                </Link>
              )
            })}
          </nav>
        </header>

        {destinatarios.linhas.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-dim">
            {progresso.total === 0 ? 'Esta transmissão não tem destinatários.' : 'Ninguém neste estado.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {destinatarios.linhas.map((d) => {
              const selo = ROTULO_DO_DESTINATARIO[d.estado]
              return (
                <li key={d.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={hrefDaFicha(clienteId, d.contatoId, {
                        aba: 'conversa',
                        // Volta ao mesmo recorte ("Não recebeu", página 2): é dele que a
                        // pessoa saiu para investigar um por um.
                        volta: endereco({ estado, pagina }),
                      })}
                      className="text-[13px] font-semibold hover:text-primary hover:underline"
                    >
                      {d.nome || (d.waId ? telefoneLegivel(d.waId) : 'Contato sem nome')}
                    </Link>
                    {d.nome && d.waId && (
                      <span className="ml-2 text-[12px] text-dim tabular-nums">{telefoneLegivel(d.waId)}</span>
                    )}
                    {d.motivo && d.estado === 'falhou' && (
                      <p className="mt-0.5 text-[12px] leading-5 text-red-700 dark:text-red-300">{d.motivo}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[11.5px] text-dim">
                    {d.enviadaEm && <span className="tabular-nums">{diaEHora(d.enviadaEm)}</span>}
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${selo.cor}`}>{selo.texto}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div className="px-5 pb-4">
          <Paginacao
            pagina={pagina}
            porPagina={POR_PAGINA}
            total={destinatarios.total}
            hrefDaPagina={(p) => endereco({ estado, pagina: p })}
            rotulo="Páginas de destinatários"
          />
        </div>
      </section>
    </main>
  )
}
