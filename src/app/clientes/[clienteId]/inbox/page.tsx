import { Fragment, Suspense, type ReactNode } from 'react'
import { after } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comoFalta, podeReagir, restaDaJanela } from '@/channels/janela'
import { Assumir, PassarPara } from '@/components/inbox/assumir'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { sessaoAtual } from '@/server/sessao'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dica } from '@/components/design/dica'
import { LogoDoCanal } from '@/components/design/selo-do-canal'
import { IlustracaoInbox } from '@/components/design/ilustracoes'
import { recemConectado } from '@/core/coexistencia-na-tela'
import { assinaturaDasReacoes } from '@/core/reacoes'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { CamposColetados } from '@/components/lead/campos-coletados'
import { camposSemOrigem } from '@/core/contatos/origem'
import type { AnuncioEmCache, Passagem } from '@/core/anuncios'
import { passagensDoContato } from '@/server/repos/passagens'
import { resolverAnuncios } from '@/server/resolver-anuncios'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'
import { QuemE } from '@/components/lead/quem-e'
import { CaixaDeResposta } from '@/components/lead/responder'
import { RodapeDaMensagem } from '@/components/lead/rodape-da-mensagem'
import { Transcricao } from '@/components/lead/transcricao'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import { ProvedorDeEntrega } from '@/components/lead/entrega-de-arquivos'
import {
  acaoAssumirAtendimento,
  acaoAtribuirPara,
  acaoEncerrarAtendimento,
  acaoLiberarAtendimento,
  acaoResponderLead,
  acaoSalvarNotas,
} from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { contextoDeResposta } from '@/server/repos/conversas'
import {
  agendadasDaConta as listarAgendadasDaConta,
  agendadasDoContato,
  type MensagemAgendada,
} from '@/server/repos/mensagens-agendadas'
import {
  acharLead,
  contarPorAtribuicao,
  contarPorEstado,
  filaInteira,
  leadsPorContatos,
  limparBusca,
  lerConversa,
  paginarLeads,
  pulsoDaConta,
  type FiltroDeEstado,
  type Lead,
  type MensagemDoLead,
} from '@/server/repos/leads'
import { listarRespostasRapidas, type RespostaRapida } from '@/server/repos/respostas-rapidas'
import {
  AnexoNaConversa,
  ArquivoSemCopia,
  MensagemNaoSuportada,
  CartoesNaBolha,
  CitacaoNaBolha,
  LocalNaBolha,
  SemTexto,
} from '@/components/lead/anexo'
import { etiquetasDeDia, horaDoRelogio, horaExata } from '@/lib/quando'
import type { EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { AcoesRapidas } from '@/components/inbox/acoes-rapidas'
import { Avatar } from '@/components/inbox/avatar'
import { MolduraDoInbox } from '@/components/inbox/moldura'
import { Fila, type Contagem } from '@/components/inbox/fila'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { listarQuadros, quadrosDoContato } from '@/server/repos/quadros'
import { FunilDaConversa, type FunilDoContato } from '@/components/inbox/funil-da-conversa'
import { marcarComoLida, naoLidasPorContato, quandoLeu } from '@/server/repos/leituras'
import { favoritasEntre, fixadasDoUsuario } from '@/server/repos/marcadores'
import { ajustesDaConta } from '@/server/repos/distribuicao'
import { avisarQueLeu } from '@/server/recibo-de-leitura'
import { TextoDoWhatsApp } from '@/components/texto-do-whatsapp'
import { FaixaDeCanalCaido } from '@/components/inbox/faixa-canal-caido'
import { PulsoDoInbox } from '@/components/inbox/pulso-do-inbox'
import { Esqueleto } from '@/components/design/esqueleto'

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
  const atribuicao = primeiro(busca.de) || 'todos'
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

  const [
    fila,
    local,
    respostasRapidas,
    contagem,
    porEstado,
    etiquetas,
    coexistencia,
    temAutomacao,
  ] =
    await Promise.all([
    paginarLeads(clienteId, {
      atribuicao,
      estado,
      busca: termo,
      pagina,
      porPagina: CONVERSAS_POR_PAGINA,
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
    filaInteira(clienteId, { busca: termo }),
    listarRespostasRapidas(clienteId),
    contarPorAtribuicao(clienteId),
    contarPorEstado(clienteId),
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
    naLista?.contatoId === pedido || !pedido ? naLista : ((await acharLead(clienteId, pedido)) ?? naLista)

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
  const [sessao, pulso] = await Promise.all([sessaoAtual(), pulsoDaConta(clienteId)])

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
   * Escrever durante a renderização é aceitável **aqui** porque a escrita é
   * idempotente (`lida_em = now()`) e a rota é `force-dynamic`: rodar duas
   * vezes na mesma navegação escreve o mesmo relógio duas vezes. Sem usuário,
   * quem ainda não tem usuário na conta, as duas funções não fazem nada.
   */
  const usuarioId = sessao?.usuario.id ?? null
  if (selecionado) {
    /*
     * A ordem importa: **ler o relógio antes de empurrá-lo.**
     *
     * `marcarComoLida` escreve `now()`. Se o recibo de leitura do WhatsApp
     * fosse decidido depois disso, a comparação "chegou algo desde a última
     * olhada?" sempre daria não, e o tique azul nunca sairia.
     */
    const leuAntesEm = await quandoLeu(usuarioId, selecionado.contatoId)

    /*
     * **A marca de lida sai do caminho do desenho.**
     *
     * Ela era `await` aqui: uma **escrita** no banco entre o clique e o
     * primeiro pixel da conversa, em toda troca de conversa. Quem lê não
     * precisa esperar o registro de que leu — o que importa nesta renderização
     * é `leuAntesEm`, que já foi lido acima, e a contagem logo abaixo, que
     * desconta a conversa aberta por conta própria.
     *
     * Continua idempotente (`lida_em = now()`) e continua antes da contagem na
     * ordem que importa: a leitura de `quandoLeu` permanece em série, porque
     * empurrar o relógio antes de lê-lo faria o tique azul nunca sair.
     */
    after(() => marcarComoLida(usuarioId, selecionado.contatoId))

    /*
     * O tique azul sai **depois** da resposta, pelo `after`: é uma chamada de
     * rede à Meta, e ela não pode entrar no caminho de desenhar a conversa.
     *
     * Sem usuário na sessão não há de quem saber "quando leu", e sem isso cada
     * atualização da tela mandaria outro recibo. Fica sem, o bot ainda marca
     * lida quando vai responder.
     */
    const contatoAberto = selecionado.contatoId
    if (usuarioId) after(() => avisarQueLeu(clienteId, contatoAberto, leuAntesEm))
  }
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
          (lead) => !naPagina.has(lead.contatoId) && cabeNoRecorte(lead, estado, atribuicao),
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
   * Antes isso acontecia por efeito colateral: `marcarComoLida` era um `await`
   * logo acima, então a contagem já vinha do banco sem ela. Agora a marca sai
   * pelo `after()`, depois da resposta, e a contagem aqui ainda enxergaria as
   * mensagens da conversa que está visível na tela.
   *
   * O desconto é explícito, e é a mesma verdade de antes dita no lugar certo:
   * o que a pessoa está lendo agora não está por ler. Vale mesmo sem usuário na
   * sessão, caso em que não há o que marcar no banco mas a tela continua
   * mostrando a conversa aberta.
   */
  if (selecionado) naoLidas.delete(selecionado.contatoId)

  return (
    <>
      {/*
        Só aqui, e não na moldura do cliente: recarregar a tela de fluxos ou de
        contatos a cada mensagem que chega seria intromissão. O Inbox é a única
        tela cujo conteúdo é a conversa acontecendo agora.
      */}
      <PulsoDoInbox clienteId={cliente.id} pulsoNaTela={pulso} />
      <FaixaDeCanalCaido clienteId={cliente.id} />
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
    <section className="mx-auto mt-16 max-w-[440px] text-center">
      <IlustracaoInbox />
      <p className="mt-6 font-mono text-[10px] font-bold tracking-[0.16em] text-dim">INBOX VAZIO</p>
      <h2 className="mt-2 text-[18px] font-bold tracking-[-0.02em]">Nenhuma conversa para atender</h2>
      <p className="mt-2 text-[13px] leading-6 text-muted">
        Quando alguém falar com o número ligado ao bot, a conversa aparece aqui. A tela de Leads
        continua sendo o lugar para analisar todos os contatos.
      </p>

      {/*
       * Número recém-conectado demora: enquanto a Meta não termina de
       * sincronizar, mensagem nova não chega. Dizer isso evita a conclusão de
       * que algo quebrou, que foi o que aconteceu com o primeiro cliente.
       */}
      {recem && (
        <p className="mt-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left text-[12px] leading-5 text-dim">
          Este número foi conectado há pouco. A Meta ainda está sincronizando, e
          isso pode levar algumas horas, até terminar, é normal nenhuma
          conversa nova aparecer aqui.
        </p>
      )}

      <Link href={`/clientes/${clienteId}/leads`} className="app-secondary-button mt-5 inline-block px-4 py-2.5 text-[12.5px]">
        Ver Leads
      </Link>
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
function cabeNoRecorte(lead: Lead, estado: FiltroDeEstado, atribuicao: string): boolean {
  if (estado !== 'todas' && lead.estadoEfetivo !== estado) return false
  if (atribuicao === 'todos') return true
  if (atribuicao === 'sem-dono') return lead.atribuidoA === null
  return lead.atribuidoA === atribuicao
}

async function Conteudo({
  clienteId,
  leads,
  local,
  selecionado,
  respostasRapidas,
  equipe,
  usuarioId,
  naoLidas,
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
}: {
  clienteId: string
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
  /*
   * Tudo o que ainda vai sair nesta conta.
   *
   * A promessa começa **antes** do bloco abaixo e é esperada depois: assim ela
   * corre junto da leitura da conversa em vez de somar uma ida de rede em série.
   * Não entra naquele `Promise.all` porque ele é condicional ao `selecionado`,
   * e o contador da barra existe mesmo sem nenhuma conversa aberta.
   *
   * Vem inteiro e não contado porque o número da barra é um botão: clicar abre
   * a lista com o cancelar. O teto de 200 está no repositório.
   */
  const agendadasDaContaPromessa = listarAgendadasDaConta(clienteId)

  const agendadasDaConta = await agendadasDaContaPromessa

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
          equipe={equipe}
          contagem={contagem}
          porEstado={porEstado}
          atribuicao={atribuicao}
          estado={estado}
          termo={termo}
          usuarioId={usuarioId}
          naoLidas={naoLidas}
          fixadas={fixadas}
          pagina={pagina}
          paginas={paginas}
          agendadas={agendadasDaConta}
        />
      }
      conversa={
        selecionado ? (
          /*
            **A fronteira que faz trocar de conversa responder na hora.**

            Clicar noutra pessoa muda `?conversa=` e renavega, e a `key` do
            `<Suspense>` lá de cima é só o filtro, de propósito, para a fila não
            piscar. O efeito colateral é que a conversa não tinha fronteira
            nenhuma: as consultas dela (histórico, contexto, funis, agendadas)
            rodavam sem nada no lugar, e a tela ficava parada segurando a
            conversa **anterior** até tudo voltar.

            Aqui a `key` é o contato. Ela isola só esta coluna: o esqueleto
            aparece no clique, a fila do lado continua firme, e o `key` ainda
            garante que nada da conversa antiga vaze para a nova.
          */
          <Suspense
            key={selecionado.contatoId}
            fallback={
              <>
                <EsperaDaConversa />
                <EsperaDaFicha />
              </>
            }
          >
            <ColunaDaConversa
              clienteId={clienteId}
              lead={selecionado}
              equipe={equipe}
              usuarioId={usuarioId}
              etiquetas={etiquetas}
              temAutomacao={temAutomacao}
              respostasRapidas={respostasRapidas}
            />
          </Suspense>
        ) : (
          <section className="flex min-w-0 items-center justify-center p-10 text-center">
            <p className="max-w-[280px] text-[12.5px] leading-6 text-dim">
              Nenhuma conversa nesta seleção.
              <br />
              Limpe a busca ou escolha outro filtro à esquerda.
            </p>
          </section>
        )
      }
      /*
        A ficha não vem mais por aqui: ela é irmã da conversa, dentro da mesma
        fronteira, porque lê o mesmo contato. `temFicha` só reserva a coluna da
        grade, ver `MolduraDoInbox`.
      */
      temFicha={Boolean(selecionado)}
    />
  )
}

/**
 * O cabeçalho da conversa: quem é, de quem é, e o que dá para fazer.
 *
 * **As três coisas em duas linhas, e a segunda é a do canal.** O desenho de
 * referência põe o canal como aba sublinhada acima das mensagens, e ele acerta:
 * a mesma pessoa pode escrever por caminhos diferentes, e "por onde esta
 * conversa está acontecendo" é a primeira coisa que muda o que se pode
 * responder, janela de 24h, botões, mídia. Estava dito em lugar nenhum.
 */
/**
 * A coluna da conversa e a ficha do contato, tudo que muda ao clicar noutra
 * pessoa, e nada além disso.
 *
 * ---------------------------------------------------------------------------
 * Por que ela existe como componente
 * ---------------------------------------------------------------------------
 *
 * Isto morava dentro de `Conteudo`, e por isso as consultas da conversa
 * (histórico, contexto da janela, funis, agendadas, anúncios) eram feitas no
 * mesmo `await` que monta a fila. Clicar noutra conversa renavega, muda
 * `?conversa=`, e refazia **a tela inteira** sem fronteira nenhuma no meio: a
 * pessoa clicava e ficava olhando a conversa anterior, parada, até tudo voltar.
 *
 * Separada, ela tem `<Suspense key={contatoId}>` só para si. O esqueleto
 * aparece no clique, e a fila ao lado nem sabe que houve troca, que é
 * exatamente a preocupação registrada na `key` do Suspense de cima: *apagar a
 * fila para um cinza a cada clique seria piscar a coluna que a pessoa está
 * usando justamente enquanto ela a usa*.
 *
 * ---------------------------------------------------------------------------
 * A ficha vem junto, e não separada
 * ---------------------------------------------------------------------------
 *
 * `DadosDoLead` lê os mesmos funis e o mesmo histórico de anúncios deste
 * contato. Deixá-la fora da fronteira só mudaria quem segura a tela, ela
 * passaria a ser a peça lenta. As duas dependem do mesmo clique, então vivem
 * sob a mesma espera.
 */
async function ColunaDaConversa({
  clienteId,
  lead,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  respostasRapidas,
}: {
  clienteId: string
  /** A conversa aberta. Nunca `null` aqui: quem decide isso é quem renderiza. */
  lead: Lead
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
  respostasRapidas: RespostaRapida[]
}) {
  // `lead` veio de `paginarLeads(clienteId, ...)` ou de `acharLead(clienteId, ...)`.
  // Só depois desse vínculo cliente–contato confirmado é seguro ler as mensagens
  // pelo id do contato.
  const [conversa, contexto, posicoes, quadros, agendadasDaConversa] = await Promise.all([
    lerConversa(lead.contatoId),
    contextoDeResposta(clienteId, lead.contatoId),
    /*
     * Onde este contato está no funil, e as etapas de cada quadro para o menu
     * de mover. As duas juntas porque uma sem a outra não desenha nada: a
     * posição diz "está em Contactado", e só a lista de etapas diz para onde
     * dá para ir.
     */
    quadrosDoContato(clienteId, lead.contatoId),
    listarQuadros(clienteId),
    // O que já está marcado para esta conversa: a barra de ações mostra o
    // ícone aceso, e o painel lista com o botão de cancelar.
    agendadasDoContato(clienteId, lead.contatoId),
  ])

  /*
   * Quais destas bolhas **eu** guardei.
   *
   * Depois do `Promise.all`, e não dentro dele, porque a pergunta é sobre os ids
   * que a conversa devolveu, não dá para perguntar antes de saber quais são. É
   * uma consulta por id em lista, no máximo `TETO_DE_MENSAGENS` deles.
   */
  const favoritas = await favoritasEntre(
    usuarioId,
    conversa.mensagens.map((mensagem) => mensagem.id),
  )

  /*
   * A trava de "só quem assumiu responde", se a conta a ligou.
   *
   * A recusa também existe no servidor (`podeResponderAgora`), e as duas não são
   * repetição: a de lá impede o envio, e esta impede a pessoa de escrever três
   * parágrafos antes de descobrir que não podia. Campo que aceita texto e recusa
   * no fim é a pior forma de dizer não.
   */
  const ajustesDeAtendimento = await ajustesDaConta(clienteId)
  const donoDaConversa = lead.atribuidoA
  const travada =
    ajustesDeAtendimento.exigeAssumir &&
    usuarioId !== null &&
    donoDaConversa !== null &&
    donoDaConversa !== usuarioId
  const nomeDoDono =
    equipe.find((membro) => membro.id === donoDaConversa)?.nome.split(' ')[0] ?? null

  /*
   * O nome da campanha, só do contato aberto.
   *
   * **Um id, e não a fila inteira**, de propósito. Resolver as 200 conversas
   * encheria o cache de nomes que ninguém vai ler, a origem aparece na coluna
   * do contato, que mostra uma pessoa por vez.
   */
  const { passagens, nomesDosAnuncios } = await historicoDoContatoAberto(clienteId, lead.contatoId)

  /*
   * Junta a posição do contato com as etapas do quadro dela. Quadro que sumiu
   * entre uma consulta e outra é descartado em vez de virar um menu vazio,
   * `flatMap` com `[]` é o jeito de dizer isso sem um `filter` a mais.
   */
  const funis: FunilDoContato[] = posicoes.flatMap((posicao) => {
    const quadro = quadros.find((q) => q.id === posicao.quadroId)
    if (!quadro) return []
    return [{ ...posicao, etapas: quadro.etapas.map((e) => ({ id: e.id, nome: e.nome })) }]
  })

  /*
   * Uma leitura do relógio para as duas contas abaixo. Chamar `Date.now()` duas
   * vezes daria dois instantes diferentes, e o fim da janela ficaria alguns
   * milissegundos fora do que a pílula diz que falta.
   */
  const agora = Date.now()
  const restante = restaDaJanela(contexto ?? { ultimaEntradaEm: null }, agora)
  const janela = restante && restante > 0 ? comoFalta(restante) : null
  /*
   * Abaixo de duas horas a contagem muda de cor.
   *
   * Não é enfeite: "22h18" e "1h04" são a mesma frase e significam coisas
   * opostas, uma diz que dá tempo de pensar, a outra que a conversa está
   * prestes a exigir modelo aprovado. Quem olha de relance lê a cor, não o
   * número.
   */
  const apertado = restante !== null && restante > 0 && restante < 2 * 60 * 60 * 1000
  const primeiroNome = lead.nome?.split(' ')[0] ?? 'esta pessoa'
  /*
   * O instante em que a janela fecha, e não quanto falta.
   *
   * A pílula do cabeçalho quer a frase pronta ("22h18"); o agendamento quer o
   * instante, para comparar com o horário que a pessoa escolheu. Derivar um do
   * outro seria refazer a subtração com menos informação.
   *
   * Sai de `restante`, e não de `ultimaEntradaEm + JANELA_MS`, para a conta do
   * prazo morar num lugar só. As 72h do anúncio **não** entram aqui: elas são
   * gratuidade, não autorização de texto livre, e foi somá-las que abria o
   * compositor para quem nunca escreveu. Ver o cabeçalho de `channels/janela`.
   */
  const fimDaJanela =
    restante !== null && restante > 0 ? new Date(agora + restante).toISOString() : null

  if (!conversa) {
    return (
      <section className="flex min-w-0 items-center justify-center p-10 text-center">
        <p className="max-w-[280px] text-[12.5px] leading-6 text-dim">
          Não deu para abrir esta conversa.
        </p>
      </section>
    )
  }

  const selecionado = lead

  return (
    <>
      <section className="flex min-h-0 min-w-0 flex-col border-r border-line">
        <CabecalhoDaConversa
          clienteId={clienteId}
          lead={selecionado}
          equipe={equipe}
          usuarioId={usuarioId}
          etiquetas={etiquetas}
          temAutomacao={temAutomacao}
          janela={janela}
          janelaApertada={apertado}
          fimDaJanela={fimDaJanela}
          agendadas={agendadasDaConversa}
        />
        {/*
          `flex-col-reverse` é o que faz a conversa abrir na mensagem mais
          recente, e não lá em cima nas antigas.

          É CSS e não JavaScript de propósito. Um `scrollTo` num efeito
          precisaria tornar isto um Client Component, e ainda assim
          apareceria no topo por um quadro antes de pular, o flash que todo
          chat feito assim tem. Com a coluna invertida o navegador ancora o
          scroll no fim desde o primeiro render, sem piscar e sem JS.

          O `Historico` fica em ordem NORMAL. Como ele é filho único deste
          container, a inversão daqui não mexe na ordem das mensagens, ela
          só decide de que ponta o scroll nasce. Inverter os dois (o que
          esta tela já fez) inverte a conversa de verdade: a mensagem de
          duas horas atrás aparecia acima da de três.
        */}
        {/*
          O provedor envolve a conversa **e** a caixa porque a citação
          nasce numa e é usada na outra.

          A `key` é o que faz trocar de conversa esquecer a citação. Sem
          ela, citar aqui, clicar noutra pessoa e responder mandaria a
          resposta citando a mensagem de alguém que não é essa.
        */}
        <ProvedorDeCitacao key={selecionado.contatoId}>
          {/*
            Arrastar um arquivo para dentro da conversa cai aqui, e o painel
            de revisão abre **dentro desta coluna**, sem escurecer a fila
            da esquerda nem o cabeçalho de quem está do outro lado.

            A `key` do provedor de cima também protege este: trocar de
            conversa não pode levar junto um anexo escolhido para outra
            pessoa.
          */}
          <ProvedorDeEntrega clienteId={clienteId} contatoId={selecionado.contatoId}>
            {/*
              `overflow-x-hidden`, e não `overflow-auto` nos dois eixos.

              Uma URL de anúncio com 180 caracteres e nenhum espaço não tem
              onde quebrar: ela esticava a bolha para além da coluna, o
              contêiner ganhava rolagem horizontal, e arrastar de lado
              deslocava a conversa inteira para fora da moldura. O `max-w` da
              bolha não segurava porque `overflow-wrap` nasce em `normal`,
              palavra sem espaço simplesmente transborda.

              A quebra é resolvida na bolha (`[overflow-wrap:anywhere]`); isto
              aqui é a garantia de que nenhum outro conteúdo largo, uma
              tabela colada, um anexo fora de medida, reintroduza o mesmo
              defeito.
            */}
            <div className="app-conversa flex min-h-0 flex-1 flex-col-reverse overflow-x-hidden overflow-y-auto p-5">
              <Historico
                mensagens={conversa.mensagens}
                cortada={conversa.cortada}
                nome={selecionado.nome}
                clienteId={clienteId}
                contatoId={selecionado.contatoId}
                favoritas={favoritas}
              />
            </div>
            {travada ? (
              /*
                O lugar da caixa de resposta, e não um aviso acima dela.

                A caixa desabilitada com um recado em cima seria um campo cinza
                que a pessoa tenta clicar assim mesmo. Aqui o espaço diz o que é
                preciso fazer, e o botão que faz isso está no cabeçalho desta
                mesma coluna, a poucos centímetros de onde o olho já está.
              */
              <div className="shrink-0 border-t border-line bg-panel px-4 py-5 text-center">
                <p className="text-[12.5px] font-semibold text-soft">
                  {nomeDoDono ? `${nomeDoDono} está atendendo` : 'esta conversa já tem dono'}
                </p>
                <p className="mx-auto mt-1 max-w-[420px] text-[11.5px] leading-5 text-dim">
                  Esta conta pediu que só quem assumiu responda, para duas pessoas não
                  escreverem ao mesmo tempo. Use o botão de assumir, no topo da conversa,
                  se precisar entrar nela.
                </p>
              </div>
            ) : (
            <CaixaDeResposta
              /*
                A `key` é a conversa, e sem ela o rascunho de uma vazava para a
                outra: o `<textarea>` não é controlado, então trocar de conversa
                remontava o campo vazio enquanto o estado do React continuava
                dizendo "tem texto aqui". O efeito visível era o microfone
                sumido com o campo vazio, e o botão de enviar no lugar dele.
              */
              key={selecionado.contatoId}
              acao={acaoResponderLead.bind(null, clienteId, selecionado.contatoId)}
              restaDaJanela={janela}
              nome={primeiroNome}
              respostasRapidas={respostasRapidas}
              temAutomacao={temAutomacao}
              anexo={{ clienteId, contatoId: selecionado.contatoId }}
            />
            )}
          </ProvedorDeEntrega>
        </ProvedorDeCitacao>
      </section>
      <DadosDoLead
        clienteId={clienteId}
        lead={selecionado}
        funis={funis}
        temAutomacao={temAutomacao}
        passagens={passagens}
        nomesDosAnuncios={nomesDosAnuncios}
      />
    </>
  )
}

/**
 * A conversa em cinza, enquanto as consultas dela voltam.
 *
 * Só a coluna do meio: a fila à esquerda não entra aqui, porque ela não mudou.
 * O desenho imita o que vem, cabeçalho, bolhas alternadas, caixa de resposta,
 * para o olho já saber onde olhar quando o conteúdo chega.
 */
function EsperaDaConversa() {
  return (
    <section className="flex min-h-0 min-w-0 flex-col border-r border-line">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Esqueleto className="size-9 rounded-full" />
        <span className="flex flex-col gap-2">
          <Esqueleto className="h-3 w-40" />
          <Esqueleto className="h-2.5 w-24" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Esqueleto
            key={i}
            className={`h-12 rounded-[14px] ${i % 2 === 0 ? 'w-[48%]' : 'w-[56%] self-end'}`}
          />
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Esqueleto className="h-10 w-full rounded-xl" />
      </div>
      <span role="status" className="sr-only">
        Carregando a conversa…
      </span>
    </section>
  )
}

/**
 * A ficha do contato em cinza.
 *
 * Existe para a grade não saltar: `temFicha` já reservou 296px, e uma coluna
 * reservada e vazia é uma faixa branca do lado da conversa. Ela vem junto do
 * esqueleto da conversa, como as duas verdadeiras vêm juntas.
 */
function EsperaDaFicha() {
  return (
    <aside className="hidden min-h-0 flex-col gap-3 overflow-hidden p-4 xl:flex">
      <Esqueleto className="size-14 self-center rounded-full" />
      <Esqueleto className="h-3 w-32 self-center" />
      <Esqueleto className="mt-3 h-2.5 w-full" />
      <Esqueleto className="h-2.5 w-4/5" />
      <Esqueleto className="mt-3 h-16 w-full rounded-xl" />
    </aside>
  )
}

function CabecalhoDaConversa({
  clienteId,
  lead,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  janela,
  janelaApertada,
  fimDaJanela,
  agendadas,
}: {
  clienteId: string
  lead: Lead
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
  /**
   * Quanto falta da janela de 24h, já escrito (`22h18`). `null` = fora dela, e
   * aí quem avisa é a caixa de resposta, que vira um aviso e não abre campo.
   *
   * **Morava no rodapé da caixa de resposta e subiu para cá.** Lá ela era lida
   * só por quem já ia escrever, no fim de uma frase sobre outro assunto. A
   * janela não é sobre responder: ela limita anexar, reagir e agendar, e quem
   * abre a conversa precisa dela antes de decidir o que fazer.
   */
  janela: string | null
  /** Menos de duas horas, a contagem muda de cor. */
  janelaApertada: boolean
  /** O instante em que a janela fecha, para o agendamento comparar. */
  fimDaJanela: string | null
  /** O que já está marcado nesta conversa. */
  agendadas: MensagemAgendada[]
}) {
  const nome = lead.nome ?? 'sem nome'
  const responsavel = equipe.find((membro) => membro.id === lead.atribuidoA) ?? null

  return (
    <>
      <header className="flex min-h-[62px] items-center gap-3 border-b border-line px-4">
        <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13.5px] font-bold">{nome}</h2>
          {/*
            De quem é a conversa fica **embaixo do nome**, e não num botão à
            direita. É estado, não ação: quem lê o cabeçalho precisa saber se
            alguém já está nessa antes de decidir responder.
          */}
          <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] text-dim">
            <span className="truncate">
              {responsavel
                ? `com ${responsavel.nome}`
                : lead.atribuidoA
                  ? 'com alguém fora da equipe'
                  : 'Não atribuído'}
            </span>
            {janela && (
              <Dica texto="Depois disso o WhatsApp só aceita modelo aprovado pela Meta">
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    janelaApertada ? 'bg-amber-400/15 text-aviso' : 'bg-surface text-muted'
                  }`}
                >
                  <span aria-hidden>🕐</span>
                  {janela}
                </span>
              </Dica>
            )}
          </p>
        </div>

        {/*
          Assumir e passar continuam sendo botão de texto: mudam **de quem é** a
          conversa, que é a única decisão desta tela que afeta o trabalho de
          outra pessoa, e a que mais precisa dizer em palavras o que vai fazer.
          Só aparecem quando há para quem passar.
        */}
        {equipe.length > 1 && (
          <PassarPara
            atribuir={acaoAtribuirPara.bind(null, clienteId, lead.contatoId)}
            equipe={equipe}
          />
        )}

        {(usuarioId || responsavel) && (
          <Assumir
            assumir={acaoAssumirAtendimento.bind(null, clienteId, lead.contatoId)}
            liberar={acaoLiberarAtendimento.bind(null, clienteId, lead.contatoId)}
            responsavel={responsavel?.nome ?? null}
            souEu={Boolean(usuarioId) && lead.atribuidoA === usuarioId}
          />
        )}

        <AcoesRapidas
          clienteId={clienteId}
          contatoId={lead.contatoId}
          estado={lead.estadoEfetivo}
          etiquetas={etiquetas}
          etiquetasAplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
          notas={lead.notas}
          salvarNotas={acaoSalvarNotas.bind(null, clienteId, lead.contatoId)}
          automacaoAtiva={lead.automacaoAtiva}
          temAutomacao={temAutomacao}
          fimDaJanela={fimDaJanela}
          agendadas={agendadas}
          nomeDoContato={lead.nome?.split(' ')[0] ?? 'esta pessoa'}
        />
      </header>

      {/*
        A aba do canal.

        É **uma** hoje, e mesmo assim desenhada como aba: o Inbox recebe só de
        WhatsApp (ver `core/canais.ts`), e o dia em que o segundo canal entregar
        é o dia em que esta linha ganha a segunda aba, sem mudar de forma.
      */}
      <div className="flex items-end gap-4 border-b border-line px-4">
        <span className="flex items-center gap-1.5 border-b-2 border-[#25d366] py-2 text-[11.5px] font-semibold text-ink">
          <span className="text-[#25d366]">
            <LogoDoCanal canal="whatsapp" tamanho={14} />
          </span>
          WhatsApp
        </span>
        <span className="ml-auto py-2 font-mono text-[10.5px] text-dim">{lead.waId}</span>
      </div>
    </>
  )
}

function Historico({
  mensagens,
  cortada,
  nome,
  clienteId,
  contatoId,
  favoritas,
}: {
  mensagens: MensagemDoLead[]
  cortada: boolean
  nome: string | null
  clienteId: string
  contatoId: string
  /** Os ids que **eu** guardei, para a estrela nascer cheia. Ver a 0063. */
  favoritas: Set<string>
}) {
  if (mensagens.length === 0) {
    return <p className="py-16 text-center text-[12px] text-dim">Nenhuma mensagem registrada.</p>
  }

  /*
   * Onde cada dia começa, calculado **uma vez** para a conversa inteira.
   *
   * Dentro do `map` isso viraria "comparar com a mensagem anterior" espalhado
   * pelo JSX, e a regra é chata o bastante (fuso de São Paulo, virada da
   * meia-noite) para merecer estar num lugar testado. Ver `lib/quando.ts`.
   */
  const diasDaConversa = etiquetasDeDia(mensagens, (m) => m.ts)

  /*
   * Ordem normal: mais antiga em cima, mais nova embaixo.
   *
   * O `flex-col-reverse` mora no container que ROLA, uma camada acima, e não
   * aqui. Como este bloco é filho único dele, a inversão de lá só escolhe de
   * que ponta o scroll nasce, não mexe na ordem. Inverter aqui também (o que
   * esta tela chegou a fazer) invertia a conversa de verdade.
   */
  return (
    /*
     * **A conversa ocupa a largura toda, sem coluna centralizada.**
     *
     * Havia aqui um `mx-auto max-w-[680px]`. O alinhamento das bolhas estava
     * certo, entrada à esquerda, saída à direita , mas relativo a essa
     * coluna, não à tela: numa área larga, a coluna flutuava no meio e a
     * conversa inteira aparecia deslocada para o centro, com as mensagens
     * recebidas começando longe da borda esquerda. Parecia bug de alinhamento
     * e era o contêiner.
     *
     * O `w-full` não é decoração: o pai que rola é um `flex-col-reverse`, e
     * num contêiner flex em coluna o filho é dimensionado pelo conteúdo no
     * eixo cruzado em vez de esticar. Sem ele, este bloco encolhe até a maior
     * bolha e fica centrado, que foi exatamente o sintoma que sobrou depois
     * de tirar o `max-w`: as bolhas alinhavam certo entre si, e o conjunto
     * todo flutuava no meio, longe das duas bordas.
     *
     * Largura cheia é também o que o WhatsApp faz, e é o que faz a direção da
     * mensagem ser legível de relance, que é a única coisa que o alinhamento
     * precisa comunicar.
     */
    <div className="flex w-full flex-col gap-2.5">
      {cortada && (
        <p className="mb-1 self-center rounded-full border border-dashed border-strong px-3 py-1.5 text-center font-mono text-[9.5px] text-dim">
          mostrando as 500 mensagens mais recentes
        </p>
      )}
      {mensagens.map((mensagem, indice) => {
        const nossa = mensagem.direcao === 'saida'
        const etiqueta = diasDaConversa[indice]
        /*
         * A barra só aparece onde há id da Meta.
         *
         * Reagir e citar pedem esse id, e saída ainda não confirmada não tem,
         * a Meta só o devolve depois de aceitar. Oferecer o botão ali daria um
         * clique que falharia sempre.
         */
        return (
          /*
           * O `Fragment` existe para a etiqueta de dia ser **irmã** da bolha, e
           * não filha dela: ela atravessa a conversa inteira e fica centrada,
           * enquanto a bolha alinha a um dos lados. A `key` sobe para cá junto,
           * porque agora é o fragmento que é o item da lista.
           */
          <Fragment key={mensagem.id}>
            {etiqueta && <EtiquetaDoDia rotulo={etiqueta} />}
            {/*
             * A coluna existe para a reação ter onde ficar.
             *
             * Antes a bolha era filha direta do `flex justify-*`. A reação
             * pendura embaixo dela e alinhada com ela, então as duas precisam
             * de um pai que empilhe, e `items-end`/`items-start` é o que
             * mantém a bolha do tamanho do conteúdo em vez de esticar na linha
             * toda.
             */}
          <div
            className={`flex min-w-0 max-w-full flex-col gap-0 ${nossa ? 'items-end' : 'items-start'}`}
          >
            {/*
              `[overflow-wrap:anywhere]` e não `break-words`: `break-word` só
              quebra a palavra depois de tentar empurrá-la para uma linha só,
              e uma URL que já é maior que a linha inteira nunca chega a caber,
              então ele desiste e deixa transbordar. `anywhere` quebra onde
              precisar, que é o comportamento certo para link colado.
            */}
            {/*
              `font-texto` e 14.5px, e não a fonte da casca em 13.

              A Outfit é geométrica de display, traço de espessura uniforme,
              aberturas fechadas, pouca diferença entre formas parecidas. Ela dá
              a cara do produto num título e cansa num parágrafo, e a conversa é
              o único lugar do painel onde se lê texto corrido, de outra pessoa,
              o dia inteiro. Aqui entra a Inter (ver `layout.tsx`).

              O corpo sobe para 14.5 e a entrelinha desce para 1.45: o ganho de
              legibilidade vem do tamanho e da forma da letra. **Não engorde o
              peso**, 500 numa bolha azul com texto branco vira borrão em tela
              comum.
            */}
            <p className={`max-w-[78%] px-3.5 py-2 font-texto text-[14.5px] leading-[1.45] whitespace-pre-wrap [overflow-wrap:anywhere] ${
              nossa
                ? 'bolha-nossa rounded-[15px_15px_4px_15px]'
                : 'rounded-[15px_15px_15px_4px] bg-surface-strong text-ink'
            }`}>
              {mensagem.cita && <CitacaoNaBolha cita={mensagem.cita} nome={nome} />}
              {mensagem.anexo && <AnexoNaConversa anexo={mensagem.anexo} />}
              {/*
                O arquivo que a pessoa mandou. Mesma bolha do que sai, e a
                diferença está em quem produziu a URL: aqui ela é assinada e
                morre em cinco minutos.
              */}
              {mensagem.recebido && <AnexoNaConversa anexo={mensagem.recebido} />}
              {/*
                Transcrever só o áudio **recebido**.

                O que sai foi escrito ou gravado por quem atende, que sabe o que
                disse. Oferecer transcrição ali seria mandar a própria voz para
                um modelo para ler de volta o que se acabou de falar.
              */}
              {mensagem.recebido?.midia === 'audio' && (
                <Transcricao
                  clienteId={clienteId}
                  contatoId={contatoId}
                  mensagemId={mensagem.id}
                  inicial={mensagem.transcricao ?? null}
                />
              )}
              {mensagem.semCopia && <ArquivoSemCopia nossa={nossa} />}
              {mensagem.naoSuportada && <MensagemNaoSuportada />}
              {mensagem.local && <LocalNaBolha local={mensagem.local} />}
              {mensagem.cartoes && <CartoesNaBolha cartoes={mensagem.cartoes} />}
              {/*
                Lugar e cartão **substituem** o "(áudio, imagem ou documento)".
                Eles são a mensagem inteira, e quase nunca vêm com legenda,
                deixar a frase genérica embaixo diria que falta algo que não
                falta.
              */}
              {/*
                A frase "(áudio, imagem ou documento)" é para quando **não há
                arquivo nenhum** para mostrar, mídia recebida que o webhook
                registrou sem baixar. Ela aparecia também embaixo do player, o
                que é dizer que não dá para ver o que está ali tocando.
              */}
              {mensagem.texto !== null ? (
                <TextoDoWhatsApp texto={mensagem.texto} />
              ) : (
                !mensagem.local &&
                !mensagem.cartoes &&
                !mensagem.anexo &&
                !mensagem.recebido &&
                !mensagem.semCopia &&
                !mensagem.naoSuportada && <SemTexto />
              )}
              {/*
                O rodapé da bolha diz a hora, e **quem escreveu só quando isso
                acrescenta alguma coisa**.

                Na entrada não acrescenta: a conversa tem duas vozes, o nome de
                quem está do outro lado já está no cabeçalho, e repeti-lo em
                cada bolha recebida era a mesma palavra dezenas de vezes na
                mesma tela.

                Na saída acrescenta, e muito, mas o rótulo antigo era
                "atendimento" em toda mensagem, do bot ou de gente. Não dizia
                nada e parecia dizer. Agora sai o nome de quem respondeu, ou
                "automação" quando foi o fluxo; quando não sabemos (mensagem
                antiga, ou o eco do que o dono mandou pelo celular), fica só a
                hora, ver `core/autor-da-mensagem.ts`.
              */}
              <span className="ml-2 text-[10px] text-muted" title={horaExata(mensagem.ts)}>
                {nossa && mensagem.autor ? `${mensagem.autor} · ` : ''}
                {horaDoRelogio(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[10px] font-semibold text-soft">envio não confirmado</span>
              )}
            </p>
            {/*
              O rodapé passou a existir **em toda bolha**.

              Antes ele só nascia com id da Meta ou reação, porque só citar e
              reagir moravam ali, e os dois precisam do id. A estrela não
              precisa: ela guarda pelo id interno (`messages.id`), que existe em
              toda mensagem gravada, inclusive na saída que a Meta ainda não
              confirmou. Guardar o que se acabou de escrever é justamente um dos
              casos de uso, e escondê-lo até a confirmação chegar seria esconder
              o botão no único momento em que a pessoa está olhando para a
              mensagem.

              Os outros dois continuam guardados por `waMessageId` dentro do
              componente, então nada aparece que não funcione.
            */}
            {(
              /*
               * A `key` é o que devolve a palavra final ao servidor.
               *
               * O rodapé guarda a nossa reação em estado para poder mostrá-la
               * antes da resposta. Quando a leitura seguinte trouxer outra
               * coisa, alguém reagiu do celular, a Meta recusou, a outra
               * pessoa reagiu também , a chave muda, o componente remonta, e
               * o otimismo pendurado ali morre junto. Sem isso, a tela ficaria
               * com a aposta para sempre.
               */
              <RodapeDaMensagem
                key={assinaturaDasReacoes(mensagem.reacoes)}
                clienteId={clienteId}
                contatoId={contatoId}
                waMessageId={mensagem.waMessageId ?? null}
                podeReagir={podeReagir(mensagem.ts)}
                reacoes={mensagem.reacoes ?? []}
                nome={nome}
                texto={mensagem.texto}
                deQuem={nossa ? 'ao atendimento' : `a ${nome ?? 'cliente'}`}
                nossa={nossa}
                mensagemId={mensagem.id}
                favorita={favoritas.has(mensagem.id)}
              />
            )}
          </div>
          </Fragment>
        )
      })}

    </div>
  )
}

/**
 * A etiqueta que separa os dias dentro da conversa.
 *
 * Ela não é enfeite: sem ela a hora de relógio mente. `09:14` de hoje e `09:14`
 * de terça ficam idênticos na tela, e quem atende lê a conversa de cima para
 * baixo sem nenhuma pista de onde um dia acabou.
 */
function EtiquetaDoDia({ rotulo }: { rotulo: string }) {
  return (
    <p className="my-1 self-center rounded-full border border-line bg-surface px-3 py-1 text-center text-[10px] font-medium text-dim">
      {rotulo}
    </p>
  )
}

/**
 * A coluna da direita: quem é a pessoa, e tudo que o sistema sabe dela.
 *
 * ---------------------------------------------------------------------------
 * Ela é de leitura, e isso é a decisão
 * ---------------------------------------------------------------------------
 *
 * Aqui havia dois editores, o seletor de etiquetas e a anotação da equipe, e
 * os dois foram para as ações rápidas do cabeçalho. Não por espaço: **cada um
 * deles guarda estado local semeado pelo servidor**, e ter a mesma etiqueta
 * editável em dois lugares da mesma tela significa duas cópias que divergem no
 * primeiro clique, marcar aqui não marcaria lá, e uma das duas estaria
 * mentindo até a próxima navegação.
 *
 * Um editor por informação. Esta coluna mostra o resultado.
 *
 * ---------------------------------------------------------------------------
 * A ordem
 * ---------------------------------------------------------------------------
 *
 * Estado do atendimento primeiro, porque é o que muda o que fazer agora. Depois
 * quem é a pessoa, e só então o que foi acumulado sobre ela, etiquetas, funil,
 * anotação, campos. É a ordem em que alguém que abre uma conversa pergunta.
 */
function DadosDoLead({
  clienteId,
  lead,
  funis,
  temAutomacao,
  passagens,
  nomesDosAnuncios,
}: {
  clienteId: string
  lead: Lead
  /** Por onde o contato já chegou, da mais recente para a mais antiga. */
  passagens: Passagem[]
  /** Nomes da Marketing API por `ad_id`. Vazio quando a conta não conectou o Ads. */
  nomesDosAnuncios: Map<string, AnuncioEmCache>
  /** Um por quadro em que o contato está. Vazio = fora de todo funil. */
  funis: FunilDoContato[]
  /**
   * Existe fluxo ligado a um papel do número, ou gatilho ativo. **Sem isto o
   * card mentia**: dizia "BOT RESPONDENDO" numa conta sem fluxo nenhum e
   * oferecia "Pausar bot" para pausar o que não existe.
   */
  temAutomacao: boolean
}) {
  /*
   * Sem as chaves de origem: elas já aparecem em destaque no `QuemE`, logo
   * abaixo. Repetir gastaria o teto de quatro campos visíveis dizendo duas
   * vezes a mesma coisa.
   */
  const campos = camposSemOrigem(Object.entries(lead.campos))
  const aguardandoPessoa = lead.aguardando !== null
  /*
   * `automacao_ativa` é um interruptor **por conversa**, não a existência do
   * robô: ele nasce ligado e quer dizer "esta conversa não foi silenciada".
   * Numa conta sem automação ele fica ligado para sempre, e era por ler só
   * ele que a tela afirmava um estado impossível.
   */
  const botPausado = !lead.automacaoAtiva

  return (
    // Rola por dentro, como as outras duas colunas: agora que a moldura tem
    // teto, a ficha de um lead com muitos campos seria cortada sem isto.
    <aside className="min-w-0 overflow-y-auto border-l border-line bg-panel">
      {/*
        O topo repete foto e nome de propósito, é o mesmo gesto do desenho de
        referência. A coluna rola, e depois de duas telas de campos coletados
        nada nela dizia mais de quem era aquela ficha.
      */}
      <div className="flex flex-col items-center border-b border-line px-4 py-5 text-center">
        <Avatar nome={lead.nome} tamanho={56} />
        <h2 className="mt-2.5 max-w-full truncate text-[13.5px] font-bold">
          {lead.nome ?? 'sem nome'}
        </h2>
        <p className="mt-0.5 font-mono text-[10.5px] text-dim">{lead.waId}</p>

        <Link
          href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
          className="app-secondary-button mt-3 w-full px-3 py-1.5 text-center text-[11.5px]"
        >
          Ver ficha completa
        </Link>
      </div>

      <div className="p-4">
        {/*
          Sem automação a tag é a resposta inteira: não há bot, então não há o
          que ligar, desligar ou explicar. O card vira rótulo e para por aí,
          antes ele dizia "BOT RESPONDENDO" numa conta sem fluxo nenhum.
        */}
        <div
          className={`rounded-[11px] border px-3 py-2.5 ${aguardandoPessoa ? 'border-rose-400/35 bg-rose-50' : !temAutomacao ? 'border-line bg-surface' : botPausado ? 'border-amber-400/40 bg-amber-50' : 'border-emerald-500/30 bg-emerald-50'}`}
        >
          <p
            className={`text-[10px] font-bold tracking-[0.04em] ${aguardandoPessoa ? 'text-rose-600' : !temAutomacao ? 'text-muted' : botPausado ? 'text-amber-700' : 'text-emerald-700'}`}
          >
            {aguardandoPessoa
              ? 'AGUARDANDO PESSOA'
              : !temAutomacao
                ? 'ATENDIMENTO MANUAL'
                : botPausado
                  ? 'BOT EM PAUSA'
                  : 'BOT RESPONDENDO'}
          </p>
          {aguardandoPessoa && (
            <>
              {/*
                O motivo **inteiro**, quebrando linha, e não truncado.
                Este é o lugar onde a pessoa vem entender o que aconteceu
                depois de ver a linha vermelha na fila: cortar aqui também
                deixaria o problema sem nenhum lugar onde possa ser lido.
              */}
              <p className="mt-1 text-[11px] leading-4 break-words text-soft">
                {lead.aguardando?.motivo}
              </p>
              {lead.aguardando?.desde && (
                <p className="mt-1 text-[10px] text-dim">
                  esperando desde {horaExata(lead.aguardando.desde)}
                </p>
              )}
              <form action={acaoEncerrarAtendimento.bind(null, clienteId, lead.contatoId)}>
                <button
                  type="submit"
                  className="mt-2.5 w-full rounded-[8px] border border-rose-400/40 bg-white px-2.5 py-2 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
                >
                  Já atendi
                </button>
              </form>
            </>
          )}
        </div>

        {/*
          Quem é a pessoa vem antes de tudo que se faz com ela.

          A coluna abria em "Etiquetas", e o telefone não aparecia em tela
          nenhuma do Inbox, para ver o número era preciso sair daqui e abrir a
          Ficha, no meio de um atendimento.
        */}
        <QuemE
          waId={lead.waId}
          criadoEm={lead.criadoEm}
          ultimaEntradaEm={lead.ultimaEntradaEm}
          campos={lead.campos}
          passagens={passagens}
          nomesDosAnuncios={nomesDosAnuncios}
        />

        <Secao titulo="Etiquetas do contato" vazio="Nenhuma etiqueta aplicada.">
          {lead.etiquetasManuais.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {lead.etiquetasManuais.map((etiqueta) => (
                <span
                  key={etiqueta.id}
                  className="rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-soft"
                >
                  {etiqueta.nome}
                </span>
              ))}
            </span>
          )}
        </Secao>

        <FunilDaConversa clienteId={clienteId} funis={funis} />

        <Secao titulo="Anotação da equipe" vazio="Sem anotação.">
          {lead.notas.trim() !== '' && (
            <p className="rounded-[10px] border border-line bg-surface px-2.5 py-2 text-[11.5px] leading-5 whitespace-pre-line text-soft">
              {lead.notas}
            </p>
          )}
        </Secao>

        <div className="mt-5">
          <h3 className="text-[11px] font-bold text-soft">O que o fluxo coletou</h3>
          <CamposColetados campos={campos} />
        </div>
      </div>
    </aside>
  )
}

/**
 * Uma seção da coluna, com o que dizer quando ela está vazia.
 *
 * O vazio é escrito, e não omitido: "Nenhuma etiqueta aplicada" responde a
 * pergunta; a seção sumindo faz a pessoa procurar onde ficaram as etiquetas.
 * O caminho para preencher é o ícone lá em cima, e por isso o rótulo diz o
 * mesmo nome que o `title` do botão.
 */
function Secao({
  titulo,
  vazio,
  children,
}: {
  titulo: string
  vazio: string
  children: ReactNode
}) {
  return (
    <div className="mt-5">
      <h3 className="mb-1.5 text-[11px] font-bold text-soft">{titulo}</h3>
      {children || <p className="text-[11px] text-dim">{vazio}</p>}
    </div>
  )
}

/**
 * O histórico de chegadas do contato aberto, com o nome de cada anúncio.
 *
 * Três saídas sem rede, na ordem em que cortam mais: nenhum contato aberto,
 * contato que nunca chegou por anúncio, e conta que não conectou o Ads, que é
 * o caso da esmagadora maioria. Só o que sobra chega em `resolverAnuncios`, e
 * mesmo ali o cache costuma responder sem falar com a Meta.
 *
 * Sem token, as passagens voltam mesmo assim: cada uma tem o título que a
 * pessoa leu no dia, e é isso que a lista mostra. Conectar o Ads melhora o
 * rótulo; não conectar não esconde o histórico.
 */
async function historicoDoContatoAberto(
  clienteId: string,
  contatoId: string | null,
): Promise<{ passagens: Passagem[]; nomesDosAnuncios: Map<string, AnuncioEmCache> }> {
  const vazio = { passagens: [], nomesDosAnuncios: new Map<string, AnuncioEmCache>() }
  if (!contatoId) return vazio

  const passagens = await passagensDoContato(contatoId)
  if (passagens.length === 0) return vazio

  const token = await tokenDeAnuncios(clienteId)
  if (!token) return { passagens, nomesDosAnuncios: new Map() }

  const nomesDosAnuncios = await resolverAnuncios({
    clienteId,
    adIds: passagens.map((p) => p.adId),
    token,
  })

  return { passagens, nomesDosAnuncios }
}
