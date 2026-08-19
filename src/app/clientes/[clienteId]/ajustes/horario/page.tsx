import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { HorarioDeAtendimentoForm } from '@/components/cliente/horario'
import { acaoSalvarHorario } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

/**
 * O horário do **atendimento humano** — não o do bot.
 *
 * O bot responde 24 horas por dia e continua respondendo; o que muda é o que
 * ele diz quando a conversa precisa de gente. Sem isto, ele promete um
 * atendente às 3h da manhã e a pessoa fica no vácuo até alguém abrir o painel.
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
    <ClienteShell cliente={cliente} ativa="ajustes">
      <main className="max-w-[720px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <nav className="mb-3 text-[12.5px] text-dim">
          <Link
            href={`/clientes/${cliente.id}/ajustes`}
            className="text-muted underline underline-offset-2 transition hover:text-accent"
          >
            Configurações
          </Link>
          <span className="mx-2">/</span>
          <span className="text-soft">Horário de atendimento</span>
        </nav>

        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Horário de atendimento
        </h1>
        <p className="mt-1 mb-6 max-w-[560px] text-[13px] leading-6 text-muted">
          Vale para <strong className="text-soft">quando o bot passa a conversa para uma
          pessoa</strong>. O bot continua respondendo a qualquer hora — o que muda é o que ele diz
          fora do expediente, em vez de prometer um atendente que só chega de manhã.
        </p>

        <HorarioDeAtendimentoForm
          inicial={cliente.horarioAtendimento}
          salvar={acaoSalvarHorario.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}
