import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import {
  ModalFormulario,
  RotuloCampo,
} from '@/components/design/modal-formulario'
import { validar } from '@/core/flow/validar'
import { acaoApagarFluxo, acaoCriarFluxo } from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { listarCanais } from '@/server/repos/conversas'
import { listarFluxos } from '@/server/repos/fluxos'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [fluxos, canais] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
  ])
  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)

  return (
    <main className="max-w-[1000px] px-[42px] pt-[26px] pb-[42px]">
      <section className="app-card overflow-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="text-[14.5px] font-bold">Fluxos</h2>
            <p className="mt-0.5 text-[12px] text-dim">
              O desenho do atendimento. Só o que está publicado atende gente de
              verdade.
            </p>
          </div>
          <ModalFormulario
            botao="+ Criar fluxo"
            titulo="Novo fluxo"
            descricao={
              'Nasce como rascunho com um esqueleto válido — boas-vindas ligada a “Falar com humano”.'
            }
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
              <input
                name="ia"
                type="checkbox"
                className="size-4 accent-[#a78bfa]"
              />
              <span>
                <strong className="block text-[12.5px] font-semibold">
                  Com IA
                </strong>
                <span className="mt-0.5 block text-[11px] leading-5 text-dim">
                  Blocos de IA respondem de verdade neste fluxo. Plano à parte.
                </span>
              </span>
            </label>
          </ModalFormulario>
        </header>

        {fluxos.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[13.5px] font-semibold text-soft">
              Nenhum fluxo ainda
            </p>
            <p className="mt-1 text-xs leading-5 text-dim">
              Crie o primeiro fluxo para começar a desenhar o atendimento.
            </p>
          </div>
        ) : (
          <ul>
            {fluxos.map((fluxo) => {
              const validacao = validar(fluxo.rascunho, {
                iaHabilitada: fluxo.iaHabilitada,
              })
              // Fluxo ligado a um número é o que está atendendo agora. Dizer
              // isso aqui evita a viagem até a tela do número só para conferir.
              const emUso = canais.some((canal) => canal.flowId === fluxo.id)

              return (
                <li
                  key={fluxo.id}
                  className="flex items-center border-b border-white/[0.045] pr-4 transition last:border-0 hover:bg-white/[0.03]"
                >
                  <Link
                    href={`/clientes/${cliente.id}/fluxos/${fluxo.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3.5 px-5 py-[15px]"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${fluxo.versaoPublicadaId ? 'bg-emerald-400' : 'bg-dim'}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13.5px] font-semibold">
                        {fluxo.nome}
                      </strong>
                      <span className="mt-0.5 block text-[11px] text-dim">
                        {fluxo.rascunho.nodes.length} blocos
                        {fluxo.iaHabilitada ? ' · IA ativa' : ''}
                        {emUso ? ' · ligado a um número' : ''}
                      </span>
                    </span>
                    {!validacao.ok && (
                      <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10.5px] font-bold text-rose-300">
                        {validacao.erros.length} impedimento(s)
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${fluxo.versaoPublicadaId ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300' : 'border-white/10 bg-white/[0.04] text-muted'}`}
                    >
                      {fluxo.versaoPublicadaId ? 'NO AR' : 'RASCUNHO'}
                    </span>
                  </Link>
                  {/* Fora do `Link`: botão dentro de link é clique ambíguo. */}
                  <BotaoPerigo
                    titulo="Apaga esta automação. Recusa enquanto ela estiver ligada a um número."
                    pergunta={`Apagar a automação "${fluxo.nome}"? O desenho e as versões publicadas dela somem.`}
                    acao={acaoApagarFluxo.bind(null, cliente.id, fluxo.id)}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
