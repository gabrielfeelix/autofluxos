import { Fragment } from 'react'
import { after } from 'next/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { comoFalta, podeReagir, restaDaJanela } from '@/channels/janela'
import { Assumir, PassarPara } from '@/components/inbox/assumir'
import { NotaRapida } from '@/components/inbox/nota-rapida'
import { membrosDaConta, type MembroDaConta } from '@/server/repos/usuarios'
import { sessaoAtual } from '@/server/sessao'
import { ClienteShell } from '@/components/design/cliente-shell'
import { IlustracaoInbox } from '@/components/design/ilustracoes'
import { recemConectado } from '@/core/coexistencia-na-tela'
import { assinaturaDasReacoes } from '@/core/reacoes'
import { coexistenciaDoCliente } from '@/server/repos/coexistencia'
import { ControleDeAutomacao } from '@/components/lead/controle-automacao'
import { CamposColetados } from '@/components/lead/campos-coletados'
import { camposSemOrigem } from '@/core/contatos/origem'
import type { AnuncioEmCache, Passagem } from '@/core/anuncios'
import { passagensDoContato } from '@/server/repos/passagens'
import { resolverAnuncios } from '@/server/resolver-anuncios'
import { tokenDeAnuncios } from '@/server/token-de-anuncios'
import { QuemE } from '@/components/lead/quem-e'
import { CaixaDeResposta } from '@/components/lead/responder'
import { RodapeDaMensagem } from '@/components/lead/rodape-da-mensagem'
import { ProvedorDeCitacao } from '@/components/lead/citacao'
import {
  acaoAssumirAtendimento,
  acaoAtribuirPara,
  acaoEncerrarAtendimento,
  acaoLiberarAtendimento,
  acaoResponderLead,
  acaoSalvarNotas,
} from '@/server/acoes'
import { acharCliente } from '@/server/repos/clientes'
import { contextoDeResposta } from '@/server/repos/conversas'
import {
  acharLead,
  contarPorAtribuicao,
  contarPorEstado,
  filaInteira,
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
  CartoesNaBolha,
  CitacaoNaBolha,
  LocalNaBolha,
  SemTexto,
} from '@/components/lead/anexo'
import { etiquetasDeDia, horaDoRelogio, horaExata } from '@/lib/quando'
import { SeletorDeEtiquetas, type EtiquetaEscolhivel } from '@/components/etiquetas/seletor'
import { Avatar } from '@/components/inbox/avatar'
import { EstadoDaConversa } from '@/components/inbox/estado-da-conversa'
import { Fila, type Contagem } from '@/components/inbox/fila'
import { clienteTemAutomacao } from '@/server/repos/fluxos'
import { listarEtiquetas } from '@/server/repos/etiquetas'
import { listarQuadros, quadrosDoContato } from '@/server/repos/quadros'
import { FunilDaConversa, type FunilDoContato } from '@/components/inbox/funil-da-conversa'
import { marcarComoLida, naoLidasPorContato, quandoLeu } from '@/server/repos/leituras'
import { avisarQueLeu } from '@/server/recibo-de-leitura'
import { TextoDoWhatsApp } from '@/components/texto-do-whatsapp'
import { PulsoDoInbox } from '@/components/inbox/pulso-do-inbox'

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
 * valores conhecidos passam — o resto cai no default, que é a fila aberta.
 */
function ehEstadoValido(valor: string | undefined): valor is FiltroDeEstado {
  return valor === 'aberta' || valor === 'adiada' || valor === 'resolvida'
}

/**
 * Quantas conversas a fila carrega de uma vez.
 *
 * Ela trazia **todas**. Com 58 tudo bem; com 5.000 é uma página que demora a
 * abrir para mostrar cinquenta linhas que cabem na tela — e a fila é a tela que
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
 * Link do Next troca apenas o payload da rota — não há recarregamento do
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
  const atribuicao = primeiro(busca.de) || 'todos'
  /*
   * O eixo "em que pé está", separado do "de quem é" (0049).
   *
   * O default é `aberta` e não `todas`: a fila existe para mostrar o que
   * precisa de alguém hoje. Sem isso, a conversa resolvida ontem disputa
   * espaço com quem está esperando resposta agora — que era o estado anterior
   * desta tela.
   */
  const estadoPedido = primeiro(busca.estado)
  const estado: FiltroDeEstado = ehEstadoValido(estadoPedido) ? estadoPedido : 'aberta'
  const pagina = Math.max(1, Number(primeiro(busca.pagina)) || 1)
  const termo = limparBusca(primeiro(busca.busca))

  const [
    cliente,
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
    acharCliente(clienteId),
    paginarLeads(clienteId, {
      atribuicao,
      estado,
      busca: termo,
      pagina,
      porPagina: CONVERSAS_POR_PAGINA,
    }),
    /*
     * A fila inteira, para os rails filtrarem no navegador — ou `null` quando a
     * conta passou de `TETO_DA_FILA_LOCAL` e a tela precisa continuar
     * paginando. Ver `filaInteira`: ela conta antes de trazer, então numa conta
     * grande isto é uma contagem barata, não 5.000 linhas jogadas fora.
     *
     * Vai junto das outras no mesmo `Promise.all` — em série somaria uma ida de
     * rede à tela mais aberta do produto.
     */
    filaInteira(clienteId, { busca: termo }),
    listarRespostasRapidas(clienteId),
    contarPorAtribuicao(clienteId),
    contarPorEstado(clienteId),
    listarEtiquetas(clienteId),
    /*
     * Só custa quando o Inbox está vazio, que é quando a resposta importa —
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
  if (!cliente) notFound()

  /*
   * Qualquer número coexistente ainda sincronizando serve: a explicação é sobre
   * a conta, e um cliente com dois números conectados no mesmo dia não precisa
   * de dois avisos dizendo a mesma coisa.
   */
  const recem = Object.values(coexistencia).some((estado) => recemConectado(estado))

  const leads = fila.leads

  const pedido = primeiro(busca.conversa) || undefined

  /**
   * A conversa pedida pode não estar na página carregada — um link guardado de
   * duas semanas atrás, ou uma aba do rail que não a contém. Buscar por id
   * quando ela não aparece na lista é o que faz o endereço continuar valendo.
   */
  const naLista = escolherLead(leads, pedido)
  const selecionado =
    naLista?.contatoId === pedido || !pedido ? naLista : ((await acharLead(clienteId, pedido)) ?? naLista)

  /**
   * Quem atende nesta conta, para a tela dizer **nomes** em vez de uuid.
   *
   * A consulta fala Postgres direto (as tabelas do login ficam fora da Data
   * API), e por isso ela pode estourar num ambiente sem `DATABASE_URL`. Cair
   * para uma lista vazia é o certo: o Inbox é a tela mais usada do produto, e
   * ela não pode parar de abrir porque o login não está configurado. Sem
   * membros, a atribuição simplesmente não aparece — que é a verdade enquanto
   * não existe usuário nenhum.
   */
  const sessao = await sessaoAtual()

  let equipe: MembroDaConta[] = []
  // Só busca quando há o que mostrar: alguém logado para assumir, ou alguma
  // conversa já com dono. Enquanto não existir
  // usuário nenhum, isso é uma ida ao banco por abertura do Inbox — que é a
  // tela mais usada do produto — para montar uma lista vazia.
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
   * A conversa que está aberta na tela acabou de ser lida — contá-la como não
   * lida no mesmo desenho em que ela está visível é o tipo de detalhe que faz
   * a insígnia perder credibilidade e todo mundo parar de olhar para ela.
   *
   * Escrever durante a renderização é aceitável **aqui** porque a escrita é
   * idempotente (`lida_em = now()`) e a rota é `force-dynamic`: rodar duas
   * vezes na mesma navegação escreve o mesmo relógio duas vezes. Sem usuário —
   * quem ainda não tem usuário na conta — as duas funções não fazem nada.
   */
  // O pulso de agora vira a linha de base da tela: é contra ele que o poll
  // compara para saber se o que está à vista envelheceu.
  const pulso = await pulsoDaConta(clienteId)

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
    await marcarComoLida(usuarioId, selecionado.contatoId)

    /*
     * O tique azul sai **depois** da resposta, pelo `after`: é uma chamada de
     * rede à Meta, e ela não pode entrar no caminho de desenhar a conversa.
     *
     * Sem usuário na sessão não há de quem saber "quando leu", e sem isso cada
     * atualização da tela mandaria outro recibo. Fica sem — o bot ainda marca
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
   * senão ela nasce sem — e uma insígnia que some conforme a aba é pior que
   * insígnia nenhuma, porque ninguém desconfia de um zero.
   *
   * `local` é no máximo `TETO_DA_FILA_LOCAL` contatos, e a consulta é um
   * `in (...)` de ids. Quando ele é `null` a lista é a página, como antes.
   */
  const naoLidas = await naoLidasPorContato(
    usuarioId,
    (local ?? leads).map((lead) => lead.contatoId),
  )

  return (
    <ClienteShell cliente={cliente} ativa="inbox">
      {/*
        Só aqui, e não na moldura do cliente: recarregar a tela de fluxos ou de
        contatos a cada mensagem que chega seria intromissão. O Inbox é a única
        tela cujo conteúdo é a conversa acontecendo agora.
      */}
      <PulsoDoInbox clienteId={cliente.id} pulsoNaTela={pulso} />
      <main className="px-4 md:px-[42px] pt-[26px] pb-[42px]">
        {/*
          O estado vazio é para **cliente sem conversa nenhuma**, e não para
          filtro sem resultado.
          
          Antes bastava a lista vir vazia para a tela inteira virar "quando
          alguém falar com o número, a conversa aparece aqui" — inclusive
          depois de uma busca que não achou. Além de mentir (há conversas, só
          não com aquele termo), sumia com o próprio campo de busca, e a pessoa
          não tinha como corrigir o que digitou.
        */}
        {contagem.total === 0 ? (
          <EstadoVazio clienteId={cliente.id} recemConectado={recem} />
        ) : (
          <Conteudo
            clienteId={cliente.id}
            leads={leads}
            local={local}
            selecionado={selecionado}
            respostasRapidas={respostasRapidas}
            equipe={equipe}
            usuarioId={usuarioId}
            naoLidas={naoLidas}
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
    </ClienteShell>
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
   * três itens. A causa real era outra — o app estava inscrito na WABA errada.
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
       * que algo quebrou — que foi o que aconteceu com o primeiro cliente.
       */}
      {recem && (
        <p className="mt-3 rounded-[10px] border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left text-[12px] leading-5 text-dim">
          Este número foi conectado há pouco. A Meta ainda está sincronizando, e
          isso pode levar algumas horas — até terminar, é normal nenhuma
          conversa nova aparecer aqui.
        </p>
      )}

      <Link href={`/clientes/${clienteId}/leads`} className="app-secondary-button mt-5 inline-block px-4 py-2.5 text-[12.5px]">
        Ver Leads
      </Link>
    </section>
  )
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
   * A fila inteira, sem filtro de estado nem de dono — ou `null` quando a conta
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
  // `selecionado` veio de `paginarLeads(clienteId, ...)`. Só depois desse vínculo
  // cliente–contato confirmado é seguro ler as mensagens pelo id do contato.
  const [conversa, contexto, posicoes, quadros] = selecionado
    ? await Promise.all([
        lerConversa(selecionado.contatoId),
        contextoDeResposta(clienteId, selecionado.contatoId),
        /*
         * Onde este contato está no funil, e as etapas de cada quadro para o
         * menu de mover. As duas juntas porque uma sem a outra não desenha
         * nada: a posição diz "está em Contactado", e só a lista de etapas diz
         * para onde dá para ir.
         */
        quadrosDoContato(clienteId, selecionado.contatoId),
        listarQuadros(clienteId),
      ])
    : [null, null, [], []]

  /*
   * O nome da campanha, só do contato aberto.
   *
   * **Um id, e não a fila inteira**, de propósito. Resolver as 200 conversas
   * encheria o cache de nomes que ninguém vai ler — a origem aparece na coluna
   * do contato, que mostra uma pessoa por vez. Quando o rail "veio de anúncio"
   * existir e precisar dos nomes na lista, `resolverAnuncios` já recebe lista;
   * é só passar outra.
   *
   * Sai do `Promise.all` acima porque depende do `selecionado` que ele resolve,
   * e porque o caso comum — conta sem Ads conectado — devolve sem ir à rede.
   */
  const { passagens, nomesDosAnuncios } = await historicoDoContatoAberto(
    clienteId,
    selecionado?.contatoId ?? null,
  )

  /*
   * Junta a posição do contato com as etapas do quadro dela. Quadro que sumiu
   * entre uma consulta e outra é descartado em vez de virar um menu vazio —
   * `flatMap` com `[]` é o jeito de dizer isso sem um `filter` a mais.
   */
  const funis: FunilDoContato[] = posicoes.flatMap((posicao) => {
    const quadro = quadros.find((q) => q.id === posicao.quadroId)
    if (!quadro) return []
    return [{ ...posicao, etapas: quadro.etapas.map((e) => ({ id: e.id, nome: e.nome })) }]
  })
  const restante = restaDaJanela(contexto?.ultimaEntradaEm ?? null)
  const janela = restante && restante > 0 ? comoFalta(restante) : null
  const primeiroNome = selecionado?.nome?.split(' ')[0] ?? 'esta pessoa'
  /*
   * Conta a fila inteira quando ela veio, e não a página: a linha diz "N
   * esperando uma pessoa" **sobre a conta**, e no modo local ela fica fixa
   * enquanto a pessoa troca de aba. Contar só o recorte faria o número cair
   * para zero em "Resolvidas" — que é verdade sobre a aba e mentira sobre o
   * que precisa de alguém.
   */
  const esperando = (local ?? leads).filter((lead) => lead.aguardando).length

  return (
    <>
      <header className="mb-3">
        <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-dim">ATENDIMENTO</p>
        <h1 className="mt-0.5 text-[19px] font-bold tracking-[-0.02em]">Inbox</h1>
      </header>

      {/*
        A moldura tem **altura máxima**, e é isso que faz o histórico rolar por dentro.

        Com `min-h` só, a caixa crescia com a conversa e quem rolava era a
        página inteira: o cabeçalho da conversa e a caixa de resposta subiam
        para fora da tela, e uma conversa longa deixava de ter onde responder
        sem voltar ao topo. As três colunas já tinham `overflow` próprio — o
        que faltava era um teto para elas medirem.

        `h-[calc(100dvh-…)]` desconta o cabeçalho "Atendimento" e a margem da
        moldura. `dvh` e não `vh`: no celular a barra do navegador entra e sai,
        e `vh` congela a altura da barra escondida — a caixa de resposta ficava
        atrás dela.
      */}
      <div className="grid h-[calc(100dvh-116px)] min-h-[420px] grid-cols-[292px_minmax(390px,1fr)_250px] overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#0c1118] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
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
          pagina={pagina}
          paginas={paginas}
        />

        {selecionado && conversa ? (
          /*
            `min-h-0` não é enfeite: item de flex/grid tem `min-height: auto`,
            que o impede de encolher abaixo do próprio conteúdo. Sem ele esta
            coluna estourava o teto da moldura, e o `overflow-auto` do
            histórico — que já estava certo — nunca chegava a ter o que rolar.
          */
          <section className="flex min-h-0 min-w-0 flex-col border-r border-white/[0.06]">
            <CabecalhoDaConversa
              clienteId={clienteId}
              lead={selecionado}
              equipe={equipe}
              usuarioId={usuarioId}
            />
            {/*
              `flex-col-reverse` é o que faz a conversa abrir na mensagem mais
              recente, e não lá em cima nas antigas.

              É CSS e não JavaScript de propósito. Um `scrollTo` num efeito
              precisaria tornar isto um Client Component, e ainda assim
              apareceria no topo por um quadro antes de pular — o flash que todo
              chat feito assim tem. Com a coluna invertida o navegador ancora o
              scroll no fim desde o primeiro render, sem piscar e sem JS.

              O `Historico` fica em ordem NORMAL. Como ele é filho único deste
              container, a inversão daqui não mexe na ordem das mensagens — ela
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
              <div className="flex min-h-0 flex-1 flex-col-reverse overflow-auto bg-[radial-gradient(500px_320px_at_70%_5%,rgba(86,208,245,0.04),transparent_68%)] p-5">
                <Historico
                  mensagens={conversa.mensagens}
                  cortada={conversa.cortada}
                  nome={selecionado.nome}
                  clienteId={clienteId}
                  contatoId={selecionado.contatoId}
                />
              </div>
              <CaixaDeResposta
                acao={acaoResponderLead.bind(null, clienteId, selecionado.contatoId)}
                restaDaJanela={janela}
                nome={primeiroNome}
                respostasRapidas={respostasRapidas}
                temAutomacao={temAutomacao}
                anexo={{ clienteId, contatoId: selecionado.contatoId }}
              />
            </ProvedorDeCitacao>
          </section>
        ) : (
          <section className="col-span-2 flex min-w-0 items-center justify-center border-r border-white/[0.06] p-10 text-center">
            <p className="max-w-[280px] text-[12.5px] leading-6 text-dim">
              Nenhuma conversa nesta seleção.
              <br />
              Limpe a busca ou escolha outra aba à esquerda.
            </p>
          </section>
        )}

        {selecionado && (
          <DadosDoLead
            clienteId={clienteId}
            lead={selecionado}
            etiquetas={etiquetas}
            funis={funis}
            temAutomacao={temAutomacao}
            passagens={passagens}
            nomesDosAnuncios={nomesDosAnuncios}
          />
        )}
      </div>
    </>
  )
}

function CabecalhoDaConversa({
  clienteId,
  lead,
  equipe,
  usuarioId,
}: {
  clienteId: string
  lead: Lead
  equipe: MembroDaConta[]
  usuarioId: string | null
}) {
  const nome = lead.nome ?? 'sem nome'
  const responsavel = equipe.find((membro) => membro.id === lead.atribuidoA) ?? null
  return (
    <header className="flex min-h-[69px] items-center gap-3 border-b border-white/[0.06] px-5">
      <Avatar nome={lead.nome} alerta={Boolean(lead.aguardando)} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[13px] font-bold">{nome}</h2>
        <p className="mt-0.5 font-mono text-[10px] text-dim">{lead.waId}</p>
      </div>
      {/*
        Só aparece quando há **alguém para assumir**. Sem ninguém na equipe
        não existe usuário, e um botão que só sabe dizer "entre com a sua conta"
        seria um convite a clicar em nada.
      */}
      {equipe.length > 1 && (
        <PassarPara
          atribuir={acaoAtribuirPara.bind(null, clienteId, lead.contatoId)}
          equipe={equipe}
        />
      )}

      {/*
        Resolver e adiar antes de Assumir: são o que se faz **ao terminar** de
        olhar a conversa, e é esse o gesto mais frequente. Assumir é o que se
        faz ao começar, e só importa quando há mais de uma pessoa.
      */}
      <EstadoDaConversa
        clienteId={clienteId}
        contatoId={lead.contatoId}
        estado={lead.estadoEfetivo}
      />

      {(usuarioId || responsavel) && (
        <Assumir
          assumir={acaoAssumirAtendimento.bind(null, clienteId, lead.contatoId)}
          liberar={acaoLiberarAtendimento.bind(null, clienteId, lead.contatoId)}
          responsavel={responsavel?.nome ?? null}
          souEu={Boolean(usuarioId) && lead.atribuidoA === usuarioId}
        />
      )}

      <Link
        href={`/clientes/${clienteId}/leads/${lead.contatoId}`}
        className="rounded-[8px] border border-white/[0.09] px-2.5 py-1.5 text-[10.5px] font-semibold text-muted transition hover:border-white/[0.18] hover:text-white"
      >
        Abrir ficha
      </Link>
    </header>
  )
}

function Historico({
  mensagens,
  cortada,
  nome,
  clienteId,
  contatoId,
}: {
  mensagens: MensagemDoLead[]
  cortada: boolean
  nome: string | null
  clienteId: string
  contatoId: string
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
   * que ponta o scroll nasce — não mexe na ordem. Inverter aqui também (o que
   * esta tela chegou a fazer) invertia a conversa de verdade.
   */
  return (
    /*
     * **A conversa ocupa a largura toda, sem coluna centralizada.**
     *
     * Havia aqui um `mx-auto max-w-[680px]`. O alinhamento das bolhas estava
     * certo — entrada à esquerda, saída à direita —, mas relativo a essa
     * coluna, não à tela: numa área larga, a coluna flutuava no meio e a
     * conversa inteira aparecia deslocada para o centro, com as mensagens
     * recebidas começando longe da borda esquerda. Parecia bug de alinhamento
     * e era o contêiner.
     *
     * O `w-full` não é decoração: o pai que rola é um `flex-col-reverse`, e
     * num contêiner flex em coluna o filho é dimensionado pelo conteúdo no
     * eixo cruzado em vez de esticar. Sem ele, este bloco encolhe até a maior
     * bolha e fica centrado — que foi exatamente o sintoma que sobrou depois
     * de tirar o `max-w`: as bolhas alinhavam certo entre si, e o conjunto
     * todo flutuava no meio, longe das duas bordas.
     *
     * Largura cheia é também o que o WhatsApp faz, e é o que faz a direção da
     * mensagem ser legível de relance — que é a única coisa que o alinhamento
     * precisa comunicar.
     */
    <div className="flex w-full flex-col gap-2.5">
      {cortada && (
        <p className="mb-1 self-center rounded-full border border-dashed border-white/[0.15] px-3 py-1.5 text-center font-mono text-[9.5px] text-dim">
          mostrando as 500 mensagens mais recentes
        </p>
      )}
      {mensagens.map((mensagem, indice) => {
        const nossa = mensagem.direcao === 'saida'
        const etiqueta = diasDaConversa[indice]
        /*
         * A barra só aparece onde há id da Meta.
         *
         * Reagir e citar pedem esse id, e saída ainda não confirmada não tem —
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
             * de um pai que empilhe — e `items-end`/`items-start` é o que
             * mantém a bolha do tamanho do conteúdo em vez de esticar na linha
             * toda.
             */}
          <div
            className={`flex flex-col gap-0 ${nossa ? 'items-end' : 'items-start'}`}
          >
            <p className={`max-w-[78%] px-3 py-2 text-[12.5px] leading-[1.5] whitespace-pre-wrap shadow-[0_1px_1px_rgba(0,0,0,0.12)] ${
              nossa
                ? 'rounded-[13px_13px_4px_13px] border border-accent/[0.2] bg-accent/[0.12]'
                : 'rounded-[13px_13px_13px_4px] border border-white/[0.07] bg-white/[0.055]'
            }`}>
              {mensagem.cita && <CitacaoNaBolha cita={mensagem.cita} nome={nome} />}
              {mensagem.anexo && <AnexoNaConversa anexo={mensagem.anexo} />}
              {/*
                O arquivo que a pessoa mandou. Mesma bolha do que sai, e a
                diferença está em quem produziu a URL: aqui ela é assinada e
                morre em cinco minutos.
              */}
              {mensagem.recebido && <AnexoNaConversa anexo={mensagem.recebido} />}
              {mensagem.semCopia && <ArquivoSemCopia />}
              {mensagem.local && <LocalNaBolha local={mensagem.local} />}
              {mensagem.cartoes && <CartoesNaBolha cartoes={mensagem.cartoes} />}
              {/*
                Lugar e cartão **substituem** o "(áudio, imagem ou documento)".
                Eles são a mensagem inteira, e quase nunca vêm com legenda —
                deixar a frase genérica embaixo diria que falta algo que não
                falta.
              */}
              {mensagem.texto !== null ? (
                <TextoDoWhatsApp texto={mensagem.texto} />
              ) : (
                !mensagem.local && !mensagem.cartoes && <SemTexto />
              )}
              <span className="ml-2 text-[9.5px] text-muted" title={horaExata(mensagem.ts)}>
                {nossa ? 'atendimento' : (nome ?? 'cliente')} · {horaDoRelogio(mensagem.ts)}
              </span>
              {nossa && !mensagem.entregue && (
                <span className="ml-2 text-[9.5px] text-amber-200">envio não confirmado</span>
              )}
            </p>
            {(mensagem.waMessageId || mensagem.reacoes) && (
              /*
               * A `key` é o que devolve a palavra final ao servidor.
               *
               * O rodapé guarda a nossa reação em estado para poder mostrá-la
               * antes da resposta. Quando a leitura seguinte trouxer outra
               * coisa — alguém reagiu do celular, a Meta recusou, a outra
               * pessoa reagiu também —, a chave muda, o componente remonta, e
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
    <p className="my-1 self-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-center text-[10px] font-medium text-dim">
      {rotulo}
    </p>
  )
}

function DadosDoLead({
  clienteId,
  lead,
  etiquetas,
  funis,
  temAutomacao,
  passagens,
  nomesDosAnuncios,
}: {
  clienteId: string
  lead: Lead
  etiquetas: EtiquetaEscolhivel[]
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
   * acima. Repetir gastaria o teto de quatro campos visíveis dizendo duas
   * vezes a mesma coisa.
   */
  const campos = camposSemOrigem(Object.entries(lead.campos))
  const aguardandoPessoa = lead.aguardando !== null
  /*
   * `automacao_ativa` é um interruptor **por conversa**, não a existência do
   * robô: ele nasce ligado e quer dizer "esta conversa não foi silenciada".
   * Numa conta sem automação ele fica ligado para sempre — e era por ler só
   * ele que a tela afirmava um estado impossível.
   */
  const botPausado = !lead.automacaoAtiva
  return (
    // Rola por dentro, como as outras duas colunas: agora que a moldura tem
    // teto, a ficha de um lead com muitos campos seria cortada sem isto.
    <aside className="min-w-0 overflow-y-auto bg-white/[0.012]">
      <header className="border-b border-white/[0.06] px-4 py-[17px]">
        <p className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-dim">CONTATO</p>
        <h2 className="mt-1 text-[13px] font-bold">Contexto do lead</h2>
      </header>

      <div className="p-4">
        {/*
          Sem automação a tag é a resposta inteira: não há bot, então não há o
          que ligar, desligar ou explicar. O card vira rótulo e para por aí —
          antes ele dizia "BOT RESPONDENDO" numa conta sem fluxo nenhum.
        */}
        <div className={`rounded-[11px] border px-3 py-2.5 ${aguardandoPessoa ? 'border-rose-400/25 bg-rose-400/[0.07]' : !temAutomacao ? 'border-white/[0.09] bg-white/[0.03]' : botPausado ? 'border-amber-300/25 bg-amber-300/[0.065]' : 'border-emerald-400/20 bg-emerald-400/[0.055]'}`}>
          <p className={`text-[10px] font-bold tracking-[0.04em] ${aguardandoPessoa ? 'text-rose-300' : !temAutomacao ? 'text-muted' : botPausado ? 'text-amber-200' : 'text-emerald-300'}`}>
            {aguardandoPessoa
              ? 'AGUARDANDO PESSOA'
              : !temAutomacao
                ? 'ATENDIMENTO MANUAL'
                : botPausado
                  ? 'BOT EM PAUSA'
                  : 'BOT RESPONDENDO'}
          </p>
          {aguardandoPessoa ? (
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
                  className="mt-2.5 w-full rounded-[8px] border border-rose-400/30 bg-rose-400/[0.11] px-2.5 py-2 text-[11px] font-bold text-rose-200 transition hover:bg-rose-400/[0.18]"
                >
                  Já atendi
                </button>
              </form>
            </>
          ) : !temAutomacao ? null : (
            <ControleDeAutomacao
              clienteId={clienteId}
              contatoId={lead.contatoId}
              automacaoAtiva={lead.automacaoAtiva}
            />
          )}
        </div>

        {/*
          Quem é a pessoa vem antes de tudo que se faz com ela.

          A coluna abria em "Etiquetas", e o telefone não aparecia em tela
          nenhuma do Inbox — para ver o número era preciso sair daqui e abrir a
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

        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-bold text-soft">Etiquetas</h3>
          <SeletorDeEtiquetas
            clienteId={clienteId}
            contatoId={lead.contatoId}
            disponiveis={etiquetas}
            aplicadas={lead.etiquetasManuais.map((etiqueta) => etiqueta.id)}
          />
        </div>

        <FunilDaConversa clienteId={clienteId} funis={funis} />

        {/*
          A anotação vem antes dos campos.
          Ela é o que mais se usa nesta coluna e estava no fim, depois do
          despejo de tudo que o fluxo coletou — num contato com muitos campos,
          fora da dobra.
        */}
        <div className="mt-5">
          <h3 className="text-[11px] font-bold text-soft">Anotação da equipe</h3>
          <NotaRapida
            inicial={lead.notas}
            salvar={acaoSalvarNotas.bind(null, clienteId, lead.contatoId)}
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold text-soft">O que o fluxo coletou</h3>
            <Link href={`/clientes/${clienteId}/leads/${lead.contatoId}`} className="text-[10.5px] font-semibold text-accent hover:underline">
              Ficha
            </Link>
          </div>
          <CamposColetados campos={campos} />
        </div>
      </div>
    </aside>
  )
}

/**
 * O histórico de chegadas do contato aberto, com o nome de cada anúncio.
 *
 * Três saídas sem rede, na ordem em que cortam mais: nenhum contato aberto,
 * contato que nunca chegou por anúncio, e conta que não conectou o Ads — que é
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
