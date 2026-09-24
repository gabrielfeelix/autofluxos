import Link from 'next/link'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { rotulosDoEstado, TEXTO_DA_RECUSA } from '@/core/entrada'
import {
  casaFluxo,
  ESTADOS_DO_FILTRO,
  lerFiltroDeFluxos,
  ROTULO_DO_ESTADO,
  semAcento,
} from '@/core/lista-de-fluxos'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import { BarraDeLista } from '@/components/design/barra-de-lista'
import { MenuDoFluxo } from '@/components/fluxos/menu-do-fluxo'
import { InterruptorDoFluxo } from '@/components/fluxos/interruptor-do-fluxo'
import { ListaOrdenavel } from '@/components/fluxos/lista-ordenavel'
import { RenomearPasta } from '@/components/fluxos/renomear-pasta'
import { ClienteShell } from '@/components/design/cliente-shell'
import {
  EsqueletoDeLista,
} from '@/components/design/esqueleto'
import { IlustracaoAnuncios, IlustracaoAutomacoes, IlustracaoEventos, IlustracaoPalavrasChave, IlustracaoSequencias } from '@/components/design/ilustracoes'
import { BotaoPerigo } from '@/components/design/botao-perigo'
import {
  ModalFormulario,
  RotuloCampo,
} from '@/components/design/modal-formulario'
import { validar } from '@/core/flow/validar'
import { validarPublicacao } from '@/core/validar-publicacao'
import { Dropdown } from '@/components/design/dropdown'
import { InterruptorDeGatilho } from '@/components/gatilhos/interruptor'
import { InterruptorDeEvento } from '@/components/gatilhos/interruptor-de-evento'
import { WebhooksDeEntrada } from '@/components/gatilhos/webhooks-de-entrada'
import { InterruptorDeCampanha } from '@/components/gatilhos/interruptor-de-campanha'
import { InterruptorDeSequencia } from '@/components/sequencias/interruptor'
import { CamposDaSequencia } from '@/components/sequencias/campos'
import { CamposDoPasso, EditarPasso } from '@/components/sequencias/passo'
import {
  LIMITE_DE_PASSOS,
  ROTULO_DO_EVENTO,
  comoAtraso,
} from '@/core/sequencias'
import { OPERADORES_DE_GATILHO, ROTULO_DO_OPERADOR } from '@/core/gatilhos'
import { PAPEIS_DO_NUMERO, ROTULO_DO_PAPEL } from '@/core/papeis-do-numero'
import {
  acaoApagarCampanha,
  acaoApagarGatilho,
  acaoApagarGatilhoDeEvento,
  acaoCriarCampanha,
  acaoApagarPasta,
  acaoCriarFluxo,
  acaoCriarGatilho,
  acaoCriarGatilhoDeEvento,
  acaoCriarPasta,
  acaoApagarSequencia,
  acaoApagarPassoDaSequencia,
  acaoCriarPassoDaSequencia,
  acaoCriarSequencia,
} from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { fluxoDoPapel, listarCanais } from '@/server/repos/conversas'
import { enderecoDoPainel } from '@/server/endereco'
import { listarGatilhos } from '@/server/repos/gatilhos'
import { listarGatilhosDeEvento, listarWebhooks } from '@/server/repos/webhooks-de-entrada'
import { listarPastas } from '@/server/repos/pastas'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import {
  contarInscricoes,
  esperandoPorPasso,
  listarSequencias,
  type ContagemDaSequencia,
} from '@/server/repos/sequencias'
import { listarTemplatesAprovados } from '@/server/repos/templates'
import { listarQuadros } from '@/server/repos/quadros'
import { SeloDoCanal } from '@/components/design/selo-do-canal'
import { NomeDoFluxo } from '@/components/editor/nome-do-fluxo'
import { ETIQUETAS, MODELOS } from '@/exemplos/modelos'
import { NovaAutomacao } from '@/components/fluxos/templates'
import { contatosPorCampanha, listarCampanhas } from '@/server/repos/campanhas'
import {
  conversasEmAndamentoDeMuitos,
  listarFluxos,
  numerosDasVersoes,
} from '@/server/repos/fluxos'
import { contarExecucoesPorFluxo } from '@/server/repos/metricas'
import { contagensDeAutomacao } from '@/server/repos/contagens-de-automacao'
import {
  consultaDaAba,
  resolverAba,
  type AbaPrincipal,
  type Conteudo,
  type TipoDeGatilho,
} from '@/core/abas-de-automacao'

export const dynamic = 'force-dynamic'


/**
 * A galeria recebe **só o texto** de cada modelo.
 *
 * O grafo fica no servidor: mandar treze fluxos inteiros para o navegador só
 * para desenhar treze cartões é pagar o desenho de todos os blocos de todos os
 * modelos em toda visita, e quem cria escolhe pelo id, que é o que o Server
 * Action lê.
 *
 * O "em branco" sai da lista: ele é o botão *Do zero* do modal, não um
 * template. Aparecer nos dois lugares faria a galeria prometer um desenho que
 * não existe.
 */
const TEMPLATES = MODELOS.filter((modelo) => modelo.id !== 'vazio').map(
  ({ id, nome, resumo, etiquetas, sinonimos }) => ({ id, nome, resumo, etiquetas, sinonimos }),
)
type Aba = Conteudo

/**
 * Os rótulos, separados das contagens de propósito: o esqueleto desenha a
 * barra de verdade, com a aba certa acesa, sem esperar o banco.
 *
 * "Modelos de chatbot" saiu da barra (decisão de 23/09): os prontos estão em
 * "Nova automação", e `?aba=templates` continua abrindo a galeria. O nome
 * "Templates" já tinha virado "Modelos de chatbot" porque "modelo" também é o
 * modelo de mensagem aprovado pela Meta, que mora em Transmissões.
 */
const ABAS_ROTULOS = [
  { chave: 'fluxos', rotulo: 'Fluxos' },
  { chave: 'gatilhos', rotulo: 'Gatilhos' },
  { chave: 'sequencias', rotulo: 'Sequências' },
] as const satisfies readonly { chave: AbaPrincipal; rotulo: string }[]

/** As sub-abas de Gatilhos, na ordem em que aparecem. */
const TIPOS_ROTULOS = [
  { chave: 'palavras', rotulo: 'Palavras-chave' },
  { chave: 'eventos', rotulo: 'Eventos' },
  { chave: 'campanhas', rotulo: 'Campanhas' },
] as const satisfies readonly { chave: TipoDeGatilho; rotulo: string }[]

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { clienteId } = await params
  const pedidos = await searchParams
  const abaPedida = typeof pedidos.aba === 'string' ? pedidos.aba : undefined
  const tipoPedido = typeof pedidos.tipo === 'string' ? pedidos.tipo : undefined
  // Só o que a lista entende passa adiante (A01): o endereço é copiável, e
  // parâmetro estranho não vira filtro.
  const parametros: Record<string, string> = {}
  for (const chave of ['aba', 'q', 'canal', 'estado', 'pasta']) {
    const valor = pedidos[chave]
    if (typeof valor === 'string' && valor.trim() !== '') parametros[chave] = valor.trim().slice(0, 80)
  }
  // URL antiga e aba desconhecida: ver `resolverAba`.
  const { conteudo: aba, principal, abrirModelos = false } = resolverAba(abaPedida, tipoPedido)
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  return (
    <ClienteShell cliente={cliente} ativa="fluxos">
      <main className="w-full max-w-[1440px] px-4 md:px-[42px] pt-[26px] pb-[42px]">
        {/*
          Fluxos, Gatilhos e Sequências são subitens da barra lateral (plano de
          navegação de 24/set), e a barra de abas que havia aqui saiu: eram duas
          navegações dizendo a mesma coisa. O título é o do subitem, com a seção
          em cima, como em Negócios.
        */}
        <p className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-dim uppercase">Automações</p>
        <h1 className="mb-5 text-[20px] font-bold tracking-[-0.02em] md:text-[25px]">
          {ABAS_ROTULOS.find((item) => item.chave === principal)?.rotulo}
        </h1>

        {/*
          O conteúdo desce depois do título, e não junto com ele.

          Esta tela abre uma dúzia de consultas. Sem esta fronteira, o navegador
          só recebia a primeira letra da página quando a última consulta voltava:
          entre clicar na aba e ver qualquer coisa a tela ficava idêntica, o que
          se lê como travada. Agora o título e a barra de abas aparecem no ato e
          o miolo chega em seguida.

          A `key` é a aba porque é ela que muda sem trocar de rota. Sem a chave,
          o React entende que é a mesma fronteira de antes e segura o conteúdo
          velho na tela até o novo ficar pronto, que é o congelamento de novo,
          agora por dentro.
        */}
        <Suspense key={aba} fallback={<Espera />}>
          <ConteudoDaAba
            cliente={cliente}
            aba={aba}
            principal={principal}
            abrirModelos={abrirModelos}
            parametros={parametros}
          />
        </Suspense>
      </main>
    </ClienteShell>
  )
}

/** O que ocupa a tela entre o clique no subitem e a resposta do banco. */
function Espera() {
  return <EsqueletoDeLista linhas={4} rotulo="Carregando as automações…" />
}

async function ConteudoDaAba({
  cliente,
  aba,
  principal,
  abrirModelos,
  parametros,
}: {
  cliente: Cliente
  aba: Aba
  principal: AbaPrincipal
  abrirModelos: boolean
  parametros: Record<string, string>
}) {
  /*
   * O carregamento é **por aba**, e a barra é por contagem (T7.1, item 5).
   *
   * Antes eram 14 idas ao banco em toda visita, qualquer que fosse a aba: a
   * galeria de modelos, que é constante em `exemplos/`, pagava as 14 para
   * desenhar zero dado de banco.
   *
   * **A armadilha que essa correção esconde**: as pastilhas da barra mostram a
   * contagem de *todas* as abas, sempre. Carregar só o que a aba aberta usa e
   * derivar a contagem de `listarX().length` faria os números sumirem das outras
   * cinco, e aba marcada com "0" é aba que ninguém abre. Por isso a barra tem a
   * própria consulta, barata (`head: true`, nenhuma linha na rede), e a lista
   * inteira vem só da aba que está aberta.
   *
   * `precisa()` é a única fonte do que cada aba usa, e foi montada lendo os
   * blocos `{aba === ...}` deste arquivo, não por palpite.
   */
  const precisa = (...abas: Aba[]) => abas.includes(aba)
  // O editor aberto pelo destino volta para esta mesma aba, com a busca.
  const voltaDaAba = `/clientes/${cliente.id}/fluxos?${new URLSearchParams(parametros).toString()}`
  // Aberto pela lista com busca ou filtro, o ‹ do editor volta para eles (12.2).
  const hrefDoFluxo = (fluxoId: string) =>
    Object.keys(parametros).length > 0
      ? `/clientes/${cliente.id}/fluxos/${fluxoId}?volta=${encodeURIComponent(voltaDaAba)}`
      : `/clientes/${cliente.id}/fluxos/${fluxoId}`
  const vazio = <T,>(valor: T) => Promise.resolve(valor)

  const [
    contagens,
    fluxos,
    canais,
    execucoes,
    gatilhos,
    gatilhosDeEvento,
    webhooksDeEntrada,
    campanhas,
    contatosDaCampanha,
    sequencias,
    inscricoes,
    etiquetas,
    quadros,
    templatesAprovados,
    pastas,
    esperando,
  ] = await Promise.all([
    contagensDeAutomacao(cliente.id),
    precisa('fluxos', 'palavras', 'eventos', 'campanhas', 'sequencias')
      ? listarFluxos(cliente.id)
      : vazio([] as Awaited<ReturnType<typeof listarFluxos>>),
    precisa('fluxos') ? listarCanais(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarCanais>>),
    precisa('fluxos', 'palavras', 'eventos', 'campanhas')
      ? contarExecucoesPorFluxo(cliente.id)
      : vazio(new Map<string, number>()),
    precisa('palavras') ? listarGatilhos(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarGatilhos>>),
    precisa('eventos')
      ? listarGatilhosDeEvento(cliente.id)
      : vazio([] as Awaited<ReturnType<typeof listarGatilhosDeEvento>>),
    precisa('eventos') ? listarWebhooks(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarWebhooks>>),
    precisa('campanhas') ? listarCampanhas(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarCampanhas>>),
    precisa('campanhas')
      ? contatosPorCampanha(cliente.id)
      : vazio(new Map<string, number>()),
    precisa('sequencias') ? listarSequencias(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarSequencias>>),
    precisa('sequencias') ? contarInscricoes(cliente.id) : vazio(new Map<string, ContagemDaSequencia>()),
    // Duas abas usam as etiquetas: a lista de fluxos (no gatilho) e as
    // sequências (no evento de entrada e no de saída).
    precisa('fluxos', 'sequencias')
      ? listarEtiquetas(cliente.id)
      : vazio([] as Awaited<ReturnType<typeof listarEtiquetas>>),
    precisa('sequencias') ? listarQuadros(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarQuadros>>),
    /*
     * Só os aprovados (0059/0061): é o que um passo além de 24h pode usar.
     * Oferecer um pendente faria a pessoa desenhar uma sequência que só
     * entregaria se a Meta aprovasse a tempo.
     */
    precisa('sequencias')
      ? listarTemplatesAprovados(cliente.id)
      : vazio([] as Awaited<ReturnType<typeof listarTemplatesAprovados>>),
    precisa('fluxos') ? listarPastas(cliente.id) : vazio([] as Awaited<ReturnType<typeof listarPastas>>),
    precisa('sequencias') ? esperandoPorPasso(cliente.id) : vazio(new Map<string, number>()),
  ])
  const criarPastaComCliente = acaoCriarPasta.bind(null, cliente.id, {})
  // Os campos de passo (criar e editar) usam as mesmas listas.
  const opcoesDeFluxo = fluxos.map((item) => ({
    valor: item.id,
    rotulo: item.nome,
    ...(item.versaoPublicadaId ? {} : { detalhe: 'rascunho' }),
  }))
  const modelosDoPasso = templatesAprovados.map(({ id, nome, idioma }) => ({ id, nome, idioma }))

  /*
   * As duas conferências, como no editor (T7.2).
   *
   * A lista mostra "N impedimento(s)", e esse número tem que ser o mesmo que o
   * botão Publicar vai cobrar. Contar só os do desenho diria "pronto" sobre o
   * rascunho que acabou de sair do modelo e ainda diz "Rua Exemplo, 123": a
   * pessoa abriria o editor esperando publicar e encontraria dois impedimentos.
   *
   * Antes da lista, e não dentro da linha, porque o filtro "Com pendência"
   * precisa do resultado.
   */
  const conferencia = new Map(
    fluxos.map((fluxo) => {
      const doDesenho = validar(fluxo.rascunho, { iaHabilitada: fluxo.iaHabilitada, canal: fluxo.canal })
      const daPublicacao = validarPublicacao(fluxo.rascunho)
      return [
        fluxo.id,
        { ok: doDesenho.ok && daPublicacao.ok, erros: [...doDesenho.erros, ...daPublicacao.erros] },
      ] as const
    }),
  )
  const filtro = lerFiltroDeFluxos(parametros)
  const filtrando =
    filtro.q !== '' || filtro.canal !== null || filtro.estado !== null || filtro.pasta !== null
  const visiveis = fluxos.filter((fluxo) =>
    casaFluxo(
      {
        nome: fluxo.nome,
        canal: fluxo.canal,
        publicada: fluxo.versaoPublicadaId !== null,
        ativo: fluxo.ativo,
        pastaId: fluxo.pastaId,
        pendente: !(conferencia.get(fluxo.id)?.ok ?? true),
      },
      filtro,
    ),
  )
  const nomeDaPasta = new Map(pastas.map((p) => [p.id, p.nome]))
  // As outras abas buscam por texto (A01): frase, evento, nome da campanha ou
  // da sequência, sem acento, como a de fluxos.
  const termo = semAcento(filtro.q)
  const casaTexto = (...textos: string[]) =>
    termo === '' || textos.some((texto) => semAcento(texto).includes(termo))
  const gatilhosVisiveis = gatilhos.filter((g) => casaTexto(g.frase))
  const eventosVisiveis = gatilhosDeEvento.filter((g) => casaTexto(g.evento))
  const campanhasVisiveis = campanhas.filter((c) => casaTexto(c.nome, c.frase))
  const sequenciasVisiveis = sequencias.filter((q) => casaTexto(q.nome))

  /**
   * Os fluxos agrupados por gaveta, com a raiz **por último**.
   *
   * Quem cria pastas está separando o que interessa; deixar a raiz em cima
   * empurraria as gavetas para baixo da lista solta, que é exatamente a
   * bagunça que a pasta veio arrumar. Sem pasta nenhuma, o agrupamento
   * desaparece e a lista fica como sempre foi.
   */
  const todosDoGrupo = (pastaId: string | null) =>
    fluxos.filter((fluxo) => (fluxo.pastaId ?? null) === pastaId)
  /*
   * Filtrando, a lista fica plana (um grupo só, sem cabeçalho) e cada linha diz
   * a pasta dela: resultado de busca separado em gavetas obriga a procurar de
   * novo dentro do resultado.
   */
  const grupos = filtrando
    ? [{ id: null, nome: '', total: 0, fluxos: visiveis }]
    : [
        ...pastas.map((pasta) => ({
          id: pasta.id,
          nome: pasta.nome,
          total: todosDoGrupo(pasta.id).length,
          fluxos: todosDoGrupo(pasta.id),
        })),
        {
          id: null,
          nome: pastas.length > 0 ? 'Sem pasta' : '',
          total: todosDoGrupo(null).length,
          fluxos: todosDoGrupo(null),
        },
      ]
  /*
   * Quantas conversas rodam cada fluxo agora (RB-44).
   *
   * Em lote, e depois da lista: são duas consultas para a tela inteira em vez de
   * duas por linha. Só a aba de fluxos mostra o interruptor, então só ela paga.
   */
  const [emAndamento, numeroDaVersao] = precisa('fluxos')
    ? await Promise.all([
        conversasEmAndamentoDeMuitos(fluxos.map((f) => f.id)),
        numerosDasVersoes(
          fluxos.map((f) => f.versaoPublicadaId).filter((id): id is string => id !== null),
        ),
      ])
    : [new Map<string, number>(), new Map<string, number>()]

  const criarComCliente = acaoCriarFluxo.bind(null, cliente.id)
  const criarGatilhoComCliente = acaoCriarGatilho.bind(null, cliente.id, {})
  const criarCampanhaComCliente = acaoCriarCampanha.bind(null, cliente.id, {})
  const criarSequenciaComCliente = acaoCriarSequencia.bind(null, cliente.id, {})

  /*
   * A contagem vem de `contagens`, e **não** de `listarX().length`.
   *
   * É a linha que faz a barra continuar certa depois do carregamento por aba:
   * `gatilhos` está vazio quando a aba aberta é outra, então `gatilhos.length`
   * diria zero palavras-chave para quem tem vinte.
   */
  const CONTAGEM: Record<Aba, number> = {
    fluxos: contagens.fluxos,
    palavras: contagens.palavras,
    eventos: contagens.eventos,
    campanhas: contagens.campanhas,
    sequencias: contagens.sequencias,
  }
  const TIPOS = TIPOS_ROTULOS.map((item) => ({ ...item, contagem: CONTAGEM[item.chave] }))
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
    <>
        {principal === 'gatilhos' && (
          <div className="mb-5 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <p className="text-[12.5px] text-muted">O que faz uma automação começar.</p>
            <nav aria-label="Tipos de gatilho" className="flex max-w-full gap-1 self-start overflow-x-auto rounded-[10px] border border-line bg-panel p-1 whitespace-nowrap md:self-auto">
              {TIPOS.map((item) => (
                <Link
                  key={item.chave}
                  href={`/clientes/${cliente.id}/fluxos?${consultaDaAba(item.chave)}`}
                  aria-current={item.chave === aba ? 'page' : undefined}
                  className={`shrink-0 rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-semibold transition sm:px-3 ${
                    item.chave === aba ? 'bg-primary-weak text-primary' : 'text-dim hover:text-soft'
                  }`}
                >
                  {item.rotulo}
                  {item.contagem > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal text-dim">{item.contagem}</span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {aba === 'fluxos' && (
        <section className="app-card overflow-hidden">
          <header className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[14.5px] font-bold">Fluxos</h2>
              <p className="mt-0.5 text-[12px] text-dim">
                O desenho do atendimento. Só o que está publicado atende gente de
                verdade.
              </p>
            </div>
            <span className="flex flex-wrap items-center gap-2">
            <ModalFormulario
              botao="+ Nova pasta"
              titulo="Nova pasta"
              descricao="Uma gaveta para organizar os fluxos. Ela não decide quem vê o quê, apagar a pasta devolve os fluxos para a raiz, nenhum desenho some."
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
                modal e a aba Templates, ver `components/fluxos/templates.tsx`.
                Escondido num campo no fim do formulário, o modelo era escolhido
                por um nome de três palavras e quase ninguém usava. */}
            <NovaAutomacao
              acao={criarComCliente}
              modelos={TEMPLATES}
              etiquetas={ETIQUETAS}
              clienteId={cliente.id}
              existentes={fluxos.map(({ id, nome }) => ({ id, nome }))}
              abrirEmModelos={abrirModelos}
            />
            </span>
          </header>

          {fluxos.length > 0 && (
            <div className="border-b border-line px-5 py-3">
              <BarraDeLista
                base={`/clientes/${cliente.id}/fluxos`}
                parametros={parametros}
                busca={{ chave: 'q', placeholder: 'Buscar automação pelo nome', rotulo: 'Buscar automação pelo nome' }}
                grupos={[
                  {
                    chave: 'estado',
                    titulo: 'Estado',
                    opcoes: ESTADOS_DO_FILTRO.map((e) => ({ valor: e, rotulo: ROTULO_DO_ESTADO[e] })),
                  },
                  {
                    chave: 'canal',
                    titulo: 'Canal',
                    opcoes: [...new Set(fluxos.map((f) => f.canal))].map((c) => ({
                      valor: c,
                      rotulo: DEFINICAO_DO_CANAL[c].nome,
                    })),
                  },
                  ...(pastas.length > 0
                    ? [
                        {
                          chave: 'pasta',
                          titulo: 'Pasta',
                          opcoes: [
                            ...pastas.map((p) => ({ valor: p.id, rotulo: p.nome })),
                            { valor: 'sem', rotulo: 'Sem pasta' },
                          ],
                        },
                      ]
                    : []),
                ]}
                resumo={filtrando ? `${visiveis.length} de ${fluxos.length}` : undefined}
              />
            </div>
          )}

          {fluxos.length === 0 && pastas.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <IlustracaoAutomacoes />
              <p className="mt-6 text-[13.5px] font-semibold text-soft">
                Nenhum fluxo ainda
              </p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Crie o primeiro fluxo para começar a desenhar o atendimento.
              </p>
            </div>
          ) : filtrando && visiveis.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[13.5px] font-semibold text-soft">Nenhuma automação com esses filtros</p>
              <Link
                href={`/clientes/${cliente.id}/fluxos`}
                className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
              >
                Limpar filtros
              </Link>
            </div>
          ) : (
            <ul>
              {/*
                **Pasta vazia aparece.** Ela não aparecia, e o efeito era criar
                uma pasta e a tela não mudar em nada, o que ensina que o botão
                está quebrado. A gaveta recém-criada é justamente a que ainda não
                tem nada dentro; escondê-la é esconder o resultado do único
                clique que a pessoa acabou de dar.

                A raiz é a exceção: ela não é uma gaveta que alguém criou, e uma
                linha "Sem pasta, vazia" seria ruído sobre uma coisa que não
                existe.
              */}
              {grupos.map((grupo) =>
                grupo.id === null && grupo.fluxos.length === 0 ? null : (
                  <li key={grupo.id ?? 'raiz'}>
                    {grupo.nome !== '' && (
                      <div className="flex items-center gap-2 border-b border-line bg-panel px-5 py-2">
                        <span className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
                          {grupo.nome}
                        </span>
                        <span className="text-[10.5px] text-dim">{grupo.total}</span>
                        {grupo.id && (
                          <span className="ml-auto flex items-center gap-1.5">
                            <RenomearPasta clienteId={cliente.id} pastaId={grupo.id} nome={grupo.nome} />
                            <BotaoPerigo
                              rotulo="Apagar pasta"
                              titulo="Apaga só a gaveta. Os fluxos dentro dela voltam para Sem pasta."
                              pergunta={`Apagar a pasta “${grupo.nome}”? Os ${grupo.total} fluxo(s) dentro dela voltam para Sem pasta, nenhum desenho some.`}
                              acao={acaoApagarPasta.bind(null, cliente.id, grupo.id)}
                            />
                          </span>
                        )}
                      </div>
                    )}
                    <ul>
                      {grupo.fluxos.length === 0 && (
                        <li className="border-b border-line px-5 py-4 text-[11.5px] text-dim">
                          Pasta vazia. Mova uma automação para cá pelo menu ⋯ da linha dela.
                        </li>
                      )}
                      <ListaOrdenavel
                        clienteId={cliente.id}
                        arrastavel={!filtrando && grupo.fluxos.length > 1}
                        classeDaLinha="group/linha relative flex items-start gap-3 border-b border-line px-4 py-3.5 last:border-0 hover:bg-surface md:items-center md:px-5"
                        itens={grupo.fluxos.map((fluxo) => {
                const validacao = conferencia.get(fluxo.id) ?? { ok: true, erros: [] }
                // Fluxo ligado a um número é o que está atendendo agora. Dizer
                // isso aqui evita a viagem até a tela do número só para conferir.
                const papeis = papeisDoFluxo(fluxo.id)
                const totalDeExecucoes = execucoes.get(fluxo.id) ?? 0
                const rotulo = rotulosDoEstado({
                  versao: fluxo.versaoPublicadaId
                    ? (numeroDaVersao.get(fluxo.versaoPublicadaId) ?? null)
                    : null,
                  ativo: fluxo.ativo,
                })
                const pasta = fluxo.pastaId ? nomeDaPasta.get(fluxo.pastaId) : undefined

                return { id: fluxo.id, nome: fluxo.nome, conteudo: (
                  <>
                    {/*
                      O link cobre a linha por baixo, em vez de envolvê-la: o
                      lápis de renomear senta ao lado do nome e continua sendo
                      botão de verdade, e a linha inteira continua abrindo o
                      editor. Quem é interativo aqui dentro é `relative` (senão
                      o link, que vem antes no DOM, pinta por cima) e devolve
                      `pointer-events-auto` para si.
                    */}
                    <Link
                      href={hrefDoFluxo(fluxo.id)}
                      aria-label={`Abrir a automação ${fluxo.nome}`}
                      className="absolute inset-0"
                    />
                    <span className="pointer-events-none relative flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-center md:gap-4">
                      <span className="min-w-0 flex-1">
                        {/* O canal fica em cada linha: desde a 0037 duas
                            automações da mesma conta podem ser de canais
                            diferentes. */}
                        <strong className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
                          <span className="truncate">{fluxo.nome}</span>
                          <NomeDoFluxo
                            clienteId={cliente.id}
                            fluxoId={fluxo.id}
                            nome={fluxo.nome}
                            variante="linha"
                          />
                          <SeloDoCanal canal={fluxo.canal} compacto />
                          {fluxo.iaHabilitada && (
                            <span className="rounded border border-line px-1.5 text-[10px] font-bold text-info">IA</span>
                          )}
                        </strong>
                        <span className="mt-0.5 block text-[11px] text-dim">
                          {fluxo.rascunho.nodes.length} blocos
                          {filtrando ? ` · ${pasta ?? 'Sem pasta'}` : ''}
                          {papeis.length > 0 ? ` · ${papeis.join(', ')}` : ''}
                        </span>
                        {/* Alertas só quando pedem ação (N09). */}
                        {fluxo.ativo && !fluxo.versaoPublicadaId && (
                          <span className="mt-0.5 block text-[11px] font-medium text-aviso">
                            Ligada, mas sem versão publicada: não responde ninguém.
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dim">
                        {!validacao.ok && (
                          <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[10.5px] font-bold text-perigo">
                            {validacao.erros.length} impedimento(s)
                          </span>
                        )}
                        {/* Ligada ou desligada é o interruptor ao lado; aqui
                            fica só a publicação (A03). */}
                        <span className={`whitespace-nowrap ${fluxo.versaoPublicadaId ? 'text-soft' : ''}`}>
                          {rotulo.publicacao}
                        </span>
                      </span>
                    </span>
                    <span className="relative flex shrink-0 items-center gap-2">
                      <InterruptorDoFluxo
                        clienteId={cliente.id}
                        fluxo={{
                          id: fluxo.id,
                          nome: fluxo.nome,
                          ativo: fluxo.ativo,
                          publicada: fluxo.versaoPublicadaId !== null,
                        }}
                        emAndamento={emAndamento.get(fluxo.id) ?? 0}
                      />
                      <Link
                        href={hrefDoFluxo(fluxo.id)}
                        className="hidden rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-strong hover:text-ink md:inline-block"
                      >
                        Editar
                      </Link>
                      <MenuDoFluxo
                        clienteId={cliente.id}
                        fluxo={{ id: fluxo.id, nome: fluxo.nome, pastaId: fluxo.pastaId }}
                        pastas={pastas}
                        respostas={totalDeExecucoes}
                      />
                    </span>
                  </>
                ) }
                      })}
                      />
                    </ul>
                  </li>
                ),
              )}
            </ul>
          )}

        </section>
        )}

        {aba === 'palavras' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
            <h2 className="text-[14.5px] font-bold">Palavras-chave</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Uma frase que o cliente escreve e leva direto a uma automação.
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
          {gatilhos.length > 0 && (
            <BuscaDaAba
              base={`/clientes/${cliente.id}/fluxos`}
              parametros={parametros}
              placeholder="Buscar palavra-chave"
              visiveis={gatilhosVisiveis.length}
              total={gatilhos.length}
            />
          )}

          {gatilhos.length === 0 ? (
            <div className="border-b border-line px-5 py-12 text-center">
              <IlustracaoPalavrasChave />
              <p className="mt-6 text-[13px] font-semibold text-soft">
                Nenhuma palavra-chave ainda
              </p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, todo mundo entra pelo mesmo lugar e percorre a triagem
                inteira até chegar onde queria.
              </p>
            </div>
          ) : (
            <ul>
              {gatilhosVisiveis.map((gatilho) => {
                const destino = fluxos.find((item) => item.id === gatilho.fluxoId)

                return (
                  <li
                    key={gatilho.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0"
                  >
                    <InterruptorDeGatilho
                      bloqueio={bloqueioDoDestino(destino)}
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
                        <NomeDoDestino destino={destino} clienteId={cliente.id} volta={voltaDaAba} />
                      </span>
                      <AvisoDoDestino destino={destino} ligada={gatilho.ativo} />
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

        {aba === 'eventos' && (
        <section className="app-card overflow-hidden">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
            <span>
              <h2 className="text-[14px] font-bold tracking-[-0.01em]">Eventos de outro sistema</h2>
              <p className="mt-0.5 text-[11.5px] leading-5 text-dim">
                Outro sistema avisa que algo aconteceu, e uma automação começa.
              </p>
            </span>

            {fluxos.length > 0 && (
              <ModalFormulario
                botao="+ Evento"
                titulo="Novo evento"
                descricao="O nome vem do sistema que avisa (vaga.aberta, pedido.pago). Ele precisa ser exatamente igual ao que o outro lado manda, aqui não há “contém”."
                rotuloEnviar="Criar evento"
                variante="secundario"
                action={acaoCriarGatilhoDeEvento.bind(null, cliente.id, {})}
              >
                <label>
                  <RotuloCampo>Nome do evento</RotuloCampo>
                  <input
                    name="evento"
                    required
                    autoFocus
                    maxLength={120}
                    placeholder="ex.: vaga.aberta"
                    className="app-field px-[13px] py-[11px] font-mono text-[13px]"
                  />
                </label>
                <label>
                  <RotuloCampo>Fluxo que ele abre</RotuloCampo>
                  <Dropdown
                    nome="fluxoId"
                    rotuloAcessivel="Fluxo que este evento abre"
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
          {gatilhosDeEvento.length > 0 && (
            <BuscaDaAba
              base={`/clientes/${cliente.id}/fluxos`}
              parametros={parametros}
              placeholder="Buscar evento"
              visiveis={eventosVisiveis.length}
              total={gatilhosDeEvento.length}
            />
          )}

          {gatilhosDeEvento.length === 0 ? (
            <div className="border-b border-line px-5 py-12 text-center">
              <IlustracaoEventos />
              <p className="mt-6 text-[13px] font-semibold text-soft">Nenhum evento ainda</p>
              <p className="mx-auto mt-1 max-w-[460px] text-xs leading-5 text-dim">
                Crie um para a agenda ou o financeiro avisarem esta conta.
              </p>
            </div>
          ) : (
            <ul>
              {eventosVisiveis.map((gatilho) => {
                const destino = fluxos.find((item) => item.id === gatilho.fluxoId)

                return (
                  <li
                    key={gatilho.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3.5"
                  >
                    <InterruptorDeEvento
                      bloqueio={bloqueioDoDestino(destino)}
                      clienteId={cliente.id}
                      gatilhoId={gatilho.id}
                      ativo={gatilho.ativo}
                    />
                    <span className="min-w-0 flex-1">
                      <strong
                        className={`block truncate font-mono text-[12.5px] font-semibold ${gatilho.ativo ? '' : 'text-dim line-through'}`}
                      >
                        {gatilho.evento}
                      </strong>
                      <span className="mt-0.5 block truncate text-[11px] text-dim">
                        abre{' '}
                        <NomeDoDestino destino={destino} clienteId={cliente.id} volta={voltaDaAba} />
                      </span>
                      <AvisoDoDestino destino={destino} ligada={gatilho.ativo} />
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-dim">
                      <strong className="font-semibold text-soft">{gatilho.execucoes}</strong>{' '}
                      {gatilho.execucoes === 1 ? 'disparo' : 'disparos'}
                    </span>
                    <BotaoPerigo
                      titulo="Apaga o evento e a contagem dele. Para só desligar, use o interruptor."
                      pergunta={`Apagar o evento “${gatilho.evento}”? A contagem de ${gatilho.execucoes} disparo(s) some junto.`}
                      acao={acaoApagarGatilhoDeEvento.bind(null, cliente.id, gatilho.id)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <WebhooksDeEntrada
            clienteId={cliente.id}
            webhooks={webhooksDeEntrada}
            endereco={`${enderecoDoPainel()}/api/webhook/entrada/${cliente.id}`}
          />
        </section>
        )}

        {aba === 'campanhas' && (
        <section className="app-card overflow-hidden">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
            <h2 className="text-[14.5px] font-bold">Campanhas</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Por frase ou link de anúncio. Para mandar mensagem a uma lista, use{' '}
              <Link href={`/clientes/${cliente.id}/transmissoes`} className="font-semibold text-primary hover:underline">
                Transmissões
              </Link>
              .
            </p>
            </div>
            {/*
              Sem fluxo, o botão dava lugar a NADA, e a tela ficava sem saída:
              o cabeçalho explicando o que é campanha, a lista vazia dizendo que
              não há nenhuma, e nenhum caminho para criar a primeira. Quem não
              escreveu este código não tem como adivinhar que o que falta é um
              fluxo, porque a palavra "fluxo" não aparece em lugar nenhum da
              tela.

              Campanha precisa de um fluxo porque ela É "quem chegar por esta
              frase entra por aqui". Sem destino, não há o que gravar. Então em
              vez de esconder, a tela diz o que falta e leva até lá.
            */}
            {fluxos.length === 0 ? (
              <p className="max-w-[24ch] shrink-0 text-right text-[11.5px] leading-5 text-dim">
                Crie um{' '}
                <Link
                  href={`/clientes/${cliente.id}/fluxos`}
                  className="font-semibold text-ink underline underline-offset-2"
                >
                  fluxo
                </Link>{' '}
                primeiro, a campanha precisa de um lugar para levar quem chegar.
              </p>
            ) : (
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
          {campanhas.length > 0 && (
            <BuscaDaAba
              base={`/clientes/${cliente.id}/fluxos`}
              parametros={parametros}
              placeholder="Buscar campanha pelo nome ou frase"
              visiveis={campanhasVisiveis.length}
              total={campanhas.length}
            />
          )}

          {campanhas.length === 0 ? (
            <div className="border-b border-line px-5 py-12 text-center">
              <IlustracaoAnuncios />
              <p className="mt-6 text-[13px] font-semibold text-soft">Nenhuma campanha ainda</p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, todo mundo que vem de anúncio entra pela mesma porta ,
                e o relatório não separa quem veio de onde.
              </p>
            </div>
          ) : (
            <ul>
              {campanhasVisiveis.map((campanha) => {
                const destino = fluxos.find((item) => item.id === campanha.fluxoId)
                const trouxe = contatosDaCampanha.get(campanha.id) ?? 0

                return (
                  <li
                    key={campanha.id}
                    className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0"
                  >
                    <InterruptorDeCampanha
                      bloqueio={bloqueioDoDestino(destino)}
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
                        <NomeDoDestino destino={destino} clienteId={cliente.id} volta={voltaDaAba} />
                      </span>
                      <AvisoDoDestino destino={destino} ligada={campanha.ativa} />
                    </span>
                    <span className="whitespace-nowrap text-right text-[11px] text-dim">
                      <strong className="font-semibold text-soft">{trouxe}</strong> contato(s)
                      <span className="block">
                        {campanha.execucoes} {campanha.execucoes === 1 ? 'conversa' : 'conversas'}
                      </span>
                    </span>
                    <BotaoPerigo
                      titulo="Apaga a campanha. Os contatos que ela trouxe ficam, eles são o resultado dela."
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
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0 max-w-[86ch]">
            <h2 className="text-[14.5px] font-bold">Sequências</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-dim">
              Acompanhamento automático depois de um atendimento. Quem responde, sai.
            </p>
            <p className="mt-2 text-[11.5px] leading-5 text-dim">
              Acima de 24h, o passo precisa de um modelo aprovado.
            </p>
            </div>
            <ModalFormulario
              botao="+ Sequência"
              titulo="Nova sequência"
              descricao="Ela nasce sem passo, e sem passo não inscreve ninguém, o passo você acrescenta na linha dela, depois de criada."
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
          {sequencias.length > 0 && (
            <BuscaDaAba
              base={`/clientes/${cliente.id}/fluxos`}
              parametros={parametros}
              placeholder="Buscar sequência pelo nome"
              visiveis={sequenciasVisiveis.length}
              total={sequencias.length}
            />
          )}

          {sequencias.length === 0 ? (
            <div className="border-b border-line px-5 py-12 text-center">
              <IlustracaoSequencias />
              <p className="mt-6 text-[13px] font-semibold text-soft">Nenhuma sequência ainda</p>
              <p className="mt-1 text-xs leading-5 text-dim">
                Sem elas, quem não respondeu depois do atendimento simplesmente some.
              </p>
            </div>
          ) : (
            <ul>
              {sequenciasVisiveis.map((sequencia) => {
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
                  <li key={sequencia.id} className="border-b border-line last:border-0">
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
                            <strong className="font-semibold text-aviso">
                              sem passo, não inscreve ninguém
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
                            className="block text-aviso"
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

                    <details className="border-t border-line-soft bg-panel px-5 py-3">
                      <summary className="cursor-pointer text-[11.5px] text-muted">
                        Passos ({sequencia.passos.length}/{LIMITE_DE_PASSOS})
                      </summary>

                      {sequencia.passos.length > 0 && (
                        <ol className="mt-3 flex flex-col gap-2">
                          {sequencia.passos.map((passo, indice) => {
                            const destino = fluxos.find((item) => item.id === passo.fluxoId)
                            const quantosEsperam = esperando.get(`${sequencia.id}:${indice}`) ?? 0
                            const anterior = sequencia.passos[indice - 1]?.atrasoMinutos
                            const seguinte = sequencia.passos[indice + 1]?.atrasoMinutos
                            const faixa =
                              anterior !== undefined && seguinte !== undefined
                                ? `entre ${comoAtraso(anterior)} e ${comoAtraso(seguinte)}`
                                : anterior !== undefined
                                  ? `depois de ${comoAtraso(anterior)}`
                                  : seguinte !== undefined
                                    ? `antes de ${comoAtraso(seguinte)}`
                                    : null
                            return (
                              <li
                                key={passo.id}
                                className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2"
                              >
                                <span className="min-w-0 flex-1 text-[12px]">
                                  <span className="text-dim">{indice + 1}º passo · </span>
                                  <strong className="font-semibold text-soft">
                                    {comoAtraso(passo.atrasoMinutos)}
                                  </strong>{' '}
                                  depois da entrada ·{' '}
                                  {passo.templateId ? (
                                    /*
                                      O passo que passa de 24h manda modelo, e
                                      não abre fluxo. Mostrar "abre X" aqui
                                      diria a coisa errada sobre o que a pessoa
                                      vai receber.
                                    */
                                    <>
                                      manda o modelo{' '}
                                      <strong className="font-semibold text-muted">
                                        {templatesAprovados.find((t) => t.id === passo.templateId)
                                          ?.nome ?? 'que sumiu'}
                                      </strong>
                                    </>
                                  ) : (
                                    <>
                                      abre{' '}
                                      <NomeDoDestino destino={destino} clienteId={cliente.id} volta={voltaDaAba} />
                                      {destino && !destino.versaoPublicadaId && (
                                        <span className="text-aviso">
                                          {' '}
                                          · não publicado, então este passo não entrega nada
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {quantosEsperam > 0 && (
                                    <span className="block text-[11px] text-dim">
                                      {quantosEsperam === 1
                                        ? '1 pessoa esperando este passo'
                                        : `${quantosEsperam} pessoas esperando este passo`}
                                    </span>
                                  )}
                                </span>
                                <EditarPasso
                                  clienteId={cliente.id}
                                  passoId={passo.id}
                                  titulo={`Editar ${indice + 1}º passo`}
                                  descricao={`Hoje: ${comoAtraso(passo.atrasoMinutos)} depois da entrada.${
                                    faixa ? ` O horário novo precisa ficar ${faixa}, para a ordem dos passos não mudar.` : ''
                                  } Mudar o fluxo ou o modelo vale para quem ainda não recebeu este passo.`}
                                  fluxos={opcoesDeFluxo}
                                  modelos={modelosDoPasso}
                                  inicial={passo}
                                />
                                <BotaoPerigo
                                  rotulo="Tirar"
                                  titulo="Tira este passo. Quem já está no meio da sequência pode terminar antes."
                                  pergunta={`Tirar o passo de ${comoAtraso(passo.atrasoMinutos)}? ${
                                    quantosEsperam === 0
                                      ? 'Ninguém está esperando este passo agora.'
                                      : quantosEsperam === 1
                                        ? '1 pessoa está esperando este passo e termina a sequência sem ele.'
                                        : `${quantosEsperam} pessoas estão esperando este passo e terminam a sequência sem ele.`
                                  }`}
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
                            Crie um fluxo primeiro, um passo precisa de um lugar para levar.
                          </p>
                        ) : sequencia.passos.length >= LIMITE_DE_PASSOS ? (
                          <p className="text-[11.5px] text-dim">
                            {LIMITE_DE_PASSOS} passos é o teto. Mais que isso dentro de 24h não
                            traz lead nenhum, traz bloqueio.
                          </p>
                        ) : (
                          <ModalFormulario
                            botao="+ Adicionar passo"
                            titulo="Novo passo"
                            descricao="O tempo conta do evento que inscreveu a pessoa, não do passo anterior. Até 24h o passo abre um fluxo. Passado disso, o WhatsApp só entrega modelo aprovado pela Meta, escolha um abaixo."
                            rotuloEnviar="Adicionar passo"
                            variante="secundario"
                            action={criarPassoComCliente}
                          >
                            <CamposDoPasso fluxos={opcoesDeFluxo} modelos={modelosDoPasso} />
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
    </>
  )
}

/**
 * Por que a entrada não liga, ou `null` quando liga (A05). Mesma regra de
 * `podeLigar`, que o servidor aplica de novo no clique.
 */
function bloqueioDoDestino(destino: { versaoPublicadaId: string | null } | undefined) {
  if (!destino) return TEXTO_DA_RECUSA.destino_apagado
  return destino.versaoPublicadaId ? null : TEXTO_DA_RECUSA.destino_nao_publicado
}

/**
 * O nome do destino é o caminho para corrigi-lo: "o destino nunca foi
 * publicado" sem link obrigava a achar a automação na outra aba e depois achar
 * de novo o gatilho. O editor aberto daqui volta para a aba de origem.
 */
function NomeDoDestino({
  destino,
  clienteId,
  volta,
}: {
  destino: { id: string; nome: string } | undefined
  clienteId: string
  volta: string
}) {
  if (!destino) return <strong className="font-semibold text-muted">um fluxo que sumiu</strong>
  return (
    <Link
      href={`/clientes/${clienteId}/fluxos/${destino.id}?volta=${encodeURIComponent(volta)}`}
      className="font-semibold text-muted underline decoration-line underline-offset-2 hover:text-primary"
    >
      {destino.nome}
    </Link>
  )
}

/**
 * A linha de aviso embaixo da entrada cujo destino não atende. Linha própria, e
 * não o fim da linha de cima: aquela trunca, e no celular o aviso sumia.
 */
function AvisoDoDestino({
  destino,
  ligada,
}: {
  destino: { versaoPublicadaId: string | null } | undefined
  ligada: boolean
}) {
  if (destino?.versaoPublicadaId) return null
  const texto = !destino
    ? 'A automação de destino foi apagada. Escolha outra.'
    : ligada
      ? 'Ligada, mas o destino nunca foi publicado: não abre nada.'
      : 'Publique o destino para ligar.'
  return <span className="mt-1 block text-[11px] font-medium text-aviso">{texto}</span>
}

/** A busca por texto das abas de gatilhos e sequências, com o vazio do filtro. */
function BuscaDaAba({
  base,
  parametros,
  placeholder,
  visiveis,
  total,
}: {
  base: string
  parametros: Record<string, string>
  placeholder: string
  visiveis: number
  total: number
}) {
  const buscando = (parametros.q ?? '') !== ''
  return (
    <>
      <div className="border-b border-line px-5 py-3">
        <BarraDeLista
          base={base}
          parametros={parametros}
          busca={{ chave: 'q', placeholder, rotulo: placeholder }}
          resumo={buscando ? `${visiveis} de ${total}` : undefined}
        />
      </div>
      {buscando && visiveis === 0 && (
        <p className="border-b border-line px-5 py-8 text-center text-[12.5px] text-dim">
          Nada com essa busca.
        </p>
      )}
    </>
  )
}
