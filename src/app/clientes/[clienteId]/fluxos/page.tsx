import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClienteShell } from '@/components/design/cliente-shell'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import {
  ModalFormulario,
  RotuloCampo,
} from '@/components/design/modal-formulario'
import { validar } from '@/core/flow/validar'
import { Dropdown } from '@/components/design/dropdown'
import { FormularioSalvar } from '@/components/design/formulario-salvar'
import { InterruptorDeGatilho } from '@/components/gatilhos/interruptor'
import { OPERADORES_DE_GATILHO, ROTULO_DO_OPERADOR } from '@/core/gatilhos'
import { PAPEIS_DO_NUMERO, ROTULO_DO_PAPEL } from '@/core/papeis-do-numero'
import {
  acaoApagarFluxo,
  acaoApagarGatilho,
  acaoCriarFluxo,
  acaoCriarGatilho,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { fluxoDoPapel, listarCanais } from '@/server/repos/conversas'
import { listarGatilhos } from '@/server/repos/gatilhos'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarExecucoesPorFluxo } from '@/server/repos/metricas'

export const dynamic = 'force-dynamic'

export default async function Pagina({
  params,
}: {
  params: Promise<{ clienteId: string }>
}) {
  const { clienteId } = await params
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  const [fluxos, canais, execucoes, gatilhos] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    contarExecucoesPorFluxo(cliente.id),
    listarGatilhos(cliente.id),
  ])
  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)
  const criarGatilhoComCliente = acaoCriarGatilho.bind(null, cliente.id)

  /**
   * Em quais papéis de número este fluxo está ligado.
   *
   * Os quatro, e não só o principal: um fluxo que é o "padrão para mídia" de um
   * número está tão no ar quanto o principal, e a lista que dissesse
   * "rascunho, ninguém usa" sobre ele estaria mentindo para quem vai apagá-lo.
   */
  const papeisDoFluxo = (fluxoId: string) => [
    ...new Set(
      canais.flatMap((canal) =>
        PAPEIS_DO_NUMERO.filter((papel) => fluxoDoPapel(canal, papel) === fluxoId).map(
          (papel) => ROTULO_DO_PAPEL[papel],
        ),
      ),
    ),
  ]

  return (
    <ClienteShell cliente={cliente} ativa="fluxos">
      <main className="max-w-[1000px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Automações</h1>

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
                const papeis = papeisDoFluxo(fluxo.id)
                const totalDeExecucoes = execucoes.get(fluxo.id) ?? 0

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
                          {papeis.length > 0 ? ` · ${papeis.join(', ')}` : ''}
                        </span>
                      </span>
                      {!validacao.ok && (
                        <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2.5 py-1 text-[10.5px] font-bold text-rose-300">
                          {validacao.erros.length} impedimento(s)
                        </span>
                      )}
                      <span className="whitespace-nowrap text-[11px] text-dim">
                        <strong className="font-semibold text-soft">{totalDeExecucoes}</strong>{' '}
                        {totalDeExecucoes === 1 ? 'execução' : 'execuções'}
                      </span>
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

        <section className="app-card mt-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Palavras-chave</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Uma frase que leva direto a um fluxo, de qualquer ponto da conversa
              — o mesmo que “atendente” já faz para chamar uma pessoa, só que
              escrito por você. Ela interrompe o que estava em andamento, e nunca
              atropela quem pediu para falar com alguém.
            </p>
          </header>

          {gatilhos.length === 0 ? (
            <div className="border-b border-white/[0.045] px-5 py-10 text-center">
              <p className="text-[13px] font-semibold text-soft">
                Nenhuma palavra-chave ainda
              </p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, todo mundo entra pelo mesmo lugar e percorre a triagem
                inteira até chegar onde queria.
              </p>
            </div>
          ) : (
            <ul>
              {gatilhos.map((gatilho) => {
                const destino = fluxos.find((item) => item.id === gatilho.fluxoId)

                return (
                  <li
                    key={gatilho.id}
                    className="flex items-center gap-3 border-b border-white/[0.045] px-5 py-3.5 last:border-0"
                  >
                    <InterruptorDeGatilho
                      clienteId={cliente.id}
                      gatilhoId={gatilho.id}
                      ativo={gatilho.ativo}
                    />
                    <span className="min-w-0 flex-1">
                      <strong
                        className={`block truncate text-[13px] font-semibold ${gatilho.ativo ? '' : 'text-dim line-through'}`}
                      >
                        {gatilho.frase}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11px] text-dim">
                        {ROTULO_DO_OPERADOR[gatilho.operador]} · abre{' '}
                        <strong className="font-semibold text-muted">
                          {destino?.nome ?? 'um fluxo que sumiu'}
                        </strong>
                        {destino && !destino.versaoPublicadaId
                          ? ' · ainda não publicado, então não abre nada'
                          : ''}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-dim">
                      <strong className="font-semibold text-soft">{gatilho.execucoes}</strong>{' '}
                      {gatilho.execucoes === 1 ? 'execução' : 'execuções'}
                    </span>
                    <BotaoPerigo
                      titulo="Apaga a palavra-chave e a contagem dela. Para só desligar, use o interruptor."
                      pergunta={`Apagar a palavra-chave “${gatilho.frase}”? A contagem de ${gatilho.execucoes} execução(ões) some junto.`}
                      acao={acaoApagarGatilho.bind(null, cliente.id, gatilho.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="p-5">
            {fluxos.length === 0 ? (
              <p className="text-[11.5px] text-dim">
                Crie um fluxo primeiro — uma palavra-chave precisa de um lugar
                para levar.
              </p>
            ) : (
              <FormularioSalvar
                action={criarGatilhoComCliente}
                rotulo="Adicionar"
                dica="“Contém” casa a palavra inteira, não pedaço de palavra."
              >
                <div className="grid gap-2.5 md:grid-cols-[1fr_120px_1fr]">
                  <input
                    name="frase"
                    required
                    placeholder="ex.: cancelar"
                    aria-label="Palavra ou frase"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                  <Dropdown
                    nome="operador"
                    rotuloAcessivel="Como comparar a frase"
                    valorInicial="contem"
                    opcoes={OPERADORES_DE_GATILHO.map((operador) => ({
                      valor: operador,
                      rotulo: ROTULO_DO_OPERADOR[operador],
                    }))}
                  />
                  <Dropdown
                    nome="fluxoId"
                    rotuloAcessivel="Fluxo que esta palavra abre"
                    opcoes={fluxos.map((item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                      ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
                    }))}
                  />
                </div>
              </FormularioSalvar>
            )}
          </div>
        </section>
      </main>
    </ClienteShell>
  )
}
