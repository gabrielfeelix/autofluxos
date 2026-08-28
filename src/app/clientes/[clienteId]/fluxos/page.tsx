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
import { SeloDoCanal } from '@/components/design/selo-do-canal'
import { InterruptorDeFluxo } from '@/components/fluxos/interruptor'
import { MoverFluxo } from '@/components/editor/mover-fluxo'
import { NomeDoFluxo } from '@/components/editor/nome-do-fluxo'
import { ETIQUETAS, MODELOS } from '@/exemplos/modelos'
import { AbaDeTemplates, NovaAutomacao } from '@/components/fluxos/templates'
import { contatosPorCampanha, listarCampanhas } from '@/server/repos/campanhas'
import { listarFluxos } from '@/server/repos/fluxos'
import { contarExecucoesPorFluxo } from '@/server/repos/metricas'

export const dynamic = 'force-dynamic'

const ABAS_VALIDAS = ['fluxos', 'templates', 'palavras', 'campanhas', 'sequencias'] as const

/**
 * A galeria recebe **só o texto** de cada modelo.
 *
 * O grafo fica no servidor: mandar treze fluxos inteiros para o navegador só
 * para desenhar treze cartões é pagar o desenho de todos os blocos de todos os
 * modelos em toda visita — e quem cria escolhe pelo id, que é o que o Server
 * Action lê.
 *
 * O "em branco" sai da lista: ele é o botão *Do zero* do modal, não um
 * template. Aparecer nos dois lugares faria a galeria prometer um desenho que
 * não existe.
 */
const TEMPLATES = MODELOS.filter((modelo) => modelo.id !== 'vazio').map(
  ({ id, nome, resumo, etiquetas, sinonimos }) => ({ id, nome, resumo, etiquetas, sinonimos }),
)
type Aba = (typeof ABAS_VALIDAS)[number]

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<{ aba?: string }>
}) {
  const { clienteId } = await params
  const { aba: abaPedida } = await searchParams
  // Aba desconhecida cai em Fluxos em vez de mostrar nada: o valor vem da URL,
  // e link velho não pode virar tela em branco.
  const aba: Aba = (ABAS_VALIDAS as readonly string[]).includes(abaPedida ?? '')
    ? (abaPedida as Aba)
    : 'fluxos' 
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
  const criarPastaComCliente = acaoCriarPasta.bind(null, cliente.id, {})

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
  const criarGatilhoComCliente = acaoCriarGatilho.bind(null, cliente.id, {})
  const criarCampanhaComCliente = acaoCriarCampanha.bind(null, cliente.id, {})
  const criarSequenciaComCliente = acaoCriarSequencia.bind(null, cliente.id, {})

  const ABAS = [
    { chave: 'fluxos', rotulo: 'Fluxos', contagem: fluxos.length },
    { chave: 'templates', rotulo: 'Templates', contagem: TEMPLATES.length },
    { chave: 'palavras', rotulo: 'Palavras-chave', contagem: gatilhos.length },
    { chave: 'campanhas', rotulo: 'Campanhas', contagem: campanhas.length },
    { chave: 'sequencias', rotulo: 'Sequências', contagem: sequencias.length },
  ] as const
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
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">Automações</h1>


        {/*
          Abas, e não quatro seções empilhadas.
          A tela tinha fluxos, palavras-chave, campanhas e sequências uma embaixo
          da outra, cada uma com o próprio texto de apoio: quem abria via um
          paredão de explicação e precisava rolar para descobrir que havia mais
          coisa. São quatro assuntos que se usam **um de cada vez** — ninguém
          cadastra campanha e sequência no mesmo minuto.

          A aba vem por `?aba=`, e não por estado de cliente: assim o endereço
          leva de volta ao mesmo lugar, o botão "voltar" do navegador funciona, e
          a página continua sendo renderizada no servidor.
        */}
        <nav className="mb-5 flex flex-wrap gap-1 border-b border-white/[0.07]">
          {ABAS.map((item) => (
            <Link
              key={item.chave}
              href={`/clientes/${cliente.id}/fluxos?aba=${item.chave}`}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition ${
                item.chave === aba
                  ? 'border-accent text-accent'
                  : 'border-transparent text-dim hover:text-soft'
              }`}
            >
              {item.rotulo}
              {item.contagem > 0 && (
                <span className="ml-1.5 rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] font-normal text-dim">
                  {item.contagem}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {aba === 'fluxos' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-[14.5px] font-bold">Fluxos</h2>
              <p className="mt-0.5 text-[12px] text-dim">
                O desenho do atendimento. Só o que está publicado atende gente de
                verdade.
              </p>
            </div>
            <span className="flex items-center gap-2">
            <ModalFormulario
              botao="+ Nova pasta"
              titulo="Nova pasta"
              descricao="Uma gaveta para organizar os fluxos. Ela não decide quem vê o quê — apagar a pasta devolve os fluxos para a raiz, nenhum desenho some."
              rotuloEnviar="Criar pasta"
              variante="secundario"
              action={criarPastaComCliente}
            >
              <label>
                <RotuloCampo>Nome da pasta</RotuloCampo>
                <input
                  name="nome"
                  required
                  autoFocus
                  maxLength={40}
                  placeholder="ex.: Campanhas de agosto"
                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                />
              </label>
            </ModalFormulario>

            {/* O "Começar de" que ficava aqui virou a pergunta de abertura do
                modal e a aba Templates — ver `components/fluxos/templates.tsx`.
                Escondido num campo no fim do formulário, o modelo era escolhido
                por um nome de três palavras e quase ninguém usava. */}
            <NovaAutomacao acao={criarComCliente} modelos={TEMPLATES} etiquetas={ETIQUETAS} />
            </span>
          </header>

          {fluxos.length === 0 && pastas.length === 0 ? (
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
              {/*
                **Pasta vazia aparece.** Ela não aparecia, e o efeito era criar
                uma pasta e a tela não mudar em nada — o que ensina que o botão
                está quebrado. A gaveta recém-criada é justamente a que ainda não
                tem nada dentro; escondê-la é esconder o resultado do único
                clique que a pessoa acabou de dar.

                A raiz é a exceção: ela não é uma gaveta que alguém criou, e uma
                linha "Sem pasta — vazia" seria ruído sobre uma coisa que não
                existe.
              */}
              {grupos.map((grupo) =>
                grupo.id === null && grupo.fluxos.length === 0 ? null : (
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
                      {grupo.fluxos.length === 0 && (
                        <li className="border-b border-white/[0.045] px-5 py-4 text-[11.5px] text-dim">
                          Pasta vazia — mova um fluxo para cá pelo botão de pasta na linha dele.
                        </li>
                      )}
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
                    className="group/linha relative flex items-center border-b border-white/[0.045] pr-4 transition last:border-0 hover:bg-white/[0.03]"
                  >
                    {/*
                      O link cobre a linha por baixo, em vez de envolvê-la.

                      **O lápis precisa ficar colado no nome**, e o nome estava
                      dentro do link — botão dentro de link é clique ambíguo, que
                      é a regra que o botão de apagar já respeitava ficando de
                      fora. Só que "de fora" o empurrava para a ponta direita,
                      longe do que ele renomeia.

                      Com o link em cobertura, o conteúdo é irmão dele: o lápis
                      senta ao lado do nome e continua sendo um botão de verdade.
                      A linha inteira continua clicável, que é o que a área
                      grande de alvo garantia antes.
                    */}
                    <Link
                      href={`/clientes/${cliente.id}/fluxos/${fluxo.id}`}
                      aria-label={`Abrir a automação ${fluxo.nome}`}
                      className="absolute inset-0"
                    />
                    {/*
                      `pointer-events-none` para o clique atravessar até o link;
                      quem é interativo aqui dentro devolve `pointer-events-auto`
                      para si mesmo.
                    */}
                    <span className="pointer-events-none relative flex min-w-0 flex-1 items-center gap-3.5 px-5 py-[15px]">
                      <span
                        className={`size-2 shrink-0 rounded-full ${fluxo.versaoPublicadaId && fluxo.ativo ? 'bg-emerald-400' : 'bg-dim'}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        {/* O canal fica em cada linha, e não no cabeçalho da
                            seção: desde a 0037 duas automações da mesma conta
                            podem ser de canais diferentes, e um selo único lá
                            em cima mentiria sobre a que estivesse fora dele. */}
                        <strong className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                          <span className="truncate">{fluxo.nome}</span>
                          <NomeDoFluxo
                            clienteId={cliente.id}
                            fluxoId={fluxo.id}
                            nome={fluxo.nome}
                            variante="linha"
                          />
                          <SeloDoCanal canal={fluxo.canal} compacto />
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
                      {/*
                        Três estados, e não dois. "Publicado" e "atendendo" são
                        perguntas diferentes desde a 0036: um fluxo desligado
                        continua com a versão dele no ar — ele só não abre
                        conversa nova. Mostrar "NO AR" nele seria mentir
                        exatamente para quem acabou de desligar.
                      */}
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold ${
                          !fluxo.ativo
                            ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-200'
                            : fluxo.versaoPublicadaId
                              ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300'
                              : 'border-white/10 bg-white/[0.04] text-muted'
                        }`}
                      >
                        {!fluxo.ativo ? 'DESLIGADO' : fluxo.versaoPublicadaId ? 'NO AR' : 'RASCUNHO'}
                      </span>
                    </span>
                    {/* Fora do `Link` pelo mesmo motivo do botão de apagar. */}
                    <span className="mr-3">
                      <InterruptorDeFluxo
                        clienteId={cliente.id}
                        fluxoId={fluxo.id}
                        ativo={fluxo.ativo}
                        nome={fluxo.nome}
                      />
                    </span>
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


        </section>
        )}

        {aba === 'templates' && (
        <section className="app-card overflow-hidden">
          <header className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-[14.5px] font-bold">Templates</h2>
            <p className="mt-0.5 max-w-[78ch] text-[12px] leading-5 text-dim">
              Desenhos prontos e conferidos: todos publicam sem erro e todos têm saída para uma
              pessoa. Escolher cria uma automação nova como rascunho — o template não fica ligado a
              ela, então mexer aqui depois não mexe no que você criou.
            </p>
          </header>
          <div className="px-5 py-4">
            <AbaDeTemplates acao={criarComCliente} modelos={TEMPLATES} etiquetas={ETIQUETAS} />
          </div>
        </section>
        )}

        {aba === 'palavras' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
            <h2 className="text-[14.5px] font-bold">Palavras-chave</h2>
            <p className="mt-0.5 max-w-[78ch] text-[12px] leading-5 text-dim">
              Uma frase que leva direto a um fluxo, de qualquer ponto da conversa
              — o mesmo que “atendente” já faz para chamar uma pessoa, só que
              escrito por você. Ela interrompe o que estava em andamento, e nunca
              atropela quem pediu para falar com alguém.
            </p>
            </div>
            {fluxos.length > 0 && (
              <ModalFormulario
                botao="+ Palavra-chave"
                titulo="Nova palavra-chave"
                descricao="Uma frase que leva direto a um fluxo, de qualquer ponto da conversa. “Contém” casa a palavra inteira, não pedaço de palavra."
                rotuloEnviar="Adicionar"
                variante="secundario"
                action={criarGatilhoComCliente}
              >
                <label>
                  <RotuloCampo>Palavra ou frase</RotuloCampo>
                  <input
                    name="frase"
                    required
                    autoFocus
                    placeholder="ex.: cancelar"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Como comparar</RotuloCampo>
                  <Dropdown
                    nome="operador"
                    rotuloAcessivel="Como comparar a frase"
                    valorInicial="contem"
                    opcoes={OPERADORES_DE_GATILHO.map((operador) => ({
                      valor: operador,
                      rotulo: ROTULO_DO_OPERADOR[operador],
                    }))}
                  />
                </label>
                <label>
                  <RotuloCampo>Fluxo que ela abre</RotuloCampo>
                  <Dropdown
                    nome="fluxoId"
                    rotuloAcessivel="Fluxo que esta palavra abre"
                    opcoes={fluxos.map((item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                      ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
                    }))}
                  />
                </label>
              </ModalFormulario>
            )}
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


        </section>
        )}

        {aba === 'campanhas' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0">
            <h2 className="text-[14.5px] font-bold">Campanhas</h2>
            <p className="mt-0.5 max-w-[78ch] text-[12px] leading-5 text-dim">
              A frase que o anúncio do Click-to-WhatsApp já deixa digitada. Quem
              chega por ela cai num fluxo específico em vez do padrão do número —
              e o contato fica marcado com a campanha que o trouxe.
              <br />
              Ela casa com a <strong className="text-muted">mensagem inteira</strong>;
              quem apagou parte e escreveu outra coisa não está mais respondendo
              ao anúncio. Pode terminar com ponto ou não: a gente normaliza.
            </p>
            </div>
            {fluxos.length > 0 && (
              <ModalFormulario
                botao="+ Campanha"
                titulo="Nova campanha"
                descricao="Cole no anúncio exatamente a frase que você escrever aqui. Ela casa com a mensagem inteira."
                rotuloEnviar="Criar campanha"
                variante="secundario"
                action={criarCampanhaComCliente}
              >
                <label>
                  <RotuloCampo>Nome da campanha</RotuloCampo>
                  <input
                    name="nome"
                    required
                    autoFocus
                    placeholder="ex.: Anúncio pilates agosto"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Frase do anúncio</RotuloCampo>
                  <input
                    name="frase"
                    required
                    placeholder="ex.: Quero saber mais sobre o plano trimestral"
                    className="app-field px-[13px] py-[11px] text-[13.5px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Fluxo que ela abre</RotuloCampo>
                  <Dropdown
                    nome="fluxoId"
                    rotuloAcessivel="Fluxo que a campanha abre"
                    opcoes={fluxos.map((item) => ({
                      valor: item.id,
                      rotulo: item.nome,
                      ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
                    }))}
                  />
                </label>
              </ModalFormulario>
            )}
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


        </section>
        )}

        {aba === 'sequencias' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div className="min-w-0 max-w-[86ch]">
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
            </div>
            <ModalFormulario
              botao="+ Sequência"
              titulo="Nova sequência"
              descricao="Ela nasce sem passo, e sem passo não inscreve ninguém — o passo você acrescenta na linha dela, depois de criada."
              rotuloEnviar="Criar sequência"
              variante="secundario"
              action={criarSequenciaComCliente}
            >
              <CamposDaSequencia
                etiquetas={etiquetas.map((e) => ({ id: e.id, nome: e.nome }))}
                etapas={etapasDosQuadros}
              />
            </ModalFormulario>
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
                  {},
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
                          <ModalFormulario
                            botao="+ Adicionar passo"
                            titulo="Novo passo"
                            descricao="O tempo conta do evento que inscreveu a pessoa, não do passo anterior. O teto é 24h — a janela do WhatsApp."
                            rotuloEnviar="Adicionar passo"
                            variante="secundario"
                            action={criarPassoComCliente}
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <label>
                                <RotuloCampo>Horas</RotuloCampo>
                                <input
                                  name="horas"
                                  type="number"
                                  min={0}
                                  max={24}
                                  defaultValue={2}
                                  autoFocus
                                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                                />
                              </label>
                              <label>
                                <RotuloCampo>Minutos</RotuloCampo>
                                <input
                                  name="minutos"
                                  type="number"
                                  min={0}
                                  max={59}
                                  defaultValue={0}
                                  className="app-field px-[13px] py-[11px] text-[13.5px]"
                                />
                              </label>
                            </div>
                            <label>
                              <RotuloCampo>Fluxo que este passo abre</RotuloCampo>
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
                          </ModalFormulario>
                        )}
                      </div>
                    </details>
                  </li>
                )
              })}
            </ul>
          )}


        </section>
        )}
      </main>
    </ClienteShell>
  )
}
