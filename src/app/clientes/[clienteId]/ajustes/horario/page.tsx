import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { Trilha } from '@/components/design/trilha'
import { HorarioDeAtendimentoForm } from '@/components/cliente/horario'
import { RetomadaDoBotForm } from '@/components/cliente/retomada-do-bot'
import { acaoSalvarHorario, acaoSalvarRetomada } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarConexoesParaFluxos } from '@/server/repos/conexoes'

export const dynamic = 'force-dynamic'

/**
 * Tudo o que decide **o encontro da conversa com uma pessoa de verdade**.
 *
 * São duas perguntas, e por um tempo foram duas telas: *quando* há gente
 * (horário) e *o que fazer quando quem assumiu não voltou* (retomada). A
 * separação tinha uma lógica defensável e não sobreviveu ao uso: o Edu foi
 * procurar a mensagem de fora do expediente aqui, não achou, e gastou cinco
 * mensagens perguntando onde estava. Uma tela inteira no menu para **uma única
 * opção** também não se paga , o custo de achar o item é maior que o de ler
 * mais um cartão numa tela que já é sobre o mesmo assunto.
 *
 * O bot responde 24 horas por dia nos dois casos. O que estas duas coisas
 * configuram é só o que acontece na fronteira com o humano.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  // As credenciais servem para escolher qual delas abre a agenda do CRM, quando
  // o cliente prefere puxar o expediente de lá em vez de digitar aqui.
  const conexoes = (await listarConexoesParaFluxos(clienteId)).map((c) => ({ id: c.id, nome: c.nome }))

  return (
    <AjustesShell cliente={cliente} ativa="horario">
      <main className="w-full max-w-[1100px] px-4 pt-[26px] pb-[42px] md:px-[42px]">
        <Trilha
          caminho={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Horário de atendimento' },
          ]}
        />
        <h1 className="text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          Horário de atendimento
        </h1>
        <p className="mt-1 mb-6 max-w-[560px] text-[13px] leading-6 text-muted">
          Vale para <strong className="text-soft">quando o bot passa a conversa para uma
          pessoa</strong>. O bot continua respondendo a qualquer hora; o que muda é o que ele diz
          fora do expediente, em vez de prometer um atendente que só chega de manhã.
        </p>

        <HorarioDeAtendimentoForm
          inicial={cliente.horarioAtendimento}
          conexoes={conexoes}
          salvar={acaoSalvarHorario.bind(null, cliente.id)}
        />

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-[16px] font-bold tracking-[-0.01em]">
            Conversa parada com uma pessoa
          </h2>
          <p className="mt-1 mb-6 max-w-[620px] text-[13px] leading-6 text-muted">
            Quando alguém assume uma conversa, o bot{' '}
            <strong className="text-soft">para de responder naquele contato</strong> e só volta se
            clicarem em “Religar o bot”, no Inbox. Se ninguém clicar, ele fica calado ali para
            sempre: a pessoa escreve, as mensagens chegam, e nada responde.
          </p>

          <RetomadaDoBotForm
            inicial={cliente.retomada}
            salvar={acaoSalvarRetomada.bind(null, cliente.id)}
          />
        </section>
      </main>
    </AjustesShell>
  )
}
