import { Fragment, Suspense, type ReactNode } from 'react'
import { EntradaDeAnotacao, ListaDeAnotacoes, ProvedorDeAnotacoes } from '@/components/inbox/anotacoes'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import { anotacoesDoContato } from '@/server/repos/eventos'
import { acaoAnotar } from '@/server/acoes-crm'
import { after } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comoFalta, restaDaJanela } from '@/channels/janela'
import { Assumir, PassarPara, TravaDaResposta } from '@/components/inbox/assumir'
import { ProvedorDaConversa } from '@/components/inbox/conversa-local'
import { EtiquetasAplicadas } from '@/components/etiquetas/seletor'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { sessaoAtual } from '@/server/sessao'
import { acessoCompleto } from '@/server/permissoes'
import { alcanceDaTela, espiando, quemPossoEspiar } from '@/server/espiar'
import { FaixaDeEspiar, MenuDeEspiar, RodapeDeEspiar } from '@/components/inbox/espiar'
import { alcancaDono } from '@/core/permissoes'
import { ClienteShell } from '@/components/design/cliente-shell'
import { Dica } from '@/components/design/dica'
import { IlustracaoInbox } from '@/components/design/ilustracoes'
import { recemConectado } from '@/core/coexistencia-na-tela'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { CamposColetados } from '@/components/lead/campos-coletados'
import { camposSemOrigem } from '@/core/contatos/origem'
import type { AnuncioEmCache, Passagem } from '@/core/anuncios'
import { passagensDoContato } from '@/server/repos/passagens'
import { resolverAnuncios } from '@/server/resolver-anuncios'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'
import { QuemE } from '@/components/lead/quem-e'
import { CaixaDeResposta } from '@/components/lead/responder'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import { ProvedorDeEntrega } from '@/components/lead/entrega-de-arquivos'
import {
  acaoAssumirAtendimento,
  acaoAtribuirPara,
  acaoAlternarAutomacaoDoLead,
  acaoEncerrarAtendimento,
  acaoLiberarAtendimento,
  acaoResponderLead,
} from '@/server/acoes'
import { acharCliente, type Cliente } from '@/server/repos/clientes'
import { contextoDeResposta, sessaoComPessoa } from '@/server/repos/conversas'
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
} from '@/server/repos/leads'
import { listarRespostasRapidas, type RespostaRapida } from '@/server/repos/respostas-rapidas'
import { CartaoDoAtendimento, SeloDoAtendimento } from '@/components/atendimento/estado'
import { estadoDoAtendimento, type Atendimento } from '@/core/estado-do-atendimento'
import type { EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { AcoesRapidas } from '@/components/inbox/acoes-rapidas'
import { hrefDaFicha } from '@/core/volta-da-ficha'
import { Avatar } from '@/components/inbox/avatar'
import { ColunaDaFicha, MolduraDoInbox, SoSemFicha } from '@/components/inbox/moldura'
import { cabeNoRecorte } from '@/components/inbox/recorte'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { AbasDaFicha } from '@/components/inbox/abas-da-ficha'
import { Fila, type Contagem } from '@/components/inbox/fila'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { listarQuadros, quadrosDoContato } from '@/server/repos/quadros'
import { FunilDaConversa, type FunilDoContato } from '@/components/inbox/funil-da-conversa'
import { marcarComoLida, naoLidasPorContato, quandoLeu } from '@/server/repos/leituras'
import { favoritasEntre, fixadasDoUsuario } from '@/server/repos/marcadores'
import { canaisDosContatos } from '@/server/repos/canais-site'
import type { CanalId } from '@/core/canais'
import { ajustesDaConta } from '@/server/repos/distribuicao'
import { avisarQueLeu } from '@/server/recibo-de-leitura'
import { FaixaDeCanalCaido } from '@/components/inbox/faixa-canal-caido'
import { Historico } from '@/components/inbox/historico'
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
      estado,
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
  // Espiando, a tela é a do espiado: as não lidas e as fixadas são as dele.
  // Quem escreve "li" é o bloco abaixo, e ele não roda espiando.
  const usuarioId = espiao ? espiao.alvo.id : (sessao?.usuario.id ?? null)
  if (selecionado && !espiao) {
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
     * precisa esperar o registro de que leu, o que importa nesta renderização
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
    <section className="mx-auto mt-16 max-w-[440px] text-center">
      <IlustracaoInbox />
      <p className="mt-6 font-mono text-[11px] font-bold tracking-[0.16em] text-dim">INBOX VAZIO</p>
      <h2 className="mt-2 text-[18px] font-bold tracking-[-0.02em]">Nenhuma conversa para atender</h2>
      <p className="mt-2 text-[13.5px] leading-6 text-muted">
        Quando alguém falar com o número ligado ao bot, a conversa aparece aqui. A tela de Leads
        continua sendo o lugar para analisar todos os contatos.
      </p>

      {/*
       * Número recém-conectado demora: enquanto a Meta não termina de
       * sincronizar, mensagem nova não chega. Dizer isso evita a conclusão de
       * que algo quebrou, que foi o que aconteceu com o primeiro cliente.
       */}
      {recem && (
        <p className="mt-3 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-left text-[12.5px] leading-5 text-dim">
          Este número foi conectado há pouco. A Meta ainda está sincronizando, e
          isso pode levar algumas horas, até terminar, é normal nenhuma
          conversa nova aparecer aqui.
        </p>
      )}

      <Link href={`/clientes/${clienteId}/leads`} className="app-secondary-button mt-5 inline-block px-4 py-2.5 text-[13px]">
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
          fixadas={fixadas}
          pagina={pagina}
          paginas={paginas}
          agendadas={agendadasDaConta}
          canalDoContato={canalDoContato}
          menuDeEspiar={menuDeEspiar}
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
                <ColunaDaFicha>
                  <EsperaDaFicha />
                </ColunaDaFicha>
              </>
            }
          >
            <ColunaDaConversa
              clienteId={clienteId}
              lead={selecionado}
              canal={canalDoContato.get(selecionado.contatoId) ?? 'whatsapp'}
              equipe={equipe}
              usuarioId={usuarioId}
              etiquetas={etiquetas}
              temAutomacao={temAutomacao}
              respostasRapidas={respostasRapidas}
              espiado={espiado}
            />
          </Suspense>
        ) : (
          <section className="flex min-w-0 items-center justify-center p-10 text-center">
            <p className="max-w-[280px] text-[13px] leading-6 text-dim">
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
      conversaPedida={conversaPedida}
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
  canal,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  respostasRapidas,
  espiado,
}: {
  clienteId: string
  /** Espiando: no lugar da caixa de resposta, o aviso de só leitura. */
  espiado: string | null
  /** A conversa aberta. Nunca `null` aqui: quem decide isso é quem renderiza. */
  lead: Lead
  /** Por onde a pessoa fala. Muda o selo e o que o campo de resposta oferece. */
  canal: CanalId
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
  respostasRapidas: RespostaRapida[]
}) {
  // `lead` veio de `paginarLeads(clienteId, ...)` ou de `acharLead(clienteId, ...)`.
  // Só depois desse vínculo cliente–contato confirmado é seguro ler as mensagens
  // pelo id do contato.
  const [conversa, contexto, posicoes, quadros, agendadasDaConversa, anotacoes, comPessoa] = await Promise.all([
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
    anotacoesDoContato(clienteId, lead.contatoId),
    // A terceira fonte do estado do atendimento (8.1): a sessão com uma pessoa.
    sessaoComPessoa(lead.contatoId),
  ])

  const atendimento = estadoDoAtendimento({
    automacaoAtiva: lead.automacaoAtiva,
    aguardando: lead.aguardando,
    atribuidoA: lead.atribuidoA,
    sessaoComPessoa: comPessoa,
    estado: lead.estadoEfetivo,
    temAutomacao,
    usuarioId,
  })

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
  // Quem decide se trava é `TravaDaResposta`, no cliente: assumir destrava no
  // clique, sem esperar a página voltar do servidor.

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
  // Chat do site: sem janela. O texto não aparece em pílula nenhuma (o
  // cabeçalho a esconde para o site); ele só diz ao compositor que está livre.
  const semJanela = contexto?.semJanela ?? false
  const janela = semJanela ? 'sem prazo' : restante && restante > 0 ? comoFalta(restante) : null
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
  const fimDaJanela = semJanela
    ? new Date(agora + 365 * 24 * 60 * 60 * 1000).toISOString()
    : restante !== null && restante > 0
      ? new Date(agora + restante).toISOString()
      : null

  if (!conversa) {
    return (
      <section className="flex min-w-0 items-center justify-center p-10 text-center">
        <p className="max-w-[280px] text-[13px] leading-6 text-dim">
          Não deu para abrir esta conversa.
        </p>
      </section>
    )
  }

  const selecionado = lead

  return (
    <ProvedorDeAnotacoes
      iniciais={anotacoes}
      antiga={lead.notas}
      autor={equipe.find((membro) => membro.id === usuarioId)?.nome ?? null}
      anotar={acaoAnotar.bind(null, clienteId, lead.contatoId)}
    >
      <ProvedorDaConversa
        contatoId={lead.contatoId}
        doServidor={{
          estado: lead.estadoEfetivo,
          automacaoAtiva: lead.automacaoAtiva,
          atribuidoA: lead.atribuidoA,
          sessaoComPessoa: comPessoa,
          aguardando: lead.aguardando,
          etiquetas: lead.etiquetasManuais.map((etiqueta) => etiqueta.id),
        }}
        usuarioId={usuarioId}
        temAutomacao={temAutomacao}
        equipe={equipe.map((membro) => ({ id: membro.id, nome: membro.nome }))}
      >
      <section className="flex min-h-0 min-w-0 flex-col border-r border-line">
        <CabecalhoDaConversa
          clienteId={clienteId}
          lead={selecionado}
          canal={canal}
          equipe={equipe}
          usuarioId={usuarioId}
          etiquetas={etiquetas}
          temAutomacao={temAutomacao}
          atendimento={atendimento}
          janela={janela}
          janelaApertada={apertado}
          fimDaJanela={fimDaJanela}
          agendadas={agendadasDaConversa}
          espiando={espiado !== null}
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
            {espiado !== null ? (
              <RodapeDeEspiar nome={espiado} />
            ) : (
            <TravaDaResposta exigeAssumir={ajustesDeAtendimento.exigeAssumir}>
            <CaixaDeResposta
              /*
                A `key` é a conversa, e sem ela o rascunho de uma vazava para a
                outra: o `<textarea>` não é controlado, então trocar de conversa
                remontava o campo vazio enquanto o estado do React continuava
                dizendo "tem texto aqui". O efeito visível era o microfone
                sumido com o campo vazio, e o botão de enviar no lugar dele.
              */
              key={selecionado.contatoId}
              canal={canal}
              acao={acaoResponderLead.bind(null, clienteId, selecionado.contatoId)}
              restaDaJanela={janela}
              nome={primeiroNome}
              respostasRapidas={respostasRapidas}
              temAutomacao={temAutomacao}
              anexo={{ clienteId, contatoId: selecionado.contatoId }}
            />
            </TravaDaResposta>
            )}
          </ProvedorDeEntrega>
        </ProvedorDeCitacao>
      </section>
      <ColunaDaFicha>
        <DadosDoLead
          clienteId={clienteId}
          lead={selecionado}
          canal={canal}
          funis={funis}
          atendimento={atendimento}
          donoNome={equipe.find((membro) => membro.id === lead.atribuidoA)?.nome ?? null}
          passagens={passagens}
          nomesDosAnuncios={nomesDosAnuncios}
          etiquetas={etiquetas}
        />
      </ColunaDaFicha>
      </ProvedorDaConversa>
    </ProvedorDeAnotacoes>
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
      <span className="flex items-center gap-3">
        <Esqueleto className="size-10 shrink-0 rounded-full" />
        <span className="flex flex-1 flex-col gap-2">
          <Esqueleto className="h-3 w-32" />
          <Esqueleto className="h-2.5 w-24" />
        </span>
      </span>
      <Esqueleto className="mt-1 h-8 w-full rounded-lg" />
      <Esqueleto className="mt-3 h-2.5 w-full" />
      <Esqueleto className="h-2.5 w-4/5" />
      <Esqueleto className="mt-3 h-16 w-full rounded-xl" />
    </aside>
  )
}

function CabecalhoDaConversa({
  clienteId,
  lead,
  canal,
  equipe,
  usuarioId,
  etiquetas,
  temAutomacao,
  atendimento,
  janela,
  janelaApertada,
  fimDaJanela,
  agendadas,
  espiando,
}: {
  clienteId: string
  /** No modo espiar o cabeçalho só informa: assumir, passar e as ações somem. */
  espiando: boolean
  lead: Lead
  canal: CanalId
  equipe: MembroDaConta[]
  usuarioId: string | null
  etiquetas: EtiquetaEscolhivel[]
  temAutomacao: boolean
  /** O estado do atendimento, o mesmo da coluna ao lado e da ficha (8.1). */
  atendimento: Atendimento
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
      {/*
        Quebra linha quando falta largura. Sem isso, em 1440 px com a coluna do
        contato aberta, o nome encolhia a nada e os ícones da direita passavam
        por baixo da coluna do contato, sem dar para clicar (visto na 5.9).
      */}
      <header className="flex min-h-[62px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2">
        <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} tamanho={40} canal={canal} />
        <div className="min-w-[140px] flex-1">
          <h2 className="truncate text-[13.5px] font-bold">
            {nome}
            {/*
              O telefone morava numa faixa própria embaixo do cabeçalho, junto
              de uma aba "WhatsApp" fixa (errada em conversa do Instagram). O
              canal virou selo no avatar e o número foi para o topo da coluna
              do contato; aqui ele só aparece quando essa coluna está fechada.
            */}
            {canal === 'whatsapp' && (
              <SoSemFicha>
                <span className="ml-2 font-mono text-[11.5px] font-normal text-dim">
                  {telefoneLegivel(lead.waId)}
                </span>
              </SoSemFicha>
            )}
          </h2>
          {/*
            De quem é a conversa fica **embaixo do nome**, e não num botão à
            direita. É estado, não ação: quem lê o cabeçalho precisa saber se
            alguém já está nessa antes de decidir responder.
          */}
          <p className="mt-0.5 flex items-center gap-2 truncate text-[12px] text-dim">
            {/*
              Estado e dono juntos, pela mesma função da coluna ao lado e da
              ficha (8.1): antes o cabeçalho dizia "robô pausado" só por haver
              responsável, e a coluna dizia "BOT RESPONDENDO".
            */}
            <SeloDoAtendimento
              atendimento={atendimento}
              donoNome={
                responsavel?.nome ?? (lead.atribuidoA ? 'alguém fora da equipe' : null)
              }
            />
            {janela && canal !== 'site' && (
              <Dica texto="Depois disso o WhatsApp só aceita modelo aprovado pela Meta">
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
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
        {!espiando && equipe.length > 1 && (
          <PassarPara
            atribuir={acaoAtribuirPara.bind(null, clienteId, lead.contatoId)}
            equipe={equipe}
          />
        )}

        {!espiando && (usuarioId || responsavel) && (
          <Assumir
            assumir={acaoAssumirAtendimento.bind(null, clienteId, lead.contatoId)}
            liberar={acaoLiberarAtendimento.bind(null, clienteId, lead.contatoId)}
            responsavel={responsavel?.nome ?? null}
            souEu={Boolean(usuarioId) && lead.atribuidoA === usuarioId}
          />
        )}

        {!espiando && (
          <AcoesRapidas
            clienteId={clienteId}
            contatoId={lead.contatoId}
            etiquetas={etiquetas}
            temAutomacao={temAutomacao}
            fimDaJanela={fimDaJanela}
            agendadas={agendadas}
            nomeDoContato={lead.nome?.split(' ')[0] ?? 'esta pessoa'}
          />
        )}
      </header>

    </>
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
  canal,
  funis,
  atendimento,
  donoNome,
  passagens,
  nomesDosAnuncios,
  etiquetas,
}: {
  clienteId: string
  lead: Lead
  canal: CanalId
  /** As da conta, para dar nome às aplicadas (inclusive as que se marcam agora). */
  etiquetas: EtiquetaEscolhivel[]
  /** Por onde o contato já chegou, da mais recente para a mais antiga. */
  passagens: Passagem[]
  /** Nomes da Marketing API por `ad_id`. Vazio quando a conta não conectou o Ads. */
  nomesDosAnuncios: Map<string, AnuncioEmCache>
  /** Um por quadro em que o contato está. Vazio = fora de todo funil. */
  funis: FunilDoContato[]
  /**
   * O estado do atendimento (8.1). Já considera se a conta tem automação: sem
   * isso o card dizia "BOT RESPONDENDO" numa conta sem fluxo nenhum.
   */
  atendimento: Atendimento
  donoNome: string | null
}) {
  /*
   * Sem as chaves de origem: elas já aparecem em destaque no `QuemE`, logo
   * abaixo. Repetir gastaria o teto de quatro campos visíveis dizendo duas
   * vezes a mesma coisa.
   */
  const campos = camposSemOrigem(Object.entries(lead.campos))

  return (
    // Rola por dentro, como as outras duas colunas: agora que a moldura tem
    // teto, a ficha de um lead com muitos campos seria cortada sem isto.
    <aside className="min-w-0 overflow-y-auto border-l border-line bg-panel">
      {/*
        O topo repete foto e nome de propósito, é o mesmo gesto do desenho de
        referência. A coluna rola, e depois de duas telas de campos coletados
        nada nela dizia mais de quem era aquela ficha.
      */}
      {/*
        O topo em uma linha: foto à esquerda, nome em cima e número embaixo, o
        arranjo da referência (24/set). Centralizado e com foto de 56px, ele
        gastava 150px de altura para dizer o que o cabeçalho da conversa, logo
        ao lado, já dizia, e empurrava o resto da coluna para baixo da dobra.
      */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
        <Avatar nome={lead.nome} tamanho={40} canal={canal} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14.5px] leading-5 font-semibold">{lead.nome ?? 'sem nome'}</h2>
          <p className="truncate font-mono text-[12px] text-dim">
            {canal === 'whatsapp' ? telefoneLegivel(lead.waId) : canal === 'site' ? 'Chat do site' : 'Instagram'}
          </p>
        </div>
        <Link
          href={hrefDaFicha(clienteId, lead.contatoId, {
            volta: `/clientes/${clienteId}/inbox?conversa=${lead.contatoId}`,
          })}
          title="Abrir a ficha completa"
          className="app-secondary-button shrink-0 px-2.5 py-1 text-[12px]"
        >
          Ficha
        </Link>
      </div>

      <AbasDaFicha
        anotacoes={
          <>
            <div className="mb-3">
              <EntradaDeAnotacao limite={LIMITE_DA_NOTA} />
            </div>
            <ListaDeAnotacoes vazio="Ninguém anotou nada sobre esta pessoa ainda." />
          </>
        }
        contato={
      <>
        {/*
          Sem automação a tag é a resposta inteira: não há bot, então não há o
          que ligar, desligar ou explicar. O card vira rótulo e para por aí,
          antes ele dizia "BOT RESPONDENDO" numa conta sem fluxo nenhum.
        */}
        <CartaoDoAtendimento
          atendimento={atendimento}
          donoNome={donoNome}
          aguardando={lead.aguardando}
          automacaoAtiva={lead.automacaoAtiva}
          finalizar={acaoEncerrarAtendimento.bind(null, clienteId, lead.contatoId)}
          alternarBot={acaoAlternarAutomacaoDoLead.bind(null, clienteId, lead.contatoId)}
        />

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
          <EtiquetasAplicadas
            contatoId={lead.contatoId}
            aplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
            disponiveis={etiquetas}
            vazio="Nenhuma etiqueta aplicada."
          />
        </Secao>

        <FunilDaConversa clienteId={clienteId} funis={funis} />


        <div className="mt-5">
          <h3 className="text-[12px] font-bold text-soft">O que o fluxo coletou</h3>
          <CamposColetados campos={campos} />
        </div>
      </>
        }
      />
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
      <h3 className="mb-1.5 text-[12px] font-bold text-soft">{titulo}</h3>
      {children || <p className="text-[12px] text-dim">{vazio}</p>}
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
