import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { acaoSalvarCadastro } from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { listarLeads } from '@/server/repos/leads'

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
    <main className="max-w-[1000px] px-[42px] pt-[26px] pb-[42px]">
      <Suspense fallback={<div className="app-card mb-[18px] h-[104px] animate-pulse" />}>
        <Atendimento clienteId={cliente.id} />
      </Suspense>

      <Cadastro cliente={cliente} />
    </main>
  )
}

async function Atendimento({ clienteId }: { clienteId: string }) {
  const [fluxos, canais, leads] = await Promise.all([
    listarFluxos(clienteId),
    listarCanais(clienteId),
    listarLeads(clienteId),
  ])

  const noAr = fluxos.filter((fluxo) => fluxo.versaoPublicadaId)
  const publicados = new Set(noAr.map((fluxo) => fluxo.id))
  const atendendo = canais.filter((canal) => canal.flowId && publicados.has(canal.flowId))
  const esperando = leads.filter((lead) => lead.aguardando).length

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
        <Medida valor={leads.length} rotulo="leads" />
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

function Cadastro({ cliente }: { cliente: Cliente }) {
  return (
    <section className="app-card overflow-hidden">
      <header className="border-b border-white/[0.06] px-6 py-4">
        <h2 className="text-[14.5px] font-bold">Cadastro</h2>
        <p className="mt-0.5 text-[12px] text-dim">
          Quem é este cliente e como falar com ele. É a nossa ficha — nada daqui vai para o
          WhatsApp.
        </p>
      </header>

      <div className="p-6">
        <FormularioSalvar action={acaoSalvarCadastro.bind(null, cliente.id)} rotulo="Salvar cadastro">
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Nome do cliente" nome="nome" valor={cliente.nome} obrigatorio />
            <Campo
              rotulo="Quem responde"
              nome="responsavel"
              valor={cliente.responsavel}
              dica="a pessoa com quem a gente fala"
              exemplo="ex.: Daniel, dono do estúdio"
            />
            <Campo
              rotulo="Telefone"
              nome="telefone"
              valor={cliente.telefone}
              tipo="tel"
              dica="o contato dessa pessoa, não o número que o bot atende"
              exemplo="(11) 99999-0000"
            />
            <Campo
              rotulo="E-mail"
              nome="email"
              valor={cliente.email}
              tipo="email"
              exemplo="nome@empresa.com.br"
            />
          </div>

          <label className="mt-5 block">
            <Rotulo>Observações</Rotulo>
            <textarea
              name="observacoes"
              rows={4}
              defaultValue={cliente.observacoes}
              placeholder="Escopo combinado, prazo, o que já foi cobrado."
              className="app-field resize-y px-3.5 py-3 text-[13px] leading-6"
            />
          </label>
        </FormularioSalvar>
      </div>
    </section>
  )
}

function Campo({
  rotulo,
  nome,
  valor,
  tipo = 'text',
  dica,
  exemplo,
  obrigatorio,
}: {
  rotulo: string
  nome: string
  valor: string
  tipo?: string
  dica?: string
  exemplo?: string
  obrigatorio?: boolean
}) {
  return (
    <label className="block">
      <Rotulo>{rotulo}</Rotulo>
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        defaultValue={valor}
        placeholder={exemplo}
        className="app-field px-3.5 py-2.5 text-[13px]"
      />
      {/* A dica vem **depois** do campo, e não entre o rótulo e ele: dois campos
          lado a lado em que só um tem dica ficavam com os inputs em alturas
          diferentes, e a grade parecia torta sem motivo aparente. */}
      {dica && <span className="mt-1.5 block text-[11px] text-dim">{dica}</span>}
    </label>
  )
}

function Rotulo({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
      {children}
    </span>
  )
}
