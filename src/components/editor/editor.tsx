'use client'

import { rotulosDoEstado } from '@/core/entrada'
import { useConfirmar } from '@/components/design/confirmar'
import { PopoverDoQuadro } from '@/components/quadros/popover-do-quadro'
import type { ConfigDaConta } from '@/core/retomada'
import {
  addEdge,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Conversa } from '@/components/conversa'
import { usePreferencia } from '@/components/design/tema'
import { VARIAVEIS_NATIVAS } from '@/core/contatos/vars-iniciais'
import { FundoDoCanvas } from './fundo'
import { PreviaDoBloco } from './previa-do-bloco'
import type { CanalId } from '@/core/canais'
import {
  fluxoSchema,
  noSchema,
  LIMITE_ATRASO_SEGUNDOS,
  type Fluxo,
  type No,
  type TipoNo,
} from '@/core/flow/schema'
import { aceitaAtraso, aplicarAtrasoEmLote } from '@/core/flow/atraso-em-lote'
import type { Problema } from '@/core/flow/validar'
import { variaveisDoFluxo } from '@/core/flow/variaveis'
import { validar } from '@/core/flow/validar'
import { validarPublicacao } from '@/core/validar-publicacao'
import {
  acaoAlternarIa,
  acaoDescartarRascunho,
  acaoPublicar,
  acaoSalvarRascunho,
  acaoVoltarParaVersao,
} from '@/server/acoes'
import { Modal } from '@/components/design/modal'
import { SeloDoCanal } from '@/components/design/selo-do-canal'
import { AcaoDaArestaProvider, RealceDeArestasProvider, tiposDeAresta } from './arestas'
import { DESCRICOES, filtrarCatalogo, GRUPOS_DE_BLOCOS } from '@/core/flow/blocos'
import { CORES, ICONES, NOMES, NomesDeEtiquetaProvider, RespostasPorVariavelProvider, tiposDeNo } from './nos'
import { NomeDoFluxo } from './nome-do-fluxo'
import { organizar, type AlcasDoBloco } from './organizar'
import { PuxadorDeLargura } from './puxador'
import { useLarguraGuardada } from './largura-guardada'
import { Painel } from './painel'
import type {
  ConexaoDoCliente,
  EtapaDoCliente,
  EtiquetaDoCliente,
  FluxoDaConta,
  MembroDoCliente,
} from './painel'
import { Versoes, type VersaoNaLista } from './versoes'
import { Compartilhar } from './compartilhar'
import { AntesDePublicar } from './antes-de-publicar'
import type { PoliticaDaIa } from '@/core/autonomia-da-ia'
import { antesDePublicar, type OrigemDoFluxo } from '@/core/flow/antes-de-publicar'
import { descrever } from '@/core/flow/descrever'
import { Caixa } from '@/components/design/caixa'

const PAUSA_ANTES_DE_SALVAR = 800

/** Um passo do desfazer: o desenho inteiro num instante. */
type Instantaneo = { nodes: Node[]; edges: Edge[]; inicio: string }

/**
 * Quanto tempo de edição contínua cabe num passo só do desfazer.
 *
 * Meio segundo é a pausa de quem terminou uma palavra e pensou na próxima ,
 * curto o bastante para o `Ctrl+Z` não engolir um parágrafo inteiro, longo o
 * bastante para não voltar letra por letra.
 */
const JANELA_DE_DIGITACAO = 500

/** Quantos passos o desfazer guarda. Além disso é memória sem uso. */
const LIMITE_DO_HISTORICO = 60

/**
 * Quanto tempo o "bloco apagado, desfazer" fica na tela.
 *
 * Cinco segundos: tempo de ler a frase, perceber o engano e alcançar o botão,
 * sem virar moldura permanente. Abaixo de três, quem desviou o olhar perde a
 * chance; acima de dez, o aviso deixa de ser aviso.
 */
const SEGUNDOS_DO_DESFAZER = 5

/**
 * Estes três vivem fora do componente **de propósito**, e não é microotimização.
 *
 * O React Flow guarda cada uma destas props na store dele por identidade, e
 * repõe a store toda vez que a identidade muda. Escritos direto no JSX, eles
 * nasciam de novo a cada render do editor e enchiam a store de escrita inútil ,
 * que reacende todos os blocos e todas as linhas do desenho a cada tecla
 * digitada no painel. Era metade do "canvas travado".
 *
 * Ver também `aoMudarSelecao`, onde a mesma armadilha não era lentidão: era
 * laço infinito.
 */
const OPCOES_PADRAO_DA_ARESTA = { type: 'removivel' }
/**
 * Ctrl (ou ⌘) clicando junta blocos na seleção. O padrão do React Flow é ⌘
 * **só** no Mac, e aqui quem monta está no Windows: sem esta linha, "seleciona
 * vários com Ctrl" simplesmente não existia para ele.
 */
const TECLAS_DE_MULTISSELECAO = ['Control', 'Meta']

/** Todos os blocos do catálogo, na ordem dos grupos. O soltar confere contra ela. */
const TIPOS: TipoNo[] = GRUPOS_DE_BLOCOS.flatMap((grupo) => grupo.tipos)


/**
 * O que viaja no arrasto da barra de blocos até o desenho.
 *
 * Tipo próprio em vez de `text/plain`: qualquer texto arrastado de fora (uma
 * seleção de outra aba, um link) chega como `text/plain` e viraria bloco.
 */
const TIPO_ARRASTADO = 'application/autofluxos-bloco'

/**
 * O que o cursor carrega enquanto o bloco vem da barra para o desenho.
 *
 * O navegador, por padrão, arrasta uma foto do próprio botão do catálogo: o
 * item da lista, com descrição e tudo. Quem estava usando o editor via um
 * pedaço de lista voando e só descobria que aquilo era um bloco depois de
 * soltar. O gesto precisa mostrar o resultado enquanto acontece, então o
 * fantasma é o mesmo cartão que vai nascer: mesma largura, mesma borda por
 * tipo, mesmo cabeçalho com ícone e nome.
 *
 * O elemento precisa estar no documento e pintado na hora do `setDragImage`
 * (o navegador tira a foto ali e só ali), por isso ele entra fora da tela em
 * vez de escondido: `display:none` ou `opacity:0` saem em branco.
 */
function cartaoDoArrasto(tipo: TipoNo) {
  const fantasma = document.createElement('div')
  fantasma.className = `pointer-events-none absolute top-[-1000px] left-0 w-[248px] overflow-hidden rounded-xl border bg-panel text-xs shadow-[0_14px_34px_rgba(19,25,34,0.077)] ${CORES[tipo]}`

  const cabecalho = document.createElement('p')
  cabecalho.className =
    'flex h-[38px] items-center gap-2 border-b border-line px-3 text-[10px] font-bold tracking-[0.06em] text-muted uppercase'
  const icone = document.createElement('span')
  icone.className =
    'flex size-6 items-center justify-center rounded-[7px] bg-surface text-[13px] text-soft'
  icone.textContent = ICONES[tipo]
  cabecalho.append(icone, NOMES[tipo])

  const corpo = document.createElement('div')
  corpo.className = 'px-3 py-2.5 text-[11.5px] leading-[1.4] text-dim'
  corpo.textContent = DESCRICOES[tipo]

  fantasma.append(cabecalho, corpo)
  document.body.appendChild(fantasma)
  return fantasma
}

/** Como cada bloco nasce ao ser arrastado da barra. */
/**
 * Exportado para o teste, e o teste existe por um motivo concreto.
 *
 * Bloco recém-arrastado vive só na memória do navegador com o `data` que esta
 * função escreveu, o `default([])` do Zod só age quando o rascunho volta para
 * o banco. Um campo esquecido aqui é uma tela de erro para quem arrastar o
 * bloco, e nada no build, no typecheck ou nos testes de motor acusa.
 */
export function dadosPadrao(tipo: TipoNo): Record<string, unknown> {
  switch (tipo) {
    case 'mensagem':
      return { texto: 'Escreva a mensagem aqui.' }
    case 'midia':
      // Nasce sem URL de propósito: o validador recusa publicar assim, e é o
      // erro certo. Um endereço de exemplo que funcionasse viraria foto de
      // outro negócio no WhatsApp de um cliente.
      return { midia: 'imagem', url: '', legenda: '' }
    case 'pergunta':
      return { texto: 'O que você quer perguntar?', opcoes: [] }
    case 'condicao':
      return { variavel: 'assunto', operador: 'igual', valor: '' }
    case 'salvar-campo':
      return { campo: 'campo', valor: '' }
    case 'etapa':
      // Nasce sem etapa escolhida, e o validador recusa publicar assim. Chutar
      // a primeira etapa do primeiro quadro poria gente num funil que quem
      // desenhou não escolheu, e ninguém revisa o que já veio preenchido.
      return { quadroId: '', colunaId: '' }
    case 'etiqueta':
      // Nasce sem etiqueta, pelo mesmo motivo da etapa: uma etiqueta chutada
      // classificaria contato de verdade com um rótulo que ninguém escolheu.
      return { etiquetaId: '' }
    case 'nota':
      // Nasce vazia e o validador recusa publicar assim. Um texto de exemplo
      // que fosse publicado por engano escreveria a frase de exemplo na ficha
      // de gente de verdade, e a anotação é lida por quem vai atender.
      return { texto: '' }
    case 'ir-fluxo':
      // Nasce sem destino, pelo mesmo motivo da etapa: chutar a primeira
      // automação da lista mandaria conversa para um desenho que ninguém
      // escolheu, e o que já vem preenchido é o que ninguém revisa.
      return { fluxoId: '', rotulo: '' }
    case 'nps':
      // Nasce **pronta para publicar**, e é o único bloco assim. Os outros
      // nascem vazios porque um valor chutado viraria dado errado no contato de
      // alguém; aqui a pergunta do NPS é a mesma no mundo inteiro, é a régua,
      // não uma escolha, e quem quiser mudar a palavra muda. Nascer vazio
      // faria todo mundo digitar a mesma frase.
      //
      // Sem pergunta aberta: a pesquisa de uma pergunta só é a que as pessoas
      // terminam, e quem quiser o "por quê?" liga no painel.
      return {
        texto: 'De 0 a 10, o quanto você recomendaria a gente para um amigo?',
        perguntaAberta: '',
      }
    case 'ia':
      // `ferramentas` explícito, e não confiando no `.default([])` do Zod: o
      // bloco nasce **aqui**, no navegador, e só passa pelo schema quando o
      // rascunho é salvo. Entre o arrastar e o salvar, quem lê `data` lê o que
      // esta linha escreveu, e `undefined.some()` derruba o editor inteiro.
      return {
        instrucao: 'Responda a dúvida do cliente usando o contexto do negócio.',
        ferramentas: [],
      }
    case 'handoff':
      return {
        motivo: 'pedido pelo fluxo',
        mensagem: 'Vou te passar para um atendente. Só um instante!',
      }
    case 'http':
      // Nasce chamando o ViaCEP de verdade: dá para arrastar o bloco, abrir a
      // aba Testar e ver a integração funcionando antes de configurar nada.
      // É a demonstração de reunião pronta, e é o que prova a cadeia inteira.
      return {
        metodo: 'GET',
        url: 'https://viacep.com.br/ws/01310100/json/',
        cabecalhos: [],
        corpo: '',
        mapear: [{ variavel: 'cidade', caminho: 'localidade' }],
        aoFalhar: 'humano',
      }
    case 'voltar':
      /*
       * Nasce apontando para o início, e é a exceção consciente à regra dos
       * blocos acima.
       *
       * Etapa e ir-fluxo nascem vazios porque um destino chutado manda gente
       * para um funil ou um desenho que ninguém escolheu. Aqui não há chute: o
       * destino vazio **é** o início do fluxo, que é o "voltar ao menu" que
       * quem arrasta este bloco está procurando em nove de cada dez vezes.
       * Nascer já funcionando é o ponto, o bloco existe justamente porque a
       * alternativa era arrastar uma seta pela tela inteira.
       */
      return { destino: '', rotulo: '' }
  }
}

/**
 * Tira do React Flow só o que o motor entende.
 *
 * O React Flow carrega estado de interface junto do nó (`selected`, `dragging`,
 * `measured`). Nada disso pode ir para o banco nem para o motor, o que sai
 * daqui é o mesmo objeto que o webhook do WhatsApp vai executar.
 */
function paraFluxo(inicio: string, nodes: Node[], edges: Edge[]): Fluxo {
  return fluxoSchema.parse({
    inicio,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      // O desvio é a única coisa que a linha guarda em `data`, e ele precisa
      // sobreviver ao salvamento: sem isso, quem organizou as linhas perdia o
      // trabalho no próximo carregamento da página.
      desvio: (e.data as { desvio?: { x: number; y: number } } | undefined)?.desvio ?? null,
    })),
  })
}

/**
 * O caminho de volta: o desvio sai do fluxo e vira `data` da aresta.
 *
 * `data` é onde o React Flow deixa o que é do componente, e é de lá que
 * `ArestaRemovivel` lê. Aresta antiga não tem desvio nenhum, e continua no
 * caminho automático.
 */
function paraArestas(arestas: Fluxo['edges']): Edge[] {
  return arestas.map((e) => ({
    ...e,
    sourceHandle: e.sourceHandle ?? undefined,
    data: e.desvio ? { desvio: e.desvio } : undefined,
  })) as Edge[]
}

type AbaDoPainel = 'bloco' | 'testar' | 'antes'

const ROTULO_DA_ABA: Record<AbaDoPainel, string> = {
  bloco: 'Bloco',
  testar: 'Testar',
  antes: 'Antes de publicar',
}

export function Editor({
  fluxoId,
  clienteId,
  conexoes,
  lojaAtiva = false,
  politicasDaIa = {},
  etapas,
  etiquetas,
  equipe,
  horarioConfigurado,
  retomadaDaConta,
  fluxos,
  variaveisDaConta = [],
  canal,
  nome,
  clienteNome,
  voltarHref,
  inicial,
  publicadaInicial,
  versoesIniciais,
  iaHabilitada,
  entradaLigada = true,
  podeContratarIa,
  contextoNegocio,
  temContextoDeNegocio,
  respostasPorVariavel = {},
  origem = null,
  gatilhosDoFluxo = 0,
}: {
  fluxoId: string
  clienteId: string
  conexoes: ConexaoDoCliente[]
  /** A conta tem loja on-line ligada (0092). Libera as consultas de loja no bloco de IA. */
  lojaAtiva?: boolean
  /** A política desta conta para cada consulta que grava (A11). Sem linha, pede confirmação. */
  politicasDaIa?: Record<string, PoliticaDaIa>
  /** As etapas de quadro deste cliente, para o bloco de etapa (C1b). */
  etapas: EtapaDoCliente[]
  /** As etiquetas deste cliente, para o bloco de etiqueta (0044). */
  etiquetas: EtiquetaDoCliente[]
  /** Quem atende, para o handoff poder endereçar o aviso a uma pessoa. */
  equipe: MembroDoCliente[]
  /** A conta tem horário de atendimento? O bloco de handoff usa. */
  horarioConfigurado: boolean
  /**
   * O que a conta decidiu sobre conversa parada em atendimento humano.
   *
   * O bloco de handoff precisa **mostrar** esse valor, e não só herdá-lo: a
   * opção "usar o padrão da conta" sem dizer qual é o padrão faz a pessoa
   * abrir outra aba para descobrir o que ela acabou de escolher.
   */
  retomadaDaConta: ConfigDaConta
  /**
   * Quantas conversas já responderam cada variável, para o selo no bloco.
   *
   * Chega pronto do servidor porque o editor não fala com o banco, e opcional
   * porque a prévia do link compartilhado monta o mesmo desenho sem conta
   * nenhuma atrás.
   */
  respostasPorVariavel?: Record<string, number>
  /**
   * De onde a automação acabou de chegar (`?origem=`). Com valor, o painel abre
   * na aba "Antes de publicar" (A13).
   */
  origem?: OrigemDoFluxo | null
  /** Gatilhos desta conta que apontam para este fluxo. Só é lido com `origem`. */
  gatilhosDoFluxo?: number
  /** As automações desta conta, para o bloco "Ir para outra automação". */
  fluxos: FluxoDaConta[]
  /**
   * As variáveis que as **outras** automações desta conta guardam no contato.
   *
   * Elas sobrevivem à conversa, então um fluxo pode ler o que o outro escreveu.
   * Sem esta lista, o editor fingia que só existe o que este desenho cria.
   */
  variaveisDaConta?: string[]
  /** Por onde esta automação conversa (0037). Escolhido ao criar, não muda. */
  canal: CanalId
  nome: string
  clienteNome: string
  voltarHref: string
  inicial: Fluxo
  /** Etapa 2 é plano à parte: sem contratar, fluxo com nó de IA não publica. */
  iaHabilitada: boolean
  /**
   * A automação abre conversa nova (`flows.ativo`). Mora ao lado da publicação
   * no cabeçalho (A03): publicada e desligada é um estado real, e sem isto o
   * editor dizia "no ar" para quem tinha acabado de desligar.
   */
  entradaLigada?: boolean
  /**
   * Quem está olhando pode **contratar** a IA desta automação?
   *
   * Só a 4YU. Para a conta o contrato é estado, não interruptor, ver o
   * comentário no cabeçalho.
   */
  podeContratarIa: boolean
  /** O que o cliente escreveu sobre o negócio. É o escopo fechado da IA. */
  contextoNegocio: string
  /** Sem contexto escrito, bloco de IA não publica. Ver `contexto/page.tsx`. */
  temContextoDeNegocio: boolean
  /** `quando` já vem formatado do servidor, formatar data no cliente daria
   *  divergência de hidratação entre o fuso do servidor e o do navegador. */
  publicadaInicial: { id: string; versao: number; quando: string; grafo: Fluxo } | null
  /** Histórico completo, da mais nova para a mais antiga. */
  versoesIniciais: VersaoNaLista[]
}) {
  const [nodes, setNodes, aoMudarNos] = useNodesState<Node>(
    inicial.nodes.map((n) => ({ ...n, className: n.id === inicial.inicio ? 'no-inicio' : '' })),
  )
  const [edges, setEdges, aoMudarArestas] = useEdgesState<Edge>(paraArestas(inicial.edges))
  const [inicio, setInicio] = useState(inicial.inicio)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  /**
   * Todos os blocos da seleção, não só o primeiro.
   *
   * O painel da direita continua sendo de um bloco, editar cinco perguntas
   * diferentes num formulário só não quer dizer nada. O que a seleção múltipla
   * serve é para a **ação em lote**, que é sempre a mesma decisão repetida.
   */
  const [selecionados, setSelecionados] = useState<string[]>([])
  /** Qual bloco a última seleção apontava, ver `onSelectionChange`. */
  const ultimoSelecionado = useRef<string | null>(null)
  const [aba, setAba] = useState<AbaDoPainel>(origem ? 'antes' : 'bloco')
  const [painelAberto, setPainelAberto] = useState(true)
  /**
   * No celular a barra de blocos é uma gaveta, aberta pelo "+ Bloco" do
   * desenho. Fixa ao lado, ela e o painel somavam mais que a tela e o editor
   * inteiro rolava de lado (Fase 12). No computador este estado não aparece.
   */
  const [blocosNoCelular, setBlocosNoCelular] = useState(false)
  // No celular o painel aberto cobre o desenho: começa fechado lá.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a largura da tela só existe depois de montar
    if (window.matchMedia('(max-width: 767px)').matches) setPainelAberto(false)
  }, [])
  const [buscaDeBloco, setBuscaDeBloco] = useState('')
  const catalogo = useMemo(() => filtrarCatalogo(buscaDeBloco), [buscaDeBloco])

  // A largura da barra de blocos, lembrada no navegador de quem usa.
  const [larguraDosBlocos, mudarLarguraDosBlocos] = useLarguraGuardada(
    CHAVE_DA_LARGURA,
    LARGURA_PADRAO_DOS_BLOCOS,
    LARGURA_MINIMA_DOS_BLOCOS,
    LARGURA_MAXIMA_DOS_BLOCOS,
  )
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'pendente' | 'erro'>('salvo')
  /**
   * Quando o último salvamento automático deu certo (A07). "salvo" sozinho não
   * dizia se era de agora ou de meia hora atrás, antes da rede cair.
   */
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  /** Muda para forçar o salvamento de novo depois de um erro ("Tentar de novo"). */
  const [tentativa, setTentativa] = useState(0)
  const { confirmar: confirmarPublicacao, dialogo: dialogoDePublicacao } = useConfirmar()
  const [publicada, setPublicada] = useState(publicadaInicial)
  const [versoes, setVersoes] = useState(versoesIniciais)
  /** Id da versão sendo republicada, para a linha dela mostrar o progresso. */
  const [voltando, setVoltando] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  /** Descarte pedido, esperando confirmação. Ver `descartar()`. */
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [errosDePublicacao, setErrosDePublicacao] = useState<Problema[] | null>(null)
  /** Versão que acabou de ir ao ar. Some sozinha, aviso fixo para de ser lido. */
  const [publicadoAgora, setPublicadoAgora] = useState<number | null>(null)
  /** Rollback recém-feito. O aviso precisa dizer de onde veio, não só o número. */
  const [voltouDe, setVoltouDe] = useState<{ antiga: number; nova: number } | null>(null)
  const [comIa, setComIa] = useState(iaHabilitada)
  const [tela, setTela] = useState<ReactFlowInstance | null>(null)
  /*
   * O tema, lido do atributo no `<html>`. `usePreferencia` usa
   * `useSyncExternalStore`, então trocar de tema repinta o canvas na hora, sem
   * recarregar a página.
   */
  const temaEscuro = usePreferencia('tema')

  /*
   * A prévia do bloco no passar do mouse.
   *
   * O atraso não é enfeite: sem ele, atravessar o desenho com o mouse abre e
   * fecha meia dúzia de painéis, e o que era leitura vira pisca-pisca. Some no
   * primeiro sinal de que a pessoa parou de ler e voltou a desenhar, arrastar
   * o bloco, mexer na tela, ou tirar o mouse de cima.
   */
  const [previa, setPrevia] = useState<{ no: No; x: number; y: number } | null>(null)
  const relogioDaPrevia = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fecharPrevia = useCallback(() => {
    if (relogioDaPrevia.current) clearTimeout(relogioDaPrevia.current)
    relogioDaPrevia.current = null
    setPrevia(null)
  }, [])

  /**
   * A seleção mudou no desenho.
   *
   * **Esta função precisa ser estável, e a lista precisa parar quando não muda.
   * As duas coisas, ou o editor entra em laço infinito e cai na tela de erro.**
   *
   * O React Flow escuta a seleção num efeito com `[selectedNodes, selectedEdges,
   * onSelectionChange]` nas dependências. Escrita direto no JSX, a função nasce
   * de novo a cada render, então o efeito dispara a cada render. Enquanto ela só
   * gravava um `id` (string), isso passava despercebido: o React compara, vê o
   * mesmo valor e para. Quando entrou a seleção múltipla, ela passou a gravar
   * uma **lista nova**: array novo é sempre "valor diferente", então o render
   * chamava o efeito, o efeito trocava o estado, a troca causava outro render, e
   * assim até o React desistir com "Maximum update depth exceeded" (erro 185) e
   * derrubar o editor inteiro.
   *
   * `useCallback` sem dependências corta o gatilho; o `atuais.every` corta o
   * combustível. Um dos dois já resolveria hoje, os dois juntos resolvem também
   * o dia em que alguém precisar pôr uma dependência aqui.
   */
  const aoMudarSelecao = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    const id = sel[0]?.id ?? null
    const ids = sel.map((n) => n.id)
    setSelecionado(id)
    setSelecionados((atuais) =>
      atuais.length === ids.length && atuais.every((v, i) => v === ids[i]) ? atuais : ids,
    )
    // Trocar de bloco leva para a aba "Bloco", porque é o que a pessoa quer ver
    // ao clicar num bloco diferente.
    //
    // **Só quando o bloco muda de verdade.** O React Flow redispara este evento
    // com a mesma seleção, inclusive no render causado por clicar na aba
    // "Testar", e aí o `setAba` daqui roda no mesmo lote e vence o do clique. O
    // efeito para quem usa: com um bloco selecionado (que é o estado normal de
    // quem está desenhando) a aba "Testar" simplesmente não abria, sem nem
    // piscar. Parecia botão quebrado.
    if (id && id !== ultimoSelecionado.current) setAba('bloco')
    ultimoSelecionado.current = id
  }, [])

  /** Mexer na tela ou arrastar um bloco fecha o menu e a prévia. Ver o JSX. */
  const largarOFlutuante = useCallback(() => {
    setMenu(null)
    fecharPrevia()
  }, [fecharPrevia])
  /**
   * O menu do botão direito: em qual bloco (ou ligação) ele abriu e onde.
   *
   * `x`/`y` são medidos **dentro da área de desenho**, não na janela: o menu é
   * desenhado dentro dela para poder ser recortado por ela, e coordenada de
   * janela colocaria o menu deslocado da largura da barra de blocos.
   */
  const [menu, setMenu] = useState<MenuAberto | null>(null)
  /** Bloco que o clique em "apagar" está esperando confirmar. Ver `apagar()`. */
  const [aApagar, setAApagar] = useState<string | null>(null)
  /** O último bloco apagado, para poder devolver. Ver `apagar()`. */
  const [desfazer, setDesfazer] = useState<{ no: Node; edges: Edge[]; eraInicio: boolean } | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  /**
   * O histórico do `Ctrl+Z`: cada passo é o desenho inteiro (blocos, ligações e
   * qual é o início).
   *
   * Guardar o desenho inteiro, e não o "que mudou", é escolha deliberada: um
   * fluxo grande dá uns 50 KB em memória, e a alternativa, um passo por tipo
   * de ação, é a estrutura que erra justamente nas combinações raras
   * (duplicar, mudar o início e apagar na mesma sequência). Aqui todo passo
   * volta pelo mesmo caminho, então não existe ação "que o desfazer não cobre".
   *
   * Vive em `useRef` porque nada na tela lê o histórico: ele só é consultado no
   * instante da tecla, e guardá-lo em `useState` faria a digitação re-renderizar
   * o editor a cada passo registrado.
   */
  const historico = useRef<Instantaneo[]>([])
  const futuro = useRef<Instantaneo[]>([])
  const agoraNoEditor = useRef<Instantaneo>({ nodes, edges, inicio })
  /** Marca que a mudança veio do próprio desfazer, ela não vira passo novo. */
  const vindoDoHistorico = useRef(false)
  /** Quando o último passo foi registrado, para juntar a digitação num só. */
  const ultimoPasso = useRef(0)

  const fluxo = useMemo(() => paraFluxo(inicio, nodes, edges), [inicio, nodes, edges])
  const idsDeConexao = useMemo(() => conexoes.map((c) => c.id), [conexoes])
  const idsDeEtapa = useMemo(() => etapas.map((e) => e.colunaId), [etapas])
  const idsDeEtiqueta = useMemo(() => etiquetas.map((e) => e.id), [etiquetas])
  const nomesDeEtiqueta = useMemo(
    () => Object.fromEntries(etiquetas.map((e) => [e.id, e.nome])),
    [etiquetas],
  )
  const validacao = useMemo(
    () => {
      const doDesenho = validar(fluxo, {
        iaHabilitada: comIa,
        conexoes: idsDeConexao,
        temContextoDeNegocio,
        fluxos,
        fluxoAtualId: fluxoId,
        variaveisDaConta,
        // Os mesmos ids que o servidor confere ao publicar: sem eles, uma
        // etiqueta de outra conta (fluxo importado) só aparecia na recusa.
        etapas: idsDeEtapa,
        etiquetas: idsDeEtiqueta,
        // O aviso tem que chegar enquanto a pessoa desenha, e não na publicação:
        // descobrir na hora de publicar que a lista não cabe é refazer o menu.
        canal,
      })

      /*
       * As duas conferências juntas, e o motivo de juntá-las **aqui** (T7.2).
       *
       * `validarPublicacao` é o portão do servidor (RB-45), e o servidor é quem
       * decide. Mas quem desabilita o botão Publicar é esta variável: gatear só
       * no servidor deixaria o botão aceso, e o clique falharia com uma lista de
       * erros que a pessoa não tinha como prever. Botão que parece pronto e
       * recusa é pior do que botão desabilitado com o motivo à vista.
       *
       * **`temEntrada` não entra aqui**, e é deliberado: quem sabe disso é o
       * banco, e o editor não vai perguntar a cada tecla. O aviso de "bot sem
       * entrada" aparece na publicação, que é o momento em que ele importa.
       */
      const daPublicacao = validarPublicacao(fluxo)

      return {
        ok: doDesenho.ok && daPublicacao.ok,
        erros: [...doDesenho.erros, ...daPublicacao.erros],
        avisos: [...doDesenho.avisos, ...daPublicacao.avisos],
      }
    },
    [fluxo, comIa, idsDeConexao, idsDeEtapa, idsDeEtiqueta, temContextoDeNegocio, fluxos, fluxoId, variaveisDaConta, canal],
  )

  const itensAntes = useMemo(
    () =>
      origem
        ? antesDePublicar({
            origem,
            fluxo,
            canal,
            iaHabilitada: comIa,
            entradaLigada,
            problemas: [...validacao.erros, ...validacao.avisos],
            gatilhos: gatilhosDoFluxo,
          })
        : [],
    [origem, fluxo, canal, comIa, entradaLigada, validacao, gatilhosDoFluxo],
  )
  const faltamAntes = itensAntes.filter((item) => item.estado === 'pendente').length
  const abas: AbaDoPainel[] = origem ? ['bloco', 'testar', 'antes'] : ['bloco', 'testar']

  const assinatura = JSON.stringify(fluxo)
  const assinaturaSalva = useRef(assinatura)

  /**
   * Registra um passo sempre que o desenho muda.
   *
   * Pendura em `assinatura`, a mesma string que decide salvar e publicar ,
   * porque ela já ignora o que é só interface: selecionar um bloco ou arrastar
   * a tela não vira passo de desfazer, e arrastar um bloco vira.
   *
   * **Digitação vira um passo só.** Sem a janela de coalescência, `Ctrl+Z`
   * depois de escrever uma frase apagaria uma letra por vez, que é o desfazer
   * que ninguém quer. Mudança de forma (bloco ou ligação a mais/a menos) sempre
   * abre passo novo, porque apagar uma linha e digitar não são a mesma edição.
   */
  useEffect(() => {
    const atual: Instantaneo = { nodes, edges, inicio }

    if (vindoDoHistorico.current) {
      vindoDoHistorico.current = false
      agoraNoEditor.current = atual
      return
    }

    const anterior = agoraNoEditor.current
    const mesmaForma =
      anterior.nodes.length === nodes.length && anterior.edges.length === edges.length
    const agora = Date.now()

    if (!mesmaForma || agora - ultimoPasso.current > JANELA_DE_DIGITACAO) {
      historico.current = [...historico.current, anterior].slice(-LIMITE_DO_HISTORICO)
      // Editar depois de desfazer corta o futuro: o caminho que existia dali
      // para frente não existe mais, e oferecer "refazer" para ele devolveria
      // um desenho que nunca foi o desta linha do tempo.
      futuro.current = []
      ultimoPasso.current = agora
    }

    agoraNoEditor.current = atual
    // `assinatura` é o gatilho; os três valores são lidos dela, não observados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  // Normaliza o publicado pelo mesmo caminho do rascunho, senão a comparação
  // pegaria diferença de ordem de chave em vez de diferença de conteúdo.
  const assinaturaPublicada = useMemo(
    () => (publicada ? JSON.stringify(fluxoSchema.parse(publicada.grafo)) : null),
    [publicada],
  )
  const haNovidade = assinatura !== assinaturaPublicada
  /** A versão que nasce no próximo Publicar (A07): a maior que já existiu, mais um. */
  const proximaVersao = versoes.reduce((maior, v) => Math.max(maior, v.versao), 0) + 1

  // Salva sozinho depois de uma pausa. Rascunho incompleto pode ser salvo ,
  // quem barra a publicação é o validador, não o salvamento.
  useEffect(() => {
    if (assinatura === assinaturaSalva.current) return
    setSalvamento('pendente')

    const relogio = setTimeout(async () => {
      setSalvamento('salvando')
      const congelado = assinatura
      try {
        const r = await acaoSalvarRascunho(fluxoId, clienteId, JSON.parse(congelado))
        if (r.ok) {
          assinaturaSalva.current = congelado
          setSalvoEm(new Date())
          setSalvamento(congelado === assinatura ? 'salvo' : 'pendente')
        } else {
          setSalvamento('erro')
        }
      } catch {
        setSalvamento('erro')
      }
    }, PAUSA_ANTES_DE_SALVAR)

    return () => clearTimeout(relogio)
  }, [assinatura, clienteId, fluxoId, tentativa])

  // Avisa antes de fechar a aba com coisa por salvar.
  useEffect(() => {
    if (salvamento === 'salvo') return
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [salvamento])

  const aoConectar = useCallback(
    (conexao: Connection) => {
      setEdges((atuais) => {
        // Uma saída leva a um lugar só. O motor pega a primeira aresta que
        // encontra, então duas saindo da mesma alça seriam ambiguidade
        // silenciosa, some com a antiga em vez de deixar as duas.
        const limpas = atuais.filter(
          (e) => !(e.source === conexao.source && e.sourceHandle === conexao.sourceHandle),
        )
        return addEdge(conexao, limpas)
      })
    },
    [setEdges],
  )

  /**
   * Seleciona um bloco **e traz ele para a vista**.
   *
   * Selecionar sozinho não bastava: um impedimento que aponta para um bloco fora
   * da tela trocava o painel e mais nada, e o clique parecia não ter funcionado.
   */
  const focar = useCallback(
    (noId: string) => {
      setSelecionado(noId)
      setAba('bloco')
      setNodes((atuais) => atuais.map((n) => ({ ...n, selected: n.id === noId })))
      tela?.fitView({ nodes: [{ id: noId }], duration: 400, maxZoom: 1.2 })
    },
    [setNodes, tela],
  )

  /**
   * Arruma o desenho: blocos em colunas, da entrada para a saída.
   *
   * Fluxo grande desenhado à mão vira teia, e teia não se lê: ninguém acha
   * para onde cai a terceira opção de uma pergunta. A conta mora em
   * `organizar.ts`; daqui sai só a troca de posição, que o salvamento
   * automático grava e o `Ctrl+Z` desfaz como qualquer outra edição.
   *
   * A altura usada é a **medida** pelo React Flow (`measured`), não uma
   * constante: bloco de mensagem com três linhas e bloco de pergunta com seis
   * opções têm alturas muito diferentes, e empilhar pela constante deixaria os
   * grandes se cobrindo.
   */
  const arrumar = useCallback(() => {
    /*
     * Onde cada alça está, medido pelo React Flow depois de pintar.
     *
     * É o que deixa o filho do "verdadeiro" na linha do "verdadeiro": a opção
     * de uma pergunta com texto de duas linhas fica mais baixa que a conta
     * "uma linha por saída" daria, e só a medida acerta.
     */
    const alcas = new Map<string, AlcasDoBloco>()
    for (const n of nodes) {
      const limites = tela?.getInternalNode(n.id)?.internals.handleBounds
      if (!limites) continue
      const centro = (a: { y: number; height: number }) => a.y + a.height / 2
      alcas.set(n.id, {
        saidas: new Map((limites.source ?? []).map((a) => [a.id ?? '', centro(a)])),
        entrada: limites.target?.[0] ? centro(limites.target[0]) : null,
      })
    }
    const { posicoes, curvas } = organizar(nodes, edges, inicio, alcas)
    setNodes((atuais) =>
      atuais.map((n) => ({ ...n, position: posicoes.get(n.id) ?? n.position })),
    )
    /*
     * As linhas recebem o caminho que o arrumador reservou para elas.
     *
     * É a metade que faltava. Arrumar só os blocos deixava o fio que pula
     * colunas viajar em diagonal por trás de tudo, e o desenho continuava
     * emaranhado com os cartões perfeitamente alinhados , que era exatamente a
     * reclamação. Os `pontos` são os corredores calculados junto com as
     * colunas; ver a fase 3 em `organizar.ts`.
     *
     * E o desvio à mão vai embora: ele é desvio de um caminho que não existe
     * mais, e uma linha presa à altura antiga passaria por cima dos blocos
     * justamente depois do gesto que serve para desembaraçar o desenho.
     */
    setEdges((atuais) =>
      atuais.map((e) => {
        const pontos = curvas.get(e.id)
        if (pontos) return { ...e, data: { pontos } }
        return e.data ? { ...e, data: undefined } : e
      }),
    )
    // Depois do próximo desenho: o enquadramento só faz sentido com as posições
    // novas já aplicadas.
    setTimeout(() => tela?.fitView({ duration: 500, padding: 0.15 }), 0)
  }, [edges, inicio, nodes, setEdges, setNodes, tela])

  /**
   * Bloco arrastado à mão perde os corredores das linhas dele.
   *
   * O corredor foi calculado para o lugar onde o bloco estava. Movido o bloco,
   * o fio continuaria descendo até a altura antiga antes de voltar , um ângulo
   * que não quer dizer nada. Sem corredor a linha volta à curva simples, que
   * sempre acompanha as duas pontas. Arrumar de novo devolve os corredores.
   */
  const largarCorredores = useCallback(
    (movidos: { id: string }[]) => {
      const ids = new Set(movidos.map((n) => n.id))
      setEdges((atuais) =>
        atuais.map((e) =>
          e.data?.pontos && (ids.has(e.source) || ids.has(e.target))
            ? { ...e, data: undefined }
            : e,
        ),
      )
    },
    [setEdges],
  )

  /**
   * Põe um bloco novo no desenho, já selecionado.
   *
   * `posicao` é o canto do bloco em coordenadas do fluxo. Quem chama decide
   * onde: o clique manda o centro da tela, o arrasto manda onde a pessoa
   * soltou.
   */
  function criarNo(tipo: TipoNo, posicao: { x: number; y: number }) {
    const id = crypto.randomUUID().slice(0, 8)

    setNodes((atuais) => [
      ...atuais.map((n) => ({ ...n, selected: false })),
      { id, type: tipo, position: posicao, data: dadosPadrao(tipo), selected: true },
    ])
    setSelecionado(id)
    setAba('bloco')
  }

  /** Menos metade do bloco: senão ele nasce com o canto no ponto, não o meio. */
  const centralizar = (p: { x: number; y: number }) => ({ x: p.x - LARGURA_NO / 2, y: p.y - 40 })

  function adicionar(tipo: TipoNo) {
    // Nasce no meio de onde a pessoa está olhando. Posição fixa colocava o
    // bloco fora da tela assim que alguém arrastasse o desenho para o lado ,
    // aparecia a mensagem "adicionado" e nada na tela.
    const area = areaRef.current?.getBoundingClientRect()
    const centro =
      tela && area
        ? tela.screenToFlowPosition({ x: area.x + area.width / 2, y: area.y + area.height / 2 })
        : { x: 80 + nodes.length * 24, y: 80 + nodes.length * 40 }

    criarNo(tipo, livre(centralizar(centro), nodes))
    setBlocosNoCelular(false)
  }

  /**
   * Soltar um bloco no desenho.
   *
   * Aqui **não** passa pelo `livre()`: quem arrastou escolheu o lugar, e
   * empurrar o bloco para outro ponto "porque estava ocupado" seria desobedecer
   * a única coisa que o gesto queria dizer. Sobrepor arrastando é problema de
   * quem arrastou, e se resolve arrastando de novo.
   */
  function soltar(evento: ReactDragEvent<HTMLDivElement>) {
    evento.preventDefault()
    const tipo = evento.dataTransfer.getData(TIPO_ARRASTADO) as TipoNo
    if (!tipo || !TIPOS.includes(tipo) || !tela) return

    criarNo(tipo, centralizar(tela.screenToFlowPosition({ x: evento.clientX, y: evento.clientY })))
  }

  /**
   * A mesma decisão de ritmo aplicada em todos os blocos selecionados.
   *
   * Passa pela regra pura (`aplicarAtrasoEmLote`) porque quem decide o que é
   * bloco que fala é o `core/`, não a tela, e o salvamento e o desfazer já
   * pegam a mudança sozinhos, pelo efeito que observa `nodes`.
   */
  function aplicarAtrasoNoLote(segundos: number) {
    setNodes(
      (atuais) =>
        aplicarAtrasoEmLote(
          atuais as unknown as { id: string; type?: string; data: Record<string, unknown> }[],
          selecionados,
          segundos,
        ).blocos as unknown as Node[],
    )
  }

  function mudarDados(dados: Record<string, unknown>) {
    setNodes((atuais) =>
      atuais.map((n) => (n.id === selecionado ? { ...n, data: { ...n.data, ...dados } } : n)),
    )
  }

  /**
   * Apagar um bloco leva as ligações dele junto, e o rascunho é salvo sozinho
   * 800ms depois, sem desfazer, um clique errado custava o trabalho de religar
   * tudo à mão. Guarda o que sumiu para poder devolver.
   *
   * Um passo só, de propósito: pilha de desfazer é outra coisa (mexe em mover,
   * digitar, ligar) e prometer meia pilha é pior do que prometer um passo.
   */
  function apagar(noId: string) {
    const no = nodes.find((n) => n.id === noId)
    if (!no) return

    const ligacoes = edges.filter((e) => e.source === noId || e.target === noId)
    setDesfazer({ no, edges: ligacoes, eraInicio: inicio === noId })

    setNodes((atuais) => atuais.filter((n) => n.id !== noId))
    setEdges((atuais) => atuais.filter((e) => e.source !== noId && e.target !== noId))
    if (selecionado === noId) setSelecionado(null)
    setAApagar(null)
  }

  /**
   * Copia um bloco ao lado, com o conteúdo inteiro e **sem as ligações**.
   *
   * Sem ligação de propósito: uma saída leva a um lugar só (ver `aoConectar`),
   * então herdar as arestas do original faria a cópia roubar o destino dele ,
   * duplicar quebraria o fluxo que já estava desenhado. Quem duplicou liga a
   * cópia onde quiser.
   *
   * `structuredClone` porque `data` tem lista dentro (as opções da pergunta, a
   * pilha da mensagem): cópia rasa deixaria as duas caixas mexendo no mesmo
   * array, e editar a cópia mudaria o original.
   */
  function duplicar(noId: string) {
    const no = nodes.find((n) => n.id === noId)
    if (!no) return

    const id = crypto.randomUUID().slice(0, 8)
    const posicao = livre({ x: no.position.x + LARGURA_NO + 28, y: no.position.y }, nodes)

    setNodes((atuais) => [
      ...atuais.map((n) => ({ ...n, selected: false })),
      {
        ...no,
        id,
        position: posicao,
        data: structuredClone(no.data),
        selected: true,
        // O realce de início é do bloco inicial, e o fluxo só tem um. A cópia
        // nasce como bloco comum.
        className: '',
      },
    ])
    setSelecionado(id)
    setAba('bloco')
  }

  /**
   * Volta um passo, o `Ctrl+Z`.
   *
   * Devolve o desenho inteiro, então serve igual para apagar uma linha, mover
   * um bloco, duplicar, trocar o início ou editar um texto. O aviso de "bloco
   * apagado" sai da tela junto: ele fala de um passo que acabou de ser
   * desfeito, e um botão "Desfazer" apontando para o que já voltou é armadilha.
   */
  function voltarUmPasso() {
    const anterior = historico.current.pop()
    if (!anterior) return
    futuro.current = [...futuro.current, agoraNoEditor.current]
    aplicarInstantaneo(anterior)
  }

  /** Refaz o que o `Ctrl+Z` desfez, `Ctrl+Shift+Z` ou `Ctrl+Y`. */
  function refazerUmPasso() {
    const proximo = futuro.current.pop()
    if (!proximo) return
    historico.current = [...historico.current, agoraNoEditor.current]
    aplicarInstantaneo(proximo)
  }

  function aplicarInstantaneo(passo: Instantaneo) {
    vindoDoHistorico.current = true
    setNodes(passo.nodes)
    setEdges(passo.edges)
    setInicio(passo.inicio)
    setSelecionado(passo.nodes.find((n) => n.selected)?.id ?? null)
    setDesfazer(null)
    setMenu(null)
    setAApagar(null)
  }

  /**
   * O clique em "apagar" pergunta antes; a tecla `Delete` não.
   *
   * O botão é alcançável por engano, ele fica a poucos pixels do cabeçalho que
   * a pessoa usa para arrastar o bloco, e apagar leva as ligações junto. A
   * tecla é deliberada e continua instantânea: para ela o desfazer de cinco
   * segundos já é a rede.
   */
  function pedirParaApagar(noId: string) {
    setAApagar(noId)
  }

  /**
   * Abre o menu do botão direito em cima do bloco (ou da ligação) clicado.
   *
   * O alvo é **selecionado junto**: sem isso o menu falaria de um bloco e o
   * painel da direita mostraria outro, e "Editar" pareceria ter aberto a coisa
   * errada.
   */
  function abrirMenu(
    evento: ReactMouseEvent,
    alvo: 'no' | 'aresta',
    id: string,
  ) {
    evento.preventDefault()
    const area = areaRef.current?.getBoundingClientRect()
    const x = evento.clientX - (area?.left ?? 0)
    const y = evento.clientY - (area?.top ?? 0)

    // Clique perto da borda: o menu abre para o outro lado em vez de nascer
    // metade fora da área, com o último item inalcançável.
    setMenu({
      alvo,
      id,
      x,
      y,
      paraEsquerda: !!area && x + LARGURA_MENU > area.width,
      paraCima: !!area && y + ALTURA_MENU > area.height,
    })
    if (alvo === 'no') editarNo(id)
  }

  /** Seleciona o bloco e abre o painel da direita nele. */
  function editarNo(noId: string) {
    setNodes((atuais) => atuais.map((n) => ({ ...n, selected: n.id === noId })))
    setSelecionado(noId)
    setAba('bloco')
  }

  /**
   * Apaga uma ligação, e só ela.
   *
   * Sem confirmação, ao contrário do bloco: uma linha some e se refaz
   * arrastando de novo em dois segundos, enquanto um bloco leva o conteúdo
   * escrito junto. Perguntar aqui seria pedágio em cima de um gesto barato.
   */
  function apagarAresta(arestaId: string) {
    setEdges((atuais) => atuais.filter((e) => e.id !== arestaId))
  }

  /**
   * Guarda (ou tira) o desvio de uma ligação puxada à mão.
   *
   * `null` devolve a linha ao caminho automático, o que os dois cliques em cima
   * dela fazem. O desvio entra no mesmo estado das outras edições, então o
   * salvamento automático grava e o `Ctrl+Z` desfaz como qualquer outra.
   */
  const desviarAresta = useCallback(
    (arestaId: string, desvio: { x: number; y: number } | null) => {
      setEdges((atuais) =>
        atuais.map((e) => {
          if (e.id !== arestaId) return e
          if (desvio) return { ...e, data: { ...e.data, desvio } }
          // Tirar o desvio devolve a linha ao caminho calculado, e o calculado
          // pode ser o corredor do arrumador. Zerar `data` inteiro aqui jogava
          // o corredor fora junto e a linha caía na curva simples , o desenho
          // desarrumava sozinho a cada dois cliques.
          const { desvio: _descartado, ...resto } = e.data ?? {}
          return { ...e, data: Object.keys(resto).length > 0 ? resto : undefined }
        }),
      )
    },
    [setEdges],
  )

  /**
   * O provider recebe um objeto, e ele precisa ser o mesmo entre desenhos: um
   * objeto novo a cada render redesenharia todas as linhas a cada tecla
   * digitada no painel.
   */
  const acoesDaAresta = useMemo(
    () => ({ apagar: apagarAresta, desviar: desviarAresta }),
    // `apagarAresta` só fecha sobre `setEdges`, que é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [desviarAresta],
  )

  /**
   * O aviso de "bloco apagado" some sozinho depois de alguns segundos.
   *
   * Ele ficava pendurado até alguém apagar outro bloco ou clicar em Desfazer, e
   * aviso que fica é aviso que para de ser lido, some do campo de atenção e
   * vira parte do layout. O prazo é o do desfazer: passou, a decisão está
   * tomada.
   *
   * O relógio reinicia a cada bloco apagado porque `desfazer` muda de objeto ,
   * quem apaga três seguidos ganha os segundos contados do último, que é o
   * único que ainda dá para devolver.
   */
  useEffect(() => {
    if (!desfazer) return
    const relogio = window.setTimeout(() => setDesfazer(null), SEGUNDOS_DO_DESFAZER * 1000)
    return () => window.clearTimeout(relogio)
  }, [desfazer])

  /**
   * `Delete` e `Backspace` apagam o bloco selecionado.
   *
   * É o gesto que todo editor de diagrama tem, e a falta dele obrigava a ir até
   * o botão do painel para cada bloco.
   *
   * **Só quando o foco não está num campo.** Sem essa guarda, apagar uma letra
   * no texto da mensagem apagaria o bloco inteiro assim que o campo ficasse
   * vazio, e `Backspace` num campo vazio é exatamente o que acontece o tempo
   * todo enquanto alguém escreve.
   */
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement | null
      const digitando =
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLTextAreaElement ||
        alvo instanceof HTMLSelectElement ||
        alvo?.isContentEditable === true

      /**
       * `Ctrl+Z` vale **também dentro dos campos**, e é o oposto do que parece.
       *
       * A primeira versão deixava a tecla passar para o navegador quando o foco
       * estava num campo, supondo que ele desfaria a digitação. Ele não desfaz:
       * todo campo aqui é controlado pelo React, e a pilha nativa de desfazer
       * não sobrevive ao valor ser reescrito a cada tecla. O efeito real era
       * `Ctrl+Z` não fazer **nada** enquanto se escreve, que foi exatamente a
       * reclamação.
       *
       * O histórico daqui cobre o caso: ele guarda o desenho inteiro, e o texto
       * dos blocos está dentro dele. A janela de coalescência faz um passo por
       * rajada de digitação, então voltar apaga a última frase escrita, e não a
       * última letra.
       */
      const atalho = evento.ctrlKey || evento.metaKey
      if (atalho) {
        const tecla = evento.key.toLowerCase()
        if (tecla === 'z') {
          evento.preventDefault()
          if (evento.shiftKey) refazerUmPasso()
          else voltarUmPasso()
          return
        }
        if (tecla === 'y') {
          evento.preventDefault()
          refazerUmPasso()
          return
        }
      }

      if (evento.key !== 'Delete' && evento.key !== 'Backspace') return
      if (digitando) return

      // A linha selecionada também morre pela tecla. Ela vem antes do bloco
      // porque selecionar uma aresta não desmarca o bloco no React Flow: sem
      // esta ordem, `Delete` em cima de uma linha apagaria o bloco de antes.
      const arestasEscolhidas = edges.filter((e) => e.selected)
      if (arestasEscolhidas.length > 0) {
        evento.preventDefault()
        const ids = new Set(arestasEscolhidas.map((e) => e.id))
        setEdges((atuais) => atuais.filter((e) => !ids.has(e.id)))
        return
      }

      // Sem bloco escolhido não há o que apagar, e `Backspace` fora de campo é
      // "voltar" em alguns navegadores, deixar passar seria sair do editor.
      if (!selecionado) return

      evento.preventDefault()
      apagar(selecionado)
    }

    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  /**
   * O menu fecha em qualquer clique e no `Esc`.
   *
   * O listener na janela roda **depois** do `onClick` do item, porque o React
   * trata o clique na raiz da aplicação e só então ele chega em `window`. Ou
   * seja: a ação acontece e o menu fecha em seguida, na ordem certa. Não fecha
   * no `contextmenu`, que é o evento que abriu o menu.
   */
  useEffect(() => {
    if (!menu) return
    const fechar = () => setMenu(null)
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', fechar)
    window.addEventListener('keydown', aoTeclar)
    return () => {
      window.removeEventListener('click', fechar)
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [menu])

  function desfazerApagar() {
    if (!desfazer) return
    const { no, edges: ligacoes, eraInicio } = desfazer

    setNodes((atuais) => [...atuais.map((n) => ({ ...n, selected: false })), { ...no, selected: true }])
    setEdges((atuais) => [...atuais, ...ligacoes])
    // O nó de início some junto quando é ele que é apagado; devolver o bloco
    // sem devolver isso deixaria o fluxo apontando para um início que não é
    // mais o que a pessoa tinha escolhido.
    if (eraInicio) setInicio(no.id)
    setSelecionado(no.id)
    setAba('bloco')
    setDesfazer(null)
  }

  /**
   * Joga o rascunho fora e volta ao desenho que está no ar.
   *
   * **Aplicado pelo caminho normal, e não pelo do desfazer**: assim a troca
   * entra no histórico do `Ctrl+Z`, e quem descartar por engano volta com uma
   * tecla. Um descarte que não dá para desfazer é exatamente o tipo de botão
   * que ninguém clica com confiança.
   *
   * Não republica nada. O que está no ar continua como está, o que muda é só
   * o desenho de trabalho.
   */
  async function descartar() {
    setDescartando(true)
    setErrosDePublicacao(null)
    try {
      const r = await acaoDescartarRascunho(fluxoId, clienteId)
      if (!r.ok) {
        setErrosDePublicacao([{ codigo: 'DESCARTE', mensagem: r.erro }])
        return
      }

      assinaturaSalva.current = JSON.stringify(r.grafo)
      setNodes(
        r.grafo.nodes.map((n) => ({ ...n, className: n.id === r.grafo.inicio ? 'no-inicio' : '' })),
      )
      setEdges(paraArestas(r.grafo.edges))
      setInicio(r.grafo.inicio)
      setSelecionado(null)
      setSalvamento('salvo')
    } catch {
      setErrosDePublicacao([
        { codigo: 'DESCARTE', mensagem: 'Não deu para descartar. Tente de novo.' },
      ])
    } finally {
      setDescartando(false)
      setConfirmandoDescarte(false)
    }
  }

  async function publicarAgora() {
    setPublicando(true)
    setErrosDePublicacao(null)
    setPublicadoAgora(null)
    setVoltouDe(null)
    try {
      const r = await acaoPublicar(fluxoId, clienteId, JSON.parse(assinatura))
      if (r.ok) {
        assinaturaSalva.current = assinatura
        setSalvamento('salvo')
        setPublicada({ id: r.id, versao: r.versao, quando: 'agora', grafo: JSON.parse(assinatura) })
        setVersoes((atuais) => [{ id: r.id, versao: r.versao, quando: 'agora' }, ...atuais])
        // Publicar é a ação mais consequente daqui: o desenho passa a atender
        // gente de verdade no WhatsApp. Um selo mudando de cor no canto era
        // discreto demais para o que acabou de acontecer.
        setPublicadoAgora(r.versao)
      } else {
        setErrosDePublicacao(r.erros)
      }
    } catch {
      setErrosDePublicacao([{ codigo: 'FALHA', mensagem: 'Não deu para publicar. Tente de novo.' }])
    } finally {
      setPublicando(false)
    }
  }

  /**
   * Põe uma versão antiga no ar de novo.
   *
   * O desenho da tela é trocado junto: o que está no editor tem que ser o que
   * está publicado, senão o selo diria "no ar" ao lado de um desenho diferente.
   * `assinaturaSalva` é atualizada antes do estado para o salvamento automático
   * não gravar de novo o que a publicação já gravou.
   */
  async function voltarParaVersao(versaoId: string): Promise<boolean> {
    setVoltando(versaoId)
    setErrosDePublicacao(null)
    setPublicadoAgora(null)
    try {
      const r = await acaoVoltarParaVersao(fluxoId, clienteId, versaoId)
      if (!r.ok) {
        setErrosDePublicacao(r.erros)
        return false
      }

      assinaturaSalva.current = JSON.stringify(r.grafo)
      setNodes(
        r.grafo.nodes.map((n) => ({ ...n, className: n.id === r.grafo.inicio ? 'no-inicio' : '' })),
      )
      setEdges(paraArestas(r.grafo.edges))
      setInicio(r.grafo.inicio)
      setSelecionado(null)
      setSalvamento('salvo')
      setPublicada({ id: r.id, versao: r.versao, quando: 'agora', grafo: r.grafo })
      setVersoes((atuais) => [{ id: r.id, versao: r.versao, quando: 'agora' }, ...atuais])
      setVoltouDe({ antiga: r.voltouDe, nova: r.versao })
      return true
    } catch {
      setErrosDePublicacao([
        { codigo: 'FALHA', mensagem: 'Não deu para voltar para esta versão. Tente de novo.' },
      ])
      return false
    } finally {
      setVoltando(null)
    }
  }

  function definirInicio() {
    if (!selecionado) return
    setInicio(selecionado)
    setNodes((atuais) =>
      atuais.map((n) => ({ ...n, className: n.id === selecionado ? 'no-inicio' : '' })),
    )
  }

  /**
   * A barra está estreita o bastante para a descrição atrapalhar mais do que
   * ajudar? O corte é onde a frase de duas linhas passa a quebrar em quatro.
   */
  const apertada = larguraDosBlocos < LARGURA_SEM_DESCRICAO

  const noSelecionado = fluxo.nodes.find((n) => n.id === selecionado) ?? null
  const arestaSelecionada = noSelecionado ? null : (edges.find((e) => e.selected) ?? null)
  const {
    nomes: doDesenho,
    origens: origensDeVariaveis,
    valores: valoresDeVariaveis,
  } = variaveisDoFluxo(fluxo)

  /**
   * As variáveis que existem **na conta**, e não só neste desenho.
   *
   * O pedido veio como "tem que ter a opção de variáveis, criando variáveis
   * isoladamente", e a falta que ele descreve é real: o que uma automação
   * guarda fica no contato e continua lá na próxima conversa, mas o editor de
   * outra automação não sabia disso. Quem quisesse usar `{{plano}}`, gravado
   * pelo fluxo de matrícula, tinha que digitar de cabeça e torcer para não
   * errar uma letra, e errar uma letra não estoura em lugar nenhum: a variável
   * vira vazia e a mensagem sai com um buraco.
   *
   * **Sai do desenho das outras automações, e não de um cadastro à parte.** Um
   * cadastro de variáveis seria uma segunda verdade para manter em dia; esta
   * lista não tem como divergir, porque ela *é* o que os fluxos fazem. O preço é
   * ela só conhecer o que alguém já desenhou, e é o preço certo, porque
   * variável que nenhum bloco preenche não existe mesmo.
   */
  /*
   * As nativas entram sempre: quem escreve "Olá, {{nome}}" não deveria precisar
   * saber que ela existe, o botão de variável tem que oferecê-la, como oferece
   * as que o desenho cria.
   */
  const variaveis = [
    ...new Set([...VARIAVEIS_NATIVAS,
    ...doDesenho,
    ...variaveisDaConta]),
  ].sort()

  return (
    <div className="app-editor flex h-dvh w-full flex-col overflow-hidden bg-canvas">
      {/* No celular o topo rola dentro dele, e não a página inteira. */}
      <header className="relative flex h-[54px] shrink-0 items-center gap-3 border-b border-line bg-panel px-4 max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[&_button]:whitespace-nowrap">
        <Link
          href={voltarHref}
          title={`Voltar para ${clienteNome}`}
          className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-line text-base text-muted transition hover:border-primary/50 hover:text-primary"
        >
          ‹
        </Link>
        {/*
          O nome do fluxo não corta mais.
          Ele tinha `max-w-56 truncate`, e um nome como "PRINCIPAL - ATENDIMENTO"
          virava "PRINCIPAL - ATEN…", o mesmo defeito que reclamamos do
          concorrente. Nome de automação é como quem desenhou se localiza entre
          as suas; cortar no meio economiza 60px e cobra a leitura.

          `min-w-0` sai junto: ele existia para o `truncate` funcionar, e agora
          seria ele a espremer o título contra os controles da direita.
        */}
        <div className="shrink-0">
          <NomeDoFluxo clienteId={clienteId} fluxoId={fluxoId} nome={nome} />
          <p className="flex items-center gap-1.5 px-1 text-[10.5px] text-dim">
            {clienteNome}
            <SeloDoCanal canal={canal} compacto />
          </p>
        </div>
        <span className="mx-0.5 h-6 w-px bg-surface-strong" />
        <EstadoSalvamento
          estado={salvamento}
          salvoEm={salvoEm}
          aoTentarDeNovo={() => setTentativa((n) => n + 1)}
        />
        <span className="mx-0.5 h-6 w-px bg-surface-strong" />

        {/*
          O contrato da Etapa 2 desta automação, e **quem** pode mexer nele.

          A pergunta que isto responde não é "o desenho usa IA?": para isso
          basta olhar se existe bloco de IA no quadro. É "esta automação tem o
          plano de IA contratado?", que é decisão comercial da 4YU e o que o
          `validar()` cobra na hora de publicar.

          Era uma caixinha que qualquer pessoa da conta marcava sozinha, e um
          portão que o próprio cliente abre não é portão, era só um passo a
          mais antes de publicar exatamente o mesmo fluxo. Agora quem marca é a
          4YU; para a conta é estado, e aparece do lado dos outros estados.
        */}
        {podeContratarIa ? (
          <label
            title="Etapa 2 (IA) é plano à parte. Sem isto, fluxo com bloco de IA não publica. Só a 4YU marca."
            className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-muted transition hover:bg-surface"
          >
            <Caixa
              marcada={comIa}
              aoMudar={async (marcada) => {
                setComIa(marcada)
                try {
                  const r = await acaoAlternarIa(fluxoId, clienteId, marcada)
                  if (!r.ok) setComIa(!marcada)
                } catch {
                  setComIa(!marcada)
                }
              }}
            />
            IA contratada
          </label>
        ) : (
          comIa && (
            <span
              title="Esta automação tem o plano de IA (Etapa 2). Para mudar, fale com a 4YU."
              className="shrink-0 rounded-full border border-violet-400/25 bg-violet-400/[0.09] px-3 py-1 text-xs text-info"
            >
              IA contratada
            </span>
          )
        )}

        {/*
          Estado à esquerda, ação à direita.
          Os dois selos moravam colados no "Publicar", entre o "Compartilhar" e
          ele, e ali eles pareciam botão. São informação: dizem em que pé o
          desenho está, que é a mesma matéria do "salvo" e do "com IA" logo ao
          lado. A direita ficou só com o que se clica.
        */}
        {(() => {
          const rotulo = rotulosDoEstado({
            versao: publicada ? publicada.versao : null,
            ativo: entradaLigada,
            comMudancas: Boolean(publicada) && haNovidade,
          })
          return (
            <span className="flex shrink-0 items-center overflow-hidden rounded-full border border-line text-xs">
              <span
                title={
                  !publicada
                    ? 'Ninguém conversa com este desenho até publicar.'
                    : haNovidade
                      ? `A v${publicada.versao} está no ar; o desenho mudou depois dela e as mudanças só valem ao publicar.`
                      : `A v${publicada.versao} está no ar e é igual ao desenho.`
                }
                className={`px-3 py-1 ${
                  !publicada
                    ? 'text-muted'
                    : haNovidade
                      ? 'bg-amber-300/[0.08] text-aviso'
                      : 'bg-emerald-400/[0.08] text-ok'
                }`}
              >
                {rotulo.publicacao}
              </span>
              <span
                title={
                  entradaLigada
                    ? 'Abre conversa nova. Liga e desliga na lista de automações.'
                    : 'Não abre conversa nova. Quem já está no meio termina. Liga na lista de automações.'
                }
                className={`border-l border-line px-3 py-1 ${
                  entradaLigada ? 'text-soft' : 'bg-amber-300/[0.08] text-aviso'
                }`}
              >
                {rotulo.entrada}
              </span>
            </span>
          )
        })()}

        {!validacao.ok && (
          // Clicável porque o número sozinho não diz onde: quem apaga uma
          // ligação e vê o "Publicar" apagar precisa chegar no bloco culpado, e
          // procurar a lista no painel da direita é um passo a mais em cima de
          // um susto.
          <button
            type="button"
            onClick={() => {
              setAba('bloco')
              const primeiro = validacao.erros.find((e) => e.noId)
              if (primeiro?.noId) focar(primeiro.noId)
            }}
            title="Ver o que está impedindo a publicação"
            className="shrink-0 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-bold text-perigo transition hover:bg-rose-400/20"
          >
            {validacao.erros.length} impedimento(s)
          </button>
        )}

        <span className="flex-1" />

        {/*
          A Ajuda abre em outra aba, e essa é a diferença que importa aqui.

          Nas molduras do painel o `?` navega normalmente; deste cabeçalho, não.
          Quem consulta a Ajuda no meio de um desenho quer voltar para o desenho
         , com o mesmo bloco selecionado, o mesmo zoom e a mesma posição do
          quadro, que são estado de tela e não sobrevivem a uma navegação.
        */}
        <button
          type="button"
          onClick={arrumar}
          disabled={nodes.length < 2}
          title="Arrumar o desenho: blocos em colunas, da entrada para a saída"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-strong px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:bg-primary/[0.08] hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 2xl:py-1"
        >
          <span aria-hidden>⌗</span>
          {/* Só ícone abaixo de 1536px: publicação e entrada (A03) precisam do espaço. */}
          <span className="sr-only 2xl:not-sr-only">Organizar</span>
        </button>

        {/*
          Respostas leva ao histórico da **conta inteira**, sem filtro.

          Quem está aqui acabou de publicar e quer ver o que está chegando,
          inclusive das outras automações; o recorte de uma só já tem porta
          própria, o número no cartão da lista. É link de verdade (`<a>`,
          navegação completa) e não `router.push`: o editor guarda desenho não
          salvo, e o aviso de "sair sem salvar" só dispara numa navegação de
          página de verdade.
        */}
        <a
          href={`/clientes/${clienteId}/respostas`}
          title="Ver o que as pessoas responderam nas automações desta conta"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-strong px-2.5 py-1.5 text-xs text-muted transition hover:border-primary/50 hover:bg-primary/[0.08] hover:text-primary 2xl:py-1"
        >
          <span aria-hidden>☰</span>
          <span className="sr-only 2xl:not-sr-only">Respostas</span>
        </a>

        <a
          href="/ajuda"
          target="_blank"
          rel="noopener"
          title="Ajuda (abre em outra aba)"
          aria-label="Ajuda"
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-strong text-[12px] font-bold text-dim transition hover:border-primary/50 hover:bg-primary/[0.1] hover:text-primary"
        >
          <span aria-hidden>?</span>
        </a>

        <Versoes
          versoes={versoes}
          publicadaId={publicada?.id ?? null}
          voltando={voltando}
          aoVoltar={voltarParaVersao}
          clienteId={clienteId}
          fluxoId={fluxoId}
          rascunho={fluxo}
        />

        {/* Ao lado do histórico porque é a mesma matéria: as duas falam de
            versões publicadas, e o link aponta para a que está no ar. */}
        <Compartilhar
          clienteId={clienteId}
          fluxoId={fluxoId}
          nome={nome}
          publicada={publicada ? { versao: publicada.versao, grafo: publicada.grafo } : null}
        />

        {/*
          Só aparece quando **há o que descartar e para onde voltar**: desenho
          diferente do publicado, e um publicado existindo. Botão que fica
          sempre na tela e quase nunca pode agir vira ruído, e este, podendo
          jogar trabalho fora, seria ruído perigoso.
        */}
        {publicada && haNovidade && (
          <button
            type="button"
            onClick={() => setConfirmandoDescarte(true)}
            title="Joga fora as alterações não publicadas e volta ao desenho que está no ar"
            className="rounded-lg border border-line px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:border-amber-300/40 hover:text-aviso"
          >
            Descartar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setAba('testar')
            // Com o painel recolhido, trocar só a aba não mostrava nada.
            setPainelAberto(true)
          }}
          title="Conversar com este desenho sem sair do editor"
          className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition ${
            aba === 'testar'
              ? 'border-primary/50 bg-primary/[0.12] text-primary'
              : 'border-line text-muted hover:border-primary/40 hover:text-primary'
          }`}
        >
          Testar
        </button>

        <button
          onClick={() =>
            confirmarPublicacao({
              titulo: `Publicar v${proximaVersao}?`,
              descricao: publicada
                ? `Só novas conversas usam a versão nova. Quem já está no meio continua na v${publicada.versao}.`
                : 'A partir de agora, novas conversas que chegarem pela entrada desta automação usam este desenho.',
              rotulo: `Publicar v${proximaVersao}`,
              tom: 'normal',
              aoConfirmar: async () => {
                await publicarAgora()
              },
            })
          }
          disabled={!validacao.ok || !haNovidade || publicando || salvamento === 'salvando'}
          title={
            !validacao.ok
              ? 'Resolva os impedimentos antes de publicar'
              : !haNovidade
                ? 'O que está no ar já é este desenho'
                : 'Publicar este desenho'
          }
          className="app-primary-button px-[18px] py-2 text-[13px]"
        >
          {publicando ? 'publicando…' : `Publicar v${proximaVersao}`}
        </button>
        {dialogoDePublicacao}
      </header>

      {errosDePublicacao && (
        <div className="shrink-0 border-b border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs text-perigo">
          <strong>Não publicou.</strong>{' '}
          {errosDePublicacao.map((e) => e.mensagem).join(' ')}
        </div>
      )}

      {publicadoAgora !== null && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-emerald-400/25 bg-emerald-400/[0.09] px-4 py-2 text-xs text-ok"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="flex-1">
            <strong>No ar.</strong> A versão {publicadoAgora} passa a atender as conversas novas
            deste número, quem já estava conversando termina na versão em que começou.
          </span>
          <button
            onClick={() => setPublicadoAgora(null)}
            className="rounded-lg px-2 py-0.5 transition hover:bg-emerald-400/[0.16]"
          >
            ok
          </button>
        </div>
      )}

      {voltouDe && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-emerald-400/25 bg-emerald-400/[0.09] px-4 py-2 text-xs text-ok"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="flex-1">
            <strong>Voltou para a v{voltouDe.antiga}.</strong> Ela foi publicada de novo como versão{' '}
            {voltouDe.nova} e o desenho na tela agora é o dela. O histórico anterior continua
            inteiro.
          </span>
          <button
            onClick={() => setVoltouDe(null)}
            className="rounded-lg px-2 py-0.5 transition hover:bg-emerald-400/[0.16]"
          >
            ok
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        {/*
          A barra de blocos tem largura fixa desde sempre, e ela é grande demais
          para quem já decorou os dez blocos e pequena demais para quem está
          aprendendo, duas pessoas diferentes, um número só. Agora ela se puxa.

          `relative` porque o puxador se posiciona contra ela; `overflow-y-auto`
          continua, então a lista rola quando a largura aperta.
        */}
        <nav
          style={{ width: larguraDosBlocos }}
          className={`relative shrink-0 overflow-y-auto border-r border-line bg-panel px-3 py-3.5 max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:!w-[min(300px,85vw)] max-md:shadow-[0_24px_60px_rgba(19,25,34,0.2)] ${
            blocosNoCelular ? '' : 'max-md:hidden'
          }`}
        >
          <PuxadorDeLargura
            largura={larguraDosBlocos}
            aoMudar={mudarLarguraDosBlocos}
            minima={LARGURA_MINIMA_DOS_BLOCOS}
            maxima={LARGURA_MAXIMA_DOS_BLOCOS}
            padrao={LARGURA_PADRAO_DOS_BLOCOS}
            rotulo="Largura da barra de blocos"
          />
          <input
            type="search"
            value={buscaDeBloco}
            onChange={(evento) => setBuscaDeBloco(evento.target.value)}
            onKeyDown={(evento) => {
              // Enter com um resultado só já põe o bloco: quem digitou
              // "etiq" sabe o que quer, e não precisa ir ao mouse.
              const achados = catalogo.flatMap((grupo) => grupo.tipos)
              const [unico] = achados
              if (evento.key === 'Enter' && achados.length === 1 && unico) {
                adicionar(unico)
                setBuscaDeBloco('')
              }
            }}
            placeholder="Buscar bloco"
            aria-label="Buscar bloco pelo nome ou pelo que ele faz"
            className="app-field mb-3 w-full px-2.5 py-1.5 text-[12px]"
          />
          {catalogo.length === 0 && (
            <p className="px-2 text-[11.5px] leading-[1.5] text-dim">
              Nenhum bloco com “{buscaDeBloco.trim()}”.
            </p>
          )}
          {catalogo.map((grupo) => (
          <section key={grupo.nome} aria-label={grupo.nome} className="mb-2">
          <p className="mb-1 px-2 text-[10.5px] font-bold tracking-[0.08em] text-dim uppercase">
            {grupo.nome}
          </p>
          {grupo.tipos.map((tipo) => (
            <button
              key={tipo}
              onClick={() => adicionar(tipo)}
              draggable
              onDragStart={(evento) => {
                evento.dataTransfer.setData(TIPO_ARRASTADO, tipo)
                evento.dataTransfer.effectAllowed = 'copy'

                // O ponto de agarre repete o `centralizar` do soltar (metade da
                // largura, 40px do topo): o cartão cai exatamente onde o
                // fantasma estava, sem pulo no fim do gesto.
                const fantasma = cartaoDoArrasto(tipo)
                evento.dataTransfer.setDragImage(fantasma, LARGURA_NO / 2, 40)
                // A foto já foi tirada; o elemento só precisava existir até
                // aqui. Sair no mesmo quadro evita fantasma órfão se o
                // `dragend` não vier (arrasto cancelado fora da janela).
                requestAnimationFrame(() => fantasma.remove())
              }}
              // A dica do bloco entra no `title` quando ela sai da tela: quem
              // apertou a barra não deveria perder a explicação junto.
              title={apertada ? `${NOMES[tipo]}, ${DESCRICOES[tipo]}` : undefined}
              className={`mb-1 flex w-full cursor-grab items-start gap-3 rounded-[11px] border border-transparent text-left transition select-none hover:border-line hover:bg-surface active:cursor-grabbing ${
                apertada ? 'p-1.5' : 'p-2.5'
              }`}
            >
              <span
                aria-hidden
                className={`flex shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-primary ${
                  apertada ? 'size-7 text-[13px]' : 'size-9 text-[15px]'
                }`}
              >
                {ICONES[tipo]}
              </span>
              <span className="min-w-0">
                <strong
                  className={`block font-bold ${apertada ? 'text-[12px] leading-[1.25]' : 'text-[13.5px]'}`}
                >
                  {NOMES[tipo]}
                </strong>
                {/*
                  A descrição é a primeira coisa a sair quando a barra aperta.

                  Ela é o que ensina quem está aprendendo, e é exatamente o que
                  sobra quando alguém já decorou os dez blocos, que é o motivo
                  de a barra poder encolher. Some da tela e continua no `title`.
                */}
                {!apertada && (
                  <span className="mt-0.5 block text-[11px] leading-[1.35] text-dim">
                    {DESCRICOES[tipo]}
                  </span>
                )}
              </span>
            </button>
          ))}
          </section>
          ))}
        </nav>

        <div
          ref={areaRef}
          className="relative min-w-0 flex-1"
          onPointerDown={() => setBlocosNoCelular(false)}
          onDrop={soltar}
          // Sem cancelar o `dragover`, o navegador recusa o soltar e o gesto
          // termina com a animação de "voltou para o lugar".
          onDragOver={(evento) => {
            evento.preventDefault()
            evento.dataTransfer.dropEffect = 'copy'
          }}
        >
          <button
            type="button"
            onClick={() => setBlocosNoCelular(true)}
            className="absolute top-3 left-3 z-20 rounded-lg border border-line bg-panel px-3 py-2 text-[12.5px] font-semibold text-muted shadow-[0_8px_20px_rgba(19,25,34,0.1)] md:hidden"
          >
            + Bloco
          </button>
          <AcaoDaArestaProvider value={acoesDaAresta}>
          <RealceDeArestasProvider>
          <RespostasPorVariavelProvider value={respostasPorVariavel}>
          <NomesDeEtiquetaProvider value={nomesDeEtiqueta}>
          <ReactFlow
            onInit={setTela}
            nodes={nodes}
            edges={edges}
            onNodesChange={aoMudarNos}
            onEdgesChange={aoMudarArestas}
            onConnect={aoConectar}
            /**
             * Soltar a ligação **em cima do bloco** conecta, não só em cima da
             * bolinha.
             *
             * O padrão do React Flow é 20px: fora disso a linha some no ar sem
             * dizer nada, e quem está desenhando conclui que "esse bloco não
             * aceita ligação". Foi exatamente o que veio de quem monta fluxo.
             * 90px cobre a entrada do bloco inteira com folga, e continua
             * pequeno o bastante para não roubar a alça do bloco vizinho.
             */
            connectionRadius={90}
            nodeTypes={tiposDeNo}
            edgeTypes={tiposDeAresta}
            onNodeContextMenu={(evento, no) => abrirMenu(evento, 'no', no.id)}
            onEdgeContextMenu={(evento, aresta) => abrirMenu(evento, 'aresta', aresta.id)}
            // Arrastar ou mexer na tela com o menu aberto deixaria ele parado
            // apontando para um lugar que não existe mais.
            onNodeMouseEnter={(evento, no) => {
              const caixa = (evento.currentTarget as HTMLElement).getBoundingClientRect()
              const analise = noSchema.safeParse(no)
              if (!analise.success) return
              const bloco = analise.data
              if (relogioDaPrevia.current) clearTimeout(relogioDaPrevia.current)
              relogioDaPrevia.current = setTimeout(
                () => setPrevia({ no: bloco, x: caixa.right, y: caixa.top }),
                420,
              )
            }}
            onNodeMouseLeave={fecharPrevia}
            onNodeDragStart={largarOFlutuante}
            onNodeDragStop={(_evento, no, movidos) => largarCorredores(movidos ?? [no])}
            onMoveStart={largarOFlutuante}
            // Todo grafo já salvo tem aresta sem `type`; o padrão faz as antigas
            // ganharem o ✕ sem precisar migrar nada no banco.
            defaultEdgeOptions={OPCOES_PADRAO_DA_ARESTA}
            onSelectionChange={aoMudarSelecao}
            // `Shift` arrastando laça uma área; ver `TECLAS_DE_MULTISSELECAO`.
            multiSelectionKeyCode={TECLAS_DE_MULTISSELECAO}
            selectionKeyCode="Shift"
            fitView
            /*
             * O tema vem do painel, e não fica preso no escuro.
             *
             * Era `colorMode="dark"` fixo, e isso fazia duas coisas ruins: no
             * tema claro o editor continuava escuro, e no escuro o React Flow
             * aplicava `--xy-background-color-default: #141414`, um preto do
             * pacote que não é nenhuma cor nossa. O resultado era o canvas ser
             * a única tela do produto fora da paleta.
             */
            colorMode={temaEscuro ? 'dark' : 'light'}
            proOptions={{ hideAttribution: false }}
          >
            {/*
              A08: tudo que o botão direito oferece, também sem ele. Com um
              bloco ou uma ligação selecionados (clique ou Tab), a barra no
              topo do quadro abre as mesmas ações, e o teclado alcança.
            */}
            {selecionados.length <= 1 && (noSelecionado || arestaSelecionada) && (
              <Panel position="top-center">
                <BarraDoSelecionado
                  no={noSelecionado ? { id: noSelecionado.id, tipo: noSelecionado.type ?? '' } : null}
                  ehInicio={noSelecionado?.id === inicio}
                  aoDuplicar={() => noSelecionado && duplicar(noSelecionado.id)}
                  aoMarcarInicio={definirInicio}
                  aoExcluir={() => noSelecionado && pedirParaApagar(noSelecionado.id)}
                  aoRemoverLigacao={() => arestaSelecionada && apagarAresta(arestaSelecionada.id)}
                />
              </Panel>
            )}
            {selecionados.length > 1 && (
              <Panel position="top-center">
                <AcoesEmLote
                  quantos={selecionados.length}
                  quantosFalam={
                    nodes.filter((n) => selecionados.includes(n.id) && aceitaAtraso(n.type ?? ''))
                      .length
                  }
                  aoAtrasar={aplicarAtrasoNoLote}
                />
              </Panel>
            )}

            {/*
              O fundo do canvas, no mesmo véu azul do histórico da conversa.

              **É aqui que a cor mora, e não em `.react-flow`.** O
              `<Background>` desenha um `<svg>` que cobre o canvas inteiro, com
              `background-color` próprio vindo de `--xy-background-color-*`;
              pintar o `.react-flow` debaixo dele não aparece, porque ele está
              coberto.

              A cor sai do CSS (`.react-flow__background`) e não de uma prop
              daqui, para seguir o tema: prop é valor fixo, e o claro e o escuro
              precisam de doses diferentes do mesmo véu.
            */}
            <FundoDoCanvas />
            <Controls position="bottom-right" />
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              nodeColor="#334155"
              maskColor="rgba(7,10,14.72)"
              className="!h-24 !w-[150px]"
            />
          </ReactFlow>
          {previa && <PreviaDoBloco no={previa.no} x={previa.x} y={previa.y} />}
          </NomesDeEtiquetaProvider>
          </RespostasPorVariavelProvider>
          </RealceDeArestasProvider>
          </AcaoDaArestaProvider>

          {menu && (
            <MenuDoBotaoDireito
              menu={menu}
              aoEditar={() => editarNo(menu.id)}
              aoDuplicar={() => duplicar(menu.id)}
              aoApagar={() => (menu.alvo === 'no' ? pedirParaApagar(menu.id) : apagarAresta(menu.id))}
            />
          )}
        </div>

        {/*
          O painel recolhe.

          São 356px fixos ao lado do desenho, e num fluxo grande, o caso em que
          o desenho é justamente o que se precisa ver, eles custam caro. O
          pedido veio como "um x pra fechar, ou um - pra minimizar", e minimizar
          é o certo: fechado de vez, não haveria como voltar sem adivinhar.

          Recolhido, sobra uma coluna com os dois nomes de aba em pé. Clicar em
          qualquer um dos dois reabre já naquela aba, então recolher nunca custa
          um clique a mais do que deveria.
        */}
        {/*
          O painel da direita tem 420px abertos, e não os 356px de antes.

          É onde um bloco inteiro se preenche, e na largura anterior quase tudo
          ficava apertado: "Tornar início" quebrava uma palavra em cima da
          outra dentro do botão, rótulos de duas palavras iam para duas linhas,
          e os dois campos lado a lado de "Guardar da resposta" ficavam
          estreitos demais para caber o nome de um campo de API. O desenho perde
          64px; o formulário ganha uma linha a menos em quase todo campo.
        */}
        {!painelAberto ? (
          <aside className="flex w-[42px] shrink-0 flex-col items-center gap-2 border-l border-line bg-panel py-2.5">
            <button
              onClick={() => setPainelAberto(true)}
              title="Abrir o painel"
              aria-label="Abrir o painel"
              className="flex size-[30px] items-center justify-center rounded-lg border border-line text-base text-muted transition hover:border-primary/50 hover:text-primary"
            >
              ‹
            </button>
            {abas.map((chave) => (
              <button
                key={chave}
                onClick={() => {
                  setAba(chave)
                  setPainelAberto(true)
                }}
                className={`rounded-lg px-1 py-3 text-[10.5px] font-bold [writing-mode:vertical-rl] transition ${
                  aba === chave ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {ROTULO_DA_ABA[chave]}
              </button>
            ))}
          </aside>
        ) : (
        <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-panel max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full">
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-3 pt-2.5 text-xs">
            {abas.map((chave) => (
              <button
                key={chave}
                onClick={() => setAba(chave)}
                className={`rounded-t-lg border-b-2 px-4 py-2.5 font-bold transition ${
                  aba === chave
                    ? 'border-primary text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {ROTULO_DA_ABA[chave]}
                {chave === 'antes' && faltamAntes > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-400/15 px-1.5 py-px text-[10px] text-perigo">
                    {faltamAntes}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setPainelAberto(false)}
              title="Recolher o painel e ver o desenho inteiro"
              aria-label="Recolher o painel"
              className="mb-1 ml-auto rounded-lg px-2 py-1 text-[13px] leading-4 text-dim transition hover:bg-surface-strong hover:text-ink"
            >
              −
            </button>
          </div>

          {aba === 'bloco' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {desfazer && (
                <div className="flex items-center gap-2 border-b border-amber-300/20 bg-amber-300/[0.07] px-3.5 py-2.5 text-[11.5px] text-aviso">
                  <span className="min-w-0 flex-1">
                    Bloco apagado
                    {desfazer.edges.length > 0 && `, e ${desfazer.edges.length} ligação(ões) com ele`}.
                  </span>
                  <button
                    onClick={desfazerApagar}
                    className="shrink-0 rounded-lg border border-amber-300/30 px-2.5 py-1 font-bold transition hover:bg-amber-300/[0.15]"
                  >
                    Desfazer
                  </button>
                </div>
              )}

              <Painel
                key={noSelecionado?.id ?? 'sem-selecao'}
                no={noSelecionado}
                clienteId={clienteId}
                ehInicio={selecionado === inicio}
                variaveis={variaveis}
                origensDeVariaveis={origensDeVariaveis}
                blocos={fluxo.nodes}
                valoresDeVariaveis={valoresDeVariaveis}
                conexoes={conexoes}
                lojaAtiva={lojaAtiva}
                politicasDaIa={politicasDaIa}
                iaHabilitada={comIa}
                etapas={etapas}
                etiquetas={etiquetas}
                equipe={equipe}
                horarioConfigurado={horarioConfigurado}
                retomadaDaConta={retomadaDaConta}
                fluxos={fluxos}
                aoMudarDados={mudarDados}
                aoDefinirInicio={definirInicio}
                aoApagar={() => selecionado && pedirParaApagar(selecionado)}
              />

              {/*
                As duas listas são do **fluxo inteiro**, e por isso só aparecem
                quando não há bloco escolhido.

                Antes elas vinham embaixo do formulário de todo bloco clicado, e
                o efeito era o contrário do pretendido: quem está editando uma
                mensagem lê seis problemas de outros seis blocos, rola para
                achar o campo, e passa a ignorar a lista, aviso que aparece
                sempre para de ser lido. Sem bloco escolhido, o painel não tem
                mais nada a dizer, e aí a lista é exatamente o que se quer ver.
                Durante a edição, quem chama por elas é o selo de impedimentos
                no cabeçalho, que leva direto ao bloco culpado.
              */}
              {!selecionado && !validacao.ok && (
                <div className="border-t border-line p-4">
                  <p className="mb-2 text-[11px] font-bold tracking-[0.04em] text-soft uppercase">
                    Impede de publicar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.erros.map((erro, i) => (
                      <li key={i}>
                        <button
                          onClick={() => erro.noId && focar(erro.noId)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-4 text-perigo transition hover:bg-rose-400/[0.07]"
                        >
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-400" />
                          <span>{erro.mensagem}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!selecionado && validacao.avisos.length > 0 && (
                <div className="border-t border-line p-4">
                  <p className="mb-2 text-[11px] font-bold tracking-[0.04em] text-soft uppercase">
                    Vale olhar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.avisos.map((aviso, i) => (
                      <li key={i}>
                        <button
                          onClick={() => aviso.noId && focar(aviso.noId)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-4 text-aviso transition hover:bg-amber-300/[0.07]"
                        >
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-300" />
                          <span>{aviso.mensagem}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : aba === 'antes' && origem ? (
            <AntesDePublicar
              origem={origem}
              itens={itensAntes}
              clienteId={clienteId}
              rotuloDoNo={(noId) => {
                const no = fluxo.nodes.find((n) => n.id === noId)
                return no ? descrever(no) : 'Bloco'
              }}
              aoFocar={focar}
            />
          ) : (
            <>
              <Conversa
                fluxo={fluxo}
                fluxoId={fluxoId}
                nomeContato={clienteNome}
                contextoNegocio={contextoNegocio}
                iaHabilitada={comIa}
              />
            </>
          )}
        </aside>
        )}
      </div>

      <Modal
        aberto={confirmandoDescarte}
        aoFechar={() => setConfirmandoDescarte(false)}
        titulo="Descartar as alterações?"
        descricao={`O desenho volta a ser a versão ${publicada?.versao ?? ''}, a que está no ar agora. O que está publicado não muda: quem está conversando no WhatsApp não sente nada.`}
      >
        <p className="mb-4 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] leading-5 text-muted">
          Dá para voltar atrás com <strong className="text-soft">Ctrl+Z</strong> logo depois, o
          descarte entra no histórico de desfazer como qualquer outra mudança.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setConfirmandoDescarte(false)}
            className="rounded-lg border border-line px-3.5 py-2 text-[12px] font-semibold text-muted transition hover:border-strong hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={descartando}
            onClick={descartar}
            className="rounded-lg border border-amber-300/40 bg-amber-300/[0.12] px-3.5 py-2 text-[12px] font-bold text-aviso transition hover:bg-amber-300/20 disabled:opacity-50"
          >
            {descartando ? 'descartando…' : 'Descartar alterações'}
          </button>
        </div>
      </Modal>

      <ConfirmarApagar
        no={nodes.find((n) => n.id === aApagar) ?? null}
        ligacoes={edges.filter((e) => e.source === aApagar || e.target === aApagar).length}
        ehInicio={aApagar !== null && aApagar === inicio}
        aoFechar={() => setAApagar(null)}
        aoConfirmar={() => aApagar && apagar(aApagar)}
      />
    </div>
  )
}

/**
 * As ações do bloco (ou da ligação) selecionado, sem botão direito (A08).
 * Reaproveita os mesmos handlers do menu de contexto; Excluir passa pela mesma
 * confirmação, que diz quantas ligações somem, e deixa o Desfazer no painel.
 */
function BarraDoSelecionado({
  no,
  ehInicio,
  aoDuplicar,
  aoMarcarInicio,
  aoExcluir,
  aoRemoverLigacao,
}: {
  no: { id: string; tipo: string } | null
  ehInicio: boolean
  aoDuplicar: () => void
  aoMarcarInicio: () => void
  aoExcluir: () => void
  aoRemoverLigacao: () => void
}) {
  const nome = no ? (NOMES[no.tipo as keyof typeof NOMES] ?? 'Bloco') : null
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-1.5 text-[12px] shadow-sm">
      {no ? (
        <>
          <span className="text-muted">
            Bloco: <strong className="font-semibold text-ink">{nome}</strong>
            {ehInicio ? ' · início' : ''}
          </span>
          <PopoverDoQuadro
            rotulo={`Ações do bloco ${nome}`}
            largura={220}
            gatilho={<span aria-hidden className="px-0.5 text-[14px] leading-none">⋯</span>}
          >
            <button type="button" data-fechar-popover onClick={aoDuplicar} className="quadro-menu-item">
              Duplicar
            </button>
            <button
              type="button"
              data-fechar-popover
              disabled={ehInicio}
              onClick={aoMarcarInicio}
              className="quadro-menu-item"
            >
              {ehInicio ? 'Já é o início' : 'Marcar como início'}
            </button>
            <button
              type="button"
              data-fechar-popover
              onClick={aoExcluir}
              className="quadro-menu-item quadro-danger mt-1 border-t border-line text-perigo"
            >
              Excluir…
            </button>
          </PopoverDoQuadro>
        </>
      ) : (
        <>
          <span className="text-muted">Ligação selecionada</span>
          <button
            type="button"
            onClick={aoRemoverLigacao}
            className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-semibold text-perigo transition hover:border-rose-400/40 hover:bg-rose-400/[0.09]"
          >
            Remover ligação
          </button>
        </>
      )}
    </div>
  )
}

/** Onde o menu abriu e para que lado ele precisa crescer. */
type MenuAberto = {
  alvo: 'no' | 'aresta'
  id: string
  x: number
  y: number
  paraEsquerda: boolean
  paraCima: boolean
}

/** O tamanho do menu, para decidir o lado antes de desenhar. */
const LARGURA_MENU = 176
const ALTURA_MENU = 130

/**
 * O menu do botão direito.
 *
 * Ele substituiu os botões que iam ficar no canto de cada bloco: dois ícones em
 * cada caixa de um desenho com vinte delas é ruído permanente para uma ação
 * ocasional, e o botão direito é onde todo editor de diagrama guarda isso.
 *
 * Ele é desenhado dentro da área de desenho e não num portal: assim a rolagem e
 * o recorte da área valem para ele, e o menu não sobra por cima do painel da
 * direita quando o clique é perto da borda.
 */
/**
 * A barra que aparece quando há mais de um bloco selecionado.
 *
 * **Por que ela existe.** O "digitando…" é decisão de ritmo da conversa
 * inteira: quem quer que o bot pareça gente quer a pausa em toda fala, e num
 * fluxo de vinte blocos isso custava vinte idas ao painel, com o risco de
 * sobrar um bloco instantâneo no meio, que é justo o que denuncia o robô.
 *
 * Selecionar é o gesto que já existia (Ctrl clicando, `Shift` arrastando uma
 * área); o que faltava era ter o que fazer com a seleção.
 *
 * **Ela diz quantos blocos de fato mudam.** Pergunta, condição e guardar não
 * mandam texto e não têm o que atrasar. Prometer "aplicado em 9" quando 5
 * ignoraram é o tipo de mentira de tela que faz alguém publicar achando que
 * conferiu.
 */
function AcoesEmLote({
  quantos,
  quantosFalam,
  aoAtrasar,
}: {
  quantos: number
  quantosFalam: number
  aoAtrasar: (segundos: number) => void
}) {
  const segundos = Array.from({ length: LIMITE_ATRASO_SEGUNDOS }, (_, i) => i + 1)

  return (
    <div className="flex items-center gap-2 rounded-full border border-line bg-panel/95 px-3 py-1.5 text-[11px] shadow-[0_14px_34px_rgba(19,25,34,0.132)] backdrop-blur-sm">
      <span className="font-semibold text-soft">{quantos} blocos</span>
      <span className="h-3 w-px bg-line" aria-hidden />
      <span className="text-dim">digita antes de falar</span>

      {segundos.map((valor) => (
        <button
          key={valor}
          type="button"
          disabled={quantosFalam === 0}
          onClick={() => aoAtrasar(valor)}
          title={`Põe ${valor}s de "digitando…" antes de cada uma das falas selecionadas`}
          className="rounded-full border border-line px-2 py-0.5 font-semibold text-muted transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          {valor}s
        </button>
      ))}

      <button
        type="button"
        disabled={quantosFalam === 0}
        onClick={() => aoAtrasar(0)}
        title="Tira o atraso das falas selecionadas"
        className="rounded-full border border-line px-2 py-0.5 font-semibold text-muted transition hover:border-strong hover:text-soft disabled:opacity-40"
      >
        Tirar
      </button>

      <span className="text-dim">
        {quantosFalam === 0
          ? 'nenhum destes fala'
          : `vale para ${quantosFalam} ${quantosFalam === 1 ? 'fala' : 'falas'}`}
      </span>
    </div>
  )
}

function MenuDoBotaoDireito({
  menu,
  aoEditar,
  aoDuplicar,
  aoApagar,
}: {
  menu: MenuAberto
  aoEditar: () => void
  aoDuplicar: () => void
  aoApagar: () => void
}) {
  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-soft transition hover:bg-surface-strong hover:text-ink'

  return (
    <div
      style={{
        left: menu.x,
        top: menu.y,
        transform: `translate(${menu.paraEsquerda ? '-100%' : '0'}, ${menu.paraCima ? '-100%' : '0'})`,
      }}
      className="absolute z-20 w-[176px] rounded-[12px] border border-line bg-panel p-1.5 shadow-[0_24px_60px_rgba(19,25,34,0.121)]"
      onContextMenu={(evento) => evento.preventDefault()}
    >
      {menu.alvo === 'no' ? (
        <>
          <button type="button" onClick={aoEditar} className={item}>
            <span aria-hidden className="w-4 text-center text-muted">
              ✎
            </span>
            Editar
          </button>
          <button type="button" onClick={aoDuplicar} className={item}>
            <span aria-hidden className="w-4 text-center text-muted">
              ⧉
            </span>
            Duplicar
          </button>
          <div className="my-1 h-px bg-surface-strong" />
          <button
            type="button"
            onClick={aoApagar}
            className={`${item} text-perigo hover:bg-rose-400/[0.12] hover:text-perigo`}
          >
            <span aria-hidden className="w-4 text-center">
              ✕
            </span>
            Excluir
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={aoApagar}
          className={`${item} text-perigo hover:bg-rose-400/[0.12] hover:text-perigo`}
        >
          <span aria-hidden className="w-4 text-center">
            ✕
          </span>
          Apagar ligação
        </button>
      )}
    </div>
  )
}

/**
 * A confirmação de apagar um bloco.
 *
 * Ela diz **quantas ligações vão junto** e avisa quando o bloco é o início,
 * porque essas são as duas consequências que não estão à vista: some o bloco,
 * somem as setas que chegavam nele, e um fluxo sem início não publica.
 *
 * `key` amarrado ao bloco: sem isso o `<dialog>` reaproveitado mostraria por um
 * quadro o texto do bloco anterior.
 */
function ConfirmarApagar({
  no,
  ligacoes,
  ehInicio,
  aoFechar,
  aoConfirmar,
}: {
  no: Node | null
  ligacoes: number
  ehInicio: boolean
  aoFechar: () => void
  aoConfirmar: () => void
}) {
  const tipo = (no?.type ?? 'mensagem') as TipoNo

  return (
    <Modal
      key={no?.id ?? 'sem-bloco'}
      aberto={no !== null}
      aoFechar={aoFechar}
      titulo={`Apagar o bloco de ${NOMES[tipo].toLowerCase()}?`}
      descricao={
        ligacoes > 0
          ? `As ${ligacoes} ligação(ões) que entram ou saem dele somem junto. Dá para desfazer por alguns segundos depois.`
          : 'Dá para desfazer por alguns segundos depois.'
      }
    >
      {ehInicio && (
        <p className="mb-4 rounded-[10px] border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[12px] leading-5 text-aviso">
          Este é o bloco de <strong>início</strong>. Sem ele, o fluxo não publica até você escolher
          outro.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={aoFechar}
          className="rounded-lg border border-line px-3.5 py-2 text-[12px] font-semibold text-muted transition hover:border-strong hover:text-ink"
        >
          Cancelar
        </button>
        {/* O foco começa no "Cancelar": `Enter` logo depois de abrir é reflexo
            comum, e não pode ser o que apaga o bloco. */}
        <button
          type="button"
          onClick={aoConfirmar}
          className="rounded-lg border border-rose-400/40 bg-rose-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-perigo transition hover:bg-rose-400/20"
        >
          Apagar bloco
        </button>
      </div>
    </Modal>
  )
}

/**
 * O tamanho do bloco no desenho. A largura é o `w-[248px]` de `nos.tsx`; a
 * altura varia com o conteúdo (uma pergunta com opções é bem mais alta que uma
 * mensagem), então vale a maior. Errar para cima só afasta um pouco o bloco
 * novo; errar para baixo devolve a sobreposição.
 */
/**
 * Os limites da barra de blocos.
 *
 * O mínimo é onde o nome do bloco ainda cabe ao lado do ícone; abaixo disso a
 * lista vira dez quadradinhos iguais e deixa de ser um catálogo. O máximo é o
 * ponto em que ela começa a disputar espaço com o desenho, que é o que se veio
 * ver.
 */
const LARGURA_PADRAO_DOS_BLOCOS = 232
const LARGURA_MINIMA_DOS_BLOCOS = 132
const LARGURA_MAXIMA_DOS_BLOCOS = 380
/** Abaixo disto a descrição de cada bloco sai, e sobra o ícone com o nome. */
const LARGURA_SEM_DESCRICAO = 190
const CHAVE_DA_LARGURA = 'autofluxos:largura-dos-blocos'

const LARGURA_NO = 248
const ALTURA_NO = 140

/**
 * Empurra o bloco novo até um lugar que não esteja ocupado.
 *
 * Sem isto, adicionar dois blocos seguidos empilhava um exatamente em cima do
 * outro no centro da tela: parecia que o segundo não tinha sido criado, e quem
 * arrastasse descobria dois na mesma posição.
 *
 * **A comparação é entre retângulos, não entre pontos.** A primeira versão
 * disto media 40px nos dois eixos, o que é menos de um sexto da largura do
 * bloco: dois blocos a 46px de distância passavam no teste e se sobrepunham em
 * 200px. E bloco coberto não é só feio, ele fica inclicável, então o de baixo
 * some do editor sem nenhum aviso.
 */
function livre(inicial: { x: number; y: number }, existentes: Node[]): { x: number; y: number } {
  const sobrepoe = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < LARGURA_NO && Math.abs(a.y - b.y) < ALTURA_NO

  let alvo = inicial
  // Teto para não virar laço infinito num desenho muito cheio: depois de 20
  // degraus, empilhar é melhor do que travar.
  //
  // O degrau desce um bloco inteiro, e é de propósito. Descer de pouquinho
  // parece mais delicado e não é: o bloco novo caminha pela mesma diagonal que
  // os anteriores já ocuparam, gasta cinco degraus para vencer cada um, e no
  // quinto bloco o teto estoura, voltando a empilhar exatamente no caso em que
  // esta função existe para ajudar. Descendo uma altura por vez, cada degrau
  // vence um bloco, e o teto vira o que ele deveria ser: inalcançável na
  // prática.
  for (let i = 0; i < 20 && existentes.some((n) => sobrepoe(n.position, alvo)); i++) {
    alvo = { x: alvo.x, y: alvo.y + ALTURA_NO + 20 }
  }
  return alvo
}

function EstadoSalvamento({
  estado,
  salvoEm,
  aoTentarDeNovo,
}: {
  estado: 'salvo' | 'salvando' | 'pendente' | 'erro'
  salvoEm: Date | null
  aoTentarDeNovo: () => void
}) {
  /*
   * A07: o estado diz quando, e o erro diz por quê e o que fazer. Sem hora,
   * "salvo" parecia valer para o desenho de agora mesmo depois de a rede cair.
   */
  const hora = salvoEm
    ? salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null
  const semRede = estado === 'erro' && typeof navigator !== 'undefined' && !navigator.onLine
  const texto = {
    salvo: hora ? `Salvo às ${hora}` : 'Salvo',
    salvando: 'Salvando…',
    pendente: 'Alterações não salvas',
    erro: semRede ? 'Não salvo: sem conexão.' : 'Não salvo.',
  }[estado]

  return (
    <span
      role="status"
      className={`flex items-center gap-2 text-xs whitespace-nowrap ${estado === 'erro' ? 'text-perigo' : 'text-muted'}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          estado === 'erro'
            ? 'bg-rose-400'
            : estado === 'salvo'
              ? 'bg-emerald-400'
              : estado === 'salvando'
                ? 'animate-pulse bg-primary'
                : 'bg-amber-300'
        }`}
      />
      {texto}
      {estado === 'erro' && (
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="font-semibold underline underline-offset-2 hover:text-ink"
        >
          Tentar de novo
        </button>
      )}
    </span>
  )
}

