import { Fragment, Suspense } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { sessaoAtual } from '@/server/sessao'
import { acessoCompleto } from '@/server/permissoes'
import { alcanceDaTela, espiando, quemPossoEspiar } from '@/server/espiar'
import { FaixaDeEspiar, MenuDeEspiar } from '@/components/inbox/espiar'
import { alcancaDono } from '@/core/permissoes'
import { ClienteShell } from '@/components/design/cliente-shell'
import { IlustracaoInbox } from '@/components/design/ilustracoes'
import { recemConectado } from '@/core/coexistencia-na-tela'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { acharCliente, inboxAoVivo, type Cliente } from '@/server/repos/clientes'
import { agendadasDaConta as listarAgendadasDaConta } from '@/server/repos/mensagens-agendadas'
import {
  acharLead,
  contarPorAtribuicao,
  contarPorEstado,
  filaInteira,
  leadsPorContatos,
  limparBusca,
  paginarLeads,
  pulsoDaConta,
  type FiltroDeEstado,
  type Lead,
} from '@/server/repos/leads'
import { listarRespostasRapidas, type RespostaRapida } from '@/server/repos/respostas-rapidas'
import type { EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { MolduraDoInbox } from '@/components/inbox/moldura'
import { cabeNoRecorte } from '@/components/inbox/recorte'
import { Fila, type Contagem } from '@/components/inbox/fila'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { naoLidasPorContato } from '@/server/repos/leituras'
import { fixadasDoUsuario } from '@/server/repos/marcadores'
import { canaisDosContatos } from '@/server/repos/canais-site'
import { canalPeloContato, type CanalId } from '@/core/canais'
import { FaixaDeCanalCaido } from '@/components/inbox/faixa-canal-caido'
import { PainelDaConversa } from '@/components/inbox/painel-da-conversa'
import { lerConversaAberta } from '@/server/conversa-aberta'
import { PulsoDoInbox } from '@/components/inbox/pulso-do-inbox'
import { TelefoneDoInbox } from '@/components/inbox/telefone-do-inbox'

export const dynamic = 'force-dynamic'

type Busca = {
  conversa?: string | string[]
  /** O rail `Atribuído`: `todos`, `sem-dono` ou o id de um atendente. */
  de?: string | string[]
  pagina?: string | string[]
  busca?: string | string[]
  /** O rail `Estado` (0049): `aberta`, `adiada` ou `resolvida`. */
  estado?: string | string[]
}

/**
 * O `?estado=` veio de um endereço, então pode ser qualquer coisa. Só os três
 * valores conhecidos passam, o resto cai no default, que é a fila aberta.
 */
function ehEstadoValido(valor: string | undefined): valor is FiltroDeEstado {
  return valor === 'aberta' || valor === 'adiada' || valor === 'resolvida'
}

/**
 * Quantas conversas a fila carrega de uma vez.
 *
 * Ela trazia **todas**. Com 58 tudo bem; com 5.000 é uma página que demora a
 * abrir para mostrar cinquenta linhas que cabem na tela, e a fila é a tela que
 * alguém deixa aberta o dia inteiro.
 */
const CONVERSAS_POR_PAGINA = 50

const primeiro = (valor: string | string[] | undefined) =>
  (Array.isArray(valor) ? valor[0] : valor) ?? ''

/**
 * A tela de trabalho de quem atende.
 *
 * Leads continua sendo a lista de qualificação e relatório; Inbox é a fila
 * para responder sem voltar para uma tabela a cada conversa. A seleção vive na
 * URL para cada conversa poder ser compartilhada ou retomada ao voltar, mas o
 * Link do Next troca apenas o payload da rota, não há recarregamento do
 * navegador.
 */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>
  searchParams: Promise<Busca>
}) {
  const [{ clienteId }, busca] = await Promise.all([params, searchParams])
  const cliente = await acharCliente(clienteId)
  if (!cliente) notFound()

  /*
   * A chave é o **filtro**, e não a conversa aberta.
   *
   * Trocar de rail refaz a fila inteira: é uma tela nova, e merece o esqueleto.
   * Clicar numa conversa da lista, não, a fila continua a mesma, e apagá-la
   * para um cinza a cada clique seria piscar a coluna que a pessoa está usando
   * justamente enquanto ela a usa.
   */
  const chaveDoFiltro = [
    primeiro(busca.de),
    primeiro(busca.estado),
    primeiro(busca.pagina),
    primeiro(busca.busca),
  ].join('|')

  return (
    <ClienteShell cliente={cliente} ativa="inbox">
      {/*
        **Esta fronteira não tem mais `fallback` de esqueleto, e isso conserta o
        esqueleto em dois tempos.**

        O que o dono via, e descreveu certo: *"tem um skeleton inicial quando eu
        clico no inbox, super esquisito, e aí do nada aparece o header e continua
        um skeleton rodando embaixo"*. Eram dois mesmo, em sequência:

        1. o `loading.tsx` da rota, que aparece no quadro do clique, mas desenha
           a moldura do cliente **sem** o cabeçalho da conta, porque a
           `ClienteShell` ainda não resolveu as consultas dela;
        2. este `fallback`, que entrava **depois** da moldura chegar, repetindo o
           mesmo `EsqueletoDeInbox` já embaixo de um cabeçalho de verdade.

        O primeiro sozinho já cobre a espera inteira, e é o que o Next
        pré-carrega junto do prefetch. Repetir o esqueleto depois da moldura só
        fazia a tela parecer que recomeçava do zero.

        A fronteira continua aqui, com `key={chaveDoFiltro}`, porque ela ainda
        isola a troca de filtro, e sem `fallback` o React segura a tela anterior
        enquanto o filtro novo vem, que é o comportamento certo para quem trocou
        de aba do rail: a fila some e volta era justamente o que incomodava.
      */}
      <Suspense key={chaveDoFiltro}>
        <Tela cliente={cliente} busca={busca} />
      </Suspense>
    </ClienteShell>
  )
}

async function Tela({ cliente, busca }: { cliente: Cliente; busca: Busca }) {
  const clienteId = cliente.id
  /*
   * `?de=minhas` é o "Minhas conversas" da barra lateral: o menu não conhece o
   * id de quem está olhando (ele é desenhado sem I/O), então pede pela
   * palavra, e aqui ela vira o id. O resto da tela continua vendo um id, como
   * se a pessoa tivesse escolhido o próprio nome no filtro.
   */
  const deQuem = primeiro(busca.de) || 'todos'
  // Espiando, "minhas" são as do espiado: a tela é a dele.
  const espiao = await espiando(clienteId)
  const atribuicao =
    deQuem === 'minhas' ? (espiao?.alvo.id ?? (await acessoCompleto(clienteId)).sessao.usuario.id) : deQuem
  /*
   * O eixo "em que pé está", separado do "de quem é" (0049).
   *
   * O default é `aberta` e não `todas`: a fila existe para mostrar o que
   * precisa de alguém hoje. Sem isso, a conversa resolvida ontem disputa
   * espaço com quem está esperando resposta agora, que era o estado anterior
   * desta tela.
   */
  const estadoPedido = primeiro(busca.estado)
  const estado: FiltroDeEstado = ehEstadoValido(estadoPedido) ? estadoPedido : 'aberta'
  const pagina = Math.max(1, Number(primeiro(busca.pagina)) || 1)
  const termo = limparBusca(primeiro(busca.busca))

  // Quem a pessoa pode ver. Entra em **todas** as consultas da fila: lista,
  // busca local, contadores e a conversa aberta pelo endereço. Um contador sem
  // alcance contaria para o atendente as conversas dos colegas.
  const alcance = await alcanceDaTela(clienteId)

  const [
    fila,
    local,
    respostasRapidas,
    contagem,
    porEstado,
    etiquetas,
    coexistencia,
    temAutomacao,
    canalDoContato,
    espiaveis,
  ] =
    await Promise.all([
    paginarLeads(clienteId, {
      atribuicao,
      // Buscando, todas as conversas, como na fila local: a aba não esconde
      // a conversa resolvida que a pessoa procura pelo número.
      estado: termo === '' ? estado : 'todas',
      busca: termo,
      pagina,
      porPagina: CONVERSAS_POR_PAGINA,
      alcance,
    }),
    /*
     * A fila inteira, para os rails filtrarem no navegador, ou `null` quando a
     * conta passou de `TETO_DA_FILA_LOCAL` e a tela precisa continuar
     * paginando. Ver `filaInteira`: ela conta antes de trazer, então numa conta
     * grande isto é uma contagem barata, não 5.000 linhas jogadas fora.
     *
     * Vai junto das outras no mesmo `Promise.all`, em série somaria uma ida de
     * rede à tela mais aberta do produto.
     */
    filaInteira(clienteId, { busca: termo, alcance }),
    listarRespostasRapidas(clienteId),
    contarPorAtribuicao(clienteId, alcance),
    contarPorEstado(clienteId, alcance),
    listarEtiquetas(clienteId),
    /*
     * Só custa quando o Inbox está vazio, que é quando a resposta importa,
     * mas a chamada vai junto das outras para não somar ida de rede em série
     * numa tela que já espera cinco consultas.
     */
    coexistenciaDoCliente(clienteId),
    /*
     * Duas contagens curtas com `limit(1)`: a pergunta é "existe?", não
     * "quantos". Vai no mesmo `Promise.all` para não somar ida de rede em
     * série numa tela que já espera várias consultas.
     */
    clienteTemAutomacao(clienteId),
    /*
     * O selo de canal de cada linha. Em conta só de WhatsApp não consulta nada,
     * ver `canaisDosContatos`.
     */
    canaisDosContatos(clienteId),
    // A porta do modo espiar só aparece para quem tem de quem espiar.
    espiao ? Promise.resolve([] as string[]) : quemPossoEspiar(clienteId),
  ])

  /*
   * Qualquer número coexistente ainda sincronizando serve: a explicação é sobre
   * a conta, e um cliente com dois números conectados no mesmo dia não precisa
   * de dois avisos dizendo a mesma coisa.
   */
  const recem = Object.values(coexistencia).some((estado) => recemConectado(estado))

  const leads = fila.leads

  const pedido = primeiro(busca.conversa) || undefined

  /**
   * A conversa pedida pode não estar na página carregada, um link guardado de
   * duas semanas atrás, ou uma aba do rail que não a contém. Buscar por id
   * quando ela não aparece na lista é o que faz o endereço continuar valendo.
   */
  const naLista = escolherLead(leads, pedido)
  const selecionado =
    naLista?.contatoId === pedido || !pedido ? naLista : ((await acharLead(clienteId, pedido, alcance)) ?? naLista)

  /*
   * **`sessaoAtual` e `pulsoDaConta` vão juntas.** Eram duas idas de rede em
   * série, e uma não depende da outra: o pulso é sobre a conta, a sessão é
   * sobre quem está olhando. Em série elas somavam ao tempo até o primeiro
   * pixel de **toda** navegação do Inbox, inclusive a de só trocar de conversa,
   * que é a mais frequente da tela mais usada do produto.
   *
   * O pulso continua sendo lido aqui, antes do desenho, porque ele é a linha de
   * base contra a qual o poll compara para saber se o que está à vista
   * envelheceu: lê-lo depois seria comparar a tela com um relógio posterior a
   * ela.
   */
  const [sessao, pulso, aoVivo] = await Promise.all([
    sessaoAtual(),
    pulsoDaConta(clienteId),
    inboxAoVivo(clienteId),
  ])

  /**
   * Quem atende nesta conta, para a tela dizer **nomes** em vez de uuid.
   *
   * A consulta fala Postgres direto (as tabelas do login ficam fora da Data
   * API), e por isso ela pode estourar num ambiente sem `DATABASE_URL`. Cair
   * para uma lista vazia é o certo: o Inbox é a tela mais usada do produto, e
   * ela não pode parar de abrir porque o login não está configurado. Sem
   * membros, a atribuição simplesmente não aparece, que é a verdade enquanto
   * não existe usuário nenhum.
   */
  let equipe: MembroDaConta[] = []
  // Só busca quando há o que mostrar: alguém logado para assumir, ou alguma
  // conversa já com dono. Enquanto não existir
  // usuário nenhum, isso é uma ida ao banco por abertura do Inbox, que é a
  // tela mais usada do produto, para montar uma lista vazia.
  if (sessao || leads.some((lead) => lead.atribuidoA)) {
    try {
      equipe = await membrosDaConta(cliente.id)
    } catch (erro) {
      console.error(
        '[inbox] não deu para ler a equipe',
        erro instanceof Error ? erro.message : erro,
      )
    }
  }

  /**
   * **Marcar antes de contar, nesta ordem.**
   *
   * A conversa que está aberta na tela acabou de ser lida, contá-la como não
   * lida no mesmo desenho em que ela está visível é o tipo de detalhe que faz
   * a insígnia perder credibilidade e todo mundo parar de olhar para ela.
   *
   * **A renderização não escreve "li" nem manda o visto.** O `Link` de cada
   * linha da fila tem prefetch completo, e no Next 16 ele renderiza esta
   * página sem nada que o diferencie de uma navegação: marcar aqui fazia toda
   * conversa à vista na lista virar lida, com visto azul para o cliente, sem
   * ninguém abrir (02/out/2026). Quem marca é o navegador, com a conversa
   * montada e a aba visível (o `POST` de `inbox/conversa`, chamado pelo
   * `Historico`).
   * Aqui a conversa aberta só é descontada da contagem, logo abaixo.
   */
  // Espiando, a tela é a do espiado: as não lidas e as fixadas são as dele.
  const usuarioId = espiao ? espiao.alvo.id : (sessao?.usuario.id ?? null)
  /*
   * **As não lidas cobrem a fila local, não só a página do servidor.**
   *
   * Quem filtra no navegador troca de aba sem voltar aqui: uma conversa que
   * aparece só depois de clicar em "Adiadas" precisa da insígnia já calculada,
   * senão ela nasce sem, e uma insígnia que some conforme a aba é pior que
   * insígnia nenhuma, porque ninguém desconfia de um zero.
   *
   * `local` é no máximo `TETO_DA_FILA_LOCAL` contatos, e a consulta é um
   * `in (...)` de ids. Quando ele é `null` a lista é a página, como antes.
   */
  /*
   * ---------------------------------------------------------------------------
   * As fixadas desta pessoa, e por que o modo paginado precisa buscá-las
   * ---------------------------------------------------------------------------
   *
   * No modo local a fila inteira já está aqui, e fixar é só uma ordenação
   * diferente do que já veio. No modo paginado a lista é uma página de
   * cinquenta, e a conversa fixada pode estar na página quatro, o alfinete
   * prometeria o topo e entregaria nada. Por isso os fixados são buscados por
   * id e entram na frente.
   *
   * **Mas só os que caberiam no recorte atual.** Fixar organiza a fila; não
   * revoga o filtro. Trazer uma conversa resolvida para o topo de quem está
   * olhando "Abertas" seria o mesmo tipo de mentira que a fila local evita ao
   * não filtrar página parcial, e quem está buscando por texto quer o
   * resultado da busca, não o que marcou semana passada.
   */
  const fixadasDaPessoa = await fixadasDoUsuario(usuarioId)

  const naPagina = new Set(leads.map((lead) => lead.contatoId))
  const fixadosDeFora =
    local === null && fixadasDaPessoa.size > 0 && termo === ''
      ? (await leadsPorContatos(clienteId, [...fixadasDaPessoa.keys()])).filter(
          (lead) =>
            !naPagina.has(lead.contatoId) &&
            cabeNoRecorte(lead, estado, atribuicao) &&
            // Fixou quando a conversa era dele e ela passou para outra pessoa:
            // some da fila junto com o resto.
            alcancaDono(alcance, lead.atribuidoA),
        )
      : []

  const naFila = fixadosDeFora.length > 0 ? [...fixadosDeFora, ...leads] : leads

  /*
   * O mapa entregue à tela é **só o desta conta**. `af_fixadas` não guarda
   * cliente (ver a 0063), e quem atende dois clientes tem alfinetes nos dois:
   * sem este corte, o teto de fixadas de um cliente seria gasto pelas conversas
   * do outro, e a recusa não estaria explicada em lugar nenhum da tela.
   */
  const daConta = new Set((local ?? naFila).map((lead) => lead.contatoId))
  const fixadas = new Map(
    [...fixadasDaPessoa].filter(([contatoId]) => daConta.has(contatoId)),
  )

  const naoLidas = await naoLidasPorContato(
    usuarioId,
    (local ?? naFila).map((lead) => lead.contatoId),
  )

  /*
   * **A conversa aberta nunca aparece como não lida.**
   *
   * A marca de lida vem do navegador depois do desenho (o `POST` de `inbox/conversa`),
   * e a contagem aqui ainda enxerga as mensagens da conversa que está visível
   * na tela.
   *
   * O desconto é explícito, e é a mesma verdade de antes dita no lugar certo:
   * o que a pessoa está lendo agora não está por ler. Vale mesmo sem usuário na
   * sessão, caso em que não há o que marcar no banco mas a tela continua
   * mostrando a conversa aberta.
   */
  // O número da barra lateral foi contado antes desta leitura; a fila desconta.
  const abertaEstavaSemLer = selecionado ? (naoLidas.get(selecionado.contatoId) ?? 0) > 0 : false
  if (selecionado) naoLidas.delete(selecionado.contatoId)

  return (
    <>
      {/*
        Só aqui, e não na moldura do cliente: recarregar a tela de fluxos ou de
        contatos a cada mensagem que chega seria intromissão. O Inbox é a única
        tela cujo conteúdo é a conversa acontecendo agora.
      */}
      <PulsoDoInbox clienteId={cliente.id} pulsoNaTela={pulso} aoVivo={aoVivo} />
      <TelefoneDoInbox clienteId={cliente.id} />
      <FaixaDeCanalCaido clienteId={cliente.id} />
      {espiao && <FaixaDeEspiar clienteId={cliente.id} nome={espiao.alvo.nome} />}
      {/*
        **Sem respiro em volta, e essa é a diferença mais visível desta tela.**

        As outras páginas do painel são documentos: um cartão sobre o fundo, com
        margem, canto redondo e sombra. O Inbox não é documento, é a ferramenta,
        ela ocupa a janela inteira, encosta na barra lateral e no topo, e quem
        separa é a borda que a barra já tem.

        Com margem de 42px e canto de 16px ele virava um retângulo boiando num
        fundo cinza: o produto todo parecia um modal aberto por engano, e cada
        pixel daquela moldura era pixel que não era conversa.

        O respiro volta para o estado vazio, que **é** documento: uma explicação
        curta no meio da tela não quer encostar em nada.
      */}
      <main className="flex min-h-0 flex-1 flex-col">
        {/*
          O estado vazio é para **cliente sem conversa nenhuma**, e não para
          filtro sem resultado.
          
          Antes bastava a lista vir vazia para a tela inteira virar "quando
          alguém falar com o número, a conversa aparece aqui", inclusive
          depois de uma busca que não achou. Além de mentir (há conversas, só
          não com aquele termo), sumia com o próprio campo de busca, e a pessoa
          não tinha como corrigir o que digitou.
        */}
        {contagem.total === 0 ? (
          <div className="px-4 pt-[26px] pb-[42px] md:px-[42px]">
            <EstadoVazio clienteId={cliente.id} recemConectado={recem} />
          </div>
        ) : (
          <Conteudo
            clienteId={cliente.id}
            leads={naFila}
            local={local}
            selecionado={selecionado}
            respostasRapidas={respostasRapidas}
            equipe={equipe}
            usuarioId={usuarioId}
            naoLidas={naoLidas}
            abertaEstavaSemLer={abertaEstavaSemLer}
            fixadas={fixadas}
            etiquetas={etiquetas}
            contagem={contagem}
            porEstado={porEstado}
            atribuicao={atribuicao}
            estado={estado}
            termo={termo}
            pagina={fila.pagina}
            paginas={fila.paginas}
            temAutomacao={temAutomacao}
            conversaPedida={Boolean(pedido)}
            canalDoContato={canalDoContato}
            espiado={espiao?.alvo.nome ?? null}
            menuDeEspiar={
              espiao ? null : (
                <MenuDeEspiar
                  clienteId={cliente.id}
                  pessoas={equipe
                    .filter((membro) => espiaveis.includes(membro.id))
                    .map((membro) => ({ id: membro.id, nome: membro.nome }))}
                />
              )
            }
          />
        )}
      </main>
    </>
  )
}

function escolherLead(leads: Lead[], contatoId: string | undefined): Lead | null {
  if (leads.length === 0) return null
  return (
    leads.find((lead) => lead.contatoId === contatoId) ??
    leads.find((lead) => lead.aguardando !== null) ??
    leads[0] ??
    null
  )
}

function EstadoVazio({
  clienteId,
  recemConectado: recem,
}: {
  clienteId: string
  recemConectado: boolean
}) {
  /*
   * **A tela diz o que sabe, e só isso: não há conversa.**
   *
   * Aqui já houve um card de pendências da Meta (cartão, fuso, verificação),
   * e ele foi removido em 13/set/2026 por ser falso: o cliente que o via
   * conectou e passou a receber mensagem **sem** ter resolvido nenhum dos
   * três itens. A causa real era outra, o app estava inscrito na WABA errada.
   *
   * A fonte daquele card é o `health_status`, que fica em cache e mente: a
   * mesma conta que ele dava como bloqueada aceitava envio normalmente. Pedir
   * ao cliente que cadastre cartão para destravar algo que não está travado é
   * pior que não dizer nada.
   */
  return (
    /*
      Largura cheia e cartão com cabeçalho, como o vazio de Transmissões: era
      uma coluna de 440px no meio da tela, e o Inbox vazio parecia outra
      página (02/out/2026).
    */
    <section className="app-card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-bold">Caixa de Entrada</h2>
          <p className="mt-0.5 text-[12px] leading-5 text-dim">
            As conversas do WhatsApp, do Instagram e do site chegam aqui.
          </p>
        </div>
        <Link href={`/clientes/${clienteId}/leads`} className="app-secondary-button inline-flex h-9 shrink-0 items-center px-4 text-[13px]">
          Ver Leads
        </Link>
      </header>
      <div className="px-5 py-14 text-center">
        <IlustracaoInbox />
        <p className="mt-6 text-[13.5px] font-semibold text-soft">Nenhuma conversa para atender</p>
        <p className="mx-auto mt-1.5 max-w-[460px] text-[12.5px] leading-5 text-dim">
          Quando alguém falar com o número ligado ao bot, a conversa aparece aqui. A tela de Leads
          continua sendo o lugar para analisar todos os contatos.
        </p>

        {/*
         * Número recém-conectado demora: enquanto a Meta não termina de
         * sincronizar, mensagem nova não chega. Dizer isso evita a conclusão de
         * que algo quebrou, que foi o que aconteceu com o primeiro cliente.
         */}
        {recem && (
          <p className="mx-auto mt-4 max-w-[460px] rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left text-[12.5px] leading-5 text-dim">
            Este número foi conectado há pouco. A Meta ainda está sincronizando, e
            isso pode levar algumas horas, até terminar, é normal nenhuma
            conversa nova aparecer aqui.
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * O lead passaria pelos filtros que estão ligados agora?
 *
 * Existe só para os fixados de fora da página: eles não passaram pela consulta
 * que aplicou o recorte, e entrar no topo sem essa pergunta faria o rail dizer
 * "Abertas 12" com uma resolvida na lista. Os dois campos são os mesmos que a
 * fila local usa para filtrar no navegador (ver `RailsLocais`), e é de propósito,
 * duas definições do mesmo recorte divergiriam no primeiro estado novo.
 */

async function Conteudo({
  clienteId,
  leads,
  local,
  selecionado,
  respostasRapidas,
  equipe,
  usuarioId,
  naoLidas,
  abertaEstavaSemLer,
  fixadas,
  etiquetas,
  contagem,
  porEstado,
  atribuicao,
  estado,
  termo,
  pagina,
  paginas,
  temAutomacao,
  conversaPedida,
  canalDoContato,
  espiado,
  menuDeEspiar,
}: {
  clienteId: string
  /** O nome de quem está sendo espiado, ou `null` fora do modo espiar. */
  espiado: string | null
  menuDeEspiar: React.ReactNode
  /** Quem fala por outro canal que não o WhatsApp, para o selo. Ver `canaisDosContatos`. */
  canalDoContato: Map<string, CanalId>
  /** O endereço já chegou com `?conversa=`: no celular, abre nela. */
  conversaPedida: boolean
  leads: Lead[]
  /**
   * A fila inteira, sem filtro de estado nem de dono, ou `null` quando a conta
   * é grande demais para isso e a tela continua paginando. Ver
   * `TETO_DA_FILA_LOCAL`.
   */
  local: Lead[] | null
  /** `null` quando o filtro ou a busca não deixou nenhuma conversa para abrir. */
  selecionado: Lead | null
  respostasRapidas: RespostaRapida[]
  /** As etiquetas manuais da conta, para o painel do contato deixar aplicar. */
  etiquetas: EtiquetaEscolhivel[]
  equipe: MembroDaConta[]
  /** Quem está olhando. */
  usuarioId: string | null
  /** Quantas entradas cada conversa tem depois da última vez que **eu** abri. */
  naoLidas: Map<string, number>
  abertaEstavaSemLer: boolean
  /** As conversas que **eu** grudei no topo, e quando. Ver a 0063. */
  fixadas: Map<string, string>
  contagem: Contagem
  /** Quantas em cada estado, para o rail dizer o tamanho de cada aba. */
  porEstado: { aberta: number; adiada: number; resolvida: number }
  atribuicao: string
  estado: FiltroDeEstado
  termo: string
  pagina: number
  paginas: number
  /** Ver `DadosDoLead`: sem automação o card não fala de bot. */
  temAutomacao: boolean
}) {
  // Mesmo alcance da `Tela`: `alcanceDaTela` é `cache`, então não relê nada.
  const alcance = await alcanceDaTela(clienteId)
  /*
   * Tudo o que ainda vai sair nesta conta, junto da conversa aberta: em série
   * seria uma ida de rede a mais antes do primeiro pixel.
   *
   * Vem inteiro e não contado porque o número da barra é um botão: clicar abre
   * a lista com o cancelar. O teto de 200 está no repositório.
   */
  const [agendadasDaConta, inicial] = await Promise.all([
    listarAgendadasDaConta(clienteId),
    selecionado
      ? lerConversaAberta({
          clienteId,
          lead: selecionado,
          usuarioId,
          temAutomacao,
          canal: canalPeloContato(selecionado.waId, canalDoContato.get(selecionado.contatoId)),
        })
      : Promise.resolve(null),
  ])

  /*
   * Conta a fila inteira quando ela veio, e não a página: a linha diz "N
   * esperando uma pessoa" **sobre a conta**, e no modo local ela fica fixa
   * enquanto a pessoa troca de aba. Contar só o recorte faria o número cair
   * para zero em "Resolvidas", que é verdade sobre a aba e mentira sobre o
   * que precisa de alguém.
   */
  const esperando = (local ?? leads).filter((lead) => lead.aguardando).length

  return (
    /*
      A página do Inbox **não tem título próprio**, e é a única do painel assim.

      Ela tinha um: "ATENDIMENTO / Inbox", duas linhas acima da moldura. Com a
      coluna da fila dizendo "Caixa de Entrada" em corpo 17, o título de cima
      repetia a palavra e cobrava 24px de altura, numa tela que só perde com
      isso, porque o que ela quer é caber conversa.
    */
    <MolduraDoInbox
      fila={
        <Fila
          clienteId={clienteId}
          leads={leads}
          local={local}
          selecionado={selecionado}
          esperando={esperando}
          equipe={
            // O filtro "de quem é" só oferece quem a pessoa alcança. A equipe
            // inteira continua indo para "Passar para", que é outra pergunta.
            alcance.tipo === 'tudo'
              ? equipe
              : alcance.tipo === 'nada'
                ? []
                : equipe.filter((membro) => alcance.donos.includes(membro.id))
          }
          rotuloDeTodos={
            alcance.tipo === 'tudo'
              ? 'Todos os atendentes'
              : alcance.tipo === 'donos' && alcance.donos.length > 1
                ? 'Minha equipe e sem dono'
                : 'Minhas e sem dono'
          }
          contagem={contagem}
          porEstado={porEstado}
          atribuicao={atribuicao}
          estado={estado}
          termo={termo}
          usuarioId={usuarioId}
          naoLidas={naoLidas}
          abertaEstavaSemLer={abertaEstavaSemLer}
          fixadas={fixadas}
          pagina={pagina}
          paginas={paginas}
          agendadas={agendadasDaConta}
          canalDoContato={canalDoContato}
          menuDeEspiar={menuDeEspiar}
        />
      }
      conversa={
        /*
          **Trocar de conversa não navega.** A página desenha a primeira; as
          próximas o navegador abre sozinho, com a lista parada (ver
          `aberta-local.ts`). Antes cada clique refazia o Inbox inteiro no
          servidor para mudar só esta coluna.
        */
        <PainelDaConversa
          inicial={inicial}
          clienteId={clienteId}
          equipe={equipe}
          usuarioId={usuarioId}
          etiquetas={etiquetas}
          temAutomacao={temAutomacao}
          respostasRapidas={respostasRapidas}
          espiado={espiado}
        />
      }
      /*
        A ficha não vem mais por aqui: ela é irmã da conversa, dentro da mesma
        fronteira, porque lê o mesmo contato. `temFicha` só reserva a coluna da
        grade, ver `MolduraDoInbox`.
      */
      temFicha={Boolean(selecionado)}
      conversaPedida={conversaPedida}
    />
  )
}
