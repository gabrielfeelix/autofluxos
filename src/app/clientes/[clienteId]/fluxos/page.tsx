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
import { InterruptorDeCampanha } from '@/components/gatilhos/interruptor-de-campanha'
import { InterruptorDeSequencia } from '@/components/sequencias/interruptor'
import { CamposDaSequencia } from '@/components/sequencias/campos'
import {
  ATRASO_MAXIMO_MINUTOS,
  LIMITE_DE_PASSOS,
  ROTULO_DO_EVENTO,
  comoAtraso,
} from '@/core/sequencias'
import { OPERADORES_DE_GATILHO, ROTULO_DO_OPERADOR } from '@/core/gatilhos'
import { PAPEIS_DO_NUMERO, ROTULO_DO_PAPEL } from '@/core/papeis-do-numero'
import {
  acaoApagarCampanha,
  acaoApagarFluxo,
  acaoApagarGatilho,
  acaoCriarCampanha,
  acaoApagarPasta,
  acaoCriarFluxo,
  acaoCriarGatilho,
  acaoCriarPasta,
  acaoApagarSequencia,
  acaoApagarPassoDaSequencia,
  acaoCriarPassoDaSequencia,
  acaoCriarSequencia,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { fluxoDoPapel, listarCanais } from '@/server/repos/conversas'
import { listarGatilhos } from '@/server/repos/gatilhos'
import { listarPastas } from '@/server/repos/pastas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { contarInscricoes, listarSequencias } from '@/server/repos/sequencias'
import { listarQuadros } from '@/server/repos/quadros'
import { MoverFluxo } from '@/components/editor/mover-fluxo'
import { MODELOS } from '@/exemplos/modelos'
import { contatosPorCampanha, listarCampanhas } from '@/server/repos/campanhas'
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

  const [
    fluxos,
    canais,
    execucoes,
    gatilhos,
    campanhas,
    contatosDaCampanha,
    sequencias,
    inscricoes,
    etiquetas,
    quadros,
  ] = await Promise.all([
    listarFluxos(cliente.id),
    listarCanais(cliente.id),
    contarExecucoesPorFluxo(cliente.id),
    listarGatilhos(cliente.id),
    listarCampanhas(cliente.id),
    contatosPorCampanha(cliente.id),
    listarSequencias(cliente.id),
    contarInscricoes(cliente.id),
    listarEtiquetas(cliente.id),
    listarQuadros(cliente.id),
  ])
  const pastas = await listarPastas(cliente.id)
  const criarPastaComCliente = acaoCriarPasta.bind(null, cliente.id)

  /**
   * Os fluxos agrupados por gaveta, com a raiz **por último**.
   *
   * Quem cria pastas está separando o que interessa; deixar a raiz em cima
   * empurraria as gavetas para baixo da lista solta, que é exatamente a
   * bagunça que a pasta veio arrumar. Sem pasta nenhuma, o agrupamento
   * desaparece e a lista fica como sempre foi.
   */
  const grupos = [
    ...pastas.map((pasta) => ({
      id: pasta.id,
      nome: pasta.nome,
      fluxos: fluxos.filter((fluxo) => fluxo.pastaId === pasta.id),
    })),
    {
      id: null,
      nome: pastas.length > 0 ? 'Sem pasta' : '',
      fluxos: fluxos.filter((fluxo) => !fluxo.pastaId),
    },
  ]
  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)
  const criarGatilhoComCliente = acaoCriarGatilho.bind(null, cliente.id)
  const criarCampanhaComCliente = acaoCriarCampanha.bind(null, cliente.id)
  const criarSequenciaComCliente = acaoCriarSequencia.bind(null, cliente.id)
  const nomeDaEtiqueta = (id: string | null) =>
    etiquetas.find((etiqueta) => etiqueta.id === id)?.nome ?? 'uma etiqueta apagada'

  // Achatado com o nome do quadro na frente: duas etapas "Fechado" em funis
  // diferentes são indistinguíveis sem ele.
  const etapasDosQuadros = quadros.flatMap((quadro) =>
    quadro.etapas.map((etapa) => ({ id: etapa.id, rotulo: `${quadro.nome} · ${etapa.nome}` })),
  )
  const nomeDaEtapa = (id: string | null) =>
    etapasDosQuadros.find((etapa) => etapa.id === id)?.rotulo ?? 'uma etapa apagada'

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
                'Nasce como rascunho já válido. O modelo é só o ponto de partida: a partir daí o desenho é seu, e mudar o modelo depois não mexe no que você criou.'
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
              <label>
                <RotuloCampo>Começar de</RotuloCampo>
                <Dropdown
                  nome="modelo"
                  rotuloAcessivel="Modelo do fluxo"
                  valorInicial="vazio"
                  opcoes={MODELOS.map((modelo) => ({
                    valor: modelo.id,
                    rotulo: modelo.nome,
                    detalhe: modelo.resumo,
                  }))}
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
              {grupos.map((grupo) =>
                grupo.fluxos.length === 0 ? null : (
                  <li key={grupo.id ?? 'raiz'}>
                    {grupo.nome !== '' && (
                      <div className="flex items-center gap-2 border-b border-white/[0.045] bg-white/[0.015] px-5 py-2">
                        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                          {grupo.nome}
                        </span>
                        <span className="text-[10.5px] text-dim">
                          {grupo.fluxos.length}
                        </span>
                        {grupo.id && (
                          <span className="ml-auto">
                            <BotaoPerigo
                              rotulo="Apagar pasta"
                              titulo="Apaga só a gaveta. Os fluxos dentro dela voltam para a raiz."
                              pergunta={`Apagar a pasta “${grupo.nome}”? Os ${grupo.fluxos.length} fluxo(s) dentro dela voltam para a raiz — nenhum desenho some.`}
                              acao={acaoApagarPasta.bind(null, cliente.id, grupo.id)}
                            />
                          </span>
                        )}
                      </div>
                    )}
                    <ul>
                      {grupo.fluxos.map((fluxo) => {
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
                    {pastas.length > 0 && (
                      <span className="mr-3">
                        <MoverFluxo
                          clienteId={cliente.id}
                          fluxoId={fluxo.id}
                          pastaAtual={fluxo.pastaId}
                          pastas={pastas}
                        />
                      </span>
                    )}
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
                  </li>
                ),
              )}
            </ul>
          )}

          <div className="border-t border-white/[0.045] p-5">
            <FormularioSalvar action={criarPastaComCliente} rotulo="Criar pasta">
              <input
                name="nome"
                required
                maxLength={40}
                placeholder="Nome da pasta (ex.: Campanhas de agosto)"
                aria-label="Nome da pasta"
                className="app-field px-3 py-2.5 text-[12.5px]"
              />
            </FormularioSalvar>
          </div>
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
        <section className="app-card mt-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Campanhas</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              A frase que o anúncio do Click-to-WhatsApp já deixa digitada. Quem
              chega por ela cai num fluxo específico em vez do padrão do número —
              e o contato fica marcado com a campanha que o trouxe.
              <br />
              Ela casa com a <strong className="text-muted">mensagem inteira</strong>;
              quem apagou parte e escreveu outra coisa não está mais respondendo
              ao anúncio. Pode terminar com ponto ou não: a gente normaliza.
            </p>
          </header>

          {campanhas.length === 0 ? (
            <div className="border-b border-white/[0.045] px-5 py-10 text-center">
              <p className="text-[13px] font-semibold text-soft">Nenhuma campanha ainda</p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, todo mundo que vem de anúncio entra pela mesma porta —
                e o relatório não separa quem veio de onde.
              </p>
            </div>
          ) : (
            <ul>
              {campanhas.map((campanha) => {
                const destino = fluxos.find((item) => item.id === campanha.fluxoId)
                const trouxe = contatosDaCampanha.get(campanha.id) ?? 0

                return (
                  <li
                    key={campanha.id}
                    className="flex items-center gap-3 border-b border-white/[0.045] px-5 py-3.5 last:border-0"
                  >
                    <InterruptorDeCampanha
                      clienteId={cliente.id}
                      campanhaId={campanha.id}
                      ativa={campanha.ativa}
                    />
                    <span className="min-w-0 flex-1">
                      <strong
                        className={`block truncate text-[13px] font-semibold ${campanha.ativa ? '' : 'text-dim line-through'}`}
                      >
                        {campanha.nome}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11px] text-dim">
                        “{campanha.frase}” · abre{' '}
                        <strong className="font-semibold text-muted">
                          {destino?.nome ?? 'um fluxo que sumiu'}
                        </strong>
                        {destino && !destino.versaoPublicadaId
                          ? ' · ainda não publicado, então não abre nada'
                          : ''}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-right text-[11px] text-dim">
                      <strong className="font-semibold text-soft">{trouxe}</strong> contato(s)
                      <span className="block">
                        {campanha.execucoes} {campanha.execucoes === 1 ? 'conversa' : 'conversas'}
                      </span>
                    </span>
                    <BotaoPerigo
                      titulo="Apaga a campanha. Os contatos que ela trouxe ficam — eles são o resultado dela."
                      pergunta={`Apagar a campanha “${campanha.nome}”? Os ${trouxe} contato(s) que ela trouxe ficam, mas deixam de aparecer ligados a ela.`}
                      acao={acaoApagarCampanha.bind(null, cliente.id, campanha.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <div className="p-5">
            {fluxos.length === 0 ? (
              <p className="text-[11.5px] text-dim">
                Crie um fluxo primeiro — uma campanha precisa de um lugar para levar.
              </p>
            ) : (
              <FormularioSalvar
                action={criarCampanhaComCliente}
                rotulo="Criar campanha"
                dica="Cole no anúncio exatamente a frase que você escrever aqui."
              >
                <div className="grid gap-2.5 md:grid-cols-2">
                  <input
                    name="nome"
                    required
                    placeholder="Nome (ex.: Anúncio pilates agosto)"
                    aria-label="Nome da campanha"
                    className="app-field px-3 py-2.5 text-[12.5px]"
                  />
                  <Dropdown
                    nome="fluxoId"
                    rotuloAcessivel="Fluxo que a campanha abre"
                    opcoes={fluxos.map((item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                      ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
                    }))}
                  />
                  <input
                    name="frase"
                    required
                    placeholder="Frase do anúncio (ex.: Quero saber mais sobre o plano trimestral)"
                    aria-label="Frase que inicia o fluxo"
                    className="app-field px-3 py-2.5 text-[12.5px] md:col-span-2"
                  />
                </div>
              </FormularioSalvar>
            )}
          </div>
        </section>
        <section className="app-card mt-[18px] overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Sequências</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              O acompanhamento que acontece sozinho depois de um atendimento ou
              de uma etiqueta. Cada passo abre um fluxo no tempo que você marcar.
              <br />
              <strong className="text-muted">Sai quem responde</strong> — e também
              quem for assumido por alguém, quem tiver o bot pausado, ou quem
              ganhar a etiqueta de saída. É essa regra que separa acompanhar de
              importunar.
            </p>
            <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-[11.5px] leading-[1.6] text-amber-100/90">
              O limite de cada passo é {comoAtraso(ATRASO_MAXIMO_MINUTOS)}, e ele não é
              nosso: o WhatsApp só aceita texto livre dentro da janela de 24h
              contada da última mensagem da pessoa. Passado disso só vai mensagem
              por modelo aprovado pela Meta — que ainda não temos. Um passo mais
              longo seria desenhado e nunca entregue.
            </p>
          </header>

          {sequencias.length === 0 ? (
            <div className="border-b border-white/[0.045] px-5 py-10 text-center">
              <p className="text-[13px] font-semibold text-soft">Nenhuma sequência ainda</p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, quem não respondeu depois do atendimento simplesmente some.
              </p>
            </div>
          ) : (
            <ul>
              {sequencias.map((sequencia) => {
                const contagem = inscricoes.get(sequencia.id) ?? {
                  ativas: 0,
                  concluidas: 0,
                  sairam: 0,
                  bloqueadas: 0,
                }
                const criarPassoComCliente = acaoCriarPassoDaSequencia.bind(
                  null,
                  cliente.id,
                  sequencia.id,
                )

                return (
                  <li key={sequencia.id} className="border-b border-white/[0.045] last:border-0">
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <InterruptorDeSequencia
                        clienteId={cliente.id}
                        sequenciaId={sequencia.id}
                        ativa={sequencia.ativa}
                      />
                      <span className="min-w-0 flex-1">
                        <strong
                          className={`block truncate text-[13px] font-semibold ${sequencia.ativa ? '' : 'text-dim line-through'}`}
                        >
                          {sequencia.nome}
                        </strong>
                        <span className="mt-0.5 block truncate text-[11px] text-dim">
                          {ROTULO_DO_EVENTO[sequencia.evento]}
                          {sequencia.evento === 'etiqueta_aplicada'
                            ? `: “${nomeDaEtiqueta(sequencia.etiquetaId)}”`
                            : ''}
                          {sequencia.evento === 'etapa_alcancada'
                            ? `: “${nomeDaEtapa(sequencia.colunaId)}”`
                            : ''}
                          {' · '}
                          {sequencia.passos.length === 0 ? (
                            <strong className="font-semibold text-amber-200">
                              sem passo — não inscreve ninguém
                            </strong>
                          ) : (
                            `${sequencia.passos.length} passo(s)`
                          )}
                          {sequencia.etiquetaDeSaidaId
                            ? ` · sai com “${nomeDaEtiqueta(sequencia.etiquetaDeSaidaId)}”`
                            : ''}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-right text-[11px] text-dim">
                        <strong className="font-semibold text-soft">{contagem.ativas}</strong> em
                        andamento
                        <span className="block">
                          {contagem.concluidas} até o fim · {contagem.sairam} saíram
                        </span>
                        {contagem.bloqueadas > 0 && (
                          <span
                            title="A janela de 24h fechou antes do próximo passo. Encurte os prazos."
                            className="block text-amber-200"
                          >
                            {contagem.bloqueadas} fora da janela
                          </span>
                        )}
                      </span>
                      <BotaoPerigo
                        titulo="Apaga a sequência, os passos e o histórico de quem passou por ela. Para só pausar, use o interruptor."
                        pergunta={`Apagar a sequência “${sequencia.nome}”? Os ${contagem.ativas} acompanhamento(s) em andamento param, e o histórico dela some.`}
                        acao={acaoApagarSequencia.bind(null, cliente.id, sequencia.id)}
                      />
                    </div>

                    <details className="border-t border-white/[0.03] bg-white/[0.012] px-5 py-3">
                      <summary className="cursor-pointer text-[11.5px] text-muted">
                        Passos ({sequencia.passos.length}/{LIMITE_DE_PASSOS})
                      </summary>

                      {sequencia.passos.length > 0 && (
                        <ol className="mt-3 flex flex-col gap-2">
                          {sequencia.passos.map((passo, indice) => {
                            const destino = fluxos.find((item) => item.id === passo.fluxoId)
                            return (
                              <li
                                key={passo.id}
                                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                              >
                                <span className="w-4 shrink-0 font-mono text-[11px] text-dim">
                                  {indice + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-[12px]">
                                  <strong className="font-semibold text-soft">
                                    {comoAtraso(passo.atrasoMinutos)}
                                  </strong>{' '}
                                  depois do evento · abre{' '}
                                  <strong className="font-semibold text-muted">
                                    {destino?.nome ?? 'um fluxo que sumiu'}
                                  </strong>
                                  {destino && !destino.versaoPublicadaId && (
                                    <span className="text-amber-200">
                                      {' '}
                                      · não publicado, então este passo não entrega nada
                                    </span>
                                  )}
                                </span>
                                <BotaoPerigo
                                  rotulo="Tirar"
                                  titulo="Tira este passo. Quem já está no meio da sequência pode terminar antes."
                                  pergunta={`Tirar o passo de ${comoAtraso(passo.atrasoMinutos)}? Quem já está no meio da sequência pode terminar antes do previsto.`}
                                  acao={acaoApagarPassoDaSequencia.bind(
                                    null,
                                    cliente.id,
                                    sequencia.id,
                                    passo.id,
                                  )}
                                />
                              </li>
                            )
                          })}
                        </ol>
                      )}

                      <div className="mt-3">
                        {fluxos.length === 0 ? (
                          <p className="text-[11.5px] text-dim">
                            Crie um fluxo primeiro — um passo precisa de um lugar para levar.
                          </p>
                        ) : sequencia.passos.length >= LIMITE_DE_PASSOS ? (
                          <p className="text-[11.5px] text-dim">
                            {LIMITE_DE_PASSOS} passos é o teto. Mais que isso dentro de 24h não
                            traz lead nenhum — traz bloqueio.
                          </p>
                        ) : (
                          <FormularioSalvar
                            action={criarPassoComCliente}
                            rotulo="Adicionar passo"
                            dica="O tempo conta do evento, não do passo anterior."
                          >
                            <div className="grid gap-2.5 md:grid-cols-[90px_90px_1fr]">
                              <label>
                                <span className="mb-1 block text-[10.5px] text-dim">horas</span>
                                <input
                                  name="horas"
                                  type="number"
                                  min={0}
                                  max={24}
                                  defaultValue={2}
                                  aria-label="Horas depois do evento"
                                  className="app-field w-full px-3 py-2.5 text-[12.5px]"
                                />
                              </label>
                              <label>
                                <span className="mb-1 block text-[10.5px] text-dim">minutos</span>
                                <input
                                  name="minutos"
                                  type="number"
                                  min={0}
                                  max={59}
                                  defaultValue={0}
                                  aria-label="Minutos depois do evento"
                                  className="app-field w-full px-3 py-2.5 text-[12.5px]"
                                />
                              </label>
                              <label>
                                <span className="mb-1 block text-[10.5px] text-dim">abre</span>
                                <Dropdown
                                  nome="fluxoId"
                                  rotuloAcessivel="Fluxo que este passo abre"
                                  opcoes={fluxos.map((item) => ({
                                    valor: item.id,
                                    rotulo: item.nome,
                                    ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
                                  }))}
                                />
                              </label>
                            </div>
                          </FormularioSalvar>
                        )}
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-white/[0.045] p-5">
            <FormularioSalvar action={criarSequenciaComCliente} rotulo="Criar sequência">
              <CamposDaSequencia
                etiquetas={etiquetas.map((e) => ({ id: e.id, nome: e.nome }))}
                etapas={etapasDosQuadros}
              />
            </FormularioSalvar>
          </div>
        </section>
      </main>
    </ClienteShell>
  )
}
