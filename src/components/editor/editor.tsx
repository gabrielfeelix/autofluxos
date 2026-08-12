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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Conversa } from '@/components/conversa'
import type { Sessao } from '@/core/engine/types'
import { fluxoSchema, type Fluxo, type No, type TipoNo } from '@/core/flow/schema'
import type { Problema } from '@/core/flow/validar'
import { validar } from '@/core/flow/validar'
import { acaoAlternarIa, acaoPublicar, acaoSalvarRascunho } from '@/server/acoes'
import { ICONES, NOMES, tiposDeNo } from './nos'
import { Painel } from './painel'
import type { ConexaoDoCliente } from './painel'

const PAUSA_ANTES_DE_SALVAR = 800

const TIPOS: TipoNo[] = ['mensagem', 'pergunta', 'condicao', 'salvar-campo', 'ia', 'handoff', 'http']

const DESCRICOES: Record<TipoNo, string> = {
  mensagem: 'Envia um texto',
  pergunta: 'Pergunta e guarda',
  condicao: 'Divide o caminho',
  'salvar-campo': 'Registra no lead',
  ia: 'Responde pelo contexto',
  handoff: 'Passa para uma pessoa',
  http: 'Chama um sistema',
}

/** Como cada bloco nasce ao ser arrastado da barra. */
function dadosPadrao(tipo: TipoNo): Record<string, unknown> {
  switch (tipo) {
    case 'mensagem':
      return { texto: 'Escreva a mensagem aqui.' }
    case 'pergunta':
      return { texto: 'O que você quer perguntar?', opcoes: [] }
    case 'condicao':
      return { variavel: 'assunto', operador: 'igual', valor: '' }
    case 'salvar-campo':
      return { campo: 'campo', valor: '' }
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
  nome,
  clienteNome,
  voltarHref,
  inicial,
  publicadaInicial,
  iaHabilitada,
  contextoNegocio,
}: {
  fluxoId: string
  clienteId: string
  conexoes: ConexaoDoCliente[]
  nome: string
  clienteNome: string
  voltarHref: string
  inicial: Fluxo
  /** Etapa 2 é plano à parte: sem contratar, fluxo com nó de IA não publica. */
  iaHabilitada: boolean
  /** O que o cliente escreveu sobre o negócio. É o escopo fechado da IA. */
  contextoNegocio: string
  /** `quando` já vem formatado do servidor — formatar data no cliente daria
   *  divergência de hidratação entre o fuso do servidor e o do navegador. */
  publicadaInicial: { versao: number; quando: string; grafo: Fluxo } | null
}) {
  const [nodes, setNodes, aoMudarNos] = useNodesState<Node>(
    inicial.nodes.map((n) => ({ ...n, className: n.id === inicial.inicio ? 'no-inicio' : '' })),
  )
  const [edges, setEdges, aoMudarArestas] = useEdgesState<Edge>(inicial.edges as Edge[])
  const [inicio, setInicio] = useState(inicial.inicio)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [aba, setAba] = useState<'bloco' | 'testar'>('bloco')
  const [salvamento, setSalvamento] = useState<'salvo' | 'salvando' | 'pendente' | 'erro'>('salvo')
  const [sessao, setSessao] = useState<Sessao | null>(null)
  const [publicada, setPublicada] = useState(publicadaInicial)
  const [publicando, setPublicando] = useState(false)
  const [errosDePublicacao, setErrosDePublicacao] = useState<Problema[] | null>(null)
  const [comIa, setComIa] = useState(iaHabilitada)
  const [tela, setTela] = useState<ReactFlowInstance | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  const fluxo = useMemo(() => paraFluxo(inicio, nodes, edges), [inicio, nodes, edges])
  const idsDeConexao = useMemo(() => conexoes.map((c) => c.id), [conexoes])
  const validacao = useMemo(
    () => validar(fluxo, { iaHabilitada: comIa, conexoes: idsDeConexao }),
    [fluxo, comIa, idsDeConexao],
  )

  const assinatura = JSON.stringify(fluxo)
  const assinaturaSalva = useRef(assinatura)

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
        const r = await acaoSalvarRascunho(fluxoId, JSON.parse(congelado))
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
  }, [assinatura, fluxoId])

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

  function adicionar(tipo: TipoNo) {
    const id = crypto.randomUUID().slice(0, 8)

    // Nasce no meio de onde a pessoa está olhando. Posição fixa colocava o
    // bloco fora da tela assim que alguém arrastasse o desenho para o lado —
    // aparecia a mensagem "adicionado" e nada na tela.
    const area = areaRef.current?.getBoundingClientRect()
    const centro =
      tela && area
        ? tela.screenToFlowPosition({ x: area.x + area.width / 2, y: area.y + area.height / 2 })
        : { x: 80 + nodes.length * 24, y: 80 + nodes.length * 40 }

    setNodes((atuais) => [
      ...atuais.map((n) => ({ ...n, selected: false })),
      {
        id,
        type: tipo,
        // Menos metade do bloco, senão ele nasce com o canto no centro em vez
        // do meio. A largura é a do `Caixa` em `nos.tsx` (w-56 = 224px).
        position: { x: centro.x - 112, y: centro.y - 40 },
        data: dadosPadrao(tipo),
        selected: true,
      },
    ])
    setSelecionado(id)
    setAba('bloco')
  }

  function mudarDados(dados: Record<string, unknown>) {
    setNodes((atuais) =>
      atuais.map((n) => (n.id === selecionado ? { ...n, data: { ...n.data, ...dados } } : n)),
    )
  }

  function apagar() {
    if (!selecionado) return
    setNodes((atuais) => atuais.filter((n) => n.id !== selecionado))
    setEdges((atuais) => atuais.filter((e) => e.source !== selecionado && e.target !== selecionado))
    setSelecionado(null)
  }

  async function publicarAgora() {
    setPublicando(true)
    setErrosDePublicacao(null)
    try {
      const r = await acaoPublicar(fluxoId, clienteId, JSON.parse(assinatura))
      if (r.ok) {
        assinaturaSalva.current = assinatura
        setSalvamento('salvo')
        setPublicada({ versao: r.versao, quando: 'agora', grafo: JSON.parse(assinatura) })
      } else {
        setErrosDePublicacao(r.erros)
      }
    } catch {
      setErrosDePublicacao([{ codigo: 'FALHA', mensagem: 'Não deu para publicar. Tente de novo.' }])
    } finally {
      setPublicando(false)
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
  const variaveis = variaveisDoFluxo(fluxo)

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-white/[0.018] px-4">
        <Link
          href={voltarHref}
          title={`Voltar para ${clienteNome}`}
          className="flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-white/10 text-base text-muted transition hover:border-accent/50 hover:text-accent"
        >
          ‹
        </Link>
        <div className="min-w-0">
          <h1 className="max-w-56 truncate text-sm font-bold tracking-[-0.01em]">{nome}</h1>
          <p className="text-[10.5px] text-dim">{clienteNome}</p>
        </div>
        <span className="mx-0.5 h-6 w-px bg-white/[0.08]" />
        <EstadoSalvamento estado={salvamento} />
        <span className="mx-0.5 h-6 w-px bg-white/[0.08]" />

        <div className="flex items-center gap-3 text-xs">
          {/* O plano da automação, no lugar onde ela é editada. Mudar aqui não
              republica nada: só muda o que a próxima publicação aceita. */}
          <label
            title="IA é plano à parte. Sem isto, fluxo com bloco de IA não publica."
            className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-muted transition hover:bg-white/[0.04]"
          >
            <input
              type="checkbox"
              checked={comIa}
              onChange={async (e) => {
                const novo = e.target.checked
                setComIa(novo)
                try {
                  await acaoAlternarIa(fluxoId, clienteId, novo)
                } catch {
                  setComIa(!novo)
                }
              }}
              className="size-3.5 accent-violet-400"
            />
            com IA
          </label>
        </div>
        <span className="flex-1" />

        {publicada ? (
          <span className={`rounded-full border px-3 py-1 text-xs ${haNovidade ? 'border-amber-300/25 bg-amber-300/[0.08] text-amber-200' : 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'}`}>
            {haNovidade ? 'Desenho difere do publicado' : `No ar · v${publicada.versao}`}
          </span>
        ) : (
          <span className="rounded-full border border-dashed border-white/[0.15] px-3 py-1 text-xs text-muted">Nunca publicado</span>
        )}

        {!validacao.ok && (
          <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-300">
            {validacao.erros.length} impedimento(s)
          </span>
        )}

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

      <div className="flex min-h-0 flex-1">
        <nav className="w-[198px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-white/[0.012] px-2.5 py-3.5">
          <p className="mb-2.5 px-2 text-[10.5px] font-bold tracking-[0.08em] text-dim uppercase">
            Blocos
          </p>
          {TIPOS.map((tipo) => (
            <button
              key={tipo}
              onClick={() => adicionar(tipo)}
              className="mb-0.5 flex w-full items-start gap-2.5 rounded-[11px] border border-transparent p-2 text-left transition hover:border-white/[0.07] hover:bg-white/[0.04]"
            >
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-white/[0.08] bg-white/[0.045] text-sm text-accent">
                {ICONES[tipo]}
              </span>
              <span className="min-w-0">
                <strong className="block text-[12.5px] font-bold">{NOMES[tipo]}</strong>
                <span className="mt-0.5 block text-[10.5px] leading-[1.35] text-dim">{DESCRICOES[tipo]}</span>
              </span>
            </button>
          ))}
          <p className="mt-3.5 border-t border-white/[0.06] px-2 pt-3 text-[10.5px] leading-4 text-dim">
            Toque para adicionar. Arraste de uma alça até outro bloco para ligar.
          </p>
        </nav>

        <div ref={areaRef} className="min-w-0 flex-1">
          <ReactFlow
            onInit={setTela}
            nodes={nodes}
            edges={edges}
            onNodesChange={aoMudarNos}
            onEdgesChange={aoMudarArestas}
            onConnect={aoConectar}
            nodeTypes={tiposDeNo}
            onSelectionChange={({ nodes: sel }) => {
              const id = sel[0]?.id ?? null
              setSelecionado(id)
              if (id) setAba('bloco')
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
        </div>

        <aside className="flex w-[356px] shrink-0 flex-col border-l border-white/[0.06] bg-white/[0.014]">
          <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-3 pt-2.5 text-xs">
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
          </div>

          {aba === 'bloco' ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Painel
                no={noSelecionado}
                ehInicio={selecionado === inicio}
                variaveis={variaveis}
                conexoes={conexoes}
                aoMudarDados={mudarDados}
                aoDefinirInicio={definirInicio}
                aoApagar={apagar}
              />

              {!validacao.ok && (
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

              {validacao.avisos.length > 0 && (
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
                contextoNegocio={contextoNegocio}
                iaHabilitada={comIa}
                aoMudarSessao={setSessao}
              />
              {sessao && (
                <div className="shrink-0 border-t border-white/[0.06] p-3 text-[11px]">
                  <p className="text-dim">
                    bloco atual: <code>{sessao.noAtual ?? '—'}</code> · {sessao.status}
                  </p>
                  {Object.keys(sessao.vars).length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(sessao.vars).map(([k, v]) => (
                        <span key={k} className="rounded-md border border-white/[0.08] bg-white/[0.045] px-2 py-1 font-mono text-[10px] text-muted">
                          {k}: {v}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  )
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

function variaveisDoFluxo(fluxo: Fluxo): string[] {
  const nomes = new Set<string>()
  for (const no of fluxo.nodes as No[]) {
    if (no.type === 'pergunta' && no.data.salvarEm) nomes.add(no.data.salvarEm)
    if (no.type === 'salvar-campo' && no.data.campo) nomes.add(no.data.campo)
    if (no.type === 'ia' && no.data.salvarEm) nomes.add(no.data.salvarEm)
    // O que a API guarda também é variável do fluxo. Sem isto, o painel não
    // mostra `{{cidade}}` como disponível e quem desenha acha que não existe.
    if (no.type === 'http') for (const m of no.data.mapear) if (m.variavel) nomes.add(m.variavel)
  }
  return [...nomes].sort()
}
