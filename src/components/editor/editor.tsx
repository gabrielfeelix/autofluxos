'use client'

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
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
import type { CanalId } from '@/core/canais'
import { fluxoSchema, type Fluxo, type No, type TipoNo } from '@/core/flow/schema'
import type { Problema } from '@/core/flow/validar'
import { validar } from '@/core/flow/validar'
import {
  acaoAlternarIa,
  acaoDescartarRascunho,
  acaoPublicar,
  acaoSalvarRascunho,
  acaoVoltarParaVersao,
} from '@/server/acoes'
import { Modal } from '@/components/design/modal'
import { SeloDoCanal } from '@/components/design/selo-do-canal'
import { AcaoDaArestaProvider, tiposDeAresta } from './arestas'
import { ICONES, NOMES, tiposDeNo } from './nos'
import { NomeDoFluxo } from './nome-do-fluxo'
import { Painel } from './painel'
import type { ConexaoDoCliente, EtapaDoCliente, FluxoDaConta } from './painel'
import { Versoes, type VersaoNaLista } from './versoes'
import { Compartilhar } from './compartilhar'

const PAUSA_ANTES_DE_SALVAR = 800

/** Um passo do desfazer: o desenho inteiro num instante. */
type Instantaneo = { nodes: Node[]; edges: Edge[]; inicio: string }

/**
 * Quanto tempo de edição contínua cabe num passo só do desfazer.
 *
 * Meio segundo é a pausa de quem terminou uma palavra e pensou na próxima —
 * curto o bastante para o `Ctrl+Z` não engolir um parágrafo inteiro, longo o
 * bastante para não voltar letra por letra.
 */
const JANELA_DE_DIGITACAO = 500

/** Quantos passos o desfazer guarda. Além disso é memória sem uso. */
const LIMITE_DO_HISTORICO = 60

/**
 * Quanto tempo o "bloco apagado — desfazer" fica na tela.
 *
 * Cinco segundos: tempo de ler a frase, perceber o engano e alcançar o botão,
 * sem virar moldura permanente. Abaixo de três, quem desviou o olhar perde a
 * chance; acima de dez, o aviso deixa de ser aviso.
 */
const SEGUNDOS_DO_DESFAZER = 5

const TIPOS: TipoNo[] = [
  'mensagem',
  'midia',
  'pergunta',
  'condicao',
  'salvar-campo',
  'etapa',
  'ir-fluxo',
  'ia',
  'handoff',
  'http',
]

const DESCRICOES: Record<TipoNo, string> = {
  mensagem: 'Envia um texto',
  midia: 'Envia foto ou arquivo',
  pergunta: 'Pergunta e guarda',
  condicao: 'Divide o caminho',
  'salvar-campo': 'Registra no lead',
  etapa: 'Move no quadro',
  'ir-fluxo': 'Continua em outra',
  ia: 'Responde pelo contexto',
  handoff: 'Passa para uma pessoa',
  http: 'Chama um sistema',
}

/**
 * O que viaja no arrasto da barra de blocos até o desenho.
 *
 * Tipo próprio em vez de `text/plain`: qualquer texto arrastado de fora (uma
 * seleção de outra aba, um link) chega como `text/plain` e viraria bloco.
 */
const TIPO_ARRASTADO = 'application/autofluxos-bloco'

/** Como cada bloco nasce ao ser arrastado da barra. */
function dadosPadrao(tipo: TipoNo): Record<string, unknown> {
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
      // desenhou não escolheu — e ninguém revisa o que já veio preenchido.
      return { quadroId: '', colunaId: '' }
    case 'ir-fluxo':
      // Nasce sem destino, pelo mesmo motivo da etapa: chutar a primeira
      // automação da lista mandaria conversa para um desenho que ninguém
      // escolheu, e o que já vem preenchido é o que ninguém revisa.
      return { fluxoId: '', rotulo: '' }
    case 'ia':
      return { instrucao: 'Responda a dúvida do cliente usando o contexto do negócio.' }
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
  }
}

/**
 * Tira do React Flow só o que o motor entende.
 *
 * O React Flow carrega estado de interface junto do nó (`selected`, `dragging`,
 * `measured`). Nada disso pode ir para o banco nem para o motor — o que sai
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
    })),
  })
}

export function Editor({
  fluxoId,
  clienteId,
  conexoes,
  etapas,
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
  podeContratarIa,
  contextoNegocio,
  temContextoDeNegocio,
}: {
  fluxoId: string
  clienteId: string
  conexoes: ConexaoDoCliente[]
  /** As etapas de quadro deste cliente, para o bloco de etapa (C1b). */
  etapas: EtapaDoCliente[]
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
   * Quem está olhando pode **contratar** a IA desta automação?
   *
   * Só a 4YU. Para a conta o contrato é estado, não interruptor — ver o
   * comentário no cabeçalho.
   */
  podeContratarIa: boolean
  /** O que o cliente escreveu sobre o negócio. É o escopo fechado da IA. */
  contextoNegocio: string
  /** Sem contexto escrito, bloco de IA não publica. Ver `contexto/page.tsx`. */
  temContextoDeNegocio: boolean
  /** `quando` já vem formatado do servidor — formatar data no cliente daria
   *  divergência de hidratação entre o fuso do servidor e o do navegador. */
  publicadaInicial: { id: string; versao: number; quando: string; grafo: Fluxo } | null
  /** Histórico completo, da mais nova para a mais antiga. */
  versoesIniciais: VersaoNaLista[]
}) {
  const [nodes, setNodes, aoMudarNos] = useNodesState<Node>(
    inicial.nodes.map((n) => ({ ...n, className: n.id === inicial.inicio ? 'no-inicio' : '' })),
  )
  const [edges, setEdges, aoMudarArestas] = useEdgesState<Edge>(inicial.edges as Edge[])
  const [inicio, setInicio] = useState(inicial.inicio)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  /** Qual bloco a última seleção apontava — ver `onSelectionChange`. */
  const ultimoSelecionado = useRef<string | null>(null)
  const [aba, setAba] = useState<'bloco' | 'testar'>('bloco')
  const [painelAberto, setPainelAberto] = useState(true)
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'pendente' | 'erro'>('salvo')
  const [publicada, setPublicada] = useState(publicadaInicial)
  const [versoes, setVersoes] = useState(versoesIniciais)
  /** Id da versão sendo republicada, para a linha dela mostrar o progresso. */
  const [voltando, setVoltando] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  /** Descarte pedido, esperando confirmação. Ver `descartar()`. */
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const [descartando, setDescartando] = useState(false)
  const [errosDePublicacao, setErrosDePublicacao] = useState<Problema[] | null>(null)
  /** Versão que acabou de ir ao ar. Some sozinha — aviso fixo para de ser lido. */
  const [publicadoAgora, setPublicadoAgora] = useState<number | null>(null)
  /** Rollback recém-feito. O aviso precisa dizer de onde veio, não só o número. */
  const [voltouDe, setVoltouDe] = useState<{ antiga: number; nova: number } | null>(null)
  const [comIa, setComIa] = useState(iaHabilitada)
  const [tela, setTela] = useState<ReactFlowInstance | null>(null)
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
   * fluxo grande dá uns 50 KB em memória, e a alternativa — um passo por tipo
   * de ação — é a estrutura que erra justamente nas combinações raras
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
  /** Marca que a mudança veio do próprio desfazer — ela não vira passo novo. */
  const vindoDoHistorico = useRef(false)
  /** Quando o último passo foi registrado, para juntar a digitação num só. */
  const ultimoPasso = useRef(0)

  const fluxo = useMemo(() => paraFluxo(inicio, nodes, edges), [inicio, nodes, edges])
  const idsDeConexao = useMemo(() => conexoes.map((c) => c.id), [conexoes])
  const validacao = useMemo(
    () =>
      validar(fluxo, {
        iaHabilitada: comIa,
        conexoes: idsDeConexao,
        temContextoDeNegocio,
        fluxos,
        fluxoAtualId: fluxoId,
        variaveisDaConta,
      }),
    [fluxo, comIa, idsDeConexao, temContextoDeNegocio, fluxos, fluxoId, variaveisDaConta],
  )

  const assinatura = JSON.stringify(fluxo)
  const assinaturaSalva = useRef(assinatura)

  /**
   * Registra um passo sempre que o desenho muda.
   *
   * Pendura em `assinatura` — a mesma string que decide salvar e publicar —
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

  // Salva sozinho depois de uma pausa. Rascunho incompleto pode ser salvo —
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
          setSalvamento(congelado === assinatura ? 'salvo' : 'pendente')
        } else {
          setSalvamento('erro')
        }
      } catch {
        setSalvamento('erro')
      }
    }, PAUSA_ANTES_DE_SALVAR)

    return () => clearTimeout(relogio)
  }, [assinatura, clienteId, fluxoId])

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
        // silenciosa — some com a antiga em vez de deixar as duas.
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
    // bloco fora da tela assim que alguém arrastasse o desenho para o lado —
    // aparecia a mensagem "adicionado" e nada na tela.
    const area = areaRef.current?.getBoundingClientRect()
    const centro =
      tela && area
        ? tela.screenToFlowPosition({ x: area.x + area.width / 2, y: area.y + area.height / 2 })
        : { x: 80 + nodes.length * 24, y: 80 + nodes.length * 40 }

    criarNo(tipo, livre(centralizar(centro), nodes))
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

  function mudarDados(dados: Record<string, unknown>) {
    setNodes((atuais) =>
      atuais.map((n) => (n.id === selecionado ? { ...n, data: { ...n.data, ...dados } } : n)),
    )
  }

  /**
   * Apagar um bloco leva as ligações dele junto, e o rascunho é salvo sozinho
   * 800ms depois — sem desfazer, um clique errado custava o trabalho de religar
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
   * então herdar as arestas do original faria a cópia roubar o destino dele —
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
   * Volta um passo — o `Ctrl+Z`.
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

  /** Refaz o que o `Ctrl+Z` desfez — `Ctrl+Shift+Z` ou `Ctrl+Y`. */
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
   * O botão é alcançável por engano — ele fica a poucos pixels do cabeçalho que
   * a pessoa usa para arrastar o bloco — e apagar leva as ligações junto. A
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
   * Apaga uma ligação — e só ela.
   *
   * Sem confirmação, ao contrário do bloco: uma linha some e se refaz
   * arrastando de novo em dois segundos, enquanto um bloco leva o conteúdo
   * escrito junto. Perguntar aqui seria pedágio em cima de um gesto barato.
   */
  function apagarAresta(arestaId: string) {
    setEdges((atuais) => atuais.filter((e) => e.id !== arestaId))
  }

  /**
   * O aviso de "bloco apagado" some sozinho depois de alguns segundos.
   *
   * Ele ficava pendurado até alguém apagar outro bloco ou clicar em Desfazer, e
   * aviso que fica é aviso que para de ser lido — some do campo de atenção e
   * vira parte do layout. O prazo é o do desfazer: passou, a decisão está
   * tomada.
   *
   * O relógio reinicia a cada bloco apagado porque `desfazer` muda de objeto —
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
   * vazio — e `Backspace` num campo vazio é exatamente o que acontece o tempo
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
       * `Ctrl+Z` não fazer **nada** enquanto se escreve — que foi exatamente a
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
      // "voltar" em alguns navegadores — deixar passar seria sair do editor.
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
   * Não republica nada. O que está no ar continua como está — o que muda é só
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
      setEdges(r.grafo.edges as Edge[])
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
      setEdges(r.grafo.edges as Edge[])
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

  const noSelecionado = fluxo.nodes.find((n) => n.id === selecionado) ?? null
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
   * errar uma letra — e errar uma letra não estoura em lugar nenhum: a variável
   * vira vazia e a mensagem sai com um buraco.
   *
   * **Sai do desenho das outras automações, e não de um cadastro à parte.** Um
   * cadastro de variáveis seria uma segunda verdade para manter em dia; esta
   * lista não tem como divergir, porque ela *é* o que os fluxos fazem. O preço é
   * ela só conhecer o que alguém já desenhou — e é o preço certo, porque
   * variável que nenhum bloco preenche não existe mesmo.
   */
  const variaveis = [...new Set([...doDesenho, ...variaveisDaConta])].sort()

  return (
    <div className="app-editor flex h-screen flex-col bg-canvas">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-white/[0.018] px-4">
        <Link
          href={voltarHref}
          title={`Voltar para ${clienteNome}`}
          className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-white/10 text-base text-muted transition hover:border-accent/50 hover:text-accent"
        >
          ‹
        </Link>
        {/*
          O nome do fluxo não corta mais.
          Ele tinha `max-w-56 truncate`, e um nome como "PRINCIPAL - ATENDIMENTO"
          virava "PRINCIPAL - ATEN…" — o mesmo defeito que reclamamos do
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
        <span className="mx-0.5 h-6 w-px bg-white/[0.08]" />
        <EstadoSalvamento estado={salvamento} />
        <span className="mx-0.5 h-6 w-px bg-white/[0.08]" />

        {/*
          O contrato da Etapa 2 desta automação — e **quem** pode mexer nele.

          A pergunta que isto responde não é "o desenho usa IA?": para isso
          basta olhar se existe bloco de IA no quadro. É "esta automação tem o
          plano de IA contratado?", que é decisão comercial da 4YU e o que o
          `validar()` cobra na hora de publicar.

          Era uma caixinha que qualquer pessoa da conta marcava sozinha, e um
          portão que o próprio cliente abre não é portão — era só um passo a
          mais antes de publicar exatamente o mesmo fluxo. Agora quem marca é a
          4YU; para a conta é estado, e aparece do lado dos outros estados.
        */}
        {podeContratarIa ? (
          <label
            title="Etapa 2 (IA) é plano à parte. Sem isto, fluxo com bloco de IA não publica. Só a 4YU marca."
            className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-muted transition hover:bg-white/[0.04]"
          >
            <input
              type="checkbox"
              checked={comIa}
              onChange={async (e) => {
                const novo = e.target.checked
                setComIa(novo)
                try {
                  const r = await acaoAlternarIa(fluxoId, clienteId, novo)
                  if (!r.ok) setComIa(!novo)
                } catch {
                  setComIa(!novo)
                }
              }}
              className="size-3.5 accent-violet-400"
            />
            IA contratada
          </label>
        ) : (
          comIa && (
            <span
              title="Esta automação tem o plano de IA (Etapa 2). Para mudar, fale com a 4YU."
              className="shrink-0 rounded-full border border-violet-400/25 bg-violet-400/[0.09] px-3 py-1 text-xs text-violet-200"
            >
              IA contratada
            </span>
          )
        )}

        {/*
          Estado à esquerda, ação à direita.
          Os dois selos moravam colados no "Publicar", entre o "Compartilhar" e
          ele — e ali eles pareciam botão. São informação: dizem em que pé o
          desenho está, que é a mesma matéria do "salvo" e do "com IA" logo ao
          lado. A direita ficou só com o que se clica.
        */}
        {publicada ? (
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${haNovidade ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-200' : 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'}`}
          >
            {haNovidade ? 'Desenho difere do publicado' : `No ar · v${publicada.versao}`}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-dashed border-white/[0.15] px-3 py-1 text-xs text-muted">
            Nunca publicado
          </span>
        )}

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
            className="shrink-0 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-300 transition hover:bg-rose-400/20"
          >
            {validacao.erros.length} impedimento(s)
          </button>
        )}

        <span className="flex-1" />

        <Versoes
          versoes={versoes}
          publicadaId={publicada?.id ?? null}
          voltando={voltando}
          aoVoltar={voltarParaVersao}
        />

        {/* Ao lado do histórico porque é a mesma matéria: as duas falam de
            versões publicadas, e o link aponta para a que está no ar. */}
        <Compartilhar
          clienteId={clienteId}
          fluxoId={fluxoId}
          publicada={publicada ? { versao: publicada.versao, grafo: publicada.grafo } : null}
        />

        {/*
          Só aparece quando **há o que descartar e para onde voltar**: desenho
          diferente do publicado, e um publicado existindo. Botão que fica
          sempre na tela e quase nunca pode agir vira ruído — e este, podendo
          jogar trabalho fora, seria ruído perigoso.
        */}
        {publicada && haNovidade && (
          <button
            type="button"
            onClick={() => setConfirmandoDescarte(true)}
            title="Joga fora as alterações não publicadas e volta ao desenho que está no ar"
            className="rounded-lg border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-muted transition hover:border-amber-300/40 hover:text-amber-200"
          >
            Descartar
          </button>
        )}

        <button
          type="button"
          onClick={() => setAba('testar')}
          title="Conversar com este desenho sem sair do editor"
          className={`rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold transition ${
            aba === 'testar'
              ? 'border-accent/50 bg-accent/[0.12] text-accent'
              : 'border-white/10 text-muted hover:border-accent/40 hover:text-accent'
          }`}
        >
          Testar
        </button>

        <button
          onClick={publicarAgora}
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
          {publicando ? 'publicando…' : 'Publicar'}
        </button>
      </header>

      {errosDePublicacao && (
        <div className="shrink-0 border-b border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs text-rose-300">
          <strong>Não publicou.</strong>{' '}
          {errosDePublicacao.map((e) => e.mensagem).join(' ')}
        </div>
      )}

      {publicadoAgora !== null && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-emerald-400/25 bg-emerald-400/[0.09] px-4 py-2 text-xs text-emerald-300"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <span className="flex-1">
            <strong>No ar.</strong> A versão {publicadoAgora} passa a atender as conversas novas
            deste número — quem já estava conversando termina na versão em que começou.
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
          className="flex shrink-0 items-center gap-2 border-b border-emerald-400/25 bg-emerald-400/[0.09] px-4 py-2 text-xs text-emerald-300"
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

      <div className="flex min-h-0 flex-1">
        <nav className="w-[232px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-white/[0.012] px-3 py-3.5">
          <p className="mb-2.5 px-2 text-[10.5px] font-bold tracking-[0.08em] text-dim uppercase">
            Blocos
          </p>
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              onClick={() => adicionar(tipo)}
              draggable
              onDragStart={(evento) => {
                evento.dataTransfer.setData(TIPO_ARRASTADO, tipo)
                evento.dataTransfer.effectAllowed = 'copy'
              }}
              className="mb-1 flex w-full cursor-grab items-start gap-3 rounded-[11px] border border-transparent p-2.5 text-left transition select-none hover:border-white/[0.07] hover:bg-white/[0.04] active:cursor-grabbing"
            >
              <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] text-[15px] text-accent">
                {ICONES[tipo]}
              </span>
              <span className="min-w-0">
                <strong className="block text-[13.5px] font-bold">{NOMES[tipo]}</strong>
                <span className="mt-0.5 block text-[11px] leading-[1.35] text-dim">{DESCRICOES[tipo]}</span>
              </span>
            </button>
          ))}
        </nav>

        <div
          ref={areaRef}
          className="relative min-w-0 flex-1"
          onDrop={soltar}
          // Sem cancelar o `dragover`, o navegador recusa o soltar e o gesto
          // termina com a animação de "voltou para o lugar".
          onDragOver={(evento) => {
            evento.preventDefault()
            evento.dataTransfer.dropEffect = 'copy'
          }}
        >
          <AcaoDaArestaProvider value={apagarAresta}>
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
            onNodeDragStart={() => setMenu(null)}
            onMoveStart={() => setMenu(null)}
            // Todo grafo já salvo tem aresta sem `type`; o padrão faz as antigas
            // ganharem o ✕ sem precisar migrar nada no banco.
            defaultEdgeOptions={{ type: 'removivel' }}
            onSelectionChange={({ nodes: sel }) => {
              const id = sel[0]?.id ?? null
              setSelecionado(id)
              // Trocar de bloco leva para a aba "Bloco", porque é o que a
              // pessoa quer ver ao clicar num bloco diferente.
              //
              // **Só quando o bloco muda de verdade.** O React Flow redispara
              // este evento com a mesma seleção a cada render, inclusive no
              // render causado por clicar na aba "Testar" — e aí o `setAba`
              // daqui roda no mesmo lote e vence o do clique. O efeito para
              // quem usa: com um bloco selecionado (que é o estado normal de
              // quem está desenhando) a aba "Testar" simplesmente não abre,
              // sem nem piscar. Parecia botão quebrado.
              if (id && id !== ultimoSelecionado.current) setAba('bloco')
              ultimoSelecionado.current = id
            }}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} size={1} color="rgba(255,255,255,.08)" />
            <Controls position="bottom-right" />
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              nodeColor="#334155"
              maskColor="rgba(7,10,14,.72)"
              className="!h-24 !w-[150px]"
            />
          </ReactFlow>
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

          São 356px fixos ao lado do desenho, e num fluxo grande — o caso em que
          o desenho é justamente o que se precisa ver — eles custam caro. O
          pedido veio como "um x pra fechar, ou um - pra minimizar", e minimizar
          é o certo: fechado de vez, não haveria como voltar sem adivinhar.

          Recolhido, sobra uma coluna com os dois nomes de aba em pé. Clicar em
          qualquer um dos dois reabre já naquela aba, então recolher nunca custa
          um clique a mais do que deveria.
        */}
        {!painelAberto ? (
          <aside className="flex w-[42px] shrink-0 flex-col items-center gap-2 border-l border-white/[0.06] bg-white/[0.014] py-2.5">
            <button
              onClick={() => setPainelAberto(true)}
              title="Abrir o painel"
              aria-label="Abrir o painel"
              className="flex size-[30px] items-center justify-center rounded-lg border border-white/10 text-base text-muted transition hover:border-accent/50 hover:text-accent"
            >
              ‹
            </button>
            {(['bloco', 'testar'] as const).map((chave) => (
              <button
                key={chave}
                onClick={() => {
                  setAba(chave)
                  setPainelAberto(true)
                }}
                className={`rounded-lg px-1 py-3 text-[10.5px] font-bold [writing-mode:vertical-rl] transition ${
                  aba === chave ? 'text-white' : 'text-muted hover:text-white'
                }`}
              >
                {chave === 'bloco' ? 'Bloco' : 'Testar'}
              </button>
            ))}
          </aside>
        ) : (
        <aside className="flex w-[356px] shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.014]">
          <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-3 pt-2.5 text-xs">
            {(['bloco', 'testar'] as const).map((chave) => (
              <button
                key={chave}
                onClick={() => setAba(chave)}
                className={`rounded-t-lg border-b-2 px-4 py-2.5 font-bold transition ${
                  aba === chave
                    ? 'border-accent text-white'
                    : 'border-transparent text-muted hover:text-white'
                }`}
              >
                {chave === 'bloco' ? 'Bloco' : 'Testar'}
              </button>
            ))}
            <button
              onClick={() => setPainelAberto(false)}
              title="Recolher o painel e ver o desenho inteiro"
              aria-label="Recolher o painel"
              className="mb-1 ml-auto rounded-lg px-2 py-1 text-[13px] leading-4 text-dim transition hover:bg-white/[0.07] hover:text-ink"
            >
              −
            </button>
          </div>

          {aba === 'bloco' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {desfazer && (
                <div className="flex items-center gap-2 border-b border-amber-300/20 bg-amber-300/[0.07] px-3.5 py-2.5 text-[11.5px] text-amber-200">
                  <span className="min-w-0 flex-1">
                    Bloco apagado
                    {desfazer.edges.length > 0 && ` — e ${desfazer.edges.length} ligação(ões) com ele`}.
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
                valoresDeVariaveis={valoresDeVariaveis}
                conexoes={conexoes}
                etapas={etapas}
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
                achar o campo, e passa a ignorar a lista — aviso que aparece
                sempre para de ser lido. Sem bloco escolhido, o painel não tem
                mais nada a dizer, e aí a lista é exatamente o que se quer ver.
                Durante a edição, quem chama por elas é o selo de impedimentos
                no cabeçalho, que leva direto ao bloco culpado.
              */}
              {!selecionado && !validacao.ok && (
                <div className="border-t border-white/[0.06] p-4">
                  <p className="mb-2 text-[11px] font-bold tracking-[0.04em] text-soft uppercase">
                    Impede de publicar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.erros.map((erro, i) => (
                      <li key={i}>
                        <button
                          onClick={() => erro.noId && focar(erro.noId)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-4 text-rose-300 transition hover:bg-rose-400/[0.07]"
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
                <div className="border-t border-white/[0.06] p-4">
                  <p className="mb-2 text-[11px] font-bold tracking-[0.04em] text-soft uppercase">
                    Vale olhar
                  </p>
                  <ul className="space-y-1.5">
                    {validacao.avisos.map((aviso, i) => (
                      <li key={i}>
                        <button
                          onClick={() => aviso.noId && focar(aviso.noId)}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] leading-4 text-amber-200 transition hover:bg-amber-300/[0.07]"
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
        descricao={`O desenho volta a ser a versão ${publicada?.versao ?? ''} — a que está no ar agora. O que está publicado não muda: quem está conversando no WhatsApp não sente nada.`}
      >
        <p className="mb-4 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] leading-5 text-muted">
          Dá para voltar atrás com <strong className="text-soft">Ctrl+Z</strong> logo depois — o
          descarte entra no histórico de desfazer como qualquer outra mudança.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={() => setConfirmandoDescarte(false)}
            className="rounded-lg border border-white/10 px-3.5 py-2 text-[12px] font-semibold text-muted transition hover:border-white/25 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={descartando}
            onClick={descartar}
            className="rounded-lg border border-amber-300/40 bg-amber-300/[0.12] px-3.5 py-2 text-[12px] font-bold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-50"
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
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] text-soft transition hover:bg-white/[0.07] hover:text-white'

  return (
    <div
      style={{
        left: menu.x,
        top: menu.y,
        transform: `translate(${menu.paraEsquerda ? '-100%' : '0'}, ${menu.paraCima ? '-100%' : '0'})`,
      }}
      className="absolute z-20 w-[176px] rounded-[12px] border border-white/10 bg-panel p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
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
          <div className="my-1 h-px bg-white/[0.07]" />
          <button
            type="button"
            onClick={aoApagar}
            className={`${item} text-rose-300 hover:bg-rose-400/[0.12] hover:text-rose-200`}
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
          className={`${item} text-rose-300 hover:bg-rose-400/[0.12] hover:text-rose-200`}
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
        <p className="mb-4 rounded-[10px] border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[12px] leading-5 text-amber-200">
          Este é o bloco de <strong>início</strong>. Sem ele, o fluxo não publica até você escolher
          outro.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={aoFechar}
          className="rounded-lg border border-white/10 px-3.5 py-2 text-[12px] font-semibold text-muted transition hover:border-white/25 hover:text-white"
        >
          Cancelar
        </button>
        {/* O foco começa no "Cancelar": `Enter` logo depois de abrir é reflexo
            comum, e não pode ser o que apaga o bloco. */}
        <button
          type="button"
          onClick={aoConfirmar}
          className="rounded-lg border border-rose-400/40 bg-rose-400/[0.12] px-3.5 py-2 text-[12px] font-bold text-rose-300 transition hover:bg-rose-400/20"
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
 * 200px. E bloco coberto não é só feio — ele fica inclicável, então o de baixo
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
  // quinto bloco o teto estoura — voltando a empilhar exatamente no caso em que
  // esta função existe para ajudar. Descendo uma altura por vez, cada degrau
  // vence um bloco, e o teto vira o que ele deveria ser: inalcançável na
  // prática.
  for (let i = 0; i < 20 && existentes.some((n) => sobrepoe(n.position, alvo)); i++) {
    alvo = { x: alvo.x, y: alvo.y + ALTURA_NO + 20 }
  }
  return alvo
}

function EstadoSalvamento({ estado }: { estado: 'salvo' | 'salvando' | 'pendente' | 'erro' }) {
  const texto = {
    salvo: 'salvo',
    salvando: 'salvando…',
    pendente: 'alterações não salvas',
    erro: 'não deu para salvar',
  }[estado]

  return (
    <span className={`flex items-center gap-2 text-xs ${estado === 'erro' ? 'text-rose-300' : 'text-muted'}`}>
      <span
        className={`size-1.5 rounded-full ${
          estado === 'erro'
            ? 'bg-rose-400'
            : estado === 'salvo'
              ? 'bg-emerald-400'
              : estado === 'salvando'
                ? 'animate-pulse bg-accent'
                : 'bg-amber-300'
        }`}
      />
      {texto}
    </span>
  )
}

/**
 * As variáveis do fluxo — **e quem guarda cada uma**.
 *
 * A origem não é enfeite: o painel precisa saber se um nome já é guardado por
 * *outro* bloco para dizer "isso reaproveita a variável de lá" em vez de
 * deixar nascer um `agendar_aula2` calado. Sem o dono, o próprio bloco
 * apareceria como se estivesse repetindo a si mesmo.
 */
export function variaveisDoFluxo(fluxo: Fluxo): {
  nomes: string[]
  origens: Record<string, string[]>
  valores: Record<string, string[]>
} {
  const origens: Record<string, string[]> = {}
  const valores: Record<string, string[]> = {}
  const anotar = (nome: string, noId: string) => {
    ;(origens[nome] ??= []).push(noId)
  }

  for (const no of fluxo.nodes as No[]) {
    if (no.type === 'pergunta' && no.data.salvarEm) {
      anotar(no.data.salvarEm, no.id)
      // Pergunta com opções desenhadas guarda **o rótulo do botão clicado**.
      // São os únicos valores que aquela variável pode ter, e é por isso que a
      // condição sobre ela não precisa ser digitada de cabeça: um "Agendar
      // Aula" escrito diferente do botão manda todo mundo pelo ramo errado, e
      // nada estoura — a conversa segue, segue pelo lado errado.
      for (const opcao of no.data.opcoes) {
        const lista = (valores[no.data.salvarEm] ??= [])
        if (opcao.rotulo !== '' && !lista.includes(opcao.rotulo)) lista.push(opcao.rotulo)
      }
    }
    // O valor da opção escolhida também é variável — e é justamente a que o
    // bloco seguinte usa para chamar a API. Sem isto, `{{sessao_id}}` não
    // apareceria na lista e quem desenha acharia que precisa digitar de cabeça.
    if (no.type === 'pergunta' && no.data.salvarValorEm) anotar(no.data.salvarValorEm, no.id)
    if (no.type === 'salvar-campo' && no.data.campo) anotar(no.data.campo, no.id)
    if (no.type === 'ia' && no.data.salvarEm) anotar(no.data.salvarEm, no.id)
    // O que a API guarda também é variável do fluxo. Sem isto, o painel não
    // mostra `{{cidade}}` como disponível e quem desenha acha que não existe.
    if (no.type === 'http')
      for (const m of no.data.mapear) if (m.variavel) anotar(m.variavel, no.id)
  }

  return { nomes: Object.keys(origens).sort(), origens, valores }
}
