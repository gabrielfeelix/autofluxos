import Link from 'next/link'
import { notFound } from 'next/navigation'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarLeads, type Lead } from '@/server/repos/leads'
import { horaExata, quando } from './quando'

export const dynamic = 'force-dynamic'

/**
 * A tela de leads.
 *
 * É aqui que a automação vira dinheiro para o cliente: tudo que o bot coletou,
 * numa lista, com quem está esperando gente em cima.
 *
 * As colunas do meio saem dos dados, não de uma lista fixa no código. Cada
 * cliente desenha o fluxo dele e coleta o que quiser — chumbar "nome, telefone,
 * assunto" aqui seria o `core/` sabendo o nome de um cliente, só que na
 * camada de cima.
 */
function colunasDosCampos(leads: Lead[]): string[] {
  const vistas: string[] = []
  for (const lead of leads) {
    for (const chave of Object.keys(lead.campos)) {
      if (!vistas.includes(chave)) vistas.push(chave)
    }
  }
  return vistas
}

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params

  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [leads, canais] = await Promise.all([listarLeads(clienteId), listarCanais(clienteId)])
  const colunas = colunasDosCampos(leads)
  const esperando = leads.filter((l) => l.aguardando).length

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <header>
        <Link
          href={`/clientes/${cliente.id}`}
          className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
        >
          ← {cliente.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {leads.length === 0
            ? 'Ninguém escreveu ainda.'
            : `${leads.length} ${leads.length === 1 ? 'pessoa' : 'pessoas'}.`}
          {esperando > 0 && (
            <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">
              {esperando} esperando atendimento.
            </span>
          )}
        </p>
      </header>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {canais.length === 0
            ? 'Nenhum número do WhatsApp conectado ainda — é por ele que os leads entram.'
            : 'Assim que alguém mandar mensagem para o número conectado, ela aparece aqui com o que o fluxo perguntar.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800">
                <th className="px-4 py-3 font-semibold">Contato</th>
                {colunas.map((coluna) => (
                  <th key={coluna} className="px-4 py-3 font-semibold">
                    {coluna}
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Situação</th>
                <th className="px-4 py-3 font-semibold">Última mensagem</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.contatoId}
                  className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/clientes/${cliente.id}/leads/${lead.contatoId}`}
                      className="font-medium hover:text-emerald-600 hover:underline"
                    >
                      {lead.nome ?? 'sem nome'}
                    </Link>
                    <span className="block text-xs text-zinc-400">{lead.waId}</span>
                  </td>

                  {colunas.map((coluna) => (
                    <td key={coluna} className="px-4 py-3 align-top">
                      {lead.campos[coluna] ?? <span className="text-zinc-300">—</span>}
                    </td>
                  ))}

                  <td className="px-4 py-3 align-top">
                    {lead.aguardando ? (
                      <span
                        title={lead.aguardando.motivo}
                        className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                      >
                        aguardando humano
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">com o bot</span>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top text-zinc-500 dark:text-zinc-400">
                    {lead.ultimaEm ? (
                      <>
                        <span title={horaExata(lead.ultimaEm)}>{quando(lead.ultimaEm)}</span>
                        {lead.ultimoTexto && (
                          <span className="block max-w-64 truncate text-xs text-zinc-400">
                            {lead.ultimaDirecao === 'saida' && 'bot: '}
                            {lead.ultimoTexto}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs">sem mensagem</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
