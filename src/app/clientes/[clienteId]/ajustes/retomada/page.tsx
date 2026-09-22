import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { RetomadaDoBotForm } from '@/components/cliente/retomada-do-bot'
import { acaoSalvarRetomada } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * O que acontece com a conversa que uma pessoa assumiu e ninguém fechou.
 *
 * Tela própria, e não uma linha dentro de "Horário de atendimento", porque as
 * duas respondem perguntas diferentes: lá é *quando* há gente; aqui é *o que
 * fazer quando a gente que assumiu não voltou*. Juntar as duas esconderia esta,
 * que é a que conserta um defeito de conversa viva.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="retomada">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <nav className="mb-3 text-[12.5px] text-dim">
          <Link
            href={`/clientes/${cliente.id}/ajustes`}
            className="text-muted underline underline-offset-2 transition hover:text-primary"
          >
            Configurações
          </Link>
          <span className="mx-2">/</span>
          <span className="text-soft">Conversa parada com uma pessoa</span>
        </nav>

        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Conversa parada com uma pessoa' },
          ]}
        />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Conversa parada com uma pessoa
        </h1>
        <p className="mt-1 mb-6 max-w-[560px] text-[13px] leading-6 text-muted">
          Quando o atendimento humano para no meio, esta é a regra que decide se{' '}
          <strong className="text-soft">o bot volta a responder sozinho</strong>, depois de quanto
          tempo, e o que ele diz ao voltar.
        </p>

        <RetomadaDoBotForm
          inicial={cliente.retomada}
          salvar={acaoSalvarRetomada.bind(null, cliente.id)}
        />
      </main>
    </AjustesShell>
  )
}
