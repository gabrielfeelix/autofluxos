import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ModalFormulario, RotuloCampo } from '@/components/design/modal-formulario'
import { PainelShell } from '@/components/design/shell'
import { validar } from '@/core/flow/validar'
import { acaoConectarNumero, acaoCriarFluxo } from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'
import { listarLeads } from '@/server/repos/leads'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <PainelShell>
      <main className="app-page-enter max-w-[1160px] px-[46px] pt-[34px] pb-[46px]">
        <nav className="mb-3.5 text-[12.5px] text-dim">
          <Link href="/" className="text-muted transition hover:text-accent">Clientes</Link>
          <span className="mx-2">/</span>
          <span className="text-soft">{cliente.nome}</span>
        </nav>

        <h1 className="mb-[30px] text-[25px] font-bold tracking-[-0.02em]">{cliente.nome}</h1>

        <Link
          href={`/clientes/${cliente.id}/leads`}
          className="app-card app-card-interactive mb-[18px] flex min-h-[72px] items-center gap-[26px] px-6 py-4"
        >
          <Suspense fallback={<ContagemEsqueleto />}>
            <ContagemDeLeads clienteId={cliente.id} />
          </Suspense>
          <span className="flex-1" />
          <span className="text-[13px] font-bold text-accent">Ver leads →</span>
        </Link>

        <Link
          href={`/clientes/${cliente.id}/contexto`}
          className="app-card app-card-interactive mb-[18px] flex min-h-[60px] items-center gap-4 px-6 py-4"
        >
          <div>
            <p className="text-[13.5px] font-bold">
              Contexto do negócio
              {cliente.contextoNegocio.trim() === '' && (
                <span className="ml-2 rounded-md border border-amber-300/30 bg-amber-300/[0.1] px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  VAZIO
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[12px] text-dim">
              A única coisa que o bloco de IA pode dizer. Sem isto, ele responde &quot;não sei&quot; a tudo
            </p>
          </div>
          <span className="flex-1" />
          <span className="text-[13px] font-bold text-accent">Abrir →</span>
        </Link>

        <Link
          href={`/clientes/${cliente.id}/conexoes`}
          className="app-card app-card-interactive mb-[18px] flex min-h-[60px] items-center gap-4 px-6 py-4"
        >
          <div>
            <p className="text-[13.5px] font-bold">Credenciais</p>
            <p className="mt-0.5 text-[12px] text-dim">
              As chaves que os blocos de API usam para falar com os sistemas deste cliente
            </p>
          </div>
          <span className="flex-1" />
          <span className="text-[13px] font-bold text-accent">Abrir →</span>
        </Link>

        <Suspense fallback={<Esqueleto />}>
          <Conteudo cliente={cliente} />
        </Suspense>
      </main>
    </PainelShell>
  )
}

function Esqueleto() {
  return (
    <div className="grid grid-cols-2 gap-[18px]">
      {[0, 1].map((i) => (
        <div key={i} className="app-card h-52 animate-pulse" />
      ))}
      <span className="sr-only">Carregando os fluxos…</span>
    </div>
  )
}

function ContagemEsqueleto() {
  return (
    <>
      <div className="w-[110px] animate-pulse">
        <div className="h-[23px] w-11 rounded-md bg-white/[0.07]" />
        <div className="mt-1 h-[11px] w-[88px] rounded bg-white/[0.05]" />
      </div>
      <div className="h-[34px] w-px bg-white/[0.07]" />
      <div className="w-40 animate-pulse">
        <div className="h-[23px] w-11 rounded-md bg-white/[0.07]" />
        <div className="mt-1 h-[11px] w-[140px] rounded bg-white/[0.05]" />
      </div>
    </>
  )
}

async function ContagemDeLeads({ clienteId }: { clienteId: string }) {
  const leads = await listarLeads(clienteId)
  const esperando = leads.filter((lead) => lead.aguardando).length

  return (
    <>
      <div className="w-[110px]">
        <strong className="block text-[22px] leading-[23px] tracking-[-0.02em]">{leads.length}</strong>
        <span className="mt-1 block text-[11px] leading-3 text-muted">leads no total</span>
      </div>
      <div className="h-[34px] w-px bg-white/[0.07]" />
      <div className="w-40">
        <strong className={`block text-[22px] leading-[23px] tracking-[-0.02em] ${esperando > 0 ? 'text-rose-300' : ''}`}>
          {esperando}
        </strong>
        <span className="mt-1 block text-[11px] leading-3 text-muted">esperando atendimento</span>
      </div>
    </>
  )
}

async function Conteudo({ cliente }: { cliente: Cliente }) {
  const [fluxos, canais, cabecalhos] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    headers(),
  ])

  const host = cabecalhos.get('x-forwarded-host') ?? cabecalhos.get('host') ?? 'localhost:3000'
  const protocolo = host.startsWith('localhost') ? 'http' : 'https'
  const webhook = `${protocolo}://${host}/api/webhook/whatsapp`
  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)
  const conectarComCliente = acaoConectarNumero.bind(null, cliente.id)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-[18px]">
      <section className="app-card overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[14.5px] font-bold">Fluxos</h2>
          <ModalFormulario
            botao="+ Criar fluxo"
            titulo="Novo fluxo"
            descricao={'Nasce como rascunho com um esqueleto válido — boas-vindas ligada a “Falar com humano”.'}
            action={criarComCliente}
          >
            <label>
              <RotuloCampo>Nome do fluxo</RotuloCampo>
              <input
                name="nome"
                required
                autoFocus
                placeholder="ex.: Atendimento comercial"
                className="app-field px-[13px] py-[11px] text-[13.5px]"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.09] p-3">
              <input name="ia" type="checkbox" className="size-4 accent-[#a78bfa]" />
              <span>
                <strong className="block text-[12.5px] font-semibold">Com IA</strong>
                <span className="mt-0.5 block text-[11px] leading-5 text-dim">
                  Blocos de IA respondem de verdade neste fluxo. Plano à parte.
                </span>
              </span>
            </label>
          </ModalFormulario>
        </header>

        {fluxos.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13.5px] font-semibold text-soft">Nenhum fluxo ainda</p>
            <p className="mt-1 text-xs leading-5 text-dim">Crie o primeiro fluxo para começar a desenhar o atendimento.</p>
          </div>
        ) : (
          <ul>
            {fluxos.map((fluxo) => {
              const validacao = validar(fluxo.rascunho, { iaHabilitada: fluxo.iaHabilitada })
              return (
                <li key={fluxo.id} className="border-b border-white/[0.045] last:border-0">
                  <Link
                    href={`/clientes/${cliente.id}/fluxos/${fluxo.id}`}
                    className="flex items-center gap-3.5 px-5 py-[15px] transition hover:bg-white/[0.03]"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${fluxo.versaoPublicadaId ? 'bg-emerald-400' : 'bg-dim'}`} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13.5px] font-semibold">{fluxo.nome}</strong>
                      <span className="mt-0.5 block text-[11px] text-dim">
                        {fluxo.rascunho.nodes.length} blocos
                        {fluxo.iaHabilitada ? ' · IA ativa' : ''}
                      </span>
                    </span>
                    {!validacao.ok && (
                      <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10.5px] font-bold text-rose-300">
                        {validacao.erros.length} impedimento(s)
                      </span>
                    )}
                    <span className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${fluxo.versaoPublicadaId ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300' : 'border-white/10 bg-white/[0.04] text-muted'}`}>
                      {fluxo.versaoPublicadaId ? 'NO AR' : 'RASCUNHO'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="space-y-[18px]">
        <section className="app-card overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Números do WhatsApp</h2>
          </header>

          {canais.length > 0 && (
            <ul>
              {canais.map((canal) => {
                const fluxo = fluxos.find((item) => item.id === canal.flowId)
                const aviso = !fluxo
                  ? 'Sem fluxo ligado — o bot não responde.'
                  : !fluxo.versaoPublicadaId
                    ? 'O fluxo ligado ainda não foi publicado.'
                    : null

                return (
                  <li key={canal.id} className="border-b border-white/[0.045] px-5 py-3.5">
                    <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                      <span className={`size-2 rounded-full ${aviso ? 'bg-amber-300' : 'bg-emerald-400'}`} />
                      <code className="font-mono text-[11px] text-soft">{canal.phoneNumberId}</code>
                    </div>
                    <p className="mt-1.5 ml-4 text-[11.5px] text-muted">
                      Executa: <strong className="font-semibold text-soft">{fluxo?.nome ?? 'nenhum fluxo'}</strong>
                    </p>
                    {aviso && (
                      <p className="mt-2 ml-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-2.5 py-2 text-[11.5px] text-amber-200">
                        {aviso}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <form action={conectarComCliente} className="space-y-2.5 p-5">
            <input
              name="phoneNumberId"
              required
              placeholder="Identificação do número (Meta)"
              className="app-field px-3 py-2.5 text-[12.5px]"
            />
            <div className="flex gap-2">
              <select name="flowId" className="app-field min-w-0 flex-1 px-3 py-2.5 text-[12.5px]">
                <option value="">sem fluxo</option>
                {fluxos.map((fluxo) => (
                  <option key={fluxo.id} value={fluxo.id}>{fluxo.nome}</option>
                ))}
              </select>
              <button type="submit" className="app-secondary-button px-4 py-2 text-xs">Conectar</button>
            </div>
          </form>
        </section>

        <section className="app-card p-5">
          <h2 className="text-[13px] font-bold">Endereço para o painel da Meta</h2>
          <p className="mt-1 text-[11.5px] text-dim">Cadastre este webhook na configuração do WhatsApp Business.</p>
          <code className="mt-2.5 block truncate rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2.5 font-mono text-[11.5px] text-[#8de2fa]">
            {webhook}
          </code>
        </section>
      </div>
    </div>
  )
}
