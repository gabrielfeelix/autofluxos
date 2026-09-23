import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { EditorDeSegmento } from '@/components/contatos/editor-de-segmento'
import { explicarSegmento } from '@/core/segmentos'
import { acharCliente } from '@/server/repos/clientes'
import { listarSegmentos } from '@/server/repos/segmentos'
import { capacidadeNaPagina } from '@/server/permissoes'
import { SemAcesso } from '@/components/design/sem-acesso'

export const dynamic = 'force-dynamic'

/**
 * Contatos → Segmentos (UI-14, T6.2).
 *
 * **A capacidade é `exportar`**: um segmento compartilhado é o que alimenta uma
 * transmissão, e quem monta o público de um disparo está a um clique de
 * alcançar a base inteira. É o mesmo poder do CSV, por outra porta.
 *
 * A página lista as regras salvas e abre o editor para uma nova. Editar uma
 * existente não muda transmissão nenhuma já confirmada: a lista daquele envio
 * foi congelada, e é isso que a RB-38 protege.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  if (!(await capacidadeNaPagina(clienteId, 'exportar', 'todos'))) {
    return (
      <ClienteShell cliente={cliente} ativa="leads">
        <SemAcesso clienteId={clienteId} oQue="Segmentos" />
      </ClienteShell>
    )
  }
  const segmentos = await listarSegmentos(clienteId)

  return (
    <ClienteShell cliente={cliente} ativa="leads">
      <main className="w-full max-w-[900px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="text-[25px] font-bold tracking-[-0.02em]">Segmentos</h1>
          <Link href={`/clientes/${cliente.id}/leads`} className="text-[12px] text-dim underline">
            voltar aos contatos
          </Link>
        </div>

        <p className="mb-6 max-w-[650px] text-[13px] leading-6 text-dim">
          Um segmento é uma <strong>regra</strong>, não uma lista: “clientes sem
          comprar há 90 dias” responde uma coisa hoje e outra no mês que vem,
          porque a regra é a mesma e as pessoas mudaram.
          <br />
          Estar no segmento <strong>não autoriza mensagem</strong>. Quem pode
          receber depende da janela de 24h, do modelo aprovado e do número, e é
          conferido de novo no instante do envio.
        </p>

        <section className="app-card mb-6 overflow-hidden">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[14.5px] font-bold">
              {segmentos.length} {segmentos.length === 1 ? 'segmento' : 'segmentos'}
            </h2>
          </header>

          {segmentos.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs leading-5 text-dim">
              Nenhum ainda. O primeiro costuma ser “quem não compra há um tempo”.
            </p>
          ) : (
            <ul>
              {segmentos.map((segmento) => (
                <li key={segmento.id} className="border-b border-line px-5 py-4 last:border-0">
                  <span className="block text-[13.5px] font-medium">{segmento.nome}</span>
                  <span className="block text-[11.5px] leading-5 text-dim">
                    {explicarSegmento(segmento.regra)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="app-card px-5 py-5">
          <h2 className="mb-4 text-[14.5px] font-bold">Criar segmento</h2>
          <EditorDeSegmento clienteId={cliente.id} />
        </section>
      </main>
    </ClienteShell>
  )
}
