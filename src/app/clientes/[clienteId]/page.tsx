import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FichaDoCliente } from '@/components/cliente/ficha'
import { ClienteShell } from '@/components/design/cliente-shell'
import { acaoRemoverLogo, acaoSalvarCadastro, acaoSalvarLogo } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarEsperandoPessoa, contarLeads } from '@/server/repos/leads'
import { medirFunil, type MedidasDoMes } from '@/server/repos/metricas'

export const dynamic = 'force-dynamic'

/**
 * A primeira tela do cliente responde uma pergunta só: **ele está sendo
 * atendido agora?**
 *
 * Três coisas precisam ser verdade ao mesmo tempo para o bot responder no
 * WhatsApp — existir fluxo publicado, existir número conectado, e o número
 * apontar para um fluxo que está no ar. Cada uma tinha a sua tela, então
 * descobrir que faltava a segunda exigia visitar as três. Aqui a resposta vem
 * antes de qualquer navegação, e quando é "não", diz qual peça falta.
 */
export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="inicio">
      <main className="max-w-[1000px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <Suspense fallback={<div className="app-card mb-[18px] h-[104px] animate-pulse" />}>
          <Atendimento clienteId={cliente.id} />
        </Suspense>

        <Suspense fallback={<div className="app-card mb-[18px] h-[96px] animate-pulse" />}>
          <Funil clienteId={cliente.id} />
        </Suspense>

        <FichaDoCliente
          cliente={cliente}
          salvarCadastro={acaoSalvarCadastro.bind(null, cliente.id)}
          salvarLogo={acaoSalvarLogo.bind(null, cliente.id)}
          removerLogo={acaoRemoverLogo.bind(null, cliente.id)}
        />
      </main>
    </ClienteShell>
  )
}

async function Funil({ clienteId }: { clienteId: string }) {
  const funil = await medirFunil(clienteId)
  const percentual = funil.atual.conversas
    ? Math.round((funil.atual.resolvidasPeloBot / funil.atual.conversas) * 100)
    : 0

  return (
    <section className="app-card mb-[18px] px-6 py-5" aria-labelledby="titulo-funil">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="min-w-[130px]">
          <h2 id="titulo-funil" className="text-[12px] font-bold uppercase tracking-[0.08em] text-dim">
            Este mês
          </h2>
          <p className="mt-1 text-[11.5px] text-dim">Mês passado: {resumoDoMes(funil.anterior)}</p>
        </div>

        <span aria-hidden className="h-[38px] w-px bg-white/[0.07]" />

        <Medida valor={funil.atual.conversas} rotulo="conversas" />
        <Medida
          valor={funil.atual.resolvidasPeloBot}
          rotulo={`resolvidas pelo bot (${percentual}%)`}
        />
        <Medida
          valor={funil.atual.esperandoPessoa}
          rotulo="esperando pessoa"
          alerta={funil.atual.esperandoPessoa > 0}
        />
      </div>
    </section>
  )
}

function resumoDoMes(medidas: MedidasDoMes): string {
  return `${medidas.conversas} conversas · ${medidas.resolvidasPeloBot} pelo bot · ${medidas.esperandoPessoa} para pessoa`
}

async function Atendimento({ clienteId }: { clienteId: string }) {
  // Só a contagem, e não a lista inteira: esta tela abre a cada visita ao
  // cliente e o único uso dos leads aqui é o número de quem espera pessoa.
  const [fluxos, canais, totalDeLeads, esperando] = await Promise.all([
    listarFluxos(clienteId),
    listarCanais(clienteId),
    contarLeads(clienteId),
    contarEsperandoPessoa(clienteId),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))

  // A ordem importa: a primeira peça que falta é a que adianta resolver. Listar
  // tudo que está errado de uma vez faz parecer que há quatro problemas quando
  // há um, e os seguintes às vezes somem sozinhos quando o primeiro sai.
  const pendencia =
    fluxos.length === 0
      ? { texto: 'Nenhum fluxo desenhado ainda.', acao: 'Criar o primeiro fluxo', href: '/fluxos' }
      : noAr.length === 0
        ? {
            texto: 'Nenhum fluxo publicado — o desenho existe, mas não atende ninguém.',
            acao: 'Abrir os fluxos',
            href: '/fluxos',
          }
        : canais.length === 0
          ? {
              texto: 'Nenhum número conectado — sem isso o WhatsApp não chega até aqui.',
              acao: 'Conectar um número',
              href: '/numero',
            }
          : atendendo.length === 0
            ? {
                texto: 'O número conectado não aponta para um fluxo publicado.',
                acao: 'Ajustar o número',
                href: '/numero',
              }
            : null

  return (
    <section
      className={`app-card mb-[18px] px-6 py-5 ${pendencia ? 'border-amber-300/25' : 'border-emerald-400/20'}`}
    >
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <p className="flex items-center gap-2.5 text-[15px] font-bold">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${pendencia ? 'bg-amber-300' : 'bg-emerald-400'}`}
          />
          {pendencia ? 'Ainda não está atendendo' : 'Atendendo no WhatsApp'}
        </p>

        <span aria-hidden className="h-[26px] w-px bg-white/[0.07]" />

        <Medida valor={noAr.length} rotulo={noAr.length === 1 ? 'fluxo no ar' : 'fluxos no ar'} />
        <Medida valor={canais.length} rotulo={canais.length === 1 ? 'número' : 'números'} />
        <Medida valor={totalDeLeads} rotulo="leads" />
        <Medida valor={esperando} rotulo="esperando" alerta={esperando > 0} />

        <span className="flex-1" />

        <Link
          href={`/clientes/${clienteId}/leads`}
          className="text-[13px] font-bold text-accent transition hover:opacity-80"
        >
          Ver leads →
        </Link>
      </div>

      {pendencia && (
        <p className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3.5 text-[12.5px] text-amber-200">
          {pendencia.texto}
          <Link
            href={`/clientes/${clienteId}${pendencia.href}`}
            className="rounded-lg border border-amber-300/30 bg-amber-300/[0.08] px-2.5 py-1 text-[11.5px] font-bold transition hover:bg-amber-300/[0.14]"
          >
            {pendencia.acao} →
          </Link>
        </p>
      )}
    </section>
  )
}

function Medida({ valor, rotulo, alerta }: { valor: number; rotulo: string; alerta?: boolean }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <strong className={`text-[19px] tracking-[-0.02em] ${alerta ? 'text-rose-300' : ''}`}>
        {valor}
      </strong>
      <span className="text-[11.5px] text-muted">{rotulo}</span>
    </p>
  )
}
